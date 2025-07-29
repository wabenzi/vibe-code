import { PactV3, MatchersV3, SpecificationVersion } from '@pact-foundation/pact';
import { ApiClient } from '../utils/api-client';
import path from 'path';

const { like, datetime } = MatchersV3;

describe('User API Contract Tests (Consumer)', () => {
  let provider: PactV3;
  let apiClient: ApiClient;

  beforeAll(async () => {
    provider = new PactV3({
      consumer: 'user-management-frontend',
      provider: 'user-management-api',
      port: 1234,
      logLevel: 'info',
      dir: path.resolve(process.cwd(), 'pacts'),
      spec: SpecificationVersion.SPECIFICATION_VERSION_V4,
    });

    apiClient = new ApiClient('http://localhost:1234');
  });

  beforeEach(async () => {
    // Add a small delay between tests to ensure proper cleanup
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  afterEach(async () => {
    // Clear any pending timers or async operations
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  afterAll(async () => {
    // Clean up resources to prevent worker process hanging
    if (apiClient) {
      // Clear any axios interceptors or pending requests
      apiClient = null as any;
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Add a small delay to ensure cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Create User', () => {
    it('should create a user successfully', async () => {
      await provider
        .given('user does not exist')
        .uponReceiving('a request to create a user')
        .withRequest({
          method: 'POST',
          path: '/users',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            id: 'user-123',
            name: 'John Doe',
          },
        })
        .willRespondWith({
          status: 201,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            id: 'user-123',
            name: 'John Doe',
            createdAt: datetime("yyyy-MM-dd'T'HH:mm:ss.SSSX", "2025-01-01T00:00:00.000Z"),
            updatedAt: datetime("yyyy-MM-dd'T'HH:mm:ss.SSSX", "2025-01-01T00:00:00.000Z"),
          },
        })
        .executeTest(async (mockService) => {
          const response = await apiClient.createUser({
            id: 'user-123',
            name: 'John Doe',
          });

          expect(response.status).toBe(201);
          expect(response.data).toMatchObject({
            id: 'user-123',
            name: 'John Doe',
          });
          expect(response.data.createdAt).toBeDefined();
          expect(response.data.updatedAt).toBeDefined();
        });
    });

    it('should return validation error for invalid data', async () => {
      await provider
        .given('user data is invalid')
        .uponReceiving('a request to create a user with invalid data')
        .withRequest({
          method: 'POST',
          path: '/users',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            id: '',
            name: 'John Doe',
          },
        })
        .willRespondWith({
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            error: like('Validation failed'),
            message: like('Invalid input data'),
            errors: like(['id is required']),
          },
        })
        .executeTest(async (mockService) => {
          try {
            await apiClient.createUser({
              id: '',
              name: 'John Doe',
            });
            fail('Expected request to fail');
          } catch (error: any) {
            expect(error.response.status).toBe(400);
            expect(error.response.data).toMatchObject({
              error: expect.any(String),
              message: expect.any(String),
              errors: expect.any(Array),
            });
          }
        });
    });

    it('should return conflict error for duplicate user ID', async () => {
      await provider
        .given('user already exists')
        .uponReceiving('a request to create a user that already exists')
        .withRequest({
          method: 'POST',
          path: '/users',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            id: 'existing-user',
            name: 'Existing User',
          },
        })
        .willRespondWith({
          status: 409,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            error: 'User with this ID already exists',
          },
        })
        .executeTest(async (mockService) => {
          try {
            await apiClient.createUser({
              id: 'existing-user',
              name: 'Existing User',
            });
            fail('Expected request to fail');
          } catch (error: any) {
            expect(error.response.status).toBe(409);
            expect(error.response.data).toMatchObject({
              error: 'User with this ID already exists',
            });
          }
        });
    });
  });

  describe('Get User', () => {
    it('should retrieve an existing user', async () => {
      await provider
        .given('user exists')
        .uponReceiving('a request to get a user')
        .withRequest({
          method: 'GET',
          path: '/users/user-123',
          headers: {},
        })
        .willRespondWith({
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            id: 'user-123',
            name: 'John Doe',
            createdAt: datetime("yyyy-MM-dd'T'HH:mm:ss.SSSX", "2025-01-01T00:00:00.000Z"),
            updatedAt: datetime("yyyy-MM-dd'T'HH:mm:ss.SSSX", "2025-01-01T00:00:00.000Z"),
          },
        })
        .executeTest(async (mockService) => {
          const response = await apiClient.getUser('user-123');

          expect(response.status).toBe(200);
          expect(response.data).toMatchObject({
            id: 'user-123',
            name: 'John Doe',
          });
          expect(response.data.createdAt).toBeDefined();
          expect(response.data.updatedAt).toBeDefined();
        });
    });

    it('should return 404 for non-existent user', async () => {
      await provider
        .given('user does not exist')
        .uponReceiving('a request to get a non-existent user')
        .withRequest({
          method: 'GET',
          path: '/users/non-existent-user',
          headers: {},
        })
        .willRespondWith({
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            error: 'User not found',
            message: like('User with ID \'non-existent-user\' was not found'),
            userId: 'non-existent-user',
          },
        })
        .executeTest(async (mockService) => {
          try {
            await apiClient.getUser('non-existent-user');
            fail('Expected request to fail');
          } catch (error: any) {
            expect(error.response.status).toBe(404);
            expect(error.response.data).toMatchObject({
              error: 'User not found',
              message: expect.any(String),
              userId: 'non-existent-user',
            });
          }
        });
    });
  });
});
