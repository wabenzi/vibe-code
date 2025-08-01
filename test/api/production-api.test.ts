import jwt from 'jsonwebtoken';
import { ApiClient, createTestUser, getApiUrl } from '../utils/api-client';
import { withRetryTest } from '../utils/retry';
import { AxiosError } from 'axios';

/**
 * Production API Tests with JWT Authentication
 * 
 * These tests extend the existing integration tests but focus on:
 * - JWT authentication flow
 * - Production API endpoints
 * - Real AWS deployment verification
 * - End-to-end functionality
 */
describe('Production API Tests', () => {
  let apiClient: ApiClient;
  let jwtToken: string;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const apiUrl = process.env.API_BASE_URL || getApiUrl();
    console.log(`🌐 Testing production API at: ${apiUrl}`);

    // Generate JWT token for authentication
    const jwtSecret = process.env.JWT_SECRET || 'development-secret-key';
    jwtToken = jwt.sign(
      {
        sub: 'api-test-user',
        email: 'api-test@example.com',
        scope: ['read', 'write'],
        aud: 'user-management-api',
        iss: 'user-management-service'
      },
      jwtSecret,
      {
        algorithm: 'HS256',
        expiresIn: '1h'
      }
    );

    // Create authenticated API client
    apiClient = new ApiClient(apiUrl, {
      maxAttempts: 3,
      baseDelayMs: 500,
      maxDelayMs: 5000,
      exponentialBase: 2
    });
    
    // Add JWT authentication
    (apiClient as any).client.defaults.headers.common['Authorization'] = `Bearer ${jwtToken}`;

    // Verify API health before running tests
    console.log('🏥 Checking API health...');
    const isHealthy = await apiClient.healthCheck();
    
    if (!isHealthy) {
      throw new Error('API health check failed. Cannot proceed with tests.');
    }
    
    console.log('✅ API is healthy and ready for testing');
  });

  afterAll(async () => {
    // Clean up created test users
    console.log('🧹 Cleaning up test users...');
    for (const userId of createdUserIds) {
      try {
        await apiClient.deleteUser(userId);
        console.log(`✅ Cleaned up user: ${userId}`);
      } catch (error) {
        console.warn(`⚠️  Failed to cleanup user ${userId}:`, error);
      }
    }
  });

  describe('Authentication', () => {
    it('should reject requests without JWT token', async () => {
      const unauthenticatedClient = new ApiClient(process.env.API_BASE_URL || getApiUrl());
      
      try {
        await unauthenticatedClient.createUser(createTestUser());
        fail('Expected request to fail without authentication');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBe(401);
      }
    });

    it('should accept requests with valid JWT token', async () => {
      const userData = createTestUser({ id: `auth-test-${Date.now()}` });
      
      const response = await apiClient.createUser(userData);
      
      expect(response.status).toBe(201);
      expect(response.data.id).toBe(userData.id);
      
      createdUserIds.push(userData.id);
    });
  });

  describe('User CRUD Operations', () => {
    withRetryTest('should create user successfully', async () => {
      const userData = createTestUser({ id: `prod-create-${Date.now()}` });
      
      const response = await apiClient.createUser(userData);
      
      expect(response.status).toBe(201);
      expect(response.data).toMatchObject({
        id: userData.id,
        name: userData.name,
      });
      expect(response.data.createdAt).toBeDefined();
      expect(response.data.updatedAt).toBeDefined();
      
      createdUserIds.push(userData.id);
    });

    withRetryTest('should retrieve user successfully', async () => {
      // First create a user
      const userData = createTestUser({ id: `prod-get-${Date.now()}` });
      const createResponse = await apiClient.createUser(userData);
      createdUserIds.push(userData.id);
      
      // Then retrieve it
      const getResponse = await apiClient.getUser(userData.id);
      
      expect(getResponse.status).toBe(200);
      expect(getResponse.data).toMatchObject({
        id: userData.id,
        name: userData.name,
      });
      expect(getResponse.data.createdAt).toBe(createResponse.data.createdAt);
    });

    withRetryTest('should delete user successfully', async () => {
      // Create a user
      const userData = createTestUser({ id: `prod-delete-${Date.now()}` });
      await apiClient.createUser(userData);
      
      // Delete the user
      const deleteResponse = await apiClient.deleteUser(userData.id);
      expect(deleteResponse.status).toBe(204); // DELETE operations typically return 204 No Content
      
      // Verify user is deleted
      try {
        await apiClient.getUser(userData.id);
        fail('Expected user to be deleted');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBe(404);
      }
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent user', async () => {
      try {
        await apiClient.getUser('non-existent-user-12345');
        fail('Expected request to fail');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBe(404);
        expect(axiosError.response?.data).toHaveProperty('error');
      }
    });

    it('should return 400 for invalid user data', async () => {
      try {
        await apiClient.createUser({ id: '', name: '' });
        fail('Expected request to fail');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBe(400);
        expect(axiosError.response?.data).toHaveProperty('error');
      }
    });
  });

  describe('Performance', () => {
    withRetryTest('should respond within reasonable time limits', async () => {
      const userData = createTestUser({ id: `perf-test-${Date.now()}` });
      
      const startTime = Date.now();
      const response = await apiClient.createUser(userData);
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(201);
      expect(responseTime).toBeLessThan(3000); // 3 second limit for production
      
      createdUserIds.push(userData.id);
    });
  });
});

/**
 * Helper function to create an authenticated API client
 */
function createAuthenticatedApiClient(baseURL: string, jwtToken: string, retryOptions?: any): ApiClient {
  const client = new ApiClient(baseURL, retryOptions);
  
  // Add JWT token to all requests
  (client as any).client.defaults.headers.common['Authorization'] = `Bearer ${jwtToken}`;
  
  return client;
}
