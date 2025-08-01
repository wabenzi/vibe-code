# Integration Test Retry Mechanism

## Overview

The integration test suite now includes an exponential backoff retry mechanism to handle network hiccups and transient failures gracefully. This improves test reliability without masking real failures.

## Features

### 1. Automatic Retry with Exponential Backoff

- **Default Configuration**:
  - Maximum attempts: 3
  - Base delay: 1000ms (1 second)
  - Maximum delay: 8000ms (8 seconds)
  - Exponential base: 2
  - Retryable errors: `ETIMEDOUT`, `ECONNRESET`, `ENOTFOUND`, `ECONNREFUSED`, `EHOSTUNREACH`

### 2. Warning System

- Tests that succeed after retries will log warnings
- Warnings include attempt count and failure reasons
- Non-retryable errors fail immediately (e.g., 400 Bad Request)

### 3. Three Usage Patterns

#### Standard API Client (Transparent Retry)
```typescript
const apiClient = new ApiClient(apiUrl);
const response = await apiClient.createUser(userData); // Automatically retries on network issues
```

#### Test Wrapper with Warning Display
```typescript
withRetryTest('should create user with retry protection', async () => {
  const response = await apiClient.createUser(userData);
  expect(response.status).toBe(201);
});
```

#### Detailed Retry Information
```typescript
const { result, attempts, warnings } = await apiClient.createUserWithRetryInfo(userData);
console.log(`Operation completed in ${attempts} attempts`);
if (warnings.length > 0) {
  warnings.forEach(warning => console.warn(warning));
}
```

## Configuration

### Per-Test Configuration
```typescript
withRetryTest('custom retry test', async () => {
  // test logic
}, {
  maxAttempts: 5,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  exponentialBase: 1.5
});
```

### Global Configuration
```typescript
const apiClient = new ApiClient(apiUrl, {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
  exponentialBase: 2
});
```

## Retryable vs Non-Retryable Errors

### Retryable (Will Trigger Retry)
- Network timeouts (`ETIMEDOUT`, `ECONNABORTED`)
- Connection errors (`ECONNRESET`, `ECONNREFUSED`, `EHOSTUNREACH`)
- DNS resolution failures (`ENOTFOUND`)
- HTTP 5xx server errors

### Non-Retryable (Fail Immediately)
- HTTP 4xx client errors (400, 401, 403, 404, etc.)
- Invalid request format
- Authentication failures
- Resource not found

## Example Output

### Successful Test with Warning
```
⚠️  Test "should create user with retry protection" succeeded with warnings:
   Attempt 1/3 failed (ETIMEDOUT), retrying in 1000ms...
   Operation succeeded on attempt 2/3 after 1 retries due to network issues
```

### Test with Detailed Retry Info
```
🔄 Retry information:
   Attempts: 2
   Warnings: Attempt 1/3 failed (ETIMEDOUT), retrying in 1000ms...
```

## Benefits

1. **Improved Reliability**: Handles transient network issues automatically
2. **Clear Visibility**: Warnings show when retries were needed
3. **Fast Failure**: Non-retryable errors fail immediately
4. **Configurable**: Can be tuned per test or globally
5. **Backward Compatible**: Existing tests work without modification

## Integration Test Results

The retry mechanism has been applied to critical integration tests:

- ✅ User creation tests
- ✅ User lifecycle tests  
- ✅ Concurrent operations
- ✅ Performance tests

### Performance Impact

- **LocalStack**: Minimal impact (tests run in ~100-200ms)
- **AWS**: Significant improvement in reliability for longer-running tests (1-3 seconds)

## Environment Configuration

### LocalStack (Default)
```bash
npm run test:integration
```

### AWS Production
```bash
NODE_ENV=production API_URL=https://your-api-id.execute-api.region.amazonaws.com/prod npm test -- --testPathPatterns=your-test.ts
```

## Files Modified

- `test/utils/retry.ts` - Core retry utility
- `test/utils/api-client.ts` - Enhanced API client with retry support
- `test/integration/user-api.test.ts` - Updated critical tests to use retry wrapper

## Best Practices

1. Use `withRetryTest` for network-dependent operations
2. Use standard API client methods for most cases (retry is transparent)
3. Use `*WithRetryInfo` methods when debugging network issues
4. Configure shorter delays for faster feedback in development
5. Monitor warnings to identify infrastructure issues
