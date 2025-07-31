import { APIGatewayProxyEvent, APIGatewayProxyResult, APIGatewayEventIdentity } from 'aws-lambda'
import { Effect } from 'effect'
import { withAuthContext, withoutAuth } from '../../src/lambda/utils/auth-context-middleware'
import { getUserContext } from '../../src/lambda/utils/auth'

// Mock the auth module
jest.mock('../../src/lambda/utils/auth', () => ({
  getUserContext: jest.fn()
}))

const mockGetUserContext = getUserContext as jest.MockedFunction<typeof getUserContext>

describe('Auth Context Middleware Coverage Tests', () => {
  let mockEvent: APIGatewayProxyEvent
  let mockHandler: jest.Mock
  let consoleLogSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance

  const createMockIdentity = (sourceIp = '192.168.1.100'): APIGatewayEventIdentity => ({
    sourceIp,
    accessKey: null,
    accountId: null,
    apiKey: null,
    apiKeyId: null,
    caller: null,
    cognitoAuthenticationProvider: null,
    cognitoAuthenticationType: null,
    cognitoIdentityId: null,
    cognitoIdentityPoolId: null,
    principalOrgId: null,
    user: null,
    userAgent: null,
    userArn: null,
    clientCert: null
  })

  const createUserContext = (userId: string, email = '', scope: string[] = [], tokenIssuer = '') => ({
    userId,
    email,
    scope,
    tokenIssuer
  })

  beforeEach(() => {
    // Create base mock event
    mockEvent = {
      body: null,
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'GET',
      isBase64Encoded: false,
      path: '/users',
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {
        accountId: '123456789012',
        apiId: 'test-api',
        protocol: 'HTTP/1.1',
        httpMethod: 'GET',
        path: '/users',
        stage: 'test',
        requestId: 'test-request-id',
        requestTime: '2025-01-01T00:00:00Z',
        requestTimeEpoch: 1640995200000,
        resourceId: 'test-resource',
        resourcePath: '/users',
        identity: createMockIdentity(),
        authorizer: {
          userId: 'test-user-123',
          email: 'test@example.com',
          scope: ['read', 'write']
        }
      },
      resource: '/users'
    }

    // Create mock handler that returns a successful response
    mockHandler = jest.fn().mockReturnValue(
      Effect.succeed({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'success' })
      })
    )

    // Setup spies
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    jest.clearAllMocks()
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe('withAuthContext', () => {
    describe('Health Check Path Handling', () => {
      it('should skip authentication for health check endpoint', async () => {
        // Test line 22: Health check path handling
        const healthEvent = {
          ...mockEvent,
          path: '/health',
          httpMethod: 'GET'
        }

        const wrappedHandler = withAuthContext(mockHandler)
        const result = await wrappedHandler(healthEvent)

        expect(result.statusCode).toBe(200)
        expect(mockHandler).toHaveBeenCalledWith(healthEvent, { userId: 'health-check' })
        // getUserContext should not be called for health checks
        expect(mockGetUserContext).not.toHaveBeenCalled()
      })

      it('should handle health check with missing request context gracefully', async () => {
        // Test edge case for health check
        const healthEvent = {
          ...mockEvent,
          path: '/health',
          requestContext: undefined as any
        }

        const wrappedHandler = withAuthContext(mockHandler)
        const result = await wrappedHandler(healthEvent)

        expect(result.statusCode).toBe(200)
        expect(mockHandler).toHaveBeenCalledWith(healthEvent, { userId: 'health-check' })
      })
    })

    describe('Missing User Context Error Handling', () => {
      it('should return 401 when getUserContext returns null', async () => {
        // Test lines 31-32: Missing user context error handling
        mockGetUserContext.mockReturnValue(null)

        const wrappedHandler = withAuthContext(mockHandler)
        const result = await wrappedHandler(mockEvent)

        expect(result.statusCode).toBe(401)
        expect(result.headers).toEqual({ 'Content-Type': 'application/json' })
        expect(result.body).toBe(JSON.stringify({ 
          message: 'Unauthorized - Invalid authorization context' 
        }))
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Missing user context - Lambda Authorizer may not be configured correctly'
        )
        expect(mockHandler).not.toHaveBeenCalled()
      })

      it('should return 401 when getUserContext returns context without userId', async () => {
        // Test lines 31-32: Missing user context error handling
        mockGetUserContext.mockReturnValue(createUserContext(''))

        const wrappedHandler = withAuthContext(mockHandler)
        const result = await wrappedHandler(mockEvent)

        expect(result.statusCode).toBe(401)
        expect(result.headers).toEqual({ 'Content-Type': 'application/json' })
        expect(result.body).toBe(JSON.stringify({ 
          message: 'Unauthorized - Invalid authorization context' 
        }))
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Missing user context - Lambda Authorizer may not be configured correctly'
        )
        expect(mockHandler).not.toHaveBeenCalled()
      })

      it('should return 401 when getUserContext returns context with null userId', async () => {
        // Test lines 31-32: Missing user context error handling
        mockGetUserContext.mockReturnValue(createUserContext(null as any))

        const wrappedHandler = withAuthContext(mockHandler)
        const result = await wrappedHandler(mockEvent)

        expect(result.statusCode).toBe(401)
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Missing user context - Lambda Authorizer may not be configured correctly'
        )
      })

      it('should return 401 when getUserContext returns context with undefined userId', async () => {
        // Test lines 31-32: Missing user context error handling
        mockGetUserContext.mockReturnValue(createUserContext(undefined as any))

        const wrappedHandler = withAuthContext(mockHandler)
        const result = await wrappedHandler(mockEvent)

        expect(result.statusCode).toBe(401)
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Missing user context - Lambda Authorizer may not be configured correctly'
        )
      })
    })

    describe('Successful Authentication Flow', () => {
      it('should handle successful authentication and logging', async () => {
        const userContext = createUserContext('test-user-123', 'test@example.com', ['read', 'write'], 'test-issuer')
        mockGetUserContext.mockReturnValue(userContext)

        const wrappedHandler = withAuthContext(mockHandler)
        const result = await wrappedHandler(mockEvent)

        expect(result.statusCode).toBe(200)
        expect(mockHandler).toHaveBeenCalledWith(mockEvent, userContext)
        
        // Verify AUTH_SUCCESS logging
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"eventType":"AUTH_SUCCESS"')
        )
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"userId":"test-user-123"')
        )
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"sourceIp":"192.168.1.100"')
        )
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"endpoint":"GET /users"')
        )

        // Verify API_REQUEST logging
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"eventType":"API_REQUEST"')
        )
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"statusCode":200')
        )
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"duration":')
        )
      })

      it('should handle missing User-Agent header gracefully', async () => {
        const userContext = createUserContext('test-user-123')
        mockGetUserContext.mockReturnValue(userContext)

        const eventWithoutUserAgent = {
          ...mockEvent,
          headers: {} // No User-Agent header
        }

        const wrappedHandler = withAuthContext(mockHandler)
        const result = await wrappedHandler(eventWithoutUserAgent)

        expect(result.statusCode).toBe(200)
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"userAgent":"unknown"')
        )
      })

      it('should handle lowercase user-agent header', async () => {
        const userContext = createUserContext('test-user-123')
        mockGetUserContext.mockReturnValue(userContext)

        const eventWithLowercaseUserAgent = {
          ...mockEvent,
          headers: {
            'user-agent': 'test-agent/1.0'
          }
        }

        const wrappedHandler = withAuthContext(mockHandler)
        const result = await wrappedHandler(eventWithLowercaseUserAgent)

        expect(result.statusCode).toBe(200)
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"userAgent":"test-agent/1.0"')
        )
      })

      it('should handle missing sourceIp gracefully', async () => {
        const userContext = createUserContext('test-user-123')
        mockGetUserContext.mockReturnValue(userContext)

        const eventWithoutSourceIp = {
          ...mockEvent,
          requestContext: {
            ...mockEvent.requestContext,
            identity: createMockIdentity('')
          }
        }

        const wrappedHandler = withAuthContext(mockHandler)
        const result = await wrappedHandler(eventWithoutSourceIp)

        expect(result.statusCode).toBe(200)
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"sourceIp":"unknown"')
        )
      })
    })

    describe('Error Handling', () => {
      it('should handle handler errors and return 500', async () => {
        // Test lines 69-72: Error logging and handling
        const userContext = createUserContext('test-user-123')
        mockGetUserContext.mockReturnValue(userContext)

        const error = new Error('Handler execution failed')
        mockHandler.mockReturnValue(Effect.fail(error))

        const wrappedHandler = withAuthContext(mockHandler)
        const result = await wrappedHandler(mockEvent)

        expect(result.statusCode).toBe(500)
        expect(result.headers).toEqual({ 'Content-Type': 'application/json' })
        expect(result.body).toBe(JSON.stringify({ message: 'Internal server error' }))
        expect(consoleErrorSpy).toHaveBeenCalledWith('Lambda execution error:', expect.any(Error))
      })

      it('should handle Effect.runPromise rejection', async () => {
        // Test lines 69-72: Error logging and handling with different error types
        const userContext = createUserContext('test-user-123')
        mockGetUserContext.mockReturnValue(userContext)

        // Create a handler that returns an Effect that will fail when run
        mockHandler.mockReturnValue(Effect.die('Critical failure'))

        const wrappedHandler = withAuthContext(mockHandler)
        const result = await wrappedHandler(mockEvent)

        expect(result.statusCode).toBe(500)
        expect(result.headers).toEqual({ 'Content-Type': 'application/json' })
        expect(result.body).toBe(JSON.stringify({ message: 'Internal server error' }))
        expect(consoleErrorSpy).toHaveBeenCalledWith('Lambda execution error:', expect.any(Error))
      })

      it('should handle handler throwing synchronous error', async () => {
        // Test lines 69-72: Error when handler itself throws
        const userContext = createUserContext('test-user-123')
        mockGetUserContext.mockReturnValue(userContext)

        mockHandler.mockImplementation(() => {
          throw new Error('Synchronous error')
        })

        const wrappedHandler = withAuthContext(mockHandler)
        const result = await wrappedHandler(mockEvent)

        expect(result.statusCode).toBe(500)
        expect(result.headers).toEqual({ 'Content-Type': 'application/json' })
        expect(result.body).toBe(JSON.stringify({ message: 'Internal server error' }))
        expect(consoleErrorSpy).toHaveBeenCalledWith('Lambda execution error:', expect.any(Error))
      })
    })
  })

  describe('withoutAuth', () => {
    describe('Successful Public Request Handling', () => {
      it('should handle public requests without authentication', async () => {
        // Test lines 88-112: The entire withoutAuth function
        const publicHandler = jest.fn().mockReturnValue(
          Effect.succeed({
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'healthy' })
          })
        )

        const wrappedHandler = withoutAuth(publicHandler)
        const result = await wrappedHandler(mockEvent)

        expect(result.statusCode).toBe(200)
        expect(publicHandler).toHaveBeenCalledWith(mockEvent)
        
        // Verify PUBLIC_REQUEST logging
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"eventType":"PUBLIC_REQUEST"')
        )
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"endpoint":"GET /users"')
        )
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"statusCode":200')
        )
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"duration":')
        )
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"sourceIp":"192.168.1.100"')
        )
      })

      it('should handle missing sourceIp in public requests', async () => {
        // Test edge case for public requests without sourceIp
        const publicHandler = jest.fn().mockReturnValue(
          Effect.succeed({
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'healthy' })
          })
        )

        const eventWithoutSourceIp = {
          ...mockEvent,
          requestContext: {
            ...mockEvent.requestContext,
            identity: createMockIdentity('')
          }
        }

        const wrappedHandler = withoutAuth(publicHandler)
        const result = await wrappedHandler(eventWithoutSourceIp)

        expect(result.statusCode).toBe(200)
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"sourceIp":"unknown"')
        )
      })

      it('should handle missing requestContext in public requests', async () => {
        // Test edge case for public requests without requestContext
        const publicHandler = jest.fn().mockReturnValue(
          Effect.succeed({
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'healthy' })
          })
        )

        const eventWithoutRequestContext = {
          ...mockEvent,
          requestContext: undefined as any
        }

        const wrappedHandler = withoutAuth(publicHandler)
        const result = await wrappedHandler(eventWithoutRequestContext)

        expect(result.statusCode).toBe(200)
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"sourceIp":"unknown"')
        )
      })
    })

    describe('Error Handling in Public Requests', () => {
      it('should handle errors in public handlers', async () => {
        // Test error handling in withoutAuth function
        const publicHandler = jest.fn().mockReturnValue(
          Effect.fail(new Error('Public handler failed'))
        )

        const wrappedHandler = withoutAuth(publicHandler)
        const result = await wrappedHandler(mockEvent)

        expect(result.statusCode).toBe(500)
        expect(result.headers).toEqual({ 'Content-Type': 'application/json' })
        expect(result.body).toBe(JSON.stringify({ message: 'Internal server error' }))
        expect(consoleErrorSpy).toHaveBeenCalledWith('Lambda execution error:', expect.any(Error))
      })

      it('should handle Effect.runPromise rejection in public handlers', async () => {
        // Test error handling with Effect.die in withoutAuth
        const publicHandler = jest.fn().mockReturnValue(Effect.die('Critical public failure'))

        const wrappedHandler = withoutAuth(publicHandler)
        const result = await wrappedHandler(mockEvent)

        expect(result.statusCode).toBe(500)
        expect(result.headers).toEqual({ 'Content-Type': 'application/json' })
        expect(result.body).toBe(JSON.stringify({ message: 'Internal server error' }))
        expect(consoleErrorSpy).toHaveBeenCalledWith('Lambda execution error:', expect.any(Error))
      })

      it('should handle synchronous errors in public handlers', async () => {
        // Test synchronous error handling in withoutAuth
        const publicHandler = jest.fn().mockImplementation(() => {
          throw new Error('Synchronous public error')
        })

        const wrappedHandler = withoutAuth(publicHandler)
        const result = await wrappedHandler(mockEvent)

        expect(result.statusCode).toBe(500)
        expect(result.headers).toEqual({ 'Content-Type': 'application/json' })
        expect(result.body).toBe(JSON.stringify({ message: 'Internal server error' }))
        expect(consoleErrorSpy).toHaveBeenCalledWith('Lambda execution error:', expect.any(Error))
      })
    })

    describe('Different HTTP Methods and Paths', () => {
      it('should handle POST requests correctly', async () => {
        const publicHandler = jest.fn().mockReturnValue(
          Effect.succeed({
            statusCode: 201,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ created: true })
          })
        )

        const postEvent = {
          ...mockEvent,
          httpMethod: 'POST',
          path: '/public/data'
        }

        const wrappedHandler = withoutAuth(publicHandler)
        const result = await wrappedHandler(postEvent)

        expect(result.statusCode).toBe(201)
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"endpoint":"POST /public/data"')
        )
      })

      it('should handle different response status codes', async () => {
        const publicHandler = jest.fn().mockReturnValue(
          Effect.succeed({
            statusCode: 404,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Not found' })
          })
        )

        const wrappedHandler = withoutAuth(publicHandler)
        const result = await wrappedHandler(mockEvent)

        expect(result.statusCode).toBe(404)
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('"statusCode":404')
        )
      })
    })
  })
})
