/**
 * JWT Authentication Tests
 * Tests for the Lambda Authorizer JWT authentication functionality
 */

import { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult, Context } from 'aws-lambda'
import { handler } from '../../src/lambda/authorizer'
import { createTestJWTToken, verifyTestJWTToken, TestTokenConfig } from '../utils/jwt-test-utils'

// Mock the JWT secret for testing
process.env.JWT_SECRET = 'test-secret-key-for-development-only'
process.env.JWT_AUDIENCE = 'user-management-api'
process.env.JWT_ISSUER = 'user-management-service'

// Define fail function for tests
const fail = (message?: string): never => {
  throw new Error(message || 'Test failed')
}

// Mock context for Lambda authorizer
const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-authorizer',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-authorizer',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test-authorizer',
  logStreamName: '2025/07/30/test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {}
}

describe('JWT Lambda Authorizer', () => {
  describe('Token Validation', () => {
    it('should authorize valid JWT token', async () => {
      // Create a valid test token
      const token = createTestJWTToken({ userId: 'admin-user' })
      
      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/GET/users',
        authorizationToken: `Bearer ${token}`
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult

      expect(result.principalId).toBe('admin-user')
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow')
      expect(result.context).toEqual({
        userId: 'admin-user',
        email: 'test@example.com',
        scope: 'read,write',
        tokenIssuer: 'user-management-service'
      })
    })

    it('should authorize valid JWT token without Bearer prefix', async () => {
      const token = createTestJWTToken({ userId: 'regular-user' })
      
      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/GET/users',
        authorizationToken: token
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult

      expect(result.principalId).toBe('regular-user')
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow')
    })

    it('should deny request with invalid JWT token', async () => {
      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/GET/users',
        authorizationToken: 'Bearer invalid.jwt.token'
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult
      
      expect(result.principalId).toBe('user')
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny')
    })

    it('should deny request with expired JWT token', async () => {
      // Create a token that expires immediately
      const expiredToken = createTestJWTToken({ userId: 'test-user', expiresIn: '0s' })
      
      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/GET/users',
        authorizationToken: `Bearer ${expiredToken}`
      }

      // Wait a bit to ensure token is expired
      await new Promise(resolve => setTimeout(resolve, 100))

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult
      
      expect(result.principalId).toBe('user')
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny')
    })

    it('should deny request with missing authorization token', async () => {
      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/GET/users',
        authorizationToken: ''
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult
      
      expect(result.principalId).toBe('user')
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny')
    })
  })

  describe('Test Utils', () => {
    it('should create and verify JWT tokens', () => {
      const userId = 'test-user-123'
      const token = createTestJWTToken({ userId })
      
      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
      
      const decoded = verifyTestJWTToken(token)
      expect(decoded.sub).toBe(userId)
      expect(decoded.aud).toBe('user-management-api')
      expect(decoded.iss).toBe('user-management-service')
    })

    it('should create tokens with custom expiration', () => {
      const token = createTestJWTToken({ userId: 'test-user', expiresIn: '1h' })
      const decoded = verifyTestJWTToken(token)
      
      const now = Math.floor(Date.now() / 1000)
      const expectedExp = now + 3600
      
      // Allow for some timing variance (±5 seconds)
      expect(decoded.exp).toBeGreaterThanOrEqual(expectedExp - 5)
      expect(decoded.exp).toBeLessThanOrEqual(expectedExp + 5)
    })

    it('should reject invalid tokens', () => {
      expect(() => {
        verifyTestJWTToken('invalid-token')
      }).toThrow()
    })
  })

  describe('Policy Generation', () => {
    it('should generate correct IAM policy for authorized user', async () => {
      const token = createTestJWTToken({ userId: 'policy-test-user' })
      
      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/GET/users/123',
        authorizationToken: `Bearer ${token}`
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult

      expect(result.policyDocument).toEqual({
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/*/*'
          }
        ]
      })
    })

    it('should preserve method ARN structure in policy', async () => {
      const token = createTestJWTToken({ userId: 'arn-test-user' })
      
      const methodArn = 'arn:aws:execute-api:eu-west-1:987654321098:my-api/prod/POST/users'
      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn,
        authorizationToken: `Bearer ${token}`
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult

      // Should generate wildcard resource based on the input ARN
      const statement = result.policyDocument.Statement[0] as any
      expect(statement.Resource).toBe(
        'arn:aws:execute-api:eu-west-1:987654321098:my-api/prod/*/*'
      )
    })
  })

  describe('Context Propagation', () => {
    it('should include correct context information', async () => {
      const userId = 'context-test-user'
      const token = createTestJWTToken({ userId })
      
      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/GET/users',
        authorizationToken: `Bearer ${token}`
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult

      expect(result.context).toEqual({
        userId: userId,
        email: 'test@example.com',
        scope: 'read,write',
        tokenIssuer: 'user-management-service'
      })
    })
  })
})
