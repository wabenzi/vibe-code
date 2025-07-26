import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { Effect } from 'effect'
import { CreateUserRequest, ValidationError, UserResponse } from '../domain/user'
import { createUserService } from '../services/dynamo-user-service'

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Create User Lambda invoked', { event })

  try {
    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Request body is required',
        }),
      }
    }

    const requestData = JSON.parse(event.body)
    
    // Validate and create request object
    const createUserRequest = new CreateUserRequest({
      id: requestData.id,
      name: requestData.name,
    })

    // Execute the Effect program
    const userService = createUserService()
    const result = await Effect.runPromise(userService.createUser(createUserRequest))

    // Convert to response format
    const userResponse = new UserResponse({
      id: result.id,
      name: result.name,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    })

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(userResponse),
    }
  } catch (error) {
    console.error('Error creating user:', error)

    // Handle different types of errors
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
