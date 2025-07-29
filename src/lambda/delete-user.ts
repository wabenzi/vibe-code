import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { Effect, Exit } from 'effect'
import { UserNotFoundError } from '../domain/user'
import { createUserService } from '../services/dynamo-user-service'

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Delete User Lambda invoked', { event })

  try {
    // Extract user ID from path parameters
    const userId = event.pathParameters?.id

    if (!userId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'User ID is required',
        }),
      }
    }

    // Validate user ID format (basic validation)
    if (!userId.trim() || userId.includes('/') || userId.includes('?') || userId.includes('#') || userId.includes('%') || userId.length > 100) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Invalid user ID format',
        }),
      }
    }

    // Execute the Effect program with proper error handling
    const userService = createUserService()
    const exit = await Effect.runPromiseExit(userService.deleteUser(userId))

    if (Exit.isFailure(exit)) {
      const error = exit.cause._tag === 'Fail' ? exit.cause.error : exit.cause
      console.error('Effect error deleting user:', error)
      
      // Handle typed Effect errors
      if (error && typeof error === 'object' && '_tag' in error) {
        switch (error._tag) {
          case 'UserNotFoundError':
            return {
              statusCode: 404,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
              body: JSON.stringify({
                error: 'User not found',
                message: (error as any).message,
                userId: (error as any).userId,
              }),
            }
          case 'DynamoUserRepositoryError':
            return {
              statusCode: 500,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
              body: JSON.stringify({
                error: 'Database error',
                message: (error as any).message,
              }),
            }
        }
      }
      
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Internal server error',
          message: typeof error === 'string' ? error : 'Unknown error',
        }),
      }
    }

    return {
      statusCode: 204,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: '',
    }
  } catch (error) {
    console.error('Error deleting user:', error)

    // Generic error handling for any uncaught errors
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    }
  }
}
