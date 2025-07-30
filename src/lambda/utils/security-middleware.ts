import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { Effect } from 'effect'
import { authenticateRequest, logSecurityEvent, AuthenticationError, AuthorizationError } from './auth'
import { ApiResponse } from '../types/api-response'

/**
 * Security middleware that wraps Lambda handlers with authentication and logging
 */
export const withSecurity = <T>(
  handler: (event: APIGatewayProxyEvent, authenticatedUser?: string) => Effect.Effect<APIGatewayProxyResult, any>
) => {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const startTime = Date.now()
    const sourceIp = event.requestContext?.identity?.sourceIp || 'unknown'
    const userAgent = event.headers['User-Agent'] || event.headers['user-agent'] || 'unknown'
    const endpoint = `${event.httpMethod} ${event.path}`

    try {
      // Skip authentication for health check endpoint
      if (event.path === '/health') {
        return await Effect.runPromise(handler(event))
      }

      // Authenticate request
      let authResult: string
      try {
        authResult = await Effect.runPromise(authenticateRequest(event))
      } catch (error: any) {
        // Re-throw auth errors to be caught by the outer catch block
        if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
          throw error
        }
        // Handle other types of errors
        throw new AuthenticationError(`Authentication failed: ${error?.message || 'Unknown error'}`)
      }
      
      // Log successful authentication
      logSecurityEvent({
        type: 'AUTH_SUCCESS',
        sourceIp,
        userAgent,
        endpoint,
        timestamp: new Date().toISOString()
      })

      // Call the actual handler with authenticated context
      const result = await Effect.runPromise(handler(event, authResult))
      
      // Log successful request
      const duration = Date.now() - startTime
      console.log(JSON.stringify({
        eventType: 'API_REQUEST',
        endpoint,
        statusCode: result.statusCode,
        duration,
        sourceIp,
        userAgent,
        timestamp: new Date().toISOString()
      }))

      return result

    } catch (error) {
      // Log security failure
      logSecurityEvent({
        type: 'AUTH_FAILURE',
        sourceIp,
        userAgent,
        endpoint,
        timestamp: new Date().toISOString()
      })

      // Handle authentication/authorization errors
      if (error instanceof Error) {
        if (error.name === 'AuthenticationError') {
          return ApiResponse.unauthorized('Authentication required')
        }
        
        if (error.name === 'AuthorizationError') {
          return ApiResponse.forbidden('Access denied')
        }
      }

      // Generic error response
      return ApiResponse.internalServerError('An unexpected error occurred')
    }
  }
}

/**
 * Input sanitization utility to prevent log injection
 */
export const sanitizeForLog = (input: string): string => {
  if (!input) return 'null'
  
  // Remove control characters and limit length
  return input
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/[\r\n]/g, ' ')         // Replace newlines with spaces
    .substring(0, 500)               // Limit length
}

/**
 * Rate limiting check (basic implementation)
 * In production, you'd use Redis or DynamoDB for distributed rate limiting
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export const checkRateLimit = (clientId: string, limit: number = 100, windowMs: number = 60000): boolean => {
  const now = Date.now()
  const clientData = rateLimitStore.get(clientId)

  if (!clientData || now > clientData.resetTime) {
    // Reset or initialize
    rateLimitStore.set(clientId, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (clientData.count >= limit) {
    return false // Rate limit exceeded
  }

  clientData.count++
  return true
}

/**
 * Validate request size to prevent DoS attacks
 */
export const validateRequestSize = (event: APIGatewayProxyEvent, maxSizeBytes: number = 1024 * 1024): boolean => {
  if (!event.body) return true
  
  const bodySize = Buffer.byteLength(event.body, 'utf8')
  return bodySize <= maxSizeBytes
}
