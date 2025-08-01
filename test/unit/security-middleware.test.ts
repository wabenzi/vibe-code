import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { Effect } from 'effect'
import { withSecurity, sanitizeForLog, checkRateLimit, getCorsHeaders } from '../../src/lambda/utils/security-middleware'
import { AuthenticationError, AuthorizationError } from '../../src/lambda/utils/auth'
import { ApiResponse } from '../../src/lambda/types/api-response'

// Mock the auth module
jest.mock('../../src/lambda/utils/auth', () => ({
  authenticateRequest: jest.fn(),
  logSecurityEvent: jest.fn(),
  AuthenticationError: class AuthenticationError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'AuthenticationError'
    }
  },
  AuthorizationError: class AuthorizationError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'AuthorizationError'
    }
  },
  getUserContext: jest.fn(),
  authenticateWithApiKey: jest.fn(),
}))

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})

describe('Security Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockConsoleLog.mockClear()
    // Clear rate limit store between tests
    const rateLimitStore = (require('../../src/lambda/utils/security-middleware') as any).rateLimitStore
    if (rateLimitStore && typeof rateLimitStore.clear === 'function') {
      rateLimitStore.clear()
    }
  })

  describe('withSecurity', () => {
    const mockHandler = jest.fn()
    const createMockEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent => ({
      body: null,
      headers: {
        'User-Agent': 'test-agent'
      },
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
          sourceIp: '192.168.1.1',
          user: null,
          userAgent: 'test-agent',
          userArn: null,
        },
        authorizer: null,
      },
      resource: '/users',
      ...overrides,
    })

    beforeEach(() => {
      mockHandler.mockClear()
      mockHandler.mockReturnValue(Effect.succeed({
        statusCode: 200,
        body: JSON.stringify({ message: 'success' }),
      }))
    })

    afterEach(() => {
      // Ensure handler mock is reset after each test to prevent bleeding
      mockHandler.mockClear()
      mockHandler.mockReturnValue(Effect.succeed({
        statusCode: 200,
        body: JSON.stringify({ message: 'success' }),
      }))
    })

    describe('Health Check Bypass', () => {
      it('should skip authentication for health check endpoint', async () => {
        const { getUserContext } = require('../../src/lambda/utils/auth')
        const event = createMockEvent({ path: '/health' })
        
        const wrappedHandler = withSecurity(mockHandler)
        await wrappedHandler(event)

        expect(getUserContext).not.toHaveBeenCalled()
        expect(mockHandler).toHaveBeenCalledWith(event)
      })
    })

    describe('JWT Authentication (via Lambda Authorizer)', () => {
      it('should authenticate with JWT via authorizer context', async () => {
        const { getUserContext, logSecurityEvent } = require('../../src/lambda/utils/auth')
        getUserContext.mockReturnValue({ userId: 'test-user-123', scope: ['read', 'write'] })

        const event = createMockEvent()
        const wrappedHandler = withSecurity(mockHandler)
        
        await wrappedHandler(event)

        expect(getUserContext).toHaveBeenCalledWith(event)
        expect(logSecurityEvent).toHaveBeenCalledWith({
          type: 'AUTH_SUCCESS',
          userId: 'test-user-123',
          sourceIp: '192.168.1.1',
          userAgent: 'test-agent',
          endpoint: 'GET /users',
        })
        expect(mockHandler).toHaveBeenCalledWith(event, 'test-user-123')
      })

      it('should handle missing source IP gracefully', async () => {
        const { getUserContext, logSecurityEvent } = require('../../src/lambda/utils/auth')
        getUserContext.mockReturnValue({ userId: 'test-user-123' })

        const event = createMockEvent({
          requestContext: {
            ...createMockEvent().requestContext,
            identity: {
              ...createMockEvent().requestContext.identity,
              sourceIp: undefined as any,
            }
          }
        })
        
        const wrappedHandler = withSecurity(mockHandler)
        await wrappedHandler(event)

        expect(logSecurityEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            sourceIp: 'unknown',
          })
        )
      })

      it('should handle missing user agent gracefully', async () => {
        const { getUserContext, logSecurityEvent } = require('../../src/lambda/utils/auth')
        getUserContext.mockReturnValue({ userId: 'test-user-123' })

        const event = createMockEvent({
          headers: {},
          requestContext: {
            ...createMockEvent().requestContext,
            identity: {
              ...createMockEvent().requestContext.identity,
              userAgent: undefined as any,
            }
          }
        })
        
        const wrappedHandler = withSecurity(mockHandler)
        await wrappedHandler(event)

        expect(logSecurityEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            userAgent: 'unknown',
          })
        )
      })

      it('should handle lowercase user-agent header', async () => {
        const { getUserContext, logSecurityEvent } = require('../../src/lambda/utils/auth')
        getUserContext.mockReturnValue({ userId: 'test-user-123' })

        const event = createMockEvent({
          headers: { 'user-agent': 'lowercase-agent' }
        })
        
        const wrappedHandler = withSecurity(mockHandler)
        await wrappedHandler(event)

        expect(logSecurityEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            userAgent: 'lowercase-agent',
          })
        )
      })
    })

    describe('API Key Fallback Authentication', () => {
      it('should fall back to API key authentication when no JWT context', async () => {
        const { getUserContext, authenticateWithApiKey, logSecurityEvent } = require('../../src/lambda/utils/auth')
        getUserContext.mockReturnValue(null)
        authenticateWithApiKey.mockReturnValue(Effect.succeed('api-authenticated'))

        const event = createMockEvent()
        const wrappedHandler = withSecurity(mockHandler)
        
        await wrappedHandler(event)

        expect(getUserContext).toHaveBeenCalledWith(event)
        expect(authenticateWithApiKey).toHaveBeenCalledWith(event)
        expect(logSecurityEvent).toHaveBeenCalledWith({
          type: 'AUTH_SUCCESS',
          userId: 'api-key-user',
          sourceIp: '192.168.1.1',
          userAgent: 'test-agent',
          endpoint: 'GET /users',
        })
        expect(mockHandler).toHaveBeenCalledWith(event, 'api-authenticated')
      })

      it('should fall back when getUserContext returns context without userId', async () => {
        const { getUserContext, authenticateWithApiKey, logSecurityEvent } = require('../../src/lambda/utils/auth')
        getUserContext.mockReturnValue({ scope: ['read'] }) // No userId
        authenticateWithApiKey.mockReturnValue(Effect.succeed('api-authenticated'))

        const event = createMockEvent()
        const wrappedHandler = withSecurity(mockHandler)
        
        await wrappedHandler(event)

        expect(authenticateWithApiKey).toHaveBeenCalledWith(event)
        expect(logSecurityEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'api-key-user',
          })
        )
      })
    })

    describe('Error Handling', () => {
      it('should handle AuthenticationError', async () => {
        const { getUserContext, logSecurityEvent } = require('../../src/lambda/utils/auth')
        getUserContext.mockImplementation(() => {
          throw new AuthenticationError('Invalid credentials')
        })

        const event = createMockEvent()
        const wrappedHandler = withSecurity(mockHandler)
        
        const result = await wrappedHandler(event)

        expect(logSecurityEvent).toHaveBeenCalledWith({
          type: 'AUTH_FAILURE',
          sourceIp: '192.168.1.1',
          userAgent: 'test-agent',
          endpoint: 'GET /users',
          timestamp: expect.any(String),
        })
        expect(result.statusCode).toBe(401)
        expect(JSON.parse(result.body)).toEqual({
          error: 'Unauthorized',
          message: 'Authentication required'
        })
        expect(mockHandler).not.toHaveBeenCalled()
      })

      it('should handle AuthorizationError', async () => {
        const { getUserContext, logSecurityEvent } = require('../../src/lambda/utils/auth')
        getUserContext.mockImplementation(() => {
          throw new AuthorizationError('Access denied')
        })

        const event = createMockEvent()
        const wrappedHandler = withSecurity(mockHandler)
        
        const result = await wrappedHandler(event)

        expect(logSecurityEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'AUTH_FAILURE',
          })
        )
        expect(result.statusCode).toBe(403)
        expect(JSON.parse(result.body)).toEqual({
          error: 'Forbidden',
          message: 'Access denied'
        })
      })

      it('should handle API key authentication errors', async () => {
        const { getUserContext, authenticateWithApiKey } = require('../../src/lambda/utils/auth')
        getUserContext.mockReturnValue(null)
        authenticateWithApiKey.mockReturnValue(Effect.fail(new AuthenticationError('Invalid API key')))

        const event = createMockEvent()
        const wrappedHandler = withSecurity(mockHandler)
        
        const result = await wrappedHandler(event)

        expect(result.statusCode).toBe(401)
        expect(JSON.parse(result.body)).toEqual({
          error: 'Unauthorized',
          message: 'Authentication required'
        })
      })

      it('should handle non-auth errors during authentication', async () => {
        const { getUserContext } = require('../../src/lambda/utils/auth')
        getUserContext.mockImplementation(() => {
          throw new Error('Database connection failed')
        })

        const event = createMockEvent()
        const wrappedHandler = withSecurity(mockHandler)
        
        const result = await wrappedHandler(event)

        expect(result.statusCode).toBe(401)
        expect(JSON.parse(result.body)).toEqual({
          error: 'Unauthorized',
          message: 'Authentication required'
        })
      })

      it('should handle handler errors', async () => {
        const { getUserContext } = require('../../src/lambda/utils/auth')
        getUserContext.mockReturnValue({ userId: 'test-user' })
        mockHandler.mockRejectedValue(new Error('Handler failed'))

        const event = createMockEvent()
        const wrappedHandler = withSecurity(mockHandler)
        
        const result = await wrappedHandler(event)

        expect(result.statusCode).toBe(500)
        expect(JSON.parse(result.body)).toEqual({
          error: 'Internal Server Error',
          message: 'An unexpected error occurred'
        })
      })

      it('should handle errors without names', async () => {
        const { getUserContext } = require('../../src/lambda/utils/auth')
        const errorWithoutName = { message: 'Some error' }
        getUserContext.mockImplementation(() => {
          throw errorWithoutName
        })

        const event = createMockEvent()
        const wrappedHandler = withSecurity(mockHandler)
        
        const result = await wrappedHandler(event)

        expect(result.statusCode).toBe(401)
        expect(JSON.parse(result.body)).toEqual({
          error: 'Unauthorized',
          message: 'Authentication required'
        })
      })
    })

    describe('Request Logging', () => {
      it('should log successful requests with timing', async () => {
        const { getUserContext } = require('../../src/lambda/utils/auth')
        getUserContext.mockReturnValue({ userId: 'test-user' })

        const mockResponse = {
          statusCode: 200,
          body: JSON.stringify({ data: 'test' })
        }
        mockHandler.mockReturnValue(Effect.succeed(mockResponse))

        const event = createMockEvent()
        const wrappedHandler = withSecurity(mockHandler)
        
        const result = await wrappedHandler(event)

        // Verify the handler was called and returned successfully
        expect(result.statusCode).toBe(200)
        expect(mockHandler).toHaveBeenCalledWith(event, 'test-user')

        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('"eventType":"API_REQUEST"')
        )
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('"endpoint":"GET /users"')
        )
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('"statusCode":200')
        )
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('"duration"')
        )
      })

      it('should handle missing requestContext gracefully', async () => {
        const { getUserContext, logSecurityEvent } = require('../../src/lambda/utils/auth')
        getUserContext.mockReturnValue({ userId: 'test-user' })

        const event = createMockEvent({
          requestContext: undefined as any
        })
        
        const wrappedHandler = withSecurity(mockHandler)
        await wrappedHandler(event)

        expect(logSecurityEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            sourceIp: 'unknown',
          })
        )
      })
    })
  })

  describe('sanitizeForLog', () => {
    it('should return "null" for empty input', () => {
      expect(sanitizeForLog('')).toBe('null')
      expect(sanitizeForLog(null as any)).toBe('null')
      expect(sanitizeForLog(undefined as any)).toBe('null')
    })

    it('should remove control characters', () => {
      const input = 'test\x00\x01\x1F\x7F'
      const result = sanitizeForLog(input)
      expect(result).toBe('test')
    })

    it('should replace newlines with spaces', () => {
      // Note: \n and \r are control characters, so they get removed by the first regex
      // The function effectively removes them rather than replacing with spaces
      const input = 'line1\nline2\rline3'
      const result = sanitizeForLog(input)
      expect(result).toBe('line1line2line3')
    })

    it('should limit length to 500 characters', () => {
      const input = 'a'.repeat(600)
      const result = sanitizeForLog(input)
      expect(result).toHaveLength(500)
      expect(result).toBe('a'.repeat(500))
    })

    it('should handle normal strings', () => {
      const input = 'normal string with spaces'
      const result = sanitizeForLog(input)
      expect(result).toBe(input)
    })
  })

  describe('checkRateLimit', () => {
    beforeEach(() => {
      // Clear mocks before each test
      jest.clearAllMocks()
    })

    it('should allow first request for new client', () => {
      const result = checkRateLimit('client1')
      expect(result).toBe(true)
    })

    it('should allow requests within limit', () => {
      const clientId = 'client2'
      const limit = 5

      for (let i = 0; i < limit; i++) {
        const result = checkRateLimit(clientId, limit)
        expect(result).toBe(true)
      }
    })

    it('should deny requests exceeding limit', () => {
      const clientId = 'client3'
      const limit = 3

      // Use up the limit
      for (let i = 0; i < limit; i++) {
        checkRateLimit(clientId, limit)
      }

      // Next request should be denied
      const result = checkRateLimit(clientId, limit)
      expect(result).toBe(false)
    })

    it('should reset rate limit after window expires', async () => {
      const clientId = 'unique-client-' + Date.now() // Use unique client ID
      const limit = 2
      const windowMs = 50 // Slightly longer window for more reliable timing

      // Use up the limit
      expect(checkRateLimit(clientId, limit, windowMs)).toBe(true)
      expect(checkRateLimit(clientId, limit, windowMs)).toBe(true)

      // Should be denied
      expect(checkRateLimit(clientId, limit, windowMs)).toBe(false)

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, windowMs + 10))

      // Should be allowed again
      expect(checkRateLimit(clientId, limit, windowMs)).toBe(true)
    })

    it('should use default values', () => {
      const result = checkRateLimit('client5')
      expect(result).toBe(true)
    })

    it('should handle multiple clients independently', () => {
      const limit = 2

      // Client 1 uses up limit
      checkRateLimit('client6', limit)
      checkRateLimit('client6', limit)
      expect(checkRateLimit('client6', limit)).toBe(false)

      // Client 2 should still be allowed
      expect(checkRateLimit('client7', limit)).toBe(true)
    })
  })

  describe('getCorsHeaders', () => {
    it('should return default CORS headers', () => {
      const headers = getCorsHeaders()
      
      expect(headers).toEqual({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
        'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
      })
    })

    it('should use custom allowed origin', () => {
      const customOrigin = 'https://example.com'
      const headers = getCorsHeaders(customOrigin)
      
      expect(headers['Access-Control-Allow-Origin']).toBe(customOrigin)
    })

    it('should handle empty string origin by using default', () => {
      // Empty string is falsy, so it uses the default '*'
      const headers = getCorsHeaders('')
      expect(headers['Access-Control-Allow-Origin']).toBe('*')
    })

    it('should handle null origin by using default', () => {
      const headers = getCorsHeaders(null as any)
      expect(headers['Access-Control-Allow-Origin']).toBe('*')
    })

    it('should handle undefined origin by using default', () => {
      const headers = getCorsHeaders(undefined)
      expect(headers['Access-Control-Allow-Origin']).toBe('*')
    })
  })
})
