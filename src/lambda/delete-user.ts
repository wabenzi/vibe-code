import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { Effect } from 'effect'
import { createUserService } from '../services/dynamo-user-service'
import { ApiResponse } from './types/api-response'
import { extractUserId } from './utils/validation'
import { handleError } from './utils/error-handler'

// Effect-based user deletion pipeline
const deleteUserProgram = (event: APIGatewayProxyEvent) => {
  console.log('Delete User Lambda invoked', { event })
  
  return extractUserId(event).pipe(
    Effect.flatMap(userId => {
      const userService = createUserService()
      return userService.deleteUser(userId)
    })
  )
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  return await Effect.runPromise(
    deleteUserProgram(event).pipe(
      Effect.map(() => ApiResponse.noContent()),
      Effect.catchAll((error) => Effect.succeed(handleError(error))),
      Effect.scoped
    )
  )
}
