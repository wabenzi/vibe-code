import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { Effect } from 'effect'
import { CreateUserRequest } from '../domain/user'
import { runCreateUserLocal } from '../services/local-dynamo-user-service'

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key'
        },
        body: JSON.stringify({
          error: 'Bad request',
          message: 'Request body is required'
        })
      }
    }

    const request = JSON.parse(event.body) as CreateUserRequest

    const result = await Effect.runPromise(runCreateUserLocal(request))

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key'
      },
      body: JSON.stringify(result)
    }
  } catch (error) {
    console.error('LocalStack Create User Error:', error)

    // Handle different error types
    if (error && typeof error === 'object' && '_tag' in error) {
      switch (error._tag) {
        case 'ValidationError':
          return {
            statusCode: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key'
            },
            body: JSON.stringify({
              error: 'Validation error',
              message: (error as any).message,
              errors: (error as any).errors
            })
          }
        case 'DatabaseError':
          return {
            statusCode: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key'
            },
            body: JSON.stringify({
              error: 'Database error',
              message: (error as any).message
            })
          }
      }
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: 'An unexpected error occurred in LocalStack'
      })
    }
  }
}
