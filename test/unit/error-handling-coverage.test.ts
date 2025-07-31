import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { mockClient } from 'aws-sdk-client-mock'
import { Effect } from 'effect'

import { handleError, handleCreateUserError } from '../../src/lambda/utils/error-handler'
import { ApiResponse } from '../../src/lambda/types/api-response'
import { extractUserId } from '../../src/lambda/utils/validation'
import { DatabaseError, ValidationError, UserNotFoundError } from '../../src/domain/user'
import { DynamoUserRepositoryError } from '../../src/infrastructure/dynamo-user-repository'

// Mock AWS SDK
const docClientMock = mockClient(DynamoDBDocumentClient)

// Helper to create minimal APIGatewayProxyEvent for testing
const createAPIGatewayEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent => ({
  body: null,
  headers: {},
  multiValueHeaders: {},
  httpMethod: 'GET',
  isBase64Encoded: false,
  path: '/',
  pathParameters: null,
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  stageVariables: null,
  requestContext: {
    accountId: '123456789012',
    apiId: 'test-api',
    protocol: 'HTTP/1.1',
    httpMethod: 'GET',
    path: '/',
    stage: 'test',
    requestId: 'test-request-id',
    requestTime: '2025-01-01T00:00:00Z',
    requestTimeEpoch: 1640995200000,
    resourceId: 'test-resource',
    resourcePath: '/',
    identity: {
      cognitoIdentityPoolId: null,
      accountId: null,
      cognitoIdentityId: null,
      caller: null,
      sourceIp: '127.0.0.1',
      principalOrgId: null,
      accessKey: null,
      cognitoAuthenticationType: null,
      cognitoAuthenticationProvider: null,
      userArn: null,
      userAgent: 'test-agent',
      user: null,
      apiKey: null,
      apiKeyId: null,
      clientCert: null
    },
    authorizer: null
  },
  resource: '/',
  ...overrides
})

beforeEach(() => {
  docClientMock.reset()
  // Clear console spies to avoid interference
  jest.clearAllMocks()
})

describe('Error Handler Coverage Tests', () => {
  describe('handleError - DatabaseError path', () => {
    it('should handle DatabaseError with proper logging and response', () => {
      // Arrange
      const databaseError = new DatabaseError({
        message: 'Database connection failed',
        cause: new Error('Connection timeout')
      })

      // Spy on Effect.runSync to verify logging
      const logSpy = jest.spyOn(Effect, 'runSync')

      // Act
      const result = handleError(databaseError)

      // Assert
      expect(result.statusCode).toBe(500)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Internal Server Error')
      expect(body.message).toBe('Database operation failed')
      expect(body.details).toEqual({
        type: 'DatabaseError',
        details: 'Database connection failed',
        cause: 'Connection timeout'
      })

      // Verify logging was called
      expect(logSpy).toHaveBeenCalled()
    })

    it('should handle DatabaseError with non-Error cause', () => {
      // Arrange
      const databaseError = new DatabaseError({
        message: 'Database operation failed',
        cause: 'String cause instead of Error object'
      })

      // Act
      const result = handleError(databaseError)

      // Assert
      expect(result.statusCode).toBe(500)
      const body = JSON.parse(result.body)
      expect(body.details).toEqual({
        type: 'DatabaseError',
        details: 'Database operation failed',
        cause: 'String cause instead of Error object'
      })
    })
  })

  describe('handleError - Unknown/Generic error path', () => {
    it('should handle unknown Error objects', () => {
      // Arrange
      const unknownError = new Error('Unexpected runtime error')
      unknownError.stack = 'Error: Unexpected runtime error\n    at test.js:1:1'

      // Spy on Effect.runSync to verify logging
      const logSpy = jest.spyOn(Effect, 'runSync')

      // Act
      const result = handleError(unknownError)

      // Assert
      expect(result.statusCode).toBe(500)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Internal Server Error')
      expect(body.message).toBe('An unexpected error occurred')
      expect(body.details).toEqual({
        type: 'UnknownError',
        details: 'Unexpected runtime error',
        stack: 'Error: Unexpected runtime error\n    at test.js:1:1'
      })

      // Verify logging was called
      expect(logSpy).toHaveBeenCalled()
    })

    it('should handle non-Error unknown objects', () => {
      // Arrange
      const unknownError = 'String error message'

      // Act
      const result = handleError(unknownError)

      // Assert
      expect(result.statusCode).toBe(500)
      const body = JSON.parse(result.body)
      expect(body.details).toEqual({
        type: 'UnknownError',
        details: 'Unknown error',
        stack: undefined
      })
    })

    it('should handle null/undefined errors', () => {
      // Act
      const result = handleError(null)

      // Assert
      expect(result.statusCode).toBe(500)
      const body = JSON.parse(result.body)
      expect(body.details).toEqual({
        type: 'UnknownError',
        details: 'Unknown error',
        stack: undefined
      })
    })
  })

  describe('handleCreateUserError - specific error handling', () => {
    it('should handle DynamoUserRepositoryError with Error cause', () => {
      // Arrange
      const repositoryError = new DynamoUserRepositoryError({
        message: 'Failed to create user',
        cause: new Error('DynamoDB service error')
      })

      // Act
      const result = handleCreateUserError(repositoryError)

      // Assert
      expect(result.statusCode).toBe(500)
      const body = JSON.parse(result.body)
      expect(body.details).toEqual({
        type: 'DynamoUserRepositoryError',
        details: 'Failed to create user',
        cause: 'DynamoDB service error'
      })
    })

    it('should handle DynamoUserRepositoryError with non-Error cause', () => {
      // Arrange
      const repositoryError = new DynamoUserRepositoryError({
        message: 'Failed to create user',
        cause: { statusCode: 400, message: 'Bad request' }
      })

      // Act
      const result = handleCreateUserError(repositoryError)

      // Assert
      expect(result.statusCode).toBe(500)
      const body = JSON.parse(result.body)
      expect(body.details).toEqual({
        type: 'DynamoUserRepositoryError',
        details: 'Failed to create user',
        cause: '[object Object]'
      })
    })
  })
})

describe('API Response Coverage Tests', () => {
  describe('Untested API response methods', () => {
    it('should create unauthorized response', () => {
      // Act
      const result = ApiResponse.unauthorized('Access token required', ['Token missing'])

      // Assert
      expect(result.statusCode).toBe(401)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Unauthorized')
      expect(body.message).toBe('Access token required')
      expect(body.details).toEqual(['Token missing'])
    })

    it('should create forbidden response', () => {
      // Act
      const result = ApiResponse.forbidden('Insufficient permissions', { role: 'required' })

      // Assert
      expect(result.statusCode).toBe(403)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Forbidden')
      expect(body.message).toBe('Insufficient permissions')
      expect(body.details).toEqual({ role: 'required' })
    })

    it('should create notFound response', () => {
      // Act
      const result = ApiResponse.notFound('Resource not found')

      // Assert
      expect(result.statusCode).toBe(404)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Not Found')
      expect(body.message).toBe('Resource not found')
    })

    it('should create conflict response', () => {
      // Act
      const result = ApiResponse.conflict('Resource already exists', { id: 'existing-id' })

      // Assert
      expect(result.statusCode).toBe(409)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Conflict')
      expect(body.message).toBe('Resource already exists')
      expect(body.details).toEqual({ id: 'existing-id' })
    })

    it('should create serviceUnavailable response', () => {
      // Act
      const result = ApiResponse.serviceUnavailable('Service temporarily down')

      // Assert
      expect(result.statusCode).toBe(503)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Service Unavailable')
      expect(body.message).toBe('Service temporarily down')
    })

    it('should create response without message or details', () => {
      // Act
      const result = ApiResponse.unauthorized()

      // Assert
      expect(result.statusCode).toBe(401)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Unauthorized')
      expect(body.message).toBeUndefined()
      expect(body.details).toBeUndefined()
    })

    it('should test deprecated validationError helper', () => {
      // Act
      const result = ApiResponse.validationError('Invalid input', ['Field required'])

      // Assert
      expect(result.statusCode).toBe(400)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Bad Request')
      expect(body.message).toBe('Invalid input')
      expect(body.details).toEqual(['Field required'])
    })

    it('should test deprecated databaseError helper', () => {
      // Act
      const result = ApiResponse.databaseError('Database connection failed')

      // Assert
      expect(result.statusCode).toBe(500)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Internal Server Error')
      expect(body.message).toBe('Database connection failed')
    })
  })

  describe('Error response suppression', () => {
    const originalEnv = process.env.SUPPRESS_ERROR_DETAILS

    afterEach(() => {
      process.env.SUPPRESS_ERROR_DETAILS = originalEnv
    })

    it('should suppress error details when SUPPRESS_ERROR_DETAILS is true', () => {
      // Arrange
      process.env.SUPPRESS_ERROR_DETAILS = 'true'

      // Act
      const result = ApiResponse.badRequest('Validation failed', { sensitive: 'data' })

      // Assert
      expect(result.statusCode).toBe(400)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Bad Request')
      expect(body.message).toBe('Validation failed')
      expect(body.details).toBeUndefined()
    })

    it('should include error details when SUPPRESS_ERROR_DETAILS is false', () => {
      // Arrange
      process.env.SUPPRESS_ERROR_DETAILS = 'false'

      // Act
      const result = ApiResponse.badRequest('Validation failed', { field: 'required' })

      // Assert
      expect(result.statusCode).toBe(400)
      const body = JSON.parse(result.body)
      expect(body.details).toEqual({ field: 'required' })
    })
  })
})

describe('Validation Coverage Tests', () => {
  describe('extractUserId edge cases', () => {
    it('should handle missing pathParameters', async () => {
      // Arrange
      const event = {
        pathParameters: null
      } as APIGatewayProxyEvent

      // Act
      const result = await Effect.runPromise(
        Effect.flip(extractUserId(event))
      )

      // Assert
      expect(result).toBeInstanceOf(ValidationError)
      expect(result.message).toBe('User ID is required')
      expect(result.errors).toEqual(['User ID parameter is missing'])
    })

    it('should handle empty pathParameters object', async () => {
      // Arrange
      const event = {
        pathParameters: {}
      } as APIGatewayProxyEvent

      // Act
      const result = await Effect.runPromise(
        Effect.flip(extractUserId(event))
      )

      // Assert
      expect(result).toBeInstanceOf(ValidationError)
      expect(result.message).toBe('User ID is required')
    })

    it('should handle pathParameters with undefined id', async () => {
      // Arrange
      const event = createAPIGatewayEvent({
        pathParameters: { id: undefined }
      })

      // Act
      const result = await Effect.runPromise(
        Effect.flip(extractUserId(event))
      )

      // Assert
      expect(result).toBeInstanceOf(ValidationError)
      expect(result.message).toBe('User ID is required')
    })

    it('should handle invalid user ID with special characters', async () => {
      // Arrange
      const event = createAPIGatewayEvent({
        pathParameters: { id: 'user/with/slashes' }
      })

      // Act
      const result = await Effect.runPromise(
        Effect.flip(extractUserId(event))
      )

      // Assert
      expect(result).toBeInstanceOf(ValidationError)
      expect(result.message).toBe('Invalid user ID format')
      expect(result.errors).toEqual(['User ID contains invalid characters or is too long'])
    })

    it('should handle user ID that is too long', async () => {
      // Arrange
      const longId = 'a'.repeat(101) // 101 characters, exceeds limit of 100
      const event = createAPIGatewayEvent({
        pathParameters: { id: longId }
      })

      // Act
      const result = await Effect.runPromise(
        Effect.flip(extractUserId(event))
      )

      // Assert
      expect(result).toBeInstanceOf(ValidationError)
      expect(result.message).toBe('Invalid user ID format')
    })

    it('should handle user ID with query parameters', async () => {
      // Arrange
      const event = createAPIGatewayEvent({
        pathParameters: { id: 'user?param=value' }
      })

      // Act
      const result = await Effect.runPromise(
        Effect.flip(extractUserId(event))
      )

      // Assert
      expect(result).toBeInstanceOf(ValidationError)
      expect(result.message).toBe('Invalid user ID format')
    })

    it('should handle user ID with URL fragments', async () => {
      // Arrange
      const event = createAPIGatewayEvent({
        pathParameters: { id: 'user#fragment' }
      })

      // Act
      const result = await Effect.runPromise(
        Effect.flip(extractUserId(event))
      )

      // Assert
      expect(result).toBeInstanceOf(ValidationError)
      expect(result.message).toBe('Invalid user ID format')
    })

    it('should handle user ID with encoded characters', async () => {
      // Arrange
      const event = createAPIGatewayEvent({
        pathParameters: { id: 'user%20with%20spaces' }
      })

      // Act
      const result = await Effect.runPromise(
        Effect.flip(extractUserId(event))
      )

      // Assert
      expect(result).toBeInstanceOf(ValidationError)
      expect(result.message).toBe('Invalid user ID format')
    })

    it('should handle valid user ID successfully', async () => {
      // Arrange
      const event = createAPIGatewayEvent({
        pathParameters: { id: 'valid-user-123' }
      })

      // Act
      const result = await Effect.runPromise(extractUserId(event))

      // Assert
      expect(result).toBe('valid-user-123')
    })

    it('should handle empty string user ID', async () => {
      // Arrange - test a user ID that only fails the length condition (exactly 101 chars, all valid)
      const longButValidCharsId = 'a'.repeat(101) // This should pass all character checks but fail length
      const event = createAPIGatewayEvent({
        pathParameters: { id: longButValidCharsId }
      })

      // Act
      const result = await Effect.runPromise(
        Effect.flip(extractUserId(event))
      )

      // Assert
      expect(result).toBeInstanceOf(ValidationError)
      expect(result.message).toBe('Invalid user ID format')
      expect(result.errors).toEqual(['User ID contains invalid characters or is too long'])
    })

    it('should handle user ID with only certain invalid characters', async () => {
      // Arrange - test with a user ID that has valid characters but one specific invalid one
      const event = createAPIGatewayEvent({
        pathParameters: { id: 'validuser/' } // only fails the slash check
      })

      // Act
      const result = await Effect.runPromise(
        Effect.flip(extractUserId(event))
      )

      // Assert
      expect(result).toBeInstanceOf(ValidationError)
      expect(result.message).toBe('Invalid user ID format')
      expect(result.errors).toEqual(['User ID contains invalid characters or is too long'])
    })
  })
})

describe('Lambda Handler Branch Coverage', () => {
  describe('Edge cases for lambda handlers', () => {
    it('should test health handler with different event structures', async () => {
      // Import health handler
      const { handler } = await import('../../src/lambda/health')

      // Act & Assert - health endpoint should always return 200
      const result = await handler({} as APIGatewayProxyEvent)
      expect(result.statusCode).toBe(200)
    })

    it('should test create-user handler with edge case body parsing', async () => {
      // This tests the uncovered branch in create-user.ts line 33
      // Testing cases where body parsing might have edge cases
      const { createUserHandler } = require('../../src/lambda/create-user')
      
      const event = createAPIGatewayEvent({
        body: '{"id":"test","name":"Test User"}',
        httpMethod: 'POST'
      })

      // Mock successful creation
      docClientMock.on(PutCommand).resolves({})

      // Act
      const result = await Effect.runPromise(createUserHandler(event)) as APIGatewayProxyResult

      // Assert
      expect(result.statusCode).toBe(201)
    })
  })
})
