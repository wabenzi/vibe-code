import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { withRetry, RetryOptions } from './retry';

export interface CreateUserRequest {
  id: string;
  name: string;
}

export interface UserResponse {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ErrorResponse {
  error: string;
  message?: string;
}

export class ApiClient {
  private client: AxiosInstance;
  private retryOptions: RetryOptions;
  
  constructor(baseURL: string, retryOptions?: RetryOptions) {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      // Disable SSL verification for LocalStack
      httpsAgent: process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' ? undefined : 
        new (require('https').Agent)({ rejectUnauthorized: false })
    });

    // Default retry options for integration tests
    this.retryOptions = {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 8000,
      exponentialBase: 2,
      ...retryOptions
    };
  }
  
  async createUser(userData: CreateUserRequest): Promise<AxiosResponse<UserResponse>> {
    const { result } = await withRetry(
      () => this.client.post('/users', userData),
      this.retryOptions
    );
    return result;
  }
  
  async getUser(id: string): Promise<AxiosResponse<UserResponse>> {
    const { result } = await withRetry(
      () => this.client.get(`/users/${id}`),
      this.retryOptions
    );
    return result;
  }
  
  async deleteUser(id: string): Promise<AxiosResponse<void>> {
    const { result } = await withRetry(
      () => this.client.delete(`/users/${id}`),
      this.retryOptions
    );
    return result;
  }
  
  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const { result } = await withRetry(
        () => this.client.get('/health'),
        this.retryOptions
      );
      return true;
    } catch {
      return false;
    }
  }

  // Method to perform operations with retry info for debugging
  async createUserWithRetryInfo(userData: CreateUserRequest) {
    return await withRetry(
      () => this.client.post('/users', userData),
      this.retryOptions
    );
  }

  async getUserWithRetryInfo(id: string) {
    return await withRetry(
      () => this.client.get(`/users/${id}`),
      this.retryOptions
    );
  }

  async deleteUserWithRetryInfo(id: string) {
    return await withRetry(
      () => this.client.delete(`/users/${id}`),
      this.retryOptions
    );
  }
}

export function createTestUser(overrides: Partial<CreateUserRequest> = {}): CreateUserRequest {
  const timestamp = Date.now();
  return {
    id: `test-user-${timestamp}`,
    name: `Test User ${timestamp}`,
    ...overrides,
  };
}

export function getApiUrl(): string {
  // Check for deployment environment variable first (set by deploy-and-export.sh)
  if (process.env.API_URL) {
    return process.env.API_URL
  }
  
  // Check for integration test specific variable
  if (process.env.INTEGRATION_TEST_API_URL) {
    return process.env.INTEGRATION_TEST_API_URL
  }
  
  // Legacy fallback for AWS deployment (assumes 'prod' stage)
  if (process.env.NODE_ENV === 'production') {
    return 'https://j20a33ppkl.execute-api.us-west-2.amazonaws.com/prod'
  }
  
  // Final fallback for LocalStack (this should rarely be used now)
  console.warn('⚠️  No API_URL environment variable found, using fallback LocalStack URL')
  return 'https://bp72trc9ji.execute-api.localhost.localstack.cloud:4566/prod/'
}
