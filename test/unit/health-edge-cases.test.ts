import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

/**
 * Edge case tests for health.ts to achieve 100% branch coverage
 * This file specifically tests the fallback logic in line 10: process.env.NODE_ENV || 'unknown'
 */

// Helper function to create mock API Gateway events
const createMockAPIGatewayEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent => ({
  body: null,
  headers: {},
  multiValueHeaders: {},
  httpMethod: 'GET',
  isBase64Encoded: false,
  path: '/',
  pathParameters: null,
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  stageVariables: null,
  requestContext: {
    accountId: '123456789012',
    apiId: 'test-api',
    protocol: 'HTTP/1.1',
    httpMethod: 'GET',
    path: '/',
    stage: 'test',
    requestId: 'test-request-id',
    requestTime: '2025-01-01T00:00:00Z',
    requestTimeEpoch: 1640995200000,
    resourceId: 'test-resource',
    resourcePath: '/',
    identity: {
      accessKey: null,
      accountId: null,
      apiKey: null,
      apiKeyId: null,
      caller: null,
      clientCert: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: '127.0.0.1',
      user: null,
      userAgent: 'test-agent',
      userArn: null,
    },
    authorizer: null,
  },
  resource: '/',
  ...overrides,
})

describe('Health Handler Edge Cases', () => {
  // Store original NODE_ENV to restore after tests
  const originalNodeEnv = process.env.NODE_ENV

  afterEach(() => {
    // Restore original NODE_ENV after each test
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv
    } else {
      delete process.env.NODE_ENV
    }
    
    // Clear the require cache to ensure fresh imports
    delete require.cache[require.resolve('../../src/lambda/health')]
  })

  /**
   * Test the right side of || operator in line 10: process.env.NODE_ENV || 'unknown'
   * This test exercises the fallback when NODE_ENV is undefined
   */
  it('should return "unknown" environment when NODE_ENV is undefined', async () => {
    // Arrange: Remove NODE_ENV to trigger the fallback
    delete process.env.NODE_ENV
    
    // Import the handler after modifying the environment
    const { handler } = await import('../../src/lambda/health')
    
    const mockEvent = createMockAPIGatewayEvent({
      path: '/health',
      httpMethod: 'GET',
    })

    // Act
    const result: APIGatewayProxyResult = await handler(mockEvent)

    // Assert
    expect(result.statusCode).toBe(200)
    expect(result.headers).toMatchObject({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'self'",
    })
    
    const body = JSON.parse(result.body)
    expect(body.status).toBe('healthy')
    expect(body.service).toBe('user-management-api')
    expect(body.timestamp).toBeDefined()
    
    // This is the key assertion - environment should be 'unknown' when NODE_ENV is undefined
    expect(body.environment).toBe('unknown')
  })

  /**
   * Test with NODE_ENV set to empty string to further verify fallback behavior
   */
  it('should return "unknown" environment when NODE_ENV is empty string', async () => {
    // Arrange: Set NODE_ENV to empty string (falsy value)
    process.env.NODE_ENV = ''
    
    // Import the handler after modifying the environment
    const { handler } = await import('../../src/lambda/health')
    
    const mockEvent = createMockAPIGatewayEvent({
      path: '/health',
      httpMethod: 'GET',
    })

    // Act
    const result: APIGatewayProxyResult = await handler(mockEvent)

    // Assert
    expect(result.statusCode).toBe(200)
    
    const body = JSON.parse(result.body)
    expect(body.status).toBe('healthy')
    expect(body.service).toBe('user-management-api')
    expect(body.timestamp).toBeDefined()
    
    // This should also trigger the fallback since empty string is falsy
    expect(body.environment).toBe('unknown')
  })

  /**
   * Confirm that when NODE_ENV is set to a valid value, it's used instead of the fallback
   */
  it('should return actual environment when NODE_ENV is set', async () => {
    // Arrange: Set NODE_ENV to a specific value
    process.env.NODE_ENV = 'production'
    
    // Import the handler after modifying the environment
    const { handler } = await import('../../src/lambda/health')
    
    const mockEvent = createMockAPIGatewayEvent({
      path: '/health',
      httpMethod: 'GET',
    })

    // Act
    const result: APIGatewayProxyResult = await handler(mockEvent)

    // Assert
    expect(result.statusCode).toBe(200)
    
    const body = JSON.parse(result.body)
    expect(body.status).toBe('healthy')
    expect(body.service).toBe('user-management-api')
    expect(body.timestamp).toBeDefined()
    
    // This should use the actual environment value, not the fallback
    expect(body.environment).toBe('production')
  })
})
