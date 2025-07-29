import { Pact, Interaction, Matchers } from '@pact-foundation/pact';
import { ApiClient } from '../utils/api-client';
import path from 'path';

const { like, term, iso8601DateTime } = Matchers;

describe('User API Contract Tests (Consumer)', () => {
  let provider: Pact;
  let apiClient: ApiClient;

  beforeAll(async () => {
    provider = new Pact({
      consumer: 'user-management-frontend',
      provider: 'user-management-api',
      port: 1234,
      log: path.resolve(process.cwd(), 'pacts', 'logs', 'mockserver-integration.log'),
      dir: path.resolve(process.cwd(), 'pacts'),
      spec: 3,
      logLevel: 'INFO',
    });

    await provider.setup();
    apiClient = new ApiClient('http://localhost:1234');
  });

  afterAll(async () => {
    await provider.finalize();
  });

  afterEach(async () => {
    await provider.verify();
  });

  describe('Create User', () => {
    beforeEach(async () => {
      const interaction: Interaction = {
        state: 'user does not exist',
        uponReceiving: 'a request to create a user',
        withRequest: {
          method: 'POST',
          path: '/users',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            id: 'user-123',
            name: 'John Doe',
          },
        },
        willRespondWith: {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            id: 'user-123',
            name: 'John Doe',
            createdAt: iso8601DateTime(),
            updatedAt: iso8601DateTime(),
          },
        },
      };

      await provider.addInteraction(interaction);
    });

    it('should create a user successfully', async () => {
      const userData = {
        id: 'user-123',
        name: 'John Doe',
      };

      const response = await apiClient.createUser(userData);

      expect(response.status).toBe(201);
      expect(response.data).toMatchObject({
        id: 'user-123',
        name: 'John Doe',
      });
      expect(response.data.createdAt).toBeDefined();
      expect(response.data.updatedAt).toBeDefined();
    });
  });

  describe('Create User - Validation Error', () => {
    beforeEach(async () => {
      const interaction: Interaction = {
        state: 'user data is invalid',
        uponReceiving: 'a request to create a user with invalid data',
        withRequest: {
          method: 'POST',
          path: '/users',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            id: '',
            name: 'John Doe',
          },
        },
        willRespondWith: {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            error: like('Validation failed'),
            message: like('Invalid input data'),
            errors: like(['id is required']),
          },
        },
      };

      await provider.addInteraction(interaction);
    });

    it('should return validation error for invalid data', async () => {
      const userData = {
        id: '',
        name: 'John Doe',
      };

      try {
        await apiClient.createUser(userData);
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

  describe('Get User', () => {
    beforeEach(async () => {
      const interaction: Interaction = {
        state: 'user exists',
        uponReceiving: 'a request to get a user',
        withRequest: {
          method: 'GET',
          path: '/users/user-123',
          headers: {},
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            id: 'user-123',
            name: 'John Doe',
            createdAt: iso8601DateTime(),
            updatedAt: iso8601DateTime(),
          },
        },
      };

      await provider.addInteraction(interaction);
    });

    it('should retrieve an existing user', async () => {
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

  describe('Get User - Not Found', () => {
    beforeEach(async () => {
      const interaction: Interaction = {
        state: 'user does not exist',
        uponReceiving: 'a request to get a non-existent user',
        withRequest: {
          method: 'GET',
          path: '/users/non-existent-user',
          headers: {},
        },
        willRespondWith: {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            error: 'User not found',
            message: like('User with ID \'non-existent-user\' was not found'),
            userId: 'non-existent-user',
          },
        },
      };

      await provider.addInteraction(interaction);
    });

    it('should return 404 for non-existent user', async () => {
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

  describe('Create User - Conflict', () => {
    beforeEach(async () => {
      const interaction: Interaction = {
        state: 'user already exists',
        uponReceiving: 'a request to create a user that already exists',
        withRequest: {
          method: 'POST',
          path: '/users',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            id: 'existing-user',
            name: 'Existing User',
          },
        },
        willRespondWith: {
          status: 409,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            error: 'User with this ID already exists',
          },
        },
      };

      await provider.addInteraction(interaction);
    });

    it('should return conflict error for duplicate user ID', async () => {
      const userData = {
        id: 'existing-user',
        name: 'Existing User',
      };

      try {
        await apiClient.createUser(userData);
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
