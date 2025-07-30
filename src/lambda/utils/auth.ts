import { APIGatewayProxyEvent } from 'aws-lambda'
import { Effect } from 'effect'
import { ValidationError } from '../../domain/user'

/**
 * Authentication error for unauthorized access
 */
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

/**
 * Authorization error for forbidden access
 */
export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthorizationError'
  }
}

/**
 * Extract and validate API key from request headers
 */
export const authenticateRequest = (event: APIGatewayProxyEvent) => {
  // Check for API key in headers (case-insensitive)
  const apiKey = event.headers['x-api-key'] || 
                 event.headers['X-API-Key'] || 
                 event.headers['X-Api-Key']

  if (!apiKey) {
    return Effect.fail(new AuthenticationError('API key is required'))
  }

  // In production, you would validate against a secure store
  // For LocalStack testing, accept the deployed API key
  const validApiKey = process.env.VALID_API_KEY || 'tr5ycwc5m3'
  
  if (apiKey !== validApiKey) {
    return Effect.fail(new AuthenticationError('Invalid API key'))
  }

  return Effect.succeed(apiKey)
}

/**
 * Authorize user access to specific resources
 * This is a placeholder for more sophisticated authorization logic
 */
export const authorizeUserAccess = (
  authenticatedUser: string, 
  requestedUserId: string
) => {
  // For now, allow access if authenticated
  // In production, implement proper user-level authorization
  if (!authenticatedUser) {
    return Effect.fail(new AuthorizationError('User not authenticated'))
  }

  // Example: Users can only access their own data
  // You would implement proper user identification here
  return Effect.succeed(true)
}

/**
 * Extract user ID from authenticated context
 * This is a placeholder - in production you'd decode from JWT or lookup from API key
 */
export const extractUserFromAuth = (apiKey: string): Effect.Effect<string, AuthorizationError> => {
  // Placeholder: In production, lookup user from API key or decode JWT
  // For now, return a default user ID
  if (apiKey) {
    return Effect.succeed('authenticated-user')
  }
  
  return Effect.fail(new AuthorizationError('Cannot extract user from authentication'))
}

/**
 * Security logging utility
 */
export const logSecurityEvent = (event: {
  type: 'AUTH_SUCCESS' | 'AUTH_FAILURE' | 'AUTHZ_FAILURE'
  userId?: string
  sourceIp?: string
  userAgent?: string
  endpoint?: string
  timestamp?: string
}) => {
  const securityLog = {
    eventType: 'SECURITY',
    ...event,
    timestamp: event.timestamp || new Date().toISOString(),
    severity: event.type === 'AUTH_FAILURE' || event.type === 'AUTHZ_FAILURE' ? 'HIGH' : 'INFO'
  }
  
  console.log(JSON.stringify(securityLog))
}
