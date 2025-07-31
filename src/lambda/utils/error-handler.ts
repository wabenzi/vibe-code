import { APIGatewayProxyResult } from 'aws-lambda'
import { Effect } from 'effect'
import { ValidationError, UserNotFoundError, DatabaseError } from '../../domain/user'
import { DynamoUserRepositoryError } from '../../infrastructure/dynamo-user-repository'
import { AuthenticationError, AuthorizationError, logSecurityEvent } from './auth'
import { ApiResponse } from '../types/api-response'

// Shared error handler that maps Effect errors to API responses with security logging
export const handleError = (error: unknown, sourceIp?: string): APIGatewayProxyResult => {
  // Handle Authentication Errors (401)
  if (error instanceof AuthenticationError) {
    logSecurityEvent({
      type: 'AUTH_FAILURE',
      sourceIp,
      endpoint: 'unknown',
      timestamp: new Date().toISOString()
    })
    
    return ApiResponse.unauthorized(error.message)
  }

  // Handle Authorization Errors (403)
  if (error instanceof AuthorizationError) {
    logSecurityEvent({
      type: 'AUTHZ_FAILURE',
      sourceIp,
      endpoint: 'unknown',
      timestamp: new Date().toISOString()
    })
    
    return ApiResponse.forbidden(error.message)
  }

  // Handle ValidationError
  if (error instanceof ValidationError) {
    // Log validation error details for debugging using Effect
    Effect.runSync(
      Effect.logError('Validation Error:', {
        message: error.message,
        errors: error.errors,
        timestamp: new Date().toISOString()
      })
    )
    
    // Return standard "Bad Request" with specific message and error details
    return ApiResponse.badRequest(error.message, error.errors)
  }
  
  // Handle UserNotFoundError
  if (error instanceof UserNotFoundError) {
    // Log user not found for debugging using Effect
    Effect.runSync(
      Effect.logInfo('User Not Found:', {
        message: error.message,
        userId: error.userId,
        timestamp: new Date().toISOString()
      })
    )
    
    return ApiResponse.notFound(error.message, { userId: error.userId })
  }
  
  // Handle DynamoUserRepositoryError  
  if (error instanceof DynamoUserRepositoryError) {
    // Log detailed database error for debugging using Effect
    Effect.runSync(
      Effect.logError('DynamoDB Repository Error:', {
        message: error.message,
        cause: error.cause,
        timestamp: new Date().toISOString(),
        stack: error.cause instanceof Error ? error.cause.stack : undefined
      })
    )
    
    // Return standard "Internal Server Error" with specific message and detailed error info
    return ApiResponse.internalServerError('Database operation failed', {
      type: 'DynamoUserRepositoryError',
      details: error.message,
      cause: error.cause instanceof Error ? error.cause.message : String(error.cause)
    })
  }
  
  // Handle DatabaseError
  if (error instanceof DatabaseError) {
    // Log detailed database error for debugging using Effect
    Effect.runSync(
      Effect.logError('Database Error:', {
        message: error.message,
        cause: error.cause,
        timestamp: new Date().toISOString()
      })
    )
    
    // Return standard "Internal Server Error" with specific message and detailed error info
    return ApiResponse.internalServerError('Database operation failed', {
      type: 'DatabaseError',
      details: error.message,
      cause: error.cause instanceof Error ? error.cause.message : String(error.cause)
    })
  }
  
  // Handle generic errors
  Effect.runSync(
    Effect.logError('Unhandled Error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    })
  )
  
  return ApiResponse.internalServerError('An unexpected error occurred', {
    type: 'UnknownError',
    details: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined
  })
}

// Specialized error handler for create user
export const handleCreateUserError = (error: unknown): APIGatewayProxyResult => {
  // Handle ValidationError with enhanced details for create user operations
  if (error instanceof ValidationError) {
    // Log validation error details for debugging using Effect
    Effect.runSync(
      Effect.logError('Create User Validation Error:', {
        message: error.message,
        errors: error.errors,
        timestamp: new Date().toISOString()
      })
    )
    
    // Return standard "Bad Request" with specific message and error details
    return ApiResponse.badRequest(error.message, error.errors)
  }
  
  // For other errors, use the standard handler
  return handleError(error)
}
