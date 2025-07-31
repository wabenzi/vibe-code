import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { Effect, Schema } from 'effect'
import { handler as createUserHandler } from '../../src/lambda/create-user'

describe('Create User Edge Cases', () => {
  beforeEach(() => {
    process.env.DYNAMODB_TABLE_NAME = 'test-users-table'
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const createMockAPIGatewayEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent => ({
    body: null,
    headers: {
      'X-Api-Key': 'tr5ycwc5m3', // Default API key for testing
      ...overrides.headers
    },
    multiValueHeaders: {},
    httpMethod: 'POST',
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
      identity: {} as any,
      authorizer: {
        userId: 'test-user',
        email: 'test@example.com',
        scope: 'read,write',
        tokenIssuer: 'user-management-service'
      },
    } as any,
    resource: '/',
    ...overrides,
  })

  it('should handle schema error without message property (fallback to default)', async () => {
    // Create a mock parse error object without a message property
    const originalDecodeUnknown = Schema.decodeUnknown
    
    // Mock Schema.decodeUnknown to return an error without message
    const mockDecodeUnknown = jest.fn().mockReturnValue(() => 
      Effect.fail({
        // Intentionally create an error object without a message property
        _tag: 'ParseError',
        toString: () => 'Mock parse error without message'
      })
    )
    
    // Temporarily replace Schema.decodeUnknown
    ;(Schema as any).decodeUnknown = mockDecodeUnknown

    try {
      const event = createMockAPIGatewayEvent({
        body: JSON.stringify({ id: 'test', name: 'Test User' }),
      })

      const result: APIGatewayProxyResult = await createUserHandler(event)

      expect(result.statusCode).toBe(400)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Bad Request')
      expect(body.message).toBe('Request validation failed')
      // This should trigger the fallback 'Validation failed' message
      expect(body.details).toEqual(['Validation failed'])
      
    } finally {
      // Restore original Schema.decodeUnknown
      ;(Schema as any).decodeUnknown = originalDecodeUnknown
    }
  })

  it('should handle schema error with empty/falsy message property', async () => {
    // Create a mock parse error object with falsy message
    const originalDecodeUnknown = Schema.decodeUnknown
    
    // Mock Schema.decodeUnknown to return an error with falsy message
    const mockDecodeUnknown = jest.fn().mockReturnValue(() => 
      Effect.fail({
        _tag: 'ParseError',
        message: '', // Empty string (falsy)
        toString: () => 'Mock parse error with empty message'
      })
    )
    
    // Temporarily replace Schema.decodeUnknown
    ;(Schema as any).decodeUnknown = mockDecodeUnknown

    try {
      const event = createMockAPIGatewayEvent({
        body: JSON.stringify({ id: 'test', name: 'Test User' }),
      })

      const result: APIGatewayProxyResult = await createUserHandler(event)

      expect(result.statusCode).toBe(400)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Bad Request')
      expect(body.message).toBe('Request validation failed')
      // This should trigger the fallback 'Validation failed' message due to empty string
      expect(body.details).toEqual(['Validation failed'])
      
    } finally {
      // Restore original Schema.decodeUnknown
      ;(Schema as any).decodeUnknown = originalDecodeUnknown
    }
  })

  it('should handle schema error with null message property', async () => {
    // Create a mock parse error object with null message
    const originalDecodeUnknown = Schema.decodeUnknown
    
    // Mock Schema.decodeUnknown to return an error with null message
    const mockDecodeUnknown = jest.fn().mockReturnValue(() => 
      Effect.fail({
        _tag: 'ParseError',
        message: null, // Null (falsy)
        toString: () => 'Mock parse error with null message'
      })
    )
    
    // Temporarily replace Schema.decodeUnknown
    ;(Schema as any).decodeUnknown = mockDecodeUnknown

    try {
      const event = createMockAPIGatewayEvent({
        body: JSON.stringify({ id: 'test', name: 'Test User' }),
      })

      const result: APIGatewayProxyResult = await createUserHandler(event)

      expect(result.statusCode).toBe(400)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Bad Request')
      expect(body.message).toBe('Request validation failed')
      // This should trigger the fallback 'Validation failed' message due to null
      expect(body.details).toEqual(['Validation failed'])
      
    } finally {
      // Restore original Schema.decodeUnknown
      ;(Schema as any).decodeUnknown = originalDecodeUnknown
    }
  })

  it('should handle schema error with undefined message property', async () => {
    // Create a mock parse error object with undefined message
    const originalDecodeUnknown = Schema.decodeUnknown
    
    // Mock Schema.decodeUnknown to return an error with undefined message
    const mockDecodeUnknown = jest.fn().mockReturnValue(() => 
      Effect.fail({
        _tag: 'ParseError',
        message: undefined, // Undefined (falsy)
        toString: () => 'Mock parse error with undefined message'
      })
    )
    
    // Temporarily replace Schema.decodeUnknown
    ;(Schema as any).decodeUnknown = mockDecodeUnknown

    try {
      const event = createMockAPIGatewayEvent({
        body: JSON.stringify({ id: 'test', name: 'Test User' }),
      })

      const result: APIGatewayProxyResult = await createUserHandler(event)

      expect(result.statusCode).toBe(400)
      const body = JSON.parse(result.body)
      expect(body.error).toBe('Bad Request')
      expect(body.message).toBe('Request validation failed')
      // This should trigger the fallback 'Validation failed' message due to undefined
      expect(body.details).toEqual(['Validation failed'])
      
    } finally {
      // Restore original Schema.decodeUnknown
      ;(Schema as any).decodeUnknown = originalDecodeUnknown
    }
  })
})
