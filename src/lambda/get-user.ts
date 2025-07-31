import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { Effect } from 'effect'
import { UserResponse } from '../domain/user'
import { createUserService } from '../services/dynamo-user-service'
import { ApiResponse } from './types/api-response'
import { extractUserId } from './utils/validation'
import { handleError } from './utils/error-handler'
import { withSecurity } from './utils/security-middleware'

// Effect-based user retrieval pipeline
const getUserProgram = (event: APIGatewayProxyEvent, authenticatedUser?: string) => {
  console.log('Get User Lambda invoked', { event, authenticatedUser })
  
  return extractUserId(event).pipe(
    Effect.flatMap(userId => {
      const userService = createUserService()
      return userService.getUserById(userId)
    }),
    Effect.map(user => new UserResponse({
      id: user.id,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    }))
  )
}

const handlerLogic = (event: APIGatewayProxyEvent, authenticatedUser?: string) => {
  return getUserProgram(event, authenticatedUser).pipe(
    Effect.map(userResponse => ApiResponse.ok(userResponse)),
    Effect.catchAll((error) => Effect.succeed(handleError(error))),
    Effect.scoped
  )
}

// Export the handler logic for unit testing (without security middleware)
export const getUserHandler = handlerLogic

// Export the secured handler for production use
export const handler = withSecurity(handlerLogic)
