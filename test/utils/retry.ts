/**
 * Retry utility with exponential backoff for integration tests
 * Handles network hiccups and transient failures gracefully
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  exponentialBase?: number;
  retryableErrors?: string[];
}

export interface RetryResult<T> {
  result: T;
  attempts: number;
  warnings: string[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  exponentialBase: 2,
  retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'EHOSTUNREACH']
};

/**
 * Determines if an error should trigger a retry
 */
function isRetryableError(error: any, retryableErrors: string[]): boolean {
  if (!error) return false;
  
  // Check for Axios timeout errors
  if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
    return true;
  }
  
  // Check for network-related errors
  if (error.code && retryableErrors.includes(error.code)) {
    return true;
  }
  
  // Check for Axios errors with network issues
  if (error.response?.status >= 500) {
    return true;
  }
  
  // Check for cause chain (nested errors)
  if (error.cause) {
    return isRetryableError(error.cause, retryableErrors);
  }
  
  return false;
}

/**
 * Calculates delay for next retry attempt using exponential backoff
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const delay = options.baseDelayMs * Math.pow(options.exponentialBase, attempt - 1);
  return Math.min(delay, options.maxDelayMs);
}

/**
 * Retry function with exponential backoff and warning collection
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  userOptions: RetryOptions = {}
): Promise<RetryResult<T>> {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };
  const warnings: string[] = [];
  let lastError: any;
  
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      const result = await operation();
      
      // If we succeeded but had previous failures, add a warning
      if (attempt > 1) {
        warnings.push(
          `Operation succeeded on attempt ${attempt}/${options.maxAttempts} after ${attempt - 1} retries due to network issues`
        );
      }
      
      return { result, attempts: attempt, warnings };
    } catch (error) {
      lastError = error;
      
      // If this is the last attempt, don't retry
      if (attempt === options.maxAttempts) {
        break;
      }
      
      // Check if the error is retryable
      if (!isRetryableError(error, options.retryableErrors)) {
        // Non-retryable error, fail immediately
        throw error;
      }
      
      // Log the retry attempt
      const errorInfo = (error as any)?.code || (error as any)?.message || 'Unknown error';
      warnings.push(
        `Attempt ${attempt}/${options.maxAttempts} failed (${errorInfo}), retrying in ${calculateDelay(attempt, options)}ms...`
      );
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, calculateDelay(attempt, options)));
    }
  }
  
  // All attempts failed
  throw lastError;
}

/**
 * Jest test wrapper that adds retry logic and warning handling
 */
export function withRetryTest(
  testName: string,
  testFn: () => Promise<void>,
  retryOptions?: RetryOptions
) {
  return it(testName, async () => {
    try {
      const { warnings } = await withRetry(testFn, retryOptions);
      
      // Log warnings if any retries occurred
      if (warnings.length > 0) {
        console.warn(`\n⚠️  Test "${testName}" succeeded with warnings:`);
        warnings.forEach(warning => console.warn(`   ${warning}`));
      }
    } catch (error) {
      // Add context to the error for better debugging
      if (error && typeof error === 'object' && 'message' in error) {
        (error as any).message = `Test "${testName}" failed after retries: ${(error as any).message}`;
      }
      throw error;
    }
  });
}
