# API Client Examples

This directory contains examples of how to use the generated API clients.

## TypeScript Client Example

After generating the TypeScript client with `npm run docs:generate typescript-axios`, you can use it like this:

```typescript
import { UserApi, Configuration } from '../clients/typescript';

// Configure the API client
const config = new Configuration({
  basePath: 'https://your-api-gateway-url.amazonaws.com/prod',
  // Add authentication if needed
  // apiKey: 'your-api-key'
});

const userApi = new UserApi(config);

async function example() {
  try {
    // Create a new user
    const newUser = await userApi.createUser({
      createUserRequest: {
        id: 'user-123',
        name: 'John Doe'
      }
    });
    
    console.log('Created user:', newUser.data);
    
    // Get the user by ID
    const retrievedUser = await userApi.getUserById({
      id: 'user-123'
    });
    
    console.log('Retrieved user:', retrievedUser.data);
    
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Network Error:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error:', error.message);
    }
  }
}

// Run the example
example();
```

## React Hook Example

For React applications, you can create custom hooks:

```typescript
import { useState, useEffect } from 'react';
import { UserApi, Configuration, UserResponse } from '../clients/typescript';

const config = new Configuration({
  basePath: process.env.REACT_APP_API_URL || 'http://localhost:4566'
});

const userApi = new UserApi(config);

export function useUser(id: string) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        setLoading(true);
        const response = await userApi.getUserById({ id });
        setUser(response.data);
        setError(null);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch user');
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchUser();
    }
  }, [id]);

  return { user, loading, error };
}

export function useCreateUser() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createUser = async (userData: { id: string; name: string }) => {
    try {
      setLoading(true);
      setError(null);
      const response = await userApi.createUser({
        createUserRequest: userData
      });
      return response.data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to create user';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return { createUser, loading, error };
}
```

## Node.js Backend Example

For server-side usage:

```typescript
import { UserApi, Configuration } from '../clients/typescript';

class UserService {
  private userApi: UserApi;

  constructor(apiUrl: string, apiKey?: string) {
    const config = new Configuration({
      basePath: apiUrl,
      apiKey: apiKey
    });
    this.userApi = new UserApi(config);
  }

  async createUser(id: string, name: string) {
    try {
      const response = await this.userApi.createUser({
        createUserRequest: { id, name }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to create user:', error);
      throw error;
    }
  }

  async getUser(id: string) {
    try {
      const response = await this.userApi.getUserById({ id });
      return response.data;
    } catch (error) {
      console.error('Failed to get user:', error);
      throw error;
    }
  }

  async validateUser(id: string): Promise<boolean> {
    try {
      await this.getUser(id);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Usage
const userService = new UserService(
  process.env.API_URL || 'http://localhost:4566',
  process.env.API_KEY
);

export default userService;
```

## Environment Configuration

Create a `.env` file for different environments:

```bash
# Development (LocalStack)
API_URL=http://localhost:4566/restapis/your-api-id/prod/_user_request_
API_KEY=

# Production (AWS)
API_URL=https://your-api-id.execute-api.us-west-2.amazonaws.com/prod
API_KEY=your-production-api-key
```

## Error Handling

The generated client includes TypeScript types for all error responses:

```typescript
import { AxiosError } from 'axios';
import { 
  ValidationErrorResponse, 
  UserNotFoundErrorResponse, 
  DatabaseErrorResponse 
} from '../clients/typescript';

function handleApiError(error: AxiosError) {
  if (error.response) {
    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        const validationError = data as ValidationErrorResponse;
        console.error('Validation Error:', validationError.errors);
        break;
        
      case 404:
        const notFoundError = data as UserNotFoundErrorResponse;
        console.error('User not found:', notFoundError.userId);
        break;
        
      case 500:
        const dbError = data as DatabaseErrorResponse;
        console.error('Database Error:', dbError.message);
        break;
        
      default:
        console.error('Unknown API Error:', status, data);
    }
  }
}
```

## Testing

Use the generated client in your tests:

```typescript
import { UserApi, Configuration } from '../clients/typescript';

describe('User API Integration Tests', () => {
  let userApi: UserApi;
  
  beforeAll(() => {
    const config = new Configuration({
      basePath: 'http://localhost:4566' // LocalStack for testing
    });
    userApi = new UserApi(config);
  });

  test('should create and retrieve user', async () => {
    const testUserId = `test-user-${Date.now()}`;
    
    // Create user
    const createResponse = await userApi.createUser({
      createUserRequest: {
        id: testUserId,
        name: 'Test User'
      }
    });
    
    expect(createResponse.status).toBe(201);
    expect(createResponse.data.id).toBe(testUserId);
    
    // Retrieve user
    const getResponse = await userApi.getUserById({ id: testUserId });
    
    expect(getResponse.status).toBe(200);
    expect(getResponse.data.name).toBe('Test User');
  });
});
```
