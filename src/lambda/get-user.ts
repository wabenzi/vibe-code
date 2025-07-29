import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { Effect } from 'effect'
import { UserResponse } from '../domain/user'
import { createUserService } from '../services/dynamo-user-service'
import { ApiResponse } from './types/api-response'
import { extractUserId } from './utils/validation'
import { handleError } from './utils/error-handler'

// Effect-based user retrieval pipeline
const getUserProgram = (event: APIGatewayProxyEvent) => {
  console.log('Get User Lambda invoked', { event })
  
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

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  return await Effect.runPromise(
    getUserProgram(event).pipe(
      Effect.map(userResponse => ApiResponse.ok(userResponse)),
      Effect.catchAll((error) => Effect.succeed(handleError(error))),
      Effect.scoped
    )
  )
}
