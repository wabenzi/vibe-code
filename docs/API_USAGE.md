# API Usage Examples

This document provides examples of how to interact with the User Management API.

## Base URL

Replace `YOUR_API_GATEWAY_URL` with the actual URL from your CDK deployment output.

```text
https://YOUR_API_GATEWAY_URL/prod
```

## 🧪 Automated Testing (Recommended)

The easiest way to test the API is using the built-in automated test suites:

### Quick Testing Commands
```bash
# Test deployed AWS API (requires API to be deployed)
npm run test:aws

# Deploy and test in one command (recommended)
npm run deploy:prod:test
```

### Generate JWT Tokens for Manual Testing
```bash
# Generate a test JWT token
node generate-test-token.js

# Generate with custom user ID
node generate-test-token.js my-user-123

# Generate with export command format
node generate-test-token.js --export
```

The automated tests provide comprehensive coverage including:
- ✅ Authentication verification
- ✅ CRUD operations testing
- ✅ Error handling validation
- ✅ Performance testing
- ✅ Automatic cleanup

**Benefits of automated testing:**
- No manual token management
- Comprehensive test coverage
- Automatic cleanup of test data
- Performance validation
- Error scenario testing

## Authentication

**Production AWS Deployment**: Authentication is **REQUIRED** using JWT Bearer tokens.
**LocalStack Development**: Authentication is **DISABLED** for easier testing.

### Production Authentication Requirements

All API endpoints (except `/health`) require a valid JWT Bearer token in the Authorization header:

```http
Authorization: Bearer <JWT_TOKEN>
```

The JWT token must:
- Be signed with the configured JWT secret
- Have valid audience (`user-management-api`)
- Have valid issuer (`user-management-service`)
- Not be expired
- Follow the format: `Bearer <token>`

### Development (LocalStack)

When running against LocalStack, no authentication is required for easier development and testing.

### Obtaining JWT Tokens

In a production environment, JWT tokens would typically be obtained through:
- OAuth 2.0 authorization server
- AWS Cognito User Pools
- Custom authentication service
- Identity provider (Auth0, Okta, etc.)

**Note**: This example implementation uses a Lambda authorizer for JWT validation. The JWT secret and configuration are set via environment variables during deployment.

## Endpoints

**Important**: All endpoints except `/health` require JWT authentication in production AWS deployments. LocalStack development environments have authentication disabled for easier testing.

### 1. Create User

Creates a new user in the system.

**Request:**
```http
POST /users
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>  # Required in production only

{
  "id": "user123",
  "name": "John Doe"
}
```

**Response (201 Created):**
```json
{
  "id": "user123",
  "name": "John Doe",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

**Error Response (400 Bad Request):**
```json
{
  "error": "Invalid user data",
  "details": ["User ID cannot be empty"]
}
```

### 2. Get User by ID

Retrieves a user by their ID.

**Request:**
```http
GET /users/{id}
Authorization: Bearer <JWT_TOKEN>  # Required in production only
```

**Response (200 OK):**
```json
{
  "id": "user123",
  "name": "John Doe",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

**Error Response (404 Not Found):**
```json
{
  "error": "User not found",
  "message": "User with ID user123 not found",
  "userId": "user123"
}
```

## Demo Data

For testing purposes, a demo user is available:

```http
GET /users/test
```

This will return a mock user without requiring database setup.

## cURL Examples

### Production (AWS) - With Authentication
```bash
# Create a User
curl -X POST "https://YOUR_API_GATEWAY_URL/prod/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "id": "alice123",
    "name": "Alice Smith"
  }'

# Get a User
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "https://YOUR_API_GATEWAY_URL/prod/users/alice123"

# Get Demo User (still requires auth in production)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "https://YOUR_API_GATEWAY_URL/prod/users/test"
```

### Development (LocalStack) - No Authentication
```bash
# Create a User
curl -X POST "http://localhost:4566/restapis/API_ID/local/_user_request_/users" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "alice123",
    "name": "Alice Smith"
  }'

# Get a User
curl "http://localhost:4566/restapis/API_ID/local/_user_request_/users/alice123"

# Get Demo User
curl "http://localhost:4566/restapis/API_ID/local/_user_request_/users/test"
```

## JavaScript/TypeScript Examples

### Production (AWS) - With Authentication

```typescript
// Create user
const createUser = async (id: string, name: string, token: string) => {
  const response = await fetch('https://YOUR_API_GATEWAY_URL/prod/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ id, name }),
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized: Invalid or missing JWT token');
    }
    if (response.status === 403) {
      throw new Error('Forbidden: Insufficient permissions');
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
};

// Get user
const getUser = async (id: string, token: string) => {
  const response = await fetch(`https://YOUR_API_GATEWAY_URL/prod/users/${id}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized: Invalid or missing JWT token');
    }
    if (response.status === 404) {
      throw new Error('User not found');
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
};

// Usage
try {
  const jwtToken = 'your-jwt-token-here';
  const newUser = await createUser('bob456', 'Bob Johnson', jwtToken);
  console.log('Created user:', newUser);
  
  const retrievedUser = await getUser('bob456', jwtToken);
  console.log('Retrieved user:', retrievedUser);
} catch (error) {
  console.error('Error:', error.message);
}
```

### Development (LocalStack) - No Authentication

```typescript
// Create user
const createUser = async (id: string, name: string) => {
  const response = await fetch('http://localhost:4566/restapis/API_ID/local/_user_request_/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, name }),
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
};

// Get user
const getUser = async (id: string) => {
  const response = await fetch(`http://localhost:4566/restapis/API_ID/local/_user_request_/users/${id}`);
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('User not found');
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
};

// Usage
try {
  const newUser = await createUser('bob456', 'Bob Johnson');
  console.log('Created user:', newUser);
  
  const retrievedUser = await getUser('bob456');
  console.log('Retrieved user:', retrievedUser);
} catch (error) {
  console.error('Error:', error.message);
}
```
```

### Using axios (Production)

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://YOUR_API_GATEWAY_URL/prod',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to all requests
const setAuthToken = (token: string) => {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

// Create user
const createUser = async (id: string, name: string) => {
  try {
    const response = await api.post('/users', { id, name });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error('Unauthorized: Invalid or missing JWT token');
      }
      if (error.response?.status === 403) {
        throw new Error('Forbidden: Insufficient permissions');
      }
      throw new Error(error.response?.data?.error || error.message);
    }
    throw error;
  }
};

// Get user
const getUser = async (id: string) => {
  try {
    const response = await api.get(`/users/${id}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error('Unauthorized: Invalid or missing JWT token');
      }
      if (error.response?.status === 404) {
        throw new Error('User not found');
      }
      throw new Error(error.response?.data?.error || error.message);
    }
    throw error;
  }
};

// Usage
const jwtToken = 'your-jwt-token-here';
setAuthToken(jwtToken);
```

## Error Codes

| Status Code | Description | Example |
|-------------|-------------|---------|
| 200 | Success | User retrieved successfully |
| 201 | Created | User created successfully |
| 400 | Bad Request | Invalid input data |
| 401 | Unauthorized | Missing or invalid JWT token |
| 403 | Forbidden | Valid token but insufficient permissions |
| 404 | Not Found | User does not exist |
| 500 | Internal Server Error | Database or server error |

### Authentication Error Examples

**401 Unauthorized** (Missing token):
```json
{
  "message": "Unauthorized"
}
```

**401 Unauthorized** (Invalid token):
```json
{
  "message": "Unauthorized"
}
```

**403 Forbidden** (Valid token, insufficient scope):
```json
{
  "message": "User is not authorized to access this resource"
}

## Rate Limiting

Currently, no rate limiting is implemented. For production use, consider adding:
- API Gateway throttling
- Lambda concurrency limits
- Client-side rate limiting

## CORS

The API includes CORS headers allowing requests from any origin (`*`). In production, you should restrict this to specific domains:

```json
{
  "Access-Control-Allow-Origin": "https://yourdomain.com",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
}
```
