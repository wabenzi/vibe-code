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
 * Standard HTTP status code names/descriptions
 */
export const HttpStatusName = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
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
  message?: string,
  details?: Record<string, any> | string[]
): APIGatewayProxyResult {
  // Check if we should suppress error details for production security
  const suppressDetails = process.env.SUPPRESS_ERROR_DETAILS === 'true'
  
  // Look up the standard HTTP status description
  const error = HttpStatusName[statusCode as keyof typeof HttpStatusName] || 'Unknown Error'
  
  const body: ErrorResponseBody = {
    error,
    ...(message && { message }),
    ...(details && !suppressDetails && { details }),
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

  // Error responses with standard HTTP status messages
  badRequest: (message?: string, details?: Record<string, any> | string[]) =>
    createErrorResponse(HttpStatus.BAD_REQUEST, message, details),
  
  unauthorized: (message?: string, details?: Record<string, any> | string[]) =>
    createErrorResponse(HttpStatus.UNAUTHORIZED, message, details),
  
  forbidden: (message?: string, details?: Record<string, any> | string[]) =>
    createErrorResponse(HttpStatus.FORBIDDEN, message, details),
  
  notFound: (message?: string, details?: Record<string, any> | string[]) =>
    createErrorResponse(HttpStatus.NOT_FOUND, message, details),
  
  conflict: (message?: string, details?: Record<string, any> | string[]) =>
    createErrorResponse(HttpStatus.CONFLICT, message, details),
  
  internalServerError: (message?: string, details?: Record<string, any> | string[]) =>
    createErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, message, details),
  
  serviceUnavailable: (message?: string, details?: Record<string, any> | string[]) =>
    createErrorResponse(HttpStatus.SERVICE_UNAVAILABLE, message, details),

  // Deprecated helpers - use standard methods above
  validationError: (message: string, details: Record<string, any> | string[]) =>
    createErrorResponse(HttpStatus.BAD_REQUEST, message, details),

  databaseError: (message?: string, details?: Record<string, any> | string[]) =>
    createErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, message, details),
}
