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
 * Extract user context from Lambda Authorizer
 * With Lambda Authorizer, authentication is handled by the authorizer function
 * and user context is passed through the requestContext.authorizer
 */
export const authenticateRequest = (event: APIGatewayProxyEvent) => {
  // With Lambda Authorizer, the authorizer context contains user information
  const authorizerContext = event.requestContext.authorizer

  if (!authorizerContext) {
    return Effect.fail(new AuthenticationError('No authorization context found'))
  }

  // Extract user ID from authorizer context
  const userId = authorizerContext.userId || authorizerContext.principalId

  if (!userId) {
    return Effect.fail(new AuthenticationError('No user ID found in authorization context'))
  }

  return Effect.succeed(userId)
}

/**
 * Legacy API key authentication for backward compatibility
 * This can be used for health checks or other endpoints that don't require JWT
 */
export const authenticateWithApiKey = (event: APIGatewayProxyEvent) => {
  // Check for API key in headers (case-insensitive)
  const headers = event.headers || {}
  const apiKey = headers['x-api-key'] ||
                 headers['X-API-Key'] ||
                 headers['X-Api-Key']

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
  authenticatedUserId: string,
  requestedUserId: string
) => {
  // For now, allow access if authenticated
  // In production, implement proper user-level authorization
  if (!authenticatedUserId) {
    return Effect.fail(new AuthorizationError('User not authenticated'))
  }

  // Example: Users can only access their own data
  // You can implement more sophisticated rules here
  if (authenticatedUserId !== requestedUserId) {
    // For now, allow access to any user data if authenticated
    // In production, you might want to restrict this
    console.log(`User ${authenticatedUserId} accessing data for user ${requestedUserId}`)
  }

  return Effect.succeed(true)
}

/**
 * Extract user ID from authenticated context
 * With Lambda Authorizer, user ID is available in the authorizer context
 */
export const extractUserFromAuth = (event: APIGatewayProxyEvent): Effect.Effect<string, AuthorizationError> => {
  const authorizerContext = event.requestContext.authorizer

  if (!authorizerContext) {
    return Effect.fail(new AuthorizationError('No authorization context found'))
  }

  const userId = authorizerContext.userId || authorizerContext.principalId
  const email = authorizerContext.email

  if (!userId) {
    return Effect.fail(new AuthorizationError('Cannot extract user from authentication context'))
  }
  
  return Effect.succeed(userId)
}

/**
 * Get additional user context from authorizer
 */
export const getUserContext = (event: APIGatewayProxyEvent) => {
  const authorizerContext = event.requestContext.authorizer

  if (!authorizerContext) {
    return null
  }

  return {
    userId: authorizerContext.userId || authorizerContext.principalId,
    email: authorizerContext.email || '',
    scope: authorizerContext.scope ? authorizerContext.scope.split(',') : [],
    tokenIssuer: authorizerContext.tokenIssuer || '',
  }
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
