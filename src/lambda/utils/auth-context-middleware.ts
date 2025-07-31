import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { Effect } from 'effect'
import { getUserContext } from './auth'

/**
 * Enhanced Lambda wrapper that leverages AWS Lambda Authorizer
 * This assumes authentication is handled by API Gateway + Lambda Authorizer
 */
export const withAuthContext = <T>(
  handler: (event: APIGatewayProxyEvent, userContext: { userId: string; email?: string; scope?: string[] }) => Effect.Effect<APIGatewayProxyResult, any>
) => {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const startTime = Date.now()
    const sourceIp = event.requestContext?.identity?.sourceIp || 'unknown'
    const userAgent = event.headers['User-Agent'] || event.headers['user-agent'] || 'unknown'
    const endpoint = `${event.httpMethod} ${event.path}`

    try {
      // Skip authentication extraction for health check endpoint
      if (event.path === '/health') {
        // Health check doesn't need user context
        return await Effect.runPromise(handler(event, { userId: 'health-check' }))
      }

      // Extract user context from Lambda Authorizer
      const userContext = getUserContext(event)
      
      if (!userContext || !userContext.userId) {
        // This should never happen if Lambda Authorizer is properly configured
        // API Gateway should block requests before they reach here
        console.error('Missing user context - Lambda Authorizer may not be configured correctly')
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Unauthorized - Invalid authorization context' })
        }
      }

      // Log successful authentication (for monitoring)
      console.log(JSON.stringify({
        eventType: 'AUTH_SUCCESS',
        userId: userContext.userId,
        sourceIp,
        userAgent,
        endpoint,
        timestamp: new Date().toISOString()
      }))

      // Call the actual handler with user context
      const result = await Effect.runPromise(handler(event, userContext))
      
      // Log successful request
      const duration = Date.now() - startTime
      console.log(JSON.stringify({
        eventType: 'API_REQUEST',
        endpoint,
        statusCode: result.statusCode,
        duration,
        sourceIp,
        userAgent,
        userId: userContext.userId,
        timestamp: new Date().toISOString()
      }))

      return result

    } catch (error) {
      // Log the error
      console.error('Lambda execution error:', error)

      // Return generic error response
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Internal server error' })
      }
    }
  }
}

/**
 * Simple wrapper for public endpoints that don't require authentication
 * (like health checks)
 */
export const withoutAuth = (
  handler: (event: APIGatewayProxyEvent) => Effect.Effect<APIGatewayProxyResult, any>
) => {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const startTime = Date.now()
    const sourceIp = event.requestContext?.identity?.sourceIp || 'unknown'
    const endpoint = `${event.httpMethod} ${event.path}`

    try {
      const result = await Effect.runPromise(handler(event))
      
      // Log successful request
      const duration = Date.now() - startTime
      console.log(JSON.stringify({
        eventType: 'PUBLIC_REQUEST',
        endpoint,
        statusCode: result.statusCode,
        duration,
        sourceIp,
        timestamp: new Date().toISOString()
      }))

      return result

    } catch (error) {
      console.error('Lambda execution error:', error)
      
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Internal server error' })
      }
    }
  }
}
