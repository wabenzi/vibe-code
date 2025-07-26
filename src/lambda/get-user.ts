import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { Effect } from 'effect'
import { ValidationError, UserNotFoundError, UserResponse } from '../domain/user'
import { createUserService } from '../services/dynamo-user-service'

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Get User Lambda invoked', { event })

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

    // Execute the Effect program
    const userService = createUserService()
    const user = await Effect.runPromise(userService.getUserById(userId))

    // Convert to response format
    const userResponse = new UserResponse({
      id: user.id,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    })

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(userResponse),
    }
  } catch (error) {
    console.error('Error getting user:', error)

    // Handle different types of errors
    if (error instanceof UserNotFoundError) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'User not found',
          message: error.message,
          userId: error.userId,
        }),
      }
    }

    if (error instanceof ValidationError) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: error.message,
          details: error.errors,
        }),
      }
    }

    // Generic error handling
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
