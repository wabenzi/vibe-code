import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { Effect } from 'effect'
import { createUserService } from '../services/dynamo-user-service'
import { ApiResponse } from './types/api-response'
import { extractUserId } from './utils/validation'
import { handleError } from './utils/error-handler'
import { withAuthContext } from './utils/auth-context-middleware'

// Effect-based user deletion pipeline
const deleteUserProgram = (event: APIGatewayProxyEvent, userContext: { userId: string; email?: string; scope?: string[] }) => {
  console.log('Delete User Lambda invoked', { event, authenticatedUser: undefined })
  
  return extractUserId(event).pipe(
    Effect.flatMap(userId => {
      const userService = createUserService()
      return userService.deleteUser(userId)
    })
  )
}

const handlerLogic = (event: APIGatewayProxyEvent, userContext: { userId: string; email?: string; scope?: string[] }) => {
  return deleteUserProgram(event, userContext).pipe(
    Effect.map(() => ApiResponse.noContent()),
    Effect.catchAll((error) => Effect.succeed(handleError(error))),
    Effect.scoped
  )
}

// Export the handler logic for unit testing (without security middleware)
export const deleteUserHandler = handlerLogic

// Export the secured handler for production use
export const handler = withAuthContext(handlerLogic)
