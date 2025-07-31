import { mockClient } from 'aws-sdk-client-mock'
import { DynamoDBClient, ResourceNotFoundException, ProvisionedThroughputExceededException } from '@aws-sdk/client-dynamodb'
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  ScanCommand, 
  DeleteCommand
} from '@aws-sdk/lib-dynamodb'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { Effect } from 'effect'
import { DynamoUserRepository } from '../../src/infrastructure/dynamo-user-repository'
import { DynamoUserService } from '../../src/services/dynamo-user-service'
import { CreateUserRequest } from '../../src/domain/user'
import { createUserHandler } from '../../src/lambda/create-user'
import { getUserHandler } from '../../src/lambda/get-user'
import { deleteUserHandler } from '../../src/lambda/delete-user'

// Create AWS SDK mocks
const dynamoDBMock = mockClient(DynamoDBClient)
const docClientMock = mockClient(DynamoDBDocumentClient)

// Helper function to create test API Gateway events
const createAPIGatewayEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent => ({
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

describe('Comprehensive AWS DynamoDB Error Testing', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    dynamoDBMock.reset()
    docClientMock.reset()
    
    // Set test environment
    process.env.DYNAMODB_TABLE_NAME = 'users-table'
    process.env.AWS_REGION = 'us-west-2'
  })

  afterEach(() => {
    // Clean up environment
    delete process.env.DYNAMODB_TABLE_NAME
    delete process.env.AWS_REGION
  })

  describe('DynamoDB Error Scenarios', () => {
    describe('Repository Level - DynamoDB Errors', () => {
      it('should handle ResourceNotFoundException (table not found)', async () => {
        // Arrange
        const request: CreateUserRequest = { id: 'test-user', name: 'Test User' }
        const resourceNotFoundError = new ResourceNotFoundException({
          message: 'Table users-table not found',
          $metadata: { httpStatusCode: 400 }
        })
        
        docClientMock.on(PutCommand).rejects(resourceNotFoundError)

        // Act & Assert
        const effect = DynamoUserRepository.create(request)
        await expect(Effect.runPromise(effect)).rejects.toThrow('Table users-table not found')
        
        // Verify the AWS SDK was called
        expect(docClientMock.calls()).toHaveLength(1)
        const putCall = docClientMock.call(0)
        expect((putCall.args[0].input as any).TableName).toBe('users-table')
      })

      it('should handle ProvisionedThroughputExceededException (throttling)', async () => {
        // Arrange
        const request: CreateUserRequest = { id: 'test-user', name: 'Test User' }
        const throughputError = new ProvisionedThroughputExceededException({
          message: 'The level of configured provisioned throughput for the table was exceeded',
          $metadata: { httpStatusCode: 400 }
        })
        
        docClientMock.on(PutCommand).rejects(throughputError)

        // Act & Assert
        const effect = DynamoUserRepository.create(request)
        await expect(Effect.runPromise(effect)).rejects.toThrow('provisioned throughput')
        
        expect(docClientMock.calls()).toHaveLength(1)
      })

      it('should handle ConditionalCheckFailedException (constraint violation)', async () => {
        // Arrange
        const request: CreateUserRequest = { id: 'existing-user', name: 'Existing User' }
        const conditionalCheckError = new Error('ConditionalCheckFailedException')
        conditionalCheckError.name = 'ConditionalCheckFailedException'
        conditionalCheckError.message = 'The conditional request failed'
        
        docClientMock.on(PutCommand).rejects(conditionalCheckError)

        // Act & Assert
        const effect = DynamoUserRepository.create(request)
        await expect(Effect.runPromise(effect)).rejects.toThrow('conditional request failed')
        
        expect(docClientMock.calls()).toHaveLength(1)
      })

      it('should handle ValidationException (invalid input)', async () => {
        // Arrange
        const request: CreateUserRequest = { id: 'test-user', name: 'Test User' }
        const validationError = new Error('ValidationException')
        validationError.name = 'ValidationException'
        validationError.message = 'Invalid attribute value'
        
        docClientMock.on(PutCommand).rejects(validationError)

        // Act & Assert
        const effect = DynamoUserRepository.create(request)
        await expect(Effect.runPromise(effect)).rejects.toThrow('Invalid attribute value')
        
        expect(docClientMock.calls()).toHaveLength(1)
      })

      it('should handle ServiceUnavailableException (AWS service down)', async () => {
        // Arrange
        const request: CreateUserRequest = { id: 'test-user', name: 'Test User' }
        const serviceError = new Error('ServiceUnavailableException')
        serviceError.name = 'ServiceUnavailableException'
        serviceError.message = 'Service is currently unavailable'
        
        docClientMock.on(PutCommand).rejects(serviceError)

        // Act & Assert
        const effect = DynamoUserRepository.create(request)
        await expect(Effect.runPromise(effect)).rejects.toThrow('Service is currently unavailable')
        
        expect(docClientMock.calls()).toHaveLength(1)
      })

      it('should handle InternalServerError (AWS internal error)', async () => {
        // Arrange
        const userId = 'test-user'
        const internalError = new Error('InternalServerError')
        internalError.name = 'InternalServerError'
        internalError.message = 'An internal error occurred'
        
        docClientMock.on(GetCommand).rejects(internalError)

        // Act & Assert
        const effect = DynamoUserRepository.findById(userId)
        await expect(Effect.runPromise(effect)).rejects.toThrow('An internal error occurred')
        
        expect(docClientMock.calls()).toHaveLength(1)
        const getCall = docClientMock.call(0)
        expect((getCall.args[0].input as any).TableName).toBe('users-table')
        expect((getCall.args[0].input as any).Key.id).toBe(userId)
      })

      it('should handle ItemCollectionSizeLimitExceededException (item too large)', async () => {
        // Arrange
        const request: CreateUserRequest = { id: 'large-user', name: 'User with Large Data' }
        const itemSizeError = new Error('ItemCollectionSizeLimitExceededException')
        itemSizeError.name = 'ItemCollectionSizeLimitExceededException'
        itemSizeError.message = 'Item collection size limit exceeded'
        
        docClientMock.on(PutCommand).rejects(itemSizeError)

        // Act & Assert
        const effect = DynamoUserRepository.create(request)
        await expect(Effect.runPromise(effect)).rejects.toThrow('Item collection size limit exceeded')
        
        expect(docClientMock.calls()).toHaveLength(1)
      })

      it('should handle AccessDeniedException (permission error)', async () => {
        // Arrange
        const accessError = new Error('AccessDeniedException')
        accessError.name = 'AccessDeniedException'
        accessError.message = 'User is not authorized to perform this action'
        
        docClientMock.on(ScanCommand).rejects(accessError)

        // Act & Assert
        const effect = DynamoUserRepository.findAll()
        await expect(Effect.runPromise(effect)).rejects.toThrow('User is not authorized to perform this action')
        
        expect(docClientMock.calls()).toHaveLength(1)
        const scanCall = docClientMock.call(0)
        expect((scanCall.args[0].input as any).TableName).toBe('users-table')
      })

      it('should handle RequestLimitExceeded (API rate limiting)', async () => {
        // Arrange
        const userId = 'rate-limited-user'
        const rateLimitError = new Error('RequestLimitExceeded')
        rateLimitError.name = 'RequestLimitExceeded'
        rateLimitError.message = 'Too many requests'
        
        docClientMock.on(GetCommand).rejects(rateLimitError)

        // Act & Assert
        const effect = DynamoUserRepository.findById(userId)
        await expect(Effect.runPromise(effect)).rejects.toThrow('Too many requests')
        
        expect(docClientMock.calls()).toHaveLength(1)
      })

      it('should handle TransactionConflictException (transaction errors)', async () => {
        // Arrange
        const userId = 'transaction-user'
        const transactionError = new Error('TransactionConflictException')
        transactionError.name = 'TransactionConflictException'
        transactionError.message = 'Transaction request cannot be processed'
        
        docClientMock.on(DeleteCommand).rejects(transactionError)

        // Act & Assert
        // First mock findById to succeed, then delete to fail
        docClientMock.on(GetCommand).resolves({
          Item: {
            id: userId,
            name: 'Transaction User',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z'
          }
        })
        
        const effect = DynamoUserRepository.deleteById(userId)
        await expect(Effect.runPromise(effect)).rejects.toThrow('Transaction request cannot be processed')
        
        expect(docClientMock.calls()).toHaveLength(2) // findById + delete
      })
    })

    describe('Service Level - Error Propagation', () => {
      it('should propagate DynamoDB errors through service layer', async () => {
        // Arrange
        const request: CreateUserRequest = { id: 'service-user', name: 'Service User' }
        const throughputError = new ProvisionedThroughputExceededException({
          message: 'Request rate is too high',
          $metadata: { httpStatusCode: 400 }
        })
        
        docClientMock.on(PutCommand).rejects(throughputError)

        // Act & Assert
        const effect = DynamoUserService.createUser(request)
        await expect(Effect.runPromise(effect)).rejects.toThrow('Request rate is too high')
        
        expect(docClientMock.calls()).toHaveLength(1)
      })

      it('should handle network timeouts in service layer', async () => {
        // Arrange
        const userId = 'timeout-user'
        const timeoutError = new Error('NetworkingError')
        timeoutError.name = 'NetworkingError'
        timeoutError.message = 'Socket timeout after 30000ms'
        
        docClientMock.on(GetCommand).rejects(timeoutError)

        // Act & Assert
        const effect = DynamoUserService.getUserById(userId)
        await expect(Effect.runPromise(effect)).rejects.toThrow('Socket timeout')
        
        expect(docClientMock.calls()).toHaveLength(1)
      })

      it('should handle connection errors in service layer', async () => {
        // Arrange
        const connectionError = new Error('ECONNREFUSED')
        connectionError.name = 'ECONNREFUSED'
        connectionError.message = 'connect ECONNREFUSED 127.0.0.1:8000'
        
        docClientMock.on(ScanCommand).rejects(connectionError)

        // Act & Assert
        const effect = DynamoUserService.getAllUsers()
        await expect(Effect.runPromise(effect)).rejects.toThrow('ECONNREFUSED')
        
        expect(docClientMock.calls()).toHaveLength(1)
      })
    })

    describe('Lambda Handler Level - Error Handling', () => {
      it('should handle DynamoDB errors in Lambda create handler', async () => {
        // Arrange
        const event = createAPIGatewayEvent({
          httpMethod: 'POST',
          body: JSON.stringify({ id: 'lambda-user', name: 'Lambda User' })
        })
        
        const resourceError = new ResourceNotFoundException({
          message: 'Table does not exist',
          $metadata: { httpStatusCode: 400 }
        })
        
        docClientMock.on(PutCommand).rejects(resourceError)

        // Act
        const result = await Effect.runPromise(createUserHandler(event)) as APIGatewayProxyResult

        // Assert
        expect(result.statusCode).toBe(500)
        const body = JSON.parse(result.body)
        expect(body.error).toBe('Internal Server Error')
        expect(body.message).toBe('Database operation failed')
        expect(body.details).toEqual({
          type: 'DynamoUserRepositoryError',
          details: expect.stringContaining('Failed to create user:'),
          cause: expect.any(String)
        })
        
        expect(docClientMock.calls()).toHaveLength(1)
      })

      it('should handle throughput exceeded in Lambda get handler', async () => {
        // Arrange
        const event = createAPIGatewayEvent({
          httpMethod: 'GET',
          pathParameters: { id: 'throttled-user' }
        })
        
        const throughputError = new ProvisionedThroughputExceededException({
          message: 'Throughput exceeded',
          $metadata: { httpStatusCode: 400 }
        })
        
        docClientMock.on(GetCommand).rejects(throughputError)

        // Act
        const result = await Effect.runPromise(getUserHandler(event)) as APIGatewayProxyResult

        // Assert
        expect(result.statusCode).toBe(500)
        const body = JSON.parse(result.body)
        expect(body.error).toBe('Internal Server Error')
        expect(body.message).toBe('Database operation failed')
        expect(body.details).toEqual({
          type: 'DynamoUserRepositoryError',
          details: expect.stringContaining('Failed to find user by id'),
          cause: expect.any(String)
        })
        
        expect(docClientMock.calls()).toHaveLength(1)
      })

      it('should handle access denied in Lambda delete handler', async () => {
        // Arrange
        const event = createAPIGatewayEvent({
          httpMethod: 'DELETE',
          pathParameters: { id: 'restricted-user' }
        })
        
        const accessError = new Error('AccessDeniedException')
        accessError.name = 'AccessDeniedException'
        accessError.message = 'Access denied for this operation'
        
        docClientMock.on(GetCommand).rejects(accessError)

        // Act
        const result = await Effect.runPromise(deleteUserHandler(event)) as APIGatewayProxyResult

        // Assert
        expect(result.statusCode).toBe(500)
        const body = JSON.parse(result.body)
        expect(body.error).toBe('Internal Server Error')
        expect(body.message).toBe('Database operation failed')
        expect(body.details).toEqual({
          type: 'DynamoUserRepositoryError',
          details: expect.stringContaining('Failed to find user by id'),
          cause: expect.any(String)
        })
        
        expect(docClientMock.calls()).toHaveLength(1)
      })
    })

    describe('Comprehensive Error Recovery Scenarios', () => {
      it('should test error recovery patterns with retries', async () => {
        // Arrange - First call fails, second succeeds
        const request: CreateUserRequest = { id: 'retry-user', name: 'Retry User' }
        
        docClientMock.on(PutCommand)
          .rejectsOnce(new ProvisionedThroughputExceededException({
            message: 'Throttled',
            $metadata: { httpStatusCode: 400 }
          }))
          .resolvesOnce({})

        // Act - First attempt should fail
        const failEffect = DynamoUserRepository.create(request)
        await expect(Effect.runPromise(failEffect)).rejects.toThrow('Throttled')

        // Second attempt should succeed
        const successEffect = DynamoUserRepository.create(request)
        const user = await Effect.runPromise(successEffect)

        // Assert
        expect(user.id).toBe('retry-user')
        expect(docClientMock.calls()).toHaveLength(2)
      })

      it('should test cascading error scenarios', async () => {
        // Arrange - Multiple error types in sequence
        const userId = 'cascade-user'
        
        docClientMock.on(GetCommand)
          .rejectsOnce(new Error('NetworkingError'))
          .rejectsOnce(new ProvisionedThroughputExceededException({
            message: 'Throttled',
            $metadata: { httpStatusCode: 400 }
          }))
          .resolvesOnce({
            Item: {
              id: userId,
              name: 'Cascade User',
              createdAt: '2025-01-01T00:00:00.000Z',
              updatedAt: '2025-01-01T00:00:00.000Z'
            }
          })

        // Act & Assert - Test different error types
        const networkEffect = DynamoUserRepository.findById(userId)
        await expect(Effect.runPromise(networkEffect)).rejects.toThrow('NetworkingError')

        const throttleEffect = DynamoUserRepository.findById(userId)
        await expect(Effect.runPromise(throttleEffect)).rejects.toThrow('Throttled')

        const successEffect = DynamoUserRepository.findById(userId)
        const user = await Effect.runPromise(successEffect)
        expect(user.id).toBe(userId)

        expect(docClientMock.calls()).toHaveLength(3)
      })

      it('should test concurrent error scenarios', async () => {
        // Arrange
        const request1: CreateUserRequest = { id: 'concurrent-user-1', name: 'User 1' }
        const request2: CreateUserRequest = { id: 'concurrent-user-2', name: 'User 2' }
        
        // First request succeeds, second gets throttled
        docClientMock.on(PutCommand)
          .resolvesOnce({})
          .rejectsOnce(new ProvisionedThroughputExceededException({
            message: 'Throttled due to high concurrency',
            $metadata: { httpStatusCode: 400 }
          }))

        // Act
        const effect1 = DynamoUserRepository.create(request1)
        const effect2 = DynamoUserRepository.create(request2)

        // Assert
        const user1 = await Effect.runPromise(effect1)
        expect(user1.id).toBe('concurrent-user-1')

        await expect(Effect.runPromise(effect2)).rejects.toThrow('high concurrency')

        expect(docClientMock.calls()).toHaveLength(2)
      })
    })
  })
})
