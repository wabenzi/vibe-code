import { ApiClient, createTestUser, getApiUrl } from '../utils/api-client';
import { AxiosError } from 'axios';

describe('User API Integration Tests', () => {
  let apiClient: ApiClient;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const apiUrl = getApiUrl();
    apiClient = new ApiClient(apiUrl);
    
    // Wait for API to be ready
    console.log(`Testing API at: ${apiUrl}`);
    
    // Retry mechanism for API readiness
    let retries = 10;
    while (retries > 0) {
      try {
        await apiClient.getUser('health-check');
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          console.warn('API health check failed, proceeding with tests anyway');
        } else {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
  });

  afterAll(async () => {
    // Clean up created test users
    for (const userId of createdUserIds) {
      try {
        await apiClient.deleteUser(userId);
      } catch (error) {
        // Ignore cleanup errors
        console.warn(`Failed to cleanup user ${userId}:`, error);
      }
    }
  });

  describe('POST /users', () => {
    it('should create a new user with valid data', async () => {
      const userData = createTestUser();
      
      const response = await apiClient.createUser(userData);
      
      expect(response.status).toBe(201);
      expect(response.data).toMatchObject({
        id: userData.id,
        name: userData.name,
      });
      expect(response.data.createdAt).toBeDefined();
      expect(response.data.updatedAt).toBeDefined();
      expect(new Date(response.data.createdAt)).toBeInstanceOf(Date);
      expect(new Date(response.data.updatedAt)).toBeInstanceOf(Date);
      
      createdUserIds.push(userData.id);
    });

    it('should return 400 for missing required fields', async () => {
      try {
        await apiClient.createUser({ id: '', name: 'Test User' });
        fail('Expected request to fail');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBe(400);
        expect(axiosError.response?.data).toHaveProperty('error');
      }
    });

    it('should return 400 for invalid data types', async () => {
      try {
        await apiClient.createUser({ id: 'test', name: '' });
        fail('Expected request to fail');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBe(400);
      }
    });

    it('should handle special characters in user data', async () => {
      const userData = createTestUser({
        id: `test-special-chars-${Date.now()}`,
        name: 'User with Special Chars: !@#$%^&*()_+-=[]{}|;:,.<>?'
      });
      
      const response = await apiClient.createUser(userData);
      
      expect(response.status).toBe(201);
      expect(response.data.name).toBe(userData.name);
      
      createdUserIds.push(userData.id);
    });
  });

  describe('GET /users/{id}', () => {
    let testUserId: string;

    beforeEach(async () => {
      const userData = createTestUser();
      const response = await apiClient.createUser(userData);
      testUserId = response.data.id;
      createdUserIds.push(testUserId);
    });

    it('should retrieve an existing user', async () => {
      const response = await apiClient.getUser(testUserId);
      
      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        id: testUserId,
      });
      expect(response.data.name).toBeDefined();
      expect(response.data.createdAt).toBeDefined();
      expect(response.data.updatedAt).toBeDefined();
    });

    it('should return 404 for non-existent user', async () => {
      const nonExistentId = 'non-existent-user-12345';
      
      try {
        await apiClient.getUser(nonExistentId);
        fail('Expected request to fail');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBe(404);
        expect(axiosError.response?.data).toHaveProperty('error');
        expect(axiosError.response?.data).toHaveProperty('userId', nonExistentId);
      }
    });

    it('should return 400 for invalid user ID format', async () => {
      try {
        // Use a user ID with URL-encoded characters that will be passed to lambda
        await apiClient.getUser('user%2Fwith%2Finvalid%2Fchars');
        fail('Expected request to fail');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBe(400);
      }
    });
  });

  describe('User Lifecycle Tests', () => {
    it('should handle complete user lifecycle', async () => {
      // Create user
      const userData = createTestUser({
        id: `lifecycle-test-user-${Date.now()}`,
        name: 'Lifecycle Test User'
      });
      
      const createResponse = await apiClient.createUser(userData);
      expect(createResponse.status).toBe(201);
      
      createdUserIds.push(userData.id);
      
      // Retrieve user immediately after creation
      const getResponse = await apiClient.getUser(userData.id);
      expect(getResponse.status).toBe(200);
      expect(getResponse.data.id).toBe(userData.id);
      expect(getResponse.data.name).toBe(userData.name);
      
      // Verify timestamps are consistent
      expect(getResponse.data.createdAt).toBe(createResponse.data.createdAt);
      expect(getResponse.data.updatedAt).toBe(createResponse.data.updatedAt);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent user creation', async () => {
      const concurrentUsers = Array.from({ length: 5 }, (_, i) =>
        createTestUser({ id: `concurrent-user-${i}-${Date.now()}` })
      );
      
      const createPromises = concurrentUsers.map(userData =>
        apiClient.createUser(userData)
      );
      
      const responses = await Promise.all(createPromises);
      
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.data.id).toBe(concurrentUsers[index].id);
        createdUserIds.push(response.data.id);
      });
    });
  });

  describe('Error Handling', () => {
    it('should provide detailed error messages', async () => {
      try {
        await apiClient.createUser({ id: '', name: '' });
        fail('Expected request to fail');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBe(400);
        
        const errorData = axiosError.response?.data as any;
        expect(errorData).toHaveProperty('error');
        expect(typeof errorData.error).toBe('string');
      }
    });

    it('should handle malformed JSON gracefully', async () => {
      try {
        // This would typically be handled by axios, but we can test server behavior
        await apiClient.createUser({ id: 'test', name: null as any });
        fail('Expected request to fail');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBeGreaterThanOrEqual(400);
      }
    });
  });

  describe('Performance Tests', () => {
    it('should respond within acceptable time limits', async () => {
      const userData = createTestUser();
      
      const startTime = Date.now();
      const response = await apiClient.createUser(userData);
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(201);
      expect(responseTime).toBeLessThan(5000); // 5 second timeout
      
      createdUserIds.push(userData.id);
    });

    it('should handle rapid sequential requests', async () => {
      const users = Array.from({ length: 3 }, (_, i) =>
        createTestUser({ id: `rapid-test-${i}-${Date.now()}` })
      );
      
      const startTime = Date.now();
      
      for (const userData of users) {
        const response = await apiClient.createUser(userData);
        expect(response.status).toBe(201);
        createdUserIds.push(userData.id);
      }
      
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(15000); // 15 seconds for 3 requests
    });
  });
});
