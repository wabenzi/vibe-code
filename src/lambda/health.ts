import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { Effect } from 'effect'
import { ApiResponse } from './types/api-response'

// Get version from package.json at build time
const getVersion = (): string => {
  try {
    // In Lambda, package.json should be included in the bundle
    const packageJson = require('../../package.json')
    return packageJson.version || '1.0.0'
  } catch {
    return '1.0.0'
  }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Health check endpoint invoked', { event })
  
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    service: 'user-management-api',
    version: getVersion(),
    deployment: {
      timestamp: process.env.DEPLOYMENT_TIMESTAMP || 'unknown',
      buildNumber: process.env.BUILD_NUMBER || 'unknown'
    }
  }

  // Return response with security headers
  return ApiResponse.ok(healthData)
}
