import { APIGatewayProxyEvent } from 'aws-lambda'
import { Effect } from 'effect'
import {
  AuthenticationError,
  AuthorizationError,
  authenticateRequest,
  authenticateWithApiKey,
  authorizeUserAccess,
  extractUserFromAuth,
  getUserContext,
  logSecurityEvent
} from '../../src/lambda/utils/auth'

// Mock console.log for security logging tests
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})

describe('Authentication Utilities', () => {
  beforeEach(() => {
    mockConsoleLog.mockClear()
    mockConsoleLog.mockReset()
    delete process.env.VALID_API_KEY
  })

  afterAll(() => {
    mockConsoleLog.mockRestore()
  })

  describe('AuthenticationError', () => {
    it('should create authentication error with correct name and message', () => {
      const error = new AuthenticationError('Authentication failed')
      
      expect(error.name).toBe('AuthenticationError')
      expect(error.message).toBe('Authentication failed')
      expect(error).toBeInstanceOf(Error)
    })
  })

  describe('AuthorizationError', () => {
    it('should create authorization error with correct name and message', () => {
      const error = new AuthorizationError('Access denied')
      
      expect(error.name).toBe('AuthorizationError')
      expect(error.message).toBe('Access denied')
      expect(error).toBeInstanceOf(Error)
    })
  })

  describe('authenticateRequest', () => {
    it('should succeed when authorizer context has userId', async () => {
      const event = {
        requestContext: {
          authorizer: {
            userId: 'test-user-123'
          }
        }
      } as any as APIGatewayProxyEvent

      const result = await Effect.runPromise(authenticateRequest(event))
      expect(result).toBe('test-user-123')
    })

    it('should succeed when authorizer context has principalId', async () => {
      const event = {
        requestContext: {
          authorizer: {
            principalId: 'principal-456'
          }
        }
      } as any as APIGatewayProxyEvent

      const result = await Effect.runPromise(authenticateRequest(event))
      expect(result).toBe('principal-456')
    })

    it('should prefer userId over principalId when both exist', async () => {
      const event = {
        requestContext: {
          authorizer: {
            userId: 'user-123',
            principalId: 'principal-456'
          }
        }
      } as any as APIGatewayProxyEvent

      const result = await Effect.runPromise(authenticateRequest(event))
      expect(result).toBe('user-123')
    })

    it('should fail when no authorizer context exists', async () => {
      const event = {
        requestContext: {}
      } as any as APIGatewayProxyEvent

      await expect(Effect.runPromise(authenticateRequest(event)))
        .rejects.toThrow('No authorization context found')
    })

    it('should fail when authorizer context exists but has no userId or principalId', async () => {
      const event = {
        requestContext: {
          authorizer: {
            email: 'test@example.com'
          }
        }
      } as any as APIGatewayProxyEvent

      await expect(Effect.runPromise(authenticateRequest(event)))
        .rejects.toThrow('No user ID found in authorization context')
    })

    it('should fail when authorizer context has empty userId', async () => {
      const event = {
        requestContext: {
          authorizer: {
            userId: ''
          }
        }
      } as any as APIGatewayProxyEvent

      await expect(Effect.runPromise(authenticateRequest(event)))
        .rejects.toThrow('No user ID found in authorization context')
    })
  })

  describe('authenticateWithApiKey', () => {
    beforeEach(() => {
      process.env.VALID_API_KEY = 'test-api-key-123'
    })

    it('should succeed with valid API key in x-api-key header', async () => {
      const event = {
        headers: {
          'x-api-key': 'test-api-key-123'
        }
      } as any as APIGatewayProxyEvent

      const result = await Effect.runPromise(authenticateWithApiKey(event))
      expect(result).toBe('test-api-key-123')
    })

    it('should succeed with valid API key in X-API-Key header', async () => {
      const event = {
        headers: {
          'X-API-Key': 'test-api-key-123'
        }
      } as any as APIGatewayProxyEvent

      const result = await Effect.runPromise(authenticateWithApiKey(event))
      expect(result).toBe('test-api-key-123')
    })

    it('should succeed with valid API key in X-Api-Key header', async () => {
      const event = {
        headers: {
          'X-Api-Key': 'test-api-key-123'
        }
      } as any as APIGatewayProxyEvent

      const result = await Effect.runPromise(authenticateWithApiKey(event))
      expect(result).toBe('test-api-key-123')
    })

    it('should use default API key when VALID_API_KEY is not set', async () => {
      delete process.env.VALID_API_KEY
      
      const event = {
        headers: {
          'x-api-key': 'tr5ycwc5m3'
        }
      } as any as APIGatewayProxyEvent

      const result = await Effect.runPromise(authenticateWithApiKey(event))
      expect(result).toBe('tr5ycwc5m3')
    })

    it('should fail when no API key header is present', async () => {
      const event = {
        headers: {}
      } as any as APIGatewayProxyEvent

      await expect(Effect.runPromise(authenticateWithApiKey(event)))
        .rejects.toThrow('API key is required')
    })

    it('should fail with invalid API key', async () => {
      const event = {
        headers: {
          'x-api-key': 'invalid-key'
        }
      } as any as APIGatewayProxyEvent

      await expect(Effect.runPromise(authenticateWithApiKey(event)))
        .rejects.toThrow('Invalid API key')
    })

    it('should handle missing headers object', async () => {
      const event = {} as any as APIGatewayProxyEvent

      await expect(Effect.runPromise(authenticateWithApiKey(event)))
        .rejects.toThrow('API key is required')
    })

    it('should prioritize x-api-key over other variants', async () => {
      const event = {
        headers: {
          'x-api-key': 'test-api-key-123',
          'X-API-Key': 'wrong-key',
          'X-Api-Key': 'another-wrong-key'
        }
      } as any as APIGatewayProxyEvent

      const result = await Effect.runPromise(authenticateWithApiKey(event))
      expect(result).toBe('test-api-key-123')
    })
  })

  describe('authorizeUserAccess', () => {
    const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})

    beforeEach(() => {
      mockConsoleLog.mockClear()
    })

    afterAll(() => {
      mockConsoleLog.mockRestore()
    })

    it('should succeed when user is authenticated', async () => {
      const result = await Effect.runPromise(
        authorizeUserAccess('auth-user-123', 'target-user-456')
      )
      expect(result).toBe(true)
    })

    it('should log when authenticated user accesses different user data', async () => {
      await Effect.runPromise(
        authorizeUserAccess('auth-user-123', 'target-user-456')
      )
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'User auth-user-123 accessing data for user target-user-456'
      )
    })

    it('should not log when user accesses their own data', async () => {
      await Effect.runPromise(
        authorizeUserAccess('user-123', 'user-123')
      )
      
      expect(mockConsoleLog).not.toHaveBeenCalled()
    })

    it('should fail when authenticated user ID is empty', async () => {
      await expect(Effect.runPromise(authorizeUserAccess('', 'target-user')))
        .rejects.toThrow('User not authenticated')
    })

    it('should fail when authenticated user ID is null', async () => {
      await expect(Effect.runPromise(authorizeUserAccess(null as any, 'target-user')))
        .rejects.toThrow('User not authenticated')
    })

    it('should fail when authenticated user ID is undefined', async () => {
      await expect(Effect.runPromise(authorizeUserAccess(undefined as any, 'target-user')))
        .rejects.toThrow('User not authenticated')
    })
  })

  describe('extractUserFromAuth', () => {
    it('should succeed when authorizer context has userId', async () => {
      const event = {
        requestContext: {
          authorizer: {
            userId: 'extract-user-123'
          }
        }
      } as any as APIGatewayProxyEvent

      const result = await Effect.runPromise(extractUserFromAuth(event))
      expect(result).toBe('extract-user-123')
    })

    it('should succeed when authorizer context has principalId', async () => {
      const event = {
        requestContext: {
          authorizer: {
            principalId: 'extract-principal-456'
          }
        }
      } as any as APIGatewayProxyEvent

      const result = await Effect.runPromise(extractUserFromAuth(event))
      expect(result).toBe('extract-principal-456')
    })

    it('should prefer userId over principalId', async () => {
      const event = {
        requestContext: {
          authorizer: {
            userId: 'preferred-user',
            principalId: 'fallback-principal'
          }
        }
      } as any as APIGatewayProxyEvent

      const result = await Effect.runPromise(extractUserFromAuth(event))
      expect(result).toBe('preferred-user')
    })

    it('should fail when no authorizer context exists', async () => {
      const event = {
        requestContext: {}
      } as any as APIGatewayProxyEvent

      await expect(Effect.runPromise(extractUserFromAuth(event)))
        .rejects.toThrow('No authorization context found')
    })

    it('should fail when authorizer context has no user identifiers', async () => {
      const event = {
        requestContext: {
          authorizer: {
            email: 'test@example.com',
            scope: 'read,write'
          }
        }
      } as any as APIGatewayProxyEvent

      await expect(Effect.runPromise(extractUserFromAuth(event)))
        .rejects.toThrow('Cannot extract user from authentication context')
    })

    it('should fail when userId and principalId are empty strings', async () => {
      const event = {
        requestContext: {
          authorizer: {
            userId: '',
            principalId: ''
          }
        }
      } as any as APIGatewayProxyEvent

      await expect(Effect.runPromise(extractUserFromAuth(event)))
        .rejects.toThrow('Cannot extract user from authentication context')
    })
  })

  describe('getUserContext', () => {
    it('should return complete user context when all fields are present', () => {
      const event = {
        requestContext: {
          authorizer: {
            userId: 'context-user-123',
            email: 'user@example.com',
            scope: 'read,write,admin',
            tokenIssuer: 'auth0'
          }
        }
      } as any as APIGatewayProxyEvent

      const result = getUserContext(event)
      expect(result).toEqual({
        userId: 'context-user-123',
        email: 'user@example.com',
        scope: ['read', 'write', 'admin'],
        tokenIssuer: 'auth0'
      })
    })

    it('should use principalId when userId is not available', () => {
      const event = {
        requestContext: {
          authorizer: {
            principalId: 'context-principal-456',
            email: 'user@example.com'
          }
        }
      } as any as APIGatewayProxyEvent

      const result = getUserContext(event)
      expect(result).toEqual({
        userId: 'context-principal-456',
        email: 'user@example.com',
        scope: [],
        tokenIssuer: ''
      })
    })

    it('should handle missing optional fields with defaults', () => {
      const event = {
        requestContext: {
          authorizer: {
            userId: 'minimal-user'
          }
        }
      } as any as APIGatewayProxyEvent

      const result = getUserContext(event)
      expect(result).toEqual({
        userId: 'minimal-user',
        email: '',
        scope: [],
        tokenIssuer: ''
      })
    })

    it('should return null when no authorizer context exists', () => {
      const event = {
        requestContext: {}
      } as any as APIGatewayProxyEvent

      const result = getUserContext(event)
      expect(result).toBeNull()
    })

    it('should handle empty scope string', () => {
      const event = {
        requestContext: {
          authorizer: {
            userId: 'test-user',
            scope: ''
          }
        }
      } as any as APIGatewayProxyEvent

      const result = getUserContext(event)
      expect(result?.scope).toEqual([])
    })

    it('should handle single scope value', () => {
      const event = {
        requestContext: {
          authorizer: {
            userId: 'user-single-scope',
            scope: 'read'
          }
        }
      } as any as APIGatewayProxyEvent

      const result = getUserContext(event)
      expect(result?.scope).toEqual(['read'])
    })

    it('should prefer userId over principalId when both exist', () => {
      const event = {
        requestContext: {
          authorizer: {
            userId: 'preferred-user-id',
            principalId: 'fallback-principal-id'
          }
        }
      } as any as APIGatewayProxyEvent

      const result = getUserContext(event)
      expect(result?.userId).toBe('preferred-user-id')
    })
  })

  describe('logSecurityEvent', () => {
    let originalConsoleLog: typeof console.log

    beforeEach(() => {
      originalConsoleLog = console.log
      mockConsoleLog.mockClear()
      mockConsoleLog.mockReset()
    })

    afterEach(() => {
      console.log = originalConsoleLog
    })

    it('should log AUTH_SUCCESS event with all fields', () => {
      const event = {
        type: 'AUTH_SUCCESS' as const,
        userId: 'log-user-123',
        sourceIp: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        endpoint: 'POST /users',
        timestamp: '2025-07-31T00:00:00.000Z'
      }

      // Replace console.log with our mock directly  
      console.log = mockConsoleLog as any
      
      logSecurityEvent(event)

      expect(mockConsoleLog).toHaveBeenCalledTimes(1)
      expect(mockConsoleLog).toHaveBeenCalledWith(
        JSON.stringify({
          eventType: 'SECURITY',
          type: 'AUTH_SUCCESS',
          userId: 'log-user-123',
          sourceIp: '192.168.1.100',
          userAgent: 'Mozilla/5.0',
          endpoint: 'POST /users',
          timestamp: '2025-07-31T00:00:00.000Z',
          severity: 'INFO'
        })
      )
    })

    it('should log AUTH_FAILURE event with HIGH severity', () => {
      const event = {
        type: 'AUTH_FAILURE' as const,
        sourceIp: '10.0.0.1',
        endpoint: 'GET /protected'
      }

      console.log = mockConsoleLog as any
      logSecurityEvent(event)

      expect(mockConsoleLog).toHaveBeenCalledTimes(1)
      const loggedCall = mockConsoleLog.mock.calls[0][0]
      const loggedEvent = JSON.parse(loggedCall)

      expect(loggedEvent.eventType).toBe('SECURITY')
      expect(loggedEvent.type).toBe('AUTH_FAILURE')
      expect(loggedEvent.severity).toBe('HIGH')
      expect(loggedEvent.sourceIp).toBe('10.0.0.1')
      expect(loggedEvent.endpoint).toBe('GET /protected')
      expect(loggedEvent.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })

    it('should log AUTHZ_FAILURE event with HIGH severity', () => {
      const event = {
        type: 'AUTHZ_FAILURE' as const,
        userId: 'unauthorized-user',
        endpoint: 'DELETE /users/other-user'
      }

      console.log = mockConsoleLog as any
      logSecurityEvent(event)

      expect(mockConsoleLog).toHaveBeenCalledTimes(1)
      const loggedCall = mockConsoleLog.mock.calls[0][0]
      const loggedEvent = JSON.parse(loggedCall)

      expect(loggedEvent.severity).toBe('HIGH')
      expect(loggedEvent.type).toBe('AUTHZ_FAILURE')
      expect(loggedEvent.userId).toBe('unauthorized-user')
      expect(loggedEvent.endpoint).toBe('DELETE /users/other-user')
    })

    it('should generate timestamp when not provided', () => {
      const event = {
        type: 'AUTH_SUCCESS' as const,
        userId: 'timestamp-test-user'
      }

      console.log = mockConsoleLog as any
      const beforeTime = Date.now()
      logSecurityEvent(event)
      const afterTime = Date.now()

      expect(mockConsoleLog).toHaveBeenCalledTimes(1)
      const loggedCall = mockConsoleLog.mock.calls[0][0]
      const loggedEvent = JSON.parse(loggedCall)

      expect(loggedEvent.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      
      const loggedTimestamp = new Date(loggedEvent.timestamp).getTime()
      expect(loggedTimestamp).toBeGreaterThanOrEqual(beforeTime)
      expect(loggedTimestamp).toBeLessThanOrEqual(afterTime)
    })

    it('should handle minimal event object', () => {
      const event = {
        type: 'AUTH_SUCCESS' as const
      }

      console.log = mockConsoleLog as any
      logSecurityEvent(event)

      expect(mockConsoleLog).toHaveBeenCalledTimes(1)
      const loggedCall = mockConsoleLog.mock.calls[0][0]
      const loggedEvent = JSON.parse(loggedCall)

      expect(loggedEvent.eventType).toBe('SECURITY')
      expect(loggedEvent.type).toBe('AUTH_SUCCESS')
      expect(loggedEvent.severity).toBe('INFO')
      expect(loggedEvent.timestamp).toBeDefined()
    })

    it('should preserve all provided fields', () => {
      const event = {
        type: 'AUTH_SUCCESS' as const,
        userId: 'preserve-test',
        sourceIp: '127.0.0.1',
        userAgent: 'Test Agent',
        endpoint: 'GET /',
        timestamp: '2025-01-01T00:00:00.000Z'
      }

      console.log = mockConsoleLog as any
      logSecurityEvent(event)

      expect(mockConsoleLog).toHaveBeenCalledTimes(1)
      const loggedCall = mockConsoleLog.mock.calls[0][0]
      const loggedEvent = JSON.parse(loggedCall)

      expect(loggedEvent).toMatchObject({
        eventType: 'SECURITY',
        type: 'AUTH_SUCCESS',
        userId: 'preserve-test',
        sourceIp: '127.0.0.1',
        userAgent: 'Test Agent',
        endpoint: 'GET /',
        timestamp: '2025-01-01T00:00:00.000Z',
        severity: 'INFO'
      })
    })
  })
})
