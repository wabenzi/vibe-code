# OpenAPI Specification

This directory contains the OpenAPI 3.1.0 specification for the AWS Serverless User Management API.

## Files

- `openapi.yaml` - Complete OpenAPI specification with detailed schemas and examples

## Features

### API Documentation
- **Complete Schema Definitions**: Request/response models with validation rules
- **Detailed Examples**: Real-world usage examples for all endpoints
- **Error Handling**: Comprehensive error response documentation
- **Multiple Environments**: AWS production and LocalStack development servers

### Interactive Tools
The OpenAPI specification enables:
- **Swagger UI**: Interactive API explorer and testing interface
- **Code Generation**: Client SDKs in multiple programming languages
- **Validation**: Request/response validation for development and testing
- **Mock Servers**: Generate mock APIs for frontend development

## Usage

### View in Swagger UI
You can view the interactive documentation by:

1. **Online Swagger Editor**: 
   - Go to [editor.swagger.io](https://editor.swagger.io/)
   - Copy the content of `openapi.yaml` and paste it

2. **Local Swagger UI**:
   ```bash
   # Install swagger-ui-serve globally
   npm install -g swagger-ui-serve
   
   # Serve the specification
   swagger-ui-serve docs/openapi.yaml
   ```

3. **VS Code Extension**:
   - Install the "OpenAPI (Swagger) Editor" extension
   - Open `openapi.yaml` in VS Code
   - Use the preview feature

### Generate Client SDKs

Using OpenAPI Generator:
```bash
# Install OpenAPI Generator
npm install -g @openapitools/openapi-generator-cli

# Generate TypeScript client
openapi-generator-cli generate \
  -i docs/openapi.yaml \
  -g typescript-axios \
  -o clients/typescript

# Generate Python client
openapi-generator-cli generate \
  -i docs/openapi.yaml \
  -g python \
  -o clients/python

# Generate JavaScript client
openapi-generator-cli generate \
  -i docs/openapi.yaml \
  -g javascript \
  -o clients/javascript
```

### Validate API Responses

Using Postman:
1. Import the OpenAPI specification into Postman
2. Generate a collection from the spec
3. Use for automated testing and validation

### Development Testing

Use the specification for:
- **Request Validation**: Ensure your requests match the schema
- **Response Validation**: Verify API responses are correct
- **Contract Testing**: Ensure API implementation matches specification

## API Overview

### Base URLs
- **AWS Production**: `https://{api-id}.execute-api.{region}.amazonaws.com/prod`
- **LocalStack Development**: `http://localhost:4566/restapis/{api-id}/prod/_user_request_`

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/users` | Create a new user |
| GET | `/users/{id}` | Get user by ID |

### Authentication
Currently, the API does not require authentication. API Key authentication is defined in the spec for future use.

## Schema Documentation

### Request Schemas
- **CreateUserRequest**: User creation payload with id and name
- **Path Parameters**: User ID for retrieval operations

### Response Schemas
- **UserResponse**: Complete user data with timestamps
- **Error Responses**: Structured error handling for different scenarios

### Error Types
1. **ValidationError**: Input validation failures
2. **UserNotFoundError**: User does not exist
3. **DatabaseError**: DynamoDB operation failures
4. **Generic Errors**: Malformed requests, server errors

## Integration Examples

### cURL Examples
```bash
# Create a user
curl -X POST "https://YOUR_API_GATEWAY_URL/prod/users" \
  -H "Content-Type: application/json" \
  -d '{"id":"user-123","name":"John Doe"}'

# Get a user
curl -X GET "https://YOUR_API_GATEWAY_URL/prod/users/user-123"
```

### TypeScript Example
```typescript
import { UserAPI } from './generated-client';

const api = new UserAPI();

// Create user
const newUser = await api.createUser({
  id: 'user-123',
  name: 'John Doe'
});

// Get user
const user = await api.getUserById('user-123');
```

## Validation

The OpenAPI specification includes comprehensive validation rules:
- **String Patterns**: User IDs must match `^[a-zA-Z0-9\-_]+$`
- **Length Constraints**: Names and IDs have min/max length limits
- **Required Fields**: All mandatory fields are explicitly marked
- **Additional Properties**: Prevented to ensure strict contracts

## Architecture Alignment

The specification reflects the functional programming architecture:
- **Effect Library**: Error handling patterns match Effect's error types
- **Type Safety**: Schemas align with TypeScript domain models
- **AWS Best Practices**: Response formats follow AWS API Gateway patterns
- **DynamoDB Integration**: Timestamp handling matches DynamoDB storage

## Maintenance

Keep the specification updated when:
- Adding new endpoints
- Modifying request/response schemas
- Changing error handling
- Adding authentication
- Updating business rules

The specification should be the single source of truth for API contracts and be updated alongside code changes.
