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
  const baseUrl = process.env.API_URL || 'http://localhost:4566';
  
  // Handle LocalStack URL format
  if (baseUrl.includes('localhost:4566')) {
    return `${baseUrl}/restapis/test-api/prod/_user_request_`;
  }
  
  return baseUrl;
}
