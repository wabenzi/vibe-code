import axios, { AxiosInstance, AxiosResponse } from 'axios';

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
  
  constructor(baseURL: string) {
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
  }
  
  async createUser(userData: CreateUserRequest): Promise<AxiosResponse<UserResponse>> {
    return this.client.post('/users', userData);
  }
  
  async getUser(id: string): Promise<AxiosResponse<UserResponse>> {
    return this.client.get(`/users/${id}`);
  }
  
  async deleteUser(id: string): Promise<AxiosResponse<void>> {
    return this.client.delete(`/users/${id}`);
  }
  
  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health');
      return true;
    } catch {
      return false;
    }
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
  // Check for environment variable first
  if (process.env.API_URL) {
    return process.env.API_URL;
  }
  
  // Default to LocalStack API Gateway URL
  return 'https://e880quwe59.execute-api.localhost.localstack.cloud:4566/local';
}
