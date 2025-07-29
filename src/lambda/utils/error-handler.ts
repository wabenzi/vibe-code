import { APIGatewayProxyResult } from 'aws-lambda'
import { ValidationError, UserNotFoundError, DatabaseError } from '../../domain/user'
import { DynamoUserRepositoryError } from '../../infrastructure/dynamo-user-repository'
import { ApiResponse } from '../types/api-response'

// Shared error handler that maps Effect errors to API responses
export const handleError = (error: unknown): APIGatewayProxyResult => {
  // Handle ValidationError
  if (error instanceof ValidationError) {
    // For validation errors, return bad request with the error message
    return ApiResponse.badRequest(error.message)
  }
  
  // Handle UserNotFoundError
  if (error instanceof UserNotFoundError) {
    return ApiResponse.notFound('User not found', error.message)
  }
  
  // Handle DynamoUserRepositoryError  
  if (error instanceof DynamoUserRepositoryError) {
    return ApiResponse.databaseError(error.message)
  }
  
  // Handle DatabaseError
  if (error instanceof DatabaseError) {
    return ApiResponse.databaseError(error.message)
  }
  
  // Handle generic errors
  return ApiResponse.internalServerError(
    'Internal server error',
    error instanceof Error ? error.message : 'Unknown error'
  )
}

// Specialized error handler for create user (includes validation error details)
export const handleCreateUserError = (error: unknown): APIGatewayProxyResult => {
  // Handle ValidationError with detailed error information
  if (error instanceof ValidationError) {
    return ApiResponse.validationError(error.message, error.errors)
  }
  
  // For other errors, use the standard handler
  return handleError(error)
}
