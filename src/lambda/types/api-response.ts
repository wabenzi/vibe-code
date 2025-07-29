import { APIGatewayProxyResult } from 'aws-lambda'

/**
 * Standard error response body structure
 */
export interface ErrorResponseBody {
  error: string
  message?: string
  details?: Record<string, any> | string[]
}

/**
 * Standard success response body structure
 */
export interface SuccessResponseBody<T = any> {
  data?: T
  message?: string
  [key: string]: any
}

/**
 * Common HTTP status codes used in the API
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const

/**
 * Standard headers for API responses
 */
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
} as const

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  statusCode: number,
  error: string,
  message?: string,
  details?: Record<string, any> | string[]
): APIGatewayProxyResult {
  const body: ErrorResponseBody = {
    error,
    ...(message && { message }),
    ...(details && { details }),
  }

  return {
    statusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(body),
  }
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T = any>(
  statusCode: number,
  data?: T,
  message?: string
): APIGatewayProxyResult {
  const body: SuccessResponseBody<T> = {
    ...(data && { ...data }),
    ...(message && { message }),
  }

  return {
    statusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(body),
  }
}

/**
 * Convenience functions for common response patterns
 */
export const ApiResponse = {
  // Success responses
  ok: <T>(data?: T, message?: string) => 
    createSuccessResponse(HttpStatus.OK, data, message),
  
  created: <T>(data?: T, message?: string) => 
    createSuccessResponse(HttpStatus.CREATED, data, message),
  
  noContent: () => 
    createSuccessResponse(HttpStatus.NO_CONTENT),

  // Error responses
  badRequest: (error: string, message?: string, details?: Record<string, any> | string[]) =>
    createErrorResponse(HttpStatus.BAD_REQUEST, error, message, details),
  
  unauthorized: (error: string = 'Unauthorized', message?: string) =>
    createErrorResponse(HttpStatus.UNAUTHORIZED, error, message),
  
  forbidden: (error: string = 'Forbidden', message?: string) =>
    createErrorResponse(HttpStatus.FORBIDDEN, error, message),
  
  notFound: (error: string = 'Not Found', message?: string) =>
    createErrorResponse(HttpStatus.NOT_FOUND, error, message),
  
  conflict: (error: string = 'Conflict', message?: string, details?: Record<string, any>) =>
    createErrorResponse(HttpStatus.CONFLICT, error, message, details),
  
  internalServerError: (error: string = 'Internal Server Error', message?: string) =>
    createErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, error, message),
  
  serviceUnavailable: (error: string = 'Service Unavailable', message?: string) =>
    createErrorResponse(HttpStatus.SERVICE_UNAVAILABLE, error, message),

  // Validation error helper
  validationError: (message: string, details: Record<string, any> | string[]) =>
    createErrorResponse(HttpStatus.BAD_REQUEST, 'Validation Error', message, details),

  // Database error helper
  databaseError: (message?: string) =>
    createErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Database Error', message),
}
