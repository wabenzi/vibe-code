import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { createUserHandler } from '../../src/lambda/create-user'
import { getUserHandler } from '../../src/lambda/get-user'
import { deleteUserHandler } from '../../src/lambda/delete-user'
import { handler as healthHandler } from '../../src/lambda/health'
import { Effect } from 'effect'

// Mock the DynamoDB service to avoid external dependencies
jest.mock('@aws-sdk/client-dynamodb')
jest.mock('@aws-sdk/lib-dynamodb')

const createMockAPIGatewayEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent => ({
  body: null,
  headers: {
    'X-Api-Key': 'tr5ycwc5m3' // Required API key for authentication
  },
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
      accessKey: null,
      accountId: null,
      apiKey: null,
      apiKeyId: null,
      caller: null,
      clientCert: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: '127.0.0.1',
      user: null,
      userAgent: 'test-agent',
      userArn: null,
    },
    authorizer: null,
  },
  resource: '/',
  ...overrides,
})

describe('Lambda Handlers - Source Code Tests', () => {
  
  describe('Health Handler', () => {
    it('should return healthy status', async () => {
      const event = createMockAPIGatewayEvent()
      const result: APIGatewayProxyResult = await healthHandler(event)

      expect(result.statusCode).toBe(200)
      expect(result.headers).toEqual({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'http://localhost:3000',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
        'Content-Security-Policy': 'default-src \'self\'',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      })
      
      const body = JSON.parse(result.body)
      expect(body.status).toBe('healthy')
      expect(body.service).toBe('user-management-api')
      expect(body.timestamp).toBeDefined()
    })
  })

  describe('Create User Handler', () => {
    beforeEach(() => {
      // Set up environment variables
      process.env.DYNAMODB_TABLE_NAME = 'test-users-table'
    })

    it('should return 400 for missing request body', async () => {
      const event = createMockAPIGatewayEvent({
        httpMethod: 'POST',
        body: null,
      })

      const result: APIGatewayProxyResult = await Effect.runPromise(createUserHandler(event))

      expect(result.statusCode).toBe(400)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Bad Request')
      expect(body.message).toBe('Request body is required')
    })

    it('should return 400 for invalid JSON', async () => {
      const event = createMockAPIGatewayEvent({
        httpMethod: 'POST',
        body: '{ invalid json }',
      })

      const result: APIGatewayProxyResult = await Effect.runPromise(createUserHandler(event))

      expect(result.statusCode).toBe(400)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Bad Request')
      expect(body.message).toBe('Invalid JSON in request body')
    })

    it('should return 400 for missing required fields', async () => {
      const event = createMockAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({}),
      })

      const result: APIGatewayProxyResult = await Effect.runPromise(createUserHandler(event))

      expect(result.statusCode).toBe(400)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Bad Request')
      expect(body.message).toBe('Request validation failed')
    })

    it('should return 400 for invalid data types', async () => {
      const event = createMockAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ id: 123, name: 456 }),
      })

      const result: APIGatewayProxyResult = await Effect.runPromise(createUserHandler(event))

      expect(result.statusCode).toBe(400)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Bad Request')
      expect(body.message).toBe('Request validation failed')
    })
  })

  describe('Get User Handler', () => {
    beforeEach(() => {
      process.env.DYNAMODB_TABLE_NAME = 'test-users-table'
    })

    it('should return 400 for missing user ID', async () => {
      const event = createMockAPIGatewayEvent({
        httpMethod: 'GET',
        pathParameters: null,
      })

      const mockUserContext = { userId: 'test-user', scope: ['read', 'write'] }
      const result: APIGatewayProxyResult = await Effect.runPromise(getUserHandler(event, mockUserContext))

      expect(result.statusCode).toBe(400)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Bad Request')
      expect(body.message).toBe('User ID is required')
    })

    it('should return 400 for invalid user ID format', async () => {
      const event = createMockAPIGatewayEvent({
        httpMethod: 'GET',
        pathParameters: { id: 'user/with/slashes' },
      })

      const mockUserContext = { userId: 'test-user', scope: ['read', 'write'] }
      const result: APIGatewayProxyResult = await Effect.runPromise(getUserHandler(event, mockUserContext))

      expect(result.statusCode).toBe(400)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Bad Request')
      expect(body.message).toBe('Invalid user ID format')
    })
  })

  describe('Delete User Handler', () => {
    beforeEach(() => {
      process.env.DYNAMODB_TABLE_NAME = 'test-users-table'
    })

    it('should return 400 for missing user ID', async () => {
      const event = createMockAPIGatewayEvent({
        httpMethod: 'DELETE',
        pathParameters: null,
      })

      const mockUserContext = { userId: 'test-user', scope: ['read', 'write'] }
      const result: APIGatewayProxyResult = await Effect.runPromise(deleteUserHandler(event, mockUserContext))

      expect(result.statusCode).toBe(400)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Bad Request')
      expect(body.message).toBe('User ID is required')
    })

    it('should return 400 for invalid user ID format', async () => {
      const event = createMockAPIGatewayEvent({
        httpMethod: 'DELETE',
        pathParameters: { id: 'user/with/slashes' },
      })

      const mockUserContext = { userId: 'test-user', scope: ['read', 'write'] }
      const result: APIGatewayProxyResult = await Effect.runPromise(deleteUserHandler(event, mockUserContext))

      expect(result.statusCode).toBe(400)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Bad Request')
      expect(body.message).toBe('Invalid user ID format')
    })
  })
})
