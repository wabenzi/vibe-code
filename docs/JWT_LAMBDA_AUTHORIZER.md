# AWS Lambda Authorizer Implementation

This document describes the JWT-based Lambda Authorizer implementation for the User Management API.

## Overview

The API has been upgraded from API Key authentication to a more robust JWT-based authentication system using AWS Lambda Authorizer. This provides better security, scalability, and flexibility.

## Components

### 1. Lambda Authorizer Function (`src/lambda/authorizer.ts`)

The authorizer function validates JWT tokens and returns IAM policies for API Gateway:

- **Input**: Authorization header with Bearer token
- **Validation**: JWT signature, expiration, audience, issuer
- **Output**: IAM policy allowing/denying access
- **Context**: User information passed to protected Lambda functions

#### Key Features:
- JWT validation with configurable secret, audience, and issuer
- IAM policy generation based on token validation
- User context forwarding to protected endpoints
- Comprehensive error handling and logging

### 2. Updated Authentication Utilities (`src/lambda/utils/auth.ts`)

Enhanced authentication utilities supporting both JWT and legacy API key authentication:

- `authenticateRequest()`: Extracts user context from Lambda Authorizer
- `authenticateWithApiKey()`: Legacy API key authentication (backward compatibility)
- `getUserContext()`: Retrieves user information from authorizer context
- Security event logging with detailed audit trail

### 3. Enhanced Security Middleware (`src/lambda/utils/security-middleware.ts`)

Updated middleware supporting the new authentication flow:

- Automatic detection of JWT vs API key authentication
- Unified security event logging
- Error handling for both authentication methods
- Performance monitoring and request logging

### 4. Infrastructure Updates (`infrastructure/user-api-stack.ts`)

CDK infrastructure updated to include Lambda Authorizer:

- New authorizer Lambda function deployment
- API Gateway integration with Token Authorizer
- Environment variable configuration for JWT settings
- Caching configuration for authorization results

## Configuration

### Environment Variables

Set these environment variables for JWT configuration:

```bash
# JWT Configuration
JWT_SECRET=your-jwt-secret-key
JWT_AUDIENCE=user-management-api
JWT_ISSUER=user-management-service

# Legacy API Key (for backward compatibility)
VALID_API_KEY=your-api-key
```

### JWT Token Structure

Valid JWT tokens must include these claims:

```json
{
  "sub": "user-123",           // Subject (User ID) - Required
  "email": "user@example.com", // User email - Optional
  "scope": ["read", "write"],  // User permissions - Optional
  "aud": "user-management-api", // Audience - Required
  "iss": "user-management-service", // Issuer - Required
  "exp": 1640995200,           // Expiration time - Required
  "iat": 1640991600            // Issued at time - Required
}
```

## Client Implementation

### 1. Obtain JWT Token

Clients must obtain a valid JWT token from your identity provider (e.g., Amazon Cognito, Auth0, or custom authentication service).

### 2. Include Authorization Header

Include the JWT token in the Authorization header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. API Request Example

```bash
curl -X POST https://your-api-gateway-url/users \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"id": "user123", "name": "John Doe"}'
```

## Testing

### Development Testing

Use the test utilities in `test/utils/jwt-test-utils.ts`:

```typescript
import { createTestJWTToken, createAuthorizationHeader } from '../../test/utils/jwt-test-utils'

// Create test token
const token = createTestJWTToken({
  userId: 'test-user-123',
  email: 'test@example.com',
  scope: ['read', 'write']
})

// Create authorization header
const authHeader = createAuthorizationHeader({
  userId: 'test-user-123'
})
```

### Predefined Test Users

The test utilities include predefined test users:

- `TEST_USERS.ADMIN`: Full access with admin scope
- `TEST_USERS.REGULAR_USER`: Standard read/write access
- `TEST_USERS.READ_ONLY_USER`: Read-only access

## Security Features

### 1. Token Validation
- JWT signature verification using HMAC SHA256
- Expiration time validation
- Audience and issuer validation
- Required claims validation (sub, aud, iss)

### 2. Authorization Caching
- API Gateway caches authorization results for 5 minutes
- Reduces latency for subsequent requests
- Configurable cache TTL

### 3. Security Logging
- Comprehensive audit trail for all authentication events
- Failed authentication attempts logged with details
- Request performance monitoring

### 4. Error Handling
- Secure error responses without sensitive information
- Proper HTTP status codes (401, 403, 500)
- Detailed logging for debugging (server-side only)

## Migration from API Key

The implementation maintains backward compatibility with API key authentication:

1. **Health endpoint**: No authentication required
2. **Protected endpoints**: Support both JWT and API key
3. **Gradual migration**: Can migrate endpoints individually
4. **Testing**: Both authentication methods work in test environments

## Deployment

### 1. Set Environment Variables

Configure JWT settings in your deployment environment:

```bash
export JWT_SECRET="your-production-jwt-secret"
export JWT_AUDIENCE="user-management-api"
export JWT_ISSUER="your-identity-provider"
```

### 2. Deploy Infrastructure

```bash
npm run deploy
```

The CDK will create:
- Lambda Authorizer function
- API Gateway Token Authorizer
- Updated API methods with custom authorization

### 3. Test Authorization

Verify the authorizer is working:

```bash
# This should fail (no token)
curl https://your-api-gateway-url/users

# This should succeed (with valid token)
curl -H "Authorization: Bearer valid-jwt-token" https://your-api-gateway-url/users
```

## Best Practices

### 1. Token Management
- Use short-lived tokens (1 hour or less)
- Implement token refresh mechanism
- Store tokens securely on client side

### 2. Secret Management
- Use AWS Secrets Manager or Parameter Store for JWT secrets
- Rotate secrets regularly
- Use different secrets for different environments

### 3. Monitoring
- Monitor authentication failure rates
- Set up CloudWatch alarms for security events
- Log security events to centralized logging system

### 4. Performance
- Leverage authorization caching
- Monitor authorizer function duration
- Consider using Cognito User Pools for simpler setup

## Troubleshooting

### Common Issues

1. **401 Unauthorized**
   - Check token format (Bearer token)
   - Verify token is not expired
   - Confirm JWT secret matches

2. **403 Forbidden**
   - Check IAM policy generation in authorizer
   - Verify user has required permissions
   - Check token claims (scope, audience)

3. **500 Internal Server Error**
   - Check authorizer function logs
   - Verify environment variables are set
   - Check JWT secret configuration

### Debug Tools

Use the test utilities to debug tokens:

```typescript
import { verifyTestJWTToken } from '../../test/utils/jwt-test-utils'

try {
  const decoded = verifyTestJWTToken(token)
  console.log('Token valid:', decoded)
} catch (error) {
  console.error('Token invalid:', error.message)
}
```

## Future Enhancements

1. **Role-Based Access Control**: Implement granular permissions based on user roles
2. **Cognito Integration**: Direct integration with Amazon Cognito User Pools
3. **OAuth 2.0 Scopes**: Advanced scope-based authorization
4. **Multi-tenancy**: Support for multiple tenants with different authorization rules
