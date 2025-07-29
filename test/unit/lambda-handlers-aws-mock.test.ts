import { mockClient } from 'aws-sdk-client-mock'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { handler as createUserHandler } from '../../src/lambda/create-user'
import { handler as getUserHandler } from '../../src/lambda/get-user'
import { handler as deleteUserHandler } from '../../src/lambda/delete-user'
import { handler as healthHandler } from '../../src/lambda/health'

// Create AWS SDK mocks
const dynamoDBMock = mockClient(DynamoDBClient)
const docClientMock = mockClient(DynamoDBDocumentClient)

// Helper function to create test API Gateway events
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

describe('Lambda Handlers with Real Services and AWS SDK Mocks', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    dynamoDBMock.reset()
    docClientMock.reset()
    
    // Set test environment
    process.env.DYNAMODB_TABLE_NAME = 'test-users-table'
    process.env.AWS_REGION = 'us-west-2'
  })

  afterEach(() => {
    // Clean up environment
    delete process.env.DYNAMODB_TABLE_NAME
    delete process.env.AWS_REGION
  })

  describe('Health Handler', () => {
    it('should return healthy status', async () => {
      // Arrange
      const event = createAPIGatewayEvent()

      // Act
      const result = await healthHandler(event)

      // Assert
      expect(result.statusCode).toBe(200)
      const body = JSON.parse(result.body)
      expect(body.status).toBe('healthy')
      expect(body.service).toBe('user-management-api')
      expect(body.timestamp).toBeDefined()
    })
  })

  describe('Create User Handler', () => {
    it('should successfully create a user with real service logic', async () => {
      // Arrange
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          id: 'lambda-test-user',
          name: 'Lambda Test User'
        })
      })

      // Mock successful DynamoDB put operation
      docClientMock.on(PutCommand).resolves({})

      // Act
      const result = await createUserHandler(event) as APIGatewayProxyResult

      // Assert
      expect(result.statusCode).toBe(201)
      const body = JSON.parse(result.body)
      expect(body.id).toBe('lambda-test-user')
      expect(body.name).toBe('Lambda Test User')
      expect(body.createdAt).toBeDefined()
      expect(body.updatedAt).toBeDefined()

      // Verify the handler used the real service which called AWS SDK
      expect(docClientMock.calls()).toHaveLength(1)
      const putCall = docClientMock.call(0)
      expect(putCall.args[0].input).toMatchObject({
        TableName: 'users-table',
        Item: {
          id: 'lambda-test-user',
          name: 'Lambda Test User',
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        ConditionExpression: 'attribute_not_exists(id)',
      })
    })

    it('should handle validation errors from real validation logic', async () => {
      // Arrange
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          id: '', // Invalid: empty ID
          name: 'Test User'
        })
      })

      // Act
      const result = await createUserHandler(event) as APIGatewayProxyResult

      // Assert
      expect(result.statusCode).toBe(400)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Validation Error')
      expect(body.message).toBe('Request validation failed')

      // Verify no AWS SDK calls were made due to validation failure
      expect(docClientMock.calls()).toHaveLength(0)
    })

    it('should handle DynamoDB errors from real repository', async () => {
      // Arrange
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          id: 'failing-user',
          name: 'Failing User'
        })
      })

      // Mock DynamoDB to fail - use callsFake with Promise.reject
      docClientMock.on(PutCommand).callsFake(() => 
        Promise.reject(new Error('DynamoDB connection failed'))
      )

      // Act
      const result = await createUserHandler(event) as APIGatewayProxyResult

      // Assert
      expect(result.statusCode).toBe(500)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Database Error')
      expect(body.message).toBe('Failed to create user: Error: DynamoDB connection failed')

      // Verify the AWS SDK was called
      expect(docClientMock.calls()).toHaveLength(1)
    })

    it('should handle duplicate user creation (conditional check failure)', async () => {
      // Arrange
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          id: 'existing-user',
          name: 'Existing User'
        })
      })

      // Mock conditional check failure - return rejected promise
      docClientMock.on(PutCommand).callsFake(() => {
        const error = new Error('ConditionalCheckFailedException')
        error.name = 'ConditionalCheckFailedException'
        return Promise.reject(error)
      })

      // Act
      const result = await createUserHandler(event) as APIGatewayProxyResult

      // Assert
      expect(result.statusCode).toBe(500)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Database Error')
      expect(body.message).toBe('Failed to create user: ConditionalCheckFailedException: ConditionalCheckFailedException')
    })
  })

  describe('Get User Handler', () => {
    it('should successfully retrieve a user with real service logic', async () => {
      // Arrange
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        pathParameters: { id: 'lambda-get-user' }
      })

      const mockUserData = {
        Item: {
          id: 'lambda-get-user',
          name: 'Lambda Retrieved User',
          createdAt: '2025-01-01T12:00:00.000Z',
          updatedAt: '2025-01-01T12:00:00.000Z',
        }
      }
      
      docClientMock.on(GetCommand).resolves(mockUserData)

      // Act
      const result = await getUserHandler(event) as APIGatewayProxyResult

      // Assert
      expect(result.statusCode).toBe(200)
      const body = JSON.parse(result.body)
      expect(body.id).toBe('lambda-get-user')
      expect(body.name).toBe('Lambda Retrieved User')
      expect(body.createdAt).toBe('2025-01-01T12:00:00.000Z')
      expect(body.updatedAt).toBe('2025-01-01T12:00:00.000Z')

      // Verify the handler used the real service which called AWS SDK
      expect(docClientMock.calls()).toHaveLength(1)
      const getCall = docClientMock.call(0)
      expect(getCall.args[0].input).toMatchObject({
        TableName: 'users-table',
        Key: { id: 'lambda-get-user' },
      })
    })

    it('should handle user not found with real error handling', async () => {
      // Arrange
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        pathParameters: { id: 'non-existent-user' }
      })

      // Mock empty response (user not found)
      docClientMock.on(GetCommand).resolves({})

      // Act
      const result = await getUserHandler(event) as APIGatewayProxyResult

      // Assert
      expect(result.statusCode).toBe(404)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('User not found')
      expect(body.message).toContain('User with id non-existent-user not found')

      // Verify the AWS SDK was called
      expect(docClientMock.calls()).toHaveLength(1)
    })

    it('should handle missing path parameters', async () => {
      // Arrange
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        pathParameters: null
      })

      // Act
      const result = await getUserHandler(event) as APIGatewayProxyResult

      // Assert
      expect(result.statusCode).toBe(400)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('User ID is required')
      // No message field to check since error is the message

      // Verify no AWS SDK calls were made
      expect(docClientMock.calls()).toHaveLength(0)
    })
  })

  describe('Delete User Handler', () => {
    it('should successfully delete a user with real service logic', async () => {
      // Arrange
      const event = createAPIGatewayEvent({
        httpMethod: 'DELETE',
        pathParameters: { id: 'lambda-delete-user' }
      })

      // Mock successful findById followed by successful delete
      docClientMock.on(GetCommand).resolves({
        Item: {
          id: 'lambda-delete-user',
          name: 'Lambda User To Delete',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        }
      })
      docClientMock.on(DeleteCommand).resolves({})

      // Act
      const result = await deleteUserHandler(event) as APIGatewayProxyResult

      // Assert
      expect(result.statusCode).toBe(204)
      expect(result.body).toBe('{}') // Our standardized response returns empty JSON object

      // Verify the handler used the real service which called AWS SDK
      expect(docClientMock.calls()).toHaveLength(2) // findById + delete
      
      const getCall = docClientMock.call(0)
      expect(getCall.args[0].input).toMatchObject({
        TableName: 'users-table',
        Key: { id: 'lambda-delete-user' },
      })
      
      const deleteCall = docClientMock.call(1)
      expect(deleteCall.args[0].input).toMatchObject({
        TableName: 'users-table',
        Key: { id: 'lambda-delete-user' },
      })
    })

    it('should handle delete of non-existent user', async () => {
      // Arrange
      const event = createAPIGatewayEvent({
        httpMethod: 'DELETE',
        pathParameters: { id: 'non-existent-delete-user' }
      })

      // Mock findById returning empty (user not found)
      docClientMock.on(GetCommand).resolves({})

      // Act
      const result = await deleteUserHandler(event) as APIGatewayProxyResult

      // Assert
      expect(result.statusCode).toBe(404)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('User not found')
      expect(body.message).toContain('User with id non-existent-delete-user not found')

      // Verify only findById was called, not delete
      expect(docClientMock.calls()).toHaveLength(1)
    })

    it('should handle missing path parameters for delete', async () => {
      // Arrange
      const event = createAPIGatewayEvent({
        httpMethod: 'DELETE',
        pathParameters: null
      })

      // Act
      const result = await deleteUserHandler(event) as APIGatewayProxyResult

      // Assert
      expect(result.statusCode).toBe(400)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('User ID is required')
      // No message field to check since error is the message

      // Verify no AWS SDK calls were made
      expect(docClientMock.calls()).toHaveLength(0)
    })
  })

  describe('End-to-End Lambda Workflow', () => {
    it('should handle complete user lifecycle with real services', async () => {
      // Test creating a user, retrieving it, then deleting it
      const userId = 'lifecycle-test-user'
      const userName = 'Lifecycle Test User'

      // 1. Create User
      const createEvent = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ id: userId, name: userName })
      })

      docClientMock.on(PutCommand).resolves({})
      
      const createResult = await createUserHandler(createEvent) as APIGatewayProxyResult
      expect(createResult.statusCode).toBe(201)

      // 2. Retrieve User
      const getEvent = createAPIGatewayEvent({
        httpMethod: 'GET',
        pathParameters: { id: userId }
      })

      docClientMock.on(GetCommand).resolves({
        Item: {
          id: userId,
          name: userName,
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        }
      })

      const getResult = await getUserHandler(getEvent) as APIGatewayProxyResult
      expect(getResult.statusCode).toBe(200)
      const retrievedUser = JSON.parse(getResult.body)
      expect(retrievedUser.id).toBe(userId)
      expect(retrievedUser.name).toBe(userName)

      // 3. Delete User
      const deleteEvent = createAPIGatewayEvent({
        httpMethod: 'DELETE',
        pathParameters: { id: userId }
      })

      // Mock findById for delete operation
      docClientMock.on(GetCommand).resolves({
        Item: {
          id: userId,
          name: userName,
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        }
      })
      docClientMock.on(DeleteCommand).resolves({})

      const deleteResult = await deleteUserHandler(deleteEvent) as APIGatewayProxyResult
      expect(deleteResult.statusCode).toBe(204)

      // Verify all AWS SDK operations were called
      expect(docClientMock.calls().length).toBeGreaterThan(0)
    })
  })
})
