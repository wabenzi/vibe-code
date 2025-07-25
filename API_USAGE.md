# API Usage Examples

This document provides examples of how to interact with the User Management API.

## Base URL

Replace `YOUR_API_GATEWAY_URL` with the actual URL from your CDK deployment output.

```
https://YOUR_API_GATEWAY_URL/prod
```

## Authentication

Currently, the API does not require authentication. In a production environment, you would typically add:
- AWS IAM authentication
- API keys
- JWT tokens
- OAuth 2.0

## Endpoints

### 1. Create User

Creates a new user in the system.

**Request:**
```http
POST /users
Content-Type: application/json

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

### Create a User
```bash
curl -X POST "https://YOUR_API_GATEWAY_URL/prod/users" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "alice123",
    "name": "Alice Smith"
  }'
```

### Get a User
```bash
curl "https://YOUR_API_GATEWAY_URL/prod/users/alice123"
```

### Get Demo User
```bash
curl "https://YOUR_API_GATEWAY_URL/prod/users/test"
```

## JavaScript/TypeScript Examples

### Using fetch API

```typescript
// Create user
const createUser = async (id: string, name: string) => {
  const response = await fetch('https://YOUR_API_GATEWAY_URL/prod/users', {
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
  const response = await fetch(`https://YOUR_API_GATEWAY_URL/prod/users/${id}`);
  
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

### Using axios

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://YOUR_API_GATEWAY_URL/prod',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create user
const createUser = async (id: string, name: string) => {
  try {
    const response = await api.post('/users', { id, name });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
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
      if (error.response?.status === 404) {
        throw new Error('User not found');
      }
      throw new Error(error.response?.data?.error || error.message);
    }
    throw error;
  }
};
```

## Error Codes

| Status Code | Description | Example |
|-------------|-------------|---------|
| 200 | Success | User retrieved successfully |
| 201 | Created | User created successfully |
| 400 | Bad Request | Invalid input data |
| 404 | Not Found | User does not exist |
| 500 | Internal Server Error | Database or server error |

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
