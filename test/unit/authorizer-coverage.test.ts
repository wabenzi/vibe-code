/**
 * Comprehensive Authorizer Coverage Tests
 * This file targets uncovered lines and branches in authorizer.ts
 */

import { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult, Context } from 'aws-lambda'
import { handler, createTestToken } from '../../src/lambda/authorizer'

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

describe('Authorizer Coverage Tests', () => {
  // Store original environment variables
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment before each test
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing authorization token', async () => {
      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/GET/users',
        authorizationToken: ''
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult

      expect(result.principalId).toBe('user')
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny')
    })

    it('should handle undefined authorization token', async () => {
      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/GET/users',
        authorizationToken: undefined as any
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult

      expect(result.principalId).toBe('user')
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny')
    })

    it('should handle Bearer token with empty token part', async () => {
      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/GET/users',
        authorizationToken: 'Bearer '
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult

      expect(result.principalId).toBe('user')
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny')
    })

    it('should handle Bearer token with null token part', async () => {
      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/GET/users',
        authorizationToken: 'Bearer'
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult

      expect(result.principalId).toBe('user')
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny')
    })

    it('should handle invalid token format with multiple spaces', async () => {
      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/GET/users',
        authorizationToken: 'Bearer token extra'
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult

      expect(result.principalId).toBe('user')
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny')
    })

    it('should handle missing JWT_SECRET environment variable', async () => {
      // Remove JWT_SECRET from environment
      delete process.env.JWT_SECRET

      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/GET/users',
        authorizationToken: 'Bearer some-token'
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult

      expect(result.principalId).toBe('user')
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny')
    })

    it('should handle JWT verification failure', async () => {
      process.env.JWT_SECRET = 'test-secret'

      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/GET/users',
        authorizationToken: 'Bearer invalid-jwt-token'
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult

      expect(result.principalId).toBe('user')
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny')
    })

    it('should handle JWT with missing subject claim', async () => {
      process.env.JWT_SECRET = 'test-secret'
      
      // Create a JWT without subject claim
      const jwt = require('jsonwebtoken')
      const invalidToken = jwt.sign(
        { 
          email: 'test@example.com',
          aud: 'user-management-api',
          iss: 'user-management-service'
        }, 
        'test-secret'
      )

      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/GET/users',
        authorizationToken: `Bearer ${invalidToken}`
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult

      expect(result.principalId).toBe('user')
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny')
    })

    it('should handle JWT with empty subject claim', async () => {
      process.env.JWT_SECRET = 'test-secret'
      
      // Create a JWT with empty subject claim
      const jwt = require('jsonwebtoken')
      const invalidToken = jwt.sign(
        { 
          sub: '',
          email: 'test@example.com',
          aud: 'user-management-api',
          iss: 'user-management-service'
        }, 
        'test-secret'
      )

      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/GET/users',
        authorizationToken: `Bearer ${invalidToken}`
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult

      expect(result.principalId).toBe('user')
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny')
    })

    it('should handle direct token without Bearer prefix', async () => {
      process.env.JWT_SECRET = 'test-secret'
      
      // Create a valid JWT
      const validToken = createTestToken('direct-user', 'direct@example.com')

      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/GET/users',
        authorizationToken: validToken
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult

      expect(result.principalId).toBe('direct-user')
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow')
      expect(result.context?.userId).toBe('direct-user')
      expect(result.context?.email).toBe('direct@example.com')
    })

    it('should handle empty string token', async () => {
      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/GET/users',
        authorizationToken: ''
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult

      expect(result.principalId).toBe('user')
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny')
    })

    it('should handle JWT algorithm mismatch', async () => {
      process.env.JWT_SECRET = 'test-secret'
      
      // Create a JWT with wrong algorithm
      const jwt = require('jsonwebtoken')
      const wrongAlgoToken = jwt.sign(
        { 
          sub: 'test-user',
          email: 'test@example.com',
          aud: 'user-management-api',
          iss: 'user-management-service'
        }, 
        'test-secret',
        { algorithm: 'HS512' } // Wrong algorithm
      )

      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/GET/users',
        authorizationToken: `Bearer ${wrongAlgoToken}`
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult

      expect(result.principalId).toBe('user')
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny')
    })

    it('should handle JWT with wrong audience', async () => {
      process.env.JWT_SECRET = 'test-secret'
      process.env.JWT_AUDIENCE = 'expected-audience'
      
      // Create a JWT with wrong audience
      const jwt = require('jsonwebtoken')
      const wrongAudToken = jwt.sign(
        { 
          sub: 'test-user',
          email: 'test@example.com',
          aud: 'wrong-audience',
          iss: 'user-management-service'
        }, 
        'test-secret'
      )

      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/GET/users',
        authorizationToken: `Bearer ${wrongAudToken}`
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult

      expect(result.principalId).toBe('user')
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny')
    })

    it('should handle JWT with wrong issuer', async () => {
      process.env.JWT_SECRET = 'test-secret'
      process.env.JWT_ISSUER = 'expected-issuer'
      
      // Create a JWT with wrong issuer
      const jwt = require('jsonwebtoken')
      const wrongIssToken = jwt.sign(
        { 
          sub: 'test-user',
          email: 'test@example.com',
          aud: 'user-management-api',
          iss: 'wrong-issuer'
        }, 
        'test-secret'
      )

      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/GET/users',
        authorizationToken: `Bearer ${wrongIssToken}`
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult

      expect(result.principalId).toBe('user')
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny')
    })
  })

  describe('Successful Authorization Scenarios', () => {
    beforeEach(() => {
      process.env.JWT_SECRET = 'test-secret'
      process.env.JWT_AUDIENCE = 'user-management-api'
      process.env.JWT_ISSUER = 'user-management-service'
    })

    it('should handle valid JWT with all claims', async () => {
      const validToken = createTestToken('full-user', 'full@example.com')

      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/GET/users',
        authorizationToken: `Bearer ${validToken}`
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult

      expect(result.principalId).toBe('full-user')
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow')
      expect(result.context?.userId).toBe('full-user')
      expect(result.context?.email).toBe('full@example.com')
      expect(result.context?.scope).toBe('read,write')
      expect(result.context?.tokenIssuer).toBe('user-management-service')
    })

    it('should handle valid JWT with minimal claims', async () => {
      const jwt = require('jsonwebtoken')
      const minimalToken = jwt.sign(
        { 
          sub: 'minimal-user',
          aud: 'user-management-api',
          iss: 'user-management-service'
        }, 
        'test-secret'
      )

      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/GET/users',
        authorizationToken: `Bearer ${minimalToken}`
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult

      expect(result.principalId).toBe('minimal-user')
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow')
      expect(result.context?.userId).toBe('minimal-user')
      expect(result.context?.email).toBe('')
      expect(result.context?.scope).toBe('')
    })

    it('should generate correct resource ARN format', async () => {
      const validToken = createTestToken('arn-test-user')

      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-west-2:123456789012:api123/prod/GET/users/test',
        authorizationToken: `Bearer ${validToken}`
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult

      expect(result.principalId).toBe('arn-test-user')
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow')
      // Check that resource ARN is properly formatted
      const statement = result.policyDocument.Statement[0] as any
      expect(statement.Resource).toBe(
        'arn:aws:execute-api:us-west-2:123456789012:api123/prod/*/*'
      )
    })
  })

  describe('createTestToken Function Coverage', () => {
    beforeEach(() => {
      process.env.JWT_SECRET = 'test-secret'
    })

    it('should create token with default email', () => {
      const token = createTestToken('test-user')
      
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      
      // Verify token can be decoded
      const jwt = require('jsonwebtoken')
      const decoded = jwt.verify(token, 'test-secret') as any
      
      expect(decoded.sub).toBe('test-user')
      expect(decoded.email).toBe('test@example.com')
      expect(decoded.scope).toEqual(['read', 'write'])
    })

    it('should create token with custom email', () => {
      const token = createTestToken('custom-user', 'custom@example.com')
      
      expect(token).toBeDefined()
      
      // Verify token can be decoded
      const jwt = require('jsonwebtoken')
      const decoded = jwt.verify(token, 'test-secret') as any
      
      expect(decoded.sub).toBe('custom-user')
      expect(decoded.email).toBe('custom@example.com')
    })

    it('should create token with default environment values', () => {
      delete process.env.JWT_SECRET
      delete process.env.JWT_AUDIENCE
      delete process.env.JWT_ISSUER
      
      const token = createTestToken('env-test-user')
      
      expect(token).toBeDefined()
      
      // Verify token can be decoded with default secret
      const jwt = require('jsonwebtoken')
      const decoded = jwt.verify(token, 'development-secret-key') as any
      
      expect(decoded.sub).toBe('env-test-user')
      expect(decoded.aud).toBe('user-management-api')
      expect(decoded.iss).toBe('user-management-service')
    })

    it('should create token with custom environment values', () => {
      process.env.JWT_SECRET = 'custom-secret'
      process.env.JWT_AUDIENCE = 'custom-audience'
      process.env.JWT_ISSUER = 'custom-issuer'
      
      const token = createTestToken('env-custom-user')
      
      expect(token).toBeDefined()
      
      // Verify token can be decoded with custom secret
      const jwt = require('jsonwebtoken')
      const decoded = jwt.verify(token, 'custom-secret') as any
      
      expect(decoded.sub).toBe('env-custom-user')
      expect(decoded.aud).toBe('custom-audience')
      expect(decoded.iss).toBe('custom-issuer')
    })
  })

  describe('Edge Cases for mapError Function', () => {
    it('should handle non-Error objects in mapError', async () => {
      process.env.JWT_SECRET = 'test-secret'
      
      // Create an invalid token that will cause a specific error
      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/GET/users',
        authorizationToken: 'Bearer malformed.jwt.token'
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult

      expect(result.principalId).toBe('user')
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny')
    })

    it('should handle expired JWT token', async () => {
      process.env.JWT_SECRET = 'test-secret'
      
      // Create an expired JWT
      const jwt = require('jsonwebtoken')
      const expiredToken = jwt.sign(
        { 
          sub: 'expired-user',
          email: 'expired@example.com',
          aud: 'user-management-api',
          iss: 'user-management-service'
        }, 
        'test-secret',
        { expiresIn: '-1h' } // Already expired
      )

      const event: APIGatewayTokenAuthorizerEvent = {
        type: 'TOKEN',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:test-api/test/GET/users',
        authorizationToken: `Bearer ${expiredToken}`
      }

      const result = await handler(event, mockContext) as APIGatewayAuthorizerResult

      expect(result.principalId).toBe('user')
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny')
    })
  })
})
