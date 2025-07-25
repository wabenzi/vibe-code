import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { Effect, Layer } from 'effect'
import { UserResponse, UserNotFoundError, DatabaseError, ValidationError } from '../domain/user'
import { makeLocalUserRepository, LocalUserRepository } from '../infrastructure/local-user-repository'

const getUserByIdLocal = (id: string): Effect.Effect<UserResponse, UserNotFoundError | DatabaseError | ValidationError, LocalUserRepository> =>
  Effect.gen(function* () {
    // Validate input
    if (!id.trim()) {
      yield* Effect.fail(new ValidationError({
        message: "Invalid user ID",
        errors: ["User ID cannot be empty"],
      }))
    }

    // Get repository from context
    const userRepository = yield* LocalUserRepository

    // Get user from repository
    const user = yield* userRepository.findById(id)

    // Return response
    return new UserResponse({
      id: user.id,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    })
  })

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.pathParameters?.id

    if (!userId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'User ID is required' })
      }
    }

    // Create repository layer
    const repositoryLayer = Layer.effect(LocalUserRepository, makeLocalUserRepository())

    const program = Effect.provide(getUserByIdLocal(userId), repositoryLayer)
    const result = await Effect.runPromise(program)

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    }
  } catch (error) {
    console.error('Error getting user:', error)

    if (error && typeof error === 'object' && '_tag' in error && error._tag === 'UserNotFoundError') {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          error: 'User not found',
          message: (error as any).message 
        })
      }
    }
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}
