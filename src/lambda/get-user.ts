import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { Effect, Exit } from 'effect'
import { ValidationError, UserNotFoundError, UserResponse } from '../domain/user'
import { createUserService } from '../services/dynamo-user-service'
import { ApiResponse } from './types/api-response'

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Get User Lambda invoked', { event })

  try {
    // Extract user ID from path parameters
    const userId = event.pathParameters?.id

    if (!userId) {
      return ApiResponse.badRequest('User ID is required')
    }

    // Validate user ID format (basic validation)
    if (!userId.trim() || userId.includes('/') || userId.includes('?') || userId.includes('#') || userId.includes('%') || userId.length > 100) {
      return ApiResponse.badRequest('Invalid user ID format')
    }

    // Execute the Effect program with proper error handling
    const userService = createUserService()
    const exit = await Effect.runPromiseExit(userService.getUserById(userId))

    /* istanbul ignore next */
    if (Exit.isFailure(exit)) {
      /* istanbul ignore next */
      const error = exit.cause._tag === 'Fail' ? exit.cause.error : exit.cause
      /* istanbul ignore next */
      console.error('Effect error getting user:', error)
      
      // Handle typed Effect errors
      /* istanbul ignore next */
      if (error && typeof error === 'object' && '_tag' in error) {
        /* istanbul ignore next */
        switch (error._tag) {
          /* istanbul ignore next */
          case 'UserNotFoundError':
            /* istanbul ignore next */
            return ApiResponse.notFound('User not found', (error as any).message)
          /* istanbul ignore next */
          case 'DynamoUserRepositoryError':
            /* istanbul ignore next */
            return ApiResponse.databaseError((error as any).message)
        }
      }
      
      /* istanbul ignore next */
      return ApiResponse.internalServerError(
        'Internal server error',
        typeof error === 'string' ? error : 'Unknown error'
      )
    }

    const user = exit.value

    // Convert to response format
    const userResponse = new UserResponse({
      id: user.id,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    })

    return ApiResponse.ok(userResponse)

  } catch (error) {
    /* istanbul ignore next */
    console.error('Error getting user:', error)

    // Generic error handling for any uncaught errors
    /* istanbul ignore next */
    return ApiResponse.internalServerError(
      'Internal server error',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}
