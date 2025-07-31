import * as jwt from 'jsonwebtoken'

/**
 * Test utilities for JWT token generation and validation
 * These utilities should only be used in development and testing environments
 */

export interface TestTokenConfig {
  userId: string
  email?: string
  scope?: string[]
  expiresIn?: string
  jwtSecret?: string
  audience?: string
  issuer?: string
}

/**
 * Create a test JWT token for development and testing
 * WARNING: Do not use in production
 */
export const createTestJWTToken = (config: TestTokenConfig): string => {
  const {
    userId,
    email = 'test@example.com',
    scope = ['read', 'write'],
    expiresIn = '1h',
    jwtSecret = process.env.JWT_SECRET || 'development-secret-key',
    audience = process.env.JWT_AUDIENCE || 'user-management-api',
    issuer = process.env.JWT_ISSUER || 'user-management-service'
  } = config

  const payload = {
    sub: userId,
    email: email,
    scope: scope,
    aud: audience,
    iss: issuer,
  }

  return jwt.sign(payload, jwtSecret, {
    algorithm: 'HS256',
    expiresIn: expiresIn,
  } as jwt.SignOptions)
}

/**
 * Verify a JWT token (for testing purposes)
 */
export const verifyTestJWTToken = (token: string, jwtSecret?: string): any => {
  const secret = jwtSecret || process.env.JWT_SECRET || 'development-secret-key'
  
  try {
    return jwt.verify(token, secret, {
      algorithms: ['HS256'],
      audience: process.env.JWT_AUDIENCE || 'user-management-api',
      issuer: process.env.JWT_ISSUER || 'user-management-service',
    })
  } catch (error) {
    throw new Error(`Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Create a valid Authorization header for testing
 */
export const createAuthorizationHeader = (config: TestTokenConfig): string => {
  const token = createTestJWTToken(config)
  return `Bearer ${token}`
}

/**
 * Mock API Gateway event with JWT authorization context
 * This simulates what the Lambda Authorizer would add to the event
 */
export const createMockAuthorizedEvent = (
  baseEvent: any,
  config: TestTokenConfig
) => {
  return {
    ...baseEvent,
    requestContext: {
      ...baseEvent.requestContext,
      authorizer: {
        principalId: config.userId,
        userId: config.userId,
        email: config.email || 'test@example.com',
        scope: config.scope?.join(',') || 'read,write',
        tokenIssuer: config.issuer || 'user-management-service',
      }
    }
  }
}

/**
 * Environment variables for testing JWT
 */
export const getTestJWTConfig = () => {
  return {
    JWT_SECRET: process.env.JWT_SECRET || 'development-secret-key',
    JWT_AUDIENCE: process.env.JWT_AUDIENCE || 'user-management-api',
    JWT_ISSUER: process.env.JWT_ISSUER || 'user-management-service',
  }
}

/**
 * Test users for consistent testing
 */
export const TEST_USERS = {
  ADMIN: {
    userId: 'admin-user-123',
    email: 'admin@example.com',
    scope: ['read', 'write', 'admin']
  },
  REGULAR_USER: {
    userId: 'user-456',
    email: 'user@example.com',
    scope: ['read', 'write']
  },
  READ_ONLY_USER: {
    userId: 'readonly-789',
    email: 'readonly@example.com',
    scope: ['read']
  }
} as const
