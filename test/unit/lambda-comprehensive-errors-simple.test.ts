import { mockClient } from 'aws-sdk-client-mock'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { handler as CreateUserHandler } from '../../src/lambda/create-user'
import { handler as GetUserHandler } from '../../src/lambda/get-user'
import { handler as DeleteUserHandler } from '../../src/lambda/delete-user'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

// Create mock instances
const dynamoDBMock = mockClient(DynamoDBClient)
const docClientMock = mockClient(DynamoDBDocumentClient)

describe('Comprehensive Lambda Error Testing', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    dynamoDBMock.reset()
    docClientMock.reset()
    
    // Set test environment
    process.env.DYNAMODB_TABLE_NAME = 'users-table'
    process.env.AWS_REGION = 'us-west-2'
  })

  describe('DynamoDB Service Errors in Lambda Context', () => {
    test('should handle AccessDeniedException in CreateUser Lambda with AWS mock error', async () => {
      // Mock AWS SDK error
      const accessDeniedError = new Error('Access Denied')
      accessDeniedError.name = 'AccessDeniedException'
      ;(accessDeniedError as any).statusCode = 403
      ;(accessDeniedError as any).$metadata = { httpStatusCode: 403 }

      docClientMock.on(PutCommand).rejects(accessDeniedError)

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/users',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        isBase64Encoded: false,
        body: JSON.stringify({
          id: 'test-user-1',
          name: 'John Doe'
        })
      }

      const result = await CreateUserHandler(event) as APIGatewayProxyResult

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body)).toEqual({
        error: 'Internal Server Error',
        message: 'Database operation failed',
        details: expect.objectContaining({
          type: expect.stringContaining('Error'),
          details: expect.any(String)
        })
      })
      expect(docClientMock.calls()).toHaveLength(1)
    })

    test('should handle AccessDeniedException in GetUser Lambda', async () => {
      const accessDeniedError = new Error('Access Denied')
      accessDeniedError.name = 'AccessDeniedException'
      ;(accessDeniedError as any).statusCode = 403
      ;(accessDeniedError as any).$metadata = { httpStatusCode: 403 }

      docClientMock.on(GetCommand).rejects(accessDeniedError)

      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/users/123',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: { id: '123' },
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        isBase64Encoded: false,
        body: null
      }

      const result = await GetUserHandler(event) as APIGatewayProxyResult

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body)).toEqual({
        error: 'Internal Server Error',
        message: 'Database operation failed',
        details: expect.objectContaining({
          type: expect.stringContaining('Error'),
          details: expect.any(String)
        })
      })
      expect(docClientMock.calls()).toHaveLength(1)
    })

    test('should handle ThrottlingException in CreateUser Lambda', async () => {
      const throttlingError = new Error('Request rate too high')
      throttlingError.name = 'ThrottlingException'
      ;(throttlingError as any).statusCode = 400
      ;(throttlingError as any).$metadata = { httpStatusCode: 400 }

      docClientMock.on(PutCommand).rejects(throttlingError)

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/users',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        isBase64Encoded: false,
        body: JSON.stringify({
          id: 'test-user-2',
          name: 'Jane Doe'
        })
      }

      const result = await CreateUserHandler(event) as APIGatewayProxyResult

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body)).toEqual({
        error: 'Internal Server Error',
        message: 'Database operation failed',
        details: expect.objectContaining({
          type: expect.stringContaining('Error'),
          details: expect.any(String)
        })
      })
      expect(docClientMock.calls()).toHaveLength(1)
    })

    test('should handle ValidationException in CreateUser Lambda', async () => {
      const validationError = new Error('Invalid parameter value')
      validationError.name = 'ValidationException'
      ;(validationError as any).statusCode = 400
      ;(validationError as any).$metadata = { httpStatusCode: 400 }

      docClientMock.on(PutCommand).rejects(validationError)

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/users',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        isBase64Encoded: false,
        body: JSON.stringify({
          id: 'test-user-3',
          name: 'Bob Smith'
        })
      }

      const result = await CreateUserHandler(event) as APIGatewayProxyResult

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body)).toEqual({
        error: 'Internal Server Error',
        message: 'Database operation failed',
        details: expect.objectContaining({
          type: expect.stringContaining('Error'),
          details: expect.any(String)
        })
      })
      expect(docClientMock.calls()).toHaveLength(1)
    })

    test('should handle ConditionalCheckFailedException in CreateUser Lambda', async () => {
      const conditionalError = new Error('Conditional check failed')
      conditionalError.name = 'ConditionalCheckFailedException'
      ;(conditionalError as any).statusCode = 400
      ;(conditionalError as any).$metadata = { httpStatusCode: 400 }

      docClientMock.on(PutCommand).rejects(conditionalError)

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/users',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        isBase64Encoded: false,
        body: JSON.stringify({
          id: 'existing-user',
          name: 'Existing User'
        })
      }

      const result = await CreateUserHandler(event) as APIGatewayProxyResult

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body)).toEqual({
        error: 'Internal Server Error',
        message: 'Database operation failed',
        details: expect.objectContaining({
          type: expect.stringContaining('Error'),
          details: expect.any(String)
        })
      })
      expect(docClientMock.calls()).toHaveLength(1)
    })

    test('should handle ResourceNotFoundException in DeleteUser Lambda', async () => {
      const notFoundError = new Error('Table not found')
      notFoundError.name = 'ResourceNotFoundException'
      ;(notFoundError as any).statusCode = 400
      ;(notFoundError as any).$metadata = { httpStatusCode: 400 }

      docClientMock.on(DeleteCommand).rejects(notFoundError)

      const event: APIGatewayProxyEvent = {
        httpMethod: 'DELETE',
        path: '/users/789',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: { id: '789' },
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        isBase64Encoded: false,
        body: null
      }

      const result = await DeleteUserHandler(event) as APIGatewayProxyResult

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body)).toEqual({
        error: 'Internal Server Error',
        message: 'Database operation failed',
        details: expect.objectContaining({
          type: expect.stringContaining('Error'),
          details: expect.any(String)
        })
      })
      expect(docClientMock.calls()).toHaveLength(1)
    })

    test('should handle NetworkingError in GetUser Lambda', async () => {
      const networkError = new Error('Network timeout')
      networkError.name = 'NetworkingError'
      ;(networkError as any).statusCode = 500
      ;(networkError as any).$metadata = { httpStatusCode: 500 }

      docClientMock.on(GetCommand).rejects(networkError)

      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/users/network-fail',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: { id: 'network-fail' },
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        isBase64Encoded: false,
        body: null
      }

      const result = await GetUserHandler(event) as APIGatewayProxyResult

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body)).toEqual({
        error: 'Internal Server Error',
        message: 'Database operation failed',
        details: expect.objectContaining({
          type: expect.stringContaining('Error'),
          details: expect.any(String)
        })
      })
      expect(docClientMock.calls()).toHaveLength(1)
    })

    test('should handle TimeoutError in GetUser Lambda', async () => {
      const timeoutError = new Error('Request timeout')
      timeoutError.name = 'TimeoutError'
      ;(timeoutError as any).statusCode = 408
      ;(timeoutError as any).$metadata = { httpStatusCode: 408 }

      docClientMock.on(GetCommand).rejects(timeoutError)

      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/users/timeout-fail',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: { id: 'timeout-fail' },
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        isBase64Encoded: false,
        body: null
      }

      const result = await GetUserHandler(event) as APIGatewayProxyResult

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body)).toEqual({
        error: 'Internal Server Error',
        message: 'Database operation failed',
        details: expect.objectContaining({
          type: expect.stringContaining('Error'),
          details: expect.any(String)
        })
      })
      expect(docClientMock.calls()).toHaveLength(1)
    })
  })

  describe('Lambda Runtime Error Scenarios', () => {
    test('should handle missing body in CreateUser Lambda', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/users',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        isBase64Encoded: false,
        body: null // Missing body
      }

      const result = await CreateUserHandler(event) as APIGatewayProxyResult

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body)).toEqual({
        error: 'Bad Request',
        message: 'Request body is required',
        details: ['Request body cannot be empty']
      })
      expect(docClientMock.calls()).toHaveLength(0)
    })

    test('should handle invalid JSON in CreateUser Lambda', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/users',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        isBase64Encoded: false,
        body: '{ invalid json' // Invalid JSON
      }

      const result = await CreateUserHandler(event) as APIGatewayProxyResult

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body)).toEqual({
        error: 'Bad Request',
        message: 'Invalid JSON in request body',
        details: ['Body must be valid JSON']
      })
      expect(docClientMock.calls()).toHaveLength(0)
    })

    test('should handle missing required fields in CreateUser Lambda', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/users',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        isBase64Encoded: false,
        body: JSON.stringify({
          name: 'John Doe'
          // Missing id field
        })
      }

      const result = await CreateUserHandler(event) as APIGatewayProxyResult

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body)).toEqual({
        error: 'Bad Request',
        message: 'Request validation failed',
        details: expect.arrayContaining([
          expect.stringContaining('is missing')
        ])
      })
      expect(docClientMock.calls()).toHaveLength(0)
    })

    test('should handle missing path parameters in GetUser Lambda', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/users/',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null, // Missing path parameters
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        isBase64Encoded: false,
        body: null
      }

      const result = await GetUserHandler(event) as APIGatewayProxyResult

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body)).toEqual({
        error: 'Bad Request',
        message: 'User ID is required',
        details: ['User ID parameter is missing']
      })
      expect(docClientMock.calls()).toHaveLength(0)
    })

    test('should handle missing DYNAMODB_TABLE_NAME environment variable', async () => {
      // Temporarily remove the environment variable
      const originalTableName = process.env.DYNAMODB_TABLE_NAME
      delete process.env.DYNAMODB_TABLE_NAME

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/users',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        isBase64Encoded: false,
        body: JSON.stringify({
          id: 'env-test-user',
          name: 'Environment Test User'
        })
      }

      const result = await CreateUserHandler(event) as APIGatewayProxyResult

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body)).toEqual({
        error: 'Internal Server Error',
        message: 'Database operation failed',
        details: expect.objectContaining({
          type: expect.stringContaining('Error'),
          details: expect.any(String)
        })
      })

      // Restore the environment variable
      process.env.DYNAMODB_TABLE_NAME = originalTableName
    })
  })

  describe('Combined Error Scenarios', () => {
    test('should handle cascading DynamoDB errors across multiple operations', async () => {
      // First operation fails with AccessDenied
      const accessDeniedError = new Error('Access Denied')
      accessDeniedError.name = 'AccessDeniedException'
      ;(accessDeniedError as any).statusCode = 403
      ;(accessDeniedError as any).$metadata = { httpStatusCode: 403 }

      docClientMock.on(PutCommand).rejects(accessDeniedError)

      const createEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/users',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        isBase64Encoded: false,
        body: JSON.stringify({
          id: 'cascade-test-1',
          name: 'Cascade Test User'
        })
      }

      const createResult = await CreateUserHandler(createEvent) as APIGatewayProxyResult

      expect(createResult.statusCode).toBe(500)
      expect(JSON.parse(createResult.body)).toEqual({
        error: 'Internal Server Error',
        message: 'Database operation failed',
        details: expect.objectContaining({
          type: expect.stringContaining('Error'),
          details: expect.any(String)
        })
      })

      // Reset mock for second operation
      docClientMock.reset()

      // Second operation fails with ThrottlingException
      const throttlingError = new Error('Request rate too high')
      throttlingError.name = 'ThrottlingException'
      ;(throttlingError as any).statusCode = 400
      ;(throttlingError as any).$metadata = { httpStatusCode: 400 }

      docClientMock.on(GetCommand).rejects(throttlingError)

      const getEvent: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/users/cascade-test-2',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: { id: 'cascade-test-2' },
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        isBase64Encoded: false,
        body: null
      }

      const getResult = await GetUserHandler(getEvent) as APIGatewayProxyResult

      expect(getResult.statusCode).toBe(500)
      expect(JSON.parse(getResult.body)).toEqual({
        error: 'Internal Server Error',
        message: 'Database operation failed',
        details: expect.objectContaining({
          type: expect.stringContaining('Error'),
          details: expect.any(String)
        })
      })
    })

    test('should handle mixed validation and DynamoDB errors', async () => {
      // Test invalid input first (validation error)
      const invalidEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/users',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        isBase64Encoded: false,
        body: null // Invalid: missing body
      }

      const invalidResult = await CreateUserHandler(invalidEvent) as APIGatewayProxyResult

      expect(invalidResult.statusCode).toBe(400)
      expect(JSON.parse(invalidResult.body)).toEqual({
        error: 'Bad Request',
        message: 'Request body is required',
        details: ['Request body cannot be empty']
      })

      // Then test DynamoDB error with valid input
      const dbError = new Error('Database error')
      dbError.name = 'InternalServerError'
      ;(dbError as any).statusCode = 500
      ;(dbError as any).$metadata = { httpStatusCode: 500 }

      docClientMock.on(PutCommand).rejects(dbError)

      const validEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/users',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        isBase64Encoded: false,
        body: JSON.stringify({
          id: 'mixed-error-user',
          name: 'Mixed Error User'
        })
      }

      const dbResult = await CreateUserHandler(validEvent) as APIGatewayProxyResult

      expect(dbResult.statusCode).toBe(500)
      expect(JSON.parse(dbResult.body)).toEqual({
        error: 'Internal Server Error',
        message: 'Database operation failed',
        details: expect.objectContaining({
          type: expect.stringContaining('Error'),
          details: expect.any(String)
        })
      })
    })
  })
})
