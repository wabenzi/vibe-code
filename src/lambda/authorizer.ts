import { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult, Context } from 'aws-lambda'
import { Effect } from 'effect'
import * as jwt from 'jsonwebtoken'

/**
 * JWT Token payload interface
 */
interface JWTPayload {
  sub: string // Subject (user ID)
  email?: string
  scope?: string[]
  aud: string // Audience
  iss: string // Issuer
  exp: number // Expiration time
  iat: number // Issued at time
}

/**
 * Lambda Authorizer function for validating JWT tokens
 * This function validates access tokens and returns IAM policies
 */
export const handler = async (
  event: APIGatewayTokenAuthorizerEvent,
  context: Context
): Promise<APIGatewayAuthorizerResult> => {
  console.log('Authorizer invoked', { 
    methodArn: event.methodArn,
    authorizationToken: event.authorizationToken ? 'Present' : 'Missing'
  })

  try {
    const result = await Effect.runPromise(
      Effect.gen(function* (_) {
        // Extract and validate the token
        const token = yield* _(extractToken(event.authorizationToken))
        
        // Verify and decode the JWT
        const payload = yield* _(verifyJWT(token))
        
        // Generate IAM policy based on token validation
        const policy = yield* _(generatePolicy(payload, event.methodArn))
        
        return policy
      })
    )

    return result
  } catch (error) {
    console.error('Authorization failed:', error)
    
    // Return deny policy for any authorization failures
    return generateDenyPolicy('user', event.methodArn)
  }
}

/**
 * Extract Bearer token from Authorization header
 */
const extractToken = (authorizationToken: string): Effect.Effect<string, Error> => {
  if (!authorizationToken) {
    return Effect.fail(new Error('No authorization token provided'))
  }

  const parts = authorizationToken.split(' ')
  
  // Handle Bearer tokens
  if (parts.length === 2 && parts[0] === 'Bearer') {
    const token = parts[1]
    if (!token) {
      return Effect.fail(new Error('Missing token in authorization header'))
    }
    return Effect.succeed(token)
  }
  
  // Handle direct tokens (without Bearer prefix)
  if (parts.length === 1 && parts[0]) {
    return Effect.succeed(parts[0])
  }

  return Effect.fail(new Error('Invalid authorization token format. Expected: Bearer <token> or <token>'))
}

/**
 * Verify and decode JWT token
 */
const verifyJWT = (token: string): Effect.Effect<JWTPayload, Error> => {
  return Effect.try(() => {
    // Get JWT secret from environment variable
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable not configured')
    }

    // Verify the JWT token
    const decoded = jwt.verify(token, jwtSecret, {
      algorithms: ['HS256'], // Only allow HMAC SHA256
      audience: process.env.JWT_AUDIENCE || 'user-management-api',
      issuer: process.env.JWT_ISSUER || 'user-management-service',
    }) as JWTPayload

    // Additional validation
    if (!decoded.sub) {
      throw new Error('Token missing required subject (sub) claim')
    }

    return decoded
  }).pipe(
    Effect.mapError(error => 
      new Error(`JWT verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    )
  )
}

/**
 * Generate IAM policy based on validated token
 */
const generatePolicy = (
  payload: JWTPayload, 
  methodArn: string
): Effect.Effect<APIGatewayAuthorizerResult, Error> => {
  return Effect.succeed({
    principalId: payload.sub,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: 'Allow',
          Resource: generateResourceArn(methodArn, payload)
        }
      ]
    },
    context: {
      userId: payload.sub,
      email: payload.email || '',
      scope: payload.scope?.join(',') || '',
      tokenIssuer: payload.iss,
    }
  })
}

/**
 * Generate resource ARN based on user permissions
 */
const generateResourceArn = (methodArn: string, payload: JWTPayload): string => {
  // Parse the method ARN to extract components
  const arnParts = methodArn.split(':')
  const apiGatewayArnPart = arnParts[5] // Contains: api-id/stage/method/resource-path
  const [apiId, stage] = apiGatewayArnPart.split('/')

  // For now, allow access to all API methods for authenticated users
  // In production, you might want more granular permissions based on user roles/scopes
  const resourceArn = `arn:aws:execute-api:${arnParts[3]}:${arnParts[4]}:${apiId}/${stage}/*/*`

  // Example of scope-based authorization:
  // if (payload.scope?.includes('admin')) {
  //   return `arn:aws:execute-api:${arnParts[3]}:${arnParts[4]}:${apiId}/${stage}/*/*`
  // } else {
  //   // Regular users can only access their own data
  //   return `arn:aws:execute-api:${arnParts[3]}:${arnParts[4]}:${apiId}/${stage}/*/users/${payload.sub}`
  // }

  return resourceArn
}

/**
 * Generate a deny policy for unauthorized requests
 */
const generateDenyPolicy = (principalId: string, methodArn: string): APIGatewayAuthorizerResult => {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: 'Deny',
          Resource: methodArn
        }
      ]
    }
  }
}

/**
 * Utility function to create a test JWT token (for development/testing)
 * This should NOT be used in production
 */
export const createTestToken = (userId: string, email: string = 'test@example.com'): string => {
  const jwtSecret = process.env.JWT_SECRET || 'development-secret-key'
  
  const payload: Omit<JWTPayload, 'exp' | 'iat'> = {
    sub: userId,
    email: email,
    scope: ['read', 'write'],
    aud: process.env.JWT_AUDIENCE || 'user-management-api',
    iss: process.env.JWT_ISSUER || 'user-management-service',
  }

  return jwt.sign(payload, jwtSecret, {
    algorithm: 'HS256',
    expiresIn: '1h', // Token expires in 1 hour
  })
}
