import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { ApiResponse } from './types/api-response'

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Health check endpoint invoked', { event })
  
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    service: 'user-management-api'
  }

  return ApiResponse.ok(healthData)
}
