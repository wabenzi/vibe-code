import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { Effect, Layer } from 'effect'
import { CreateUserRequest, UserResponse, ValidationError, DatabaseError } from '../domain/user'
import { makeLocalUserRepository, LocalUserRepository } from '../infrastructure/local-user-repository'
import { User } from '../domain/user'

const createUserLocal = (request: CreateUserRequest): Effect.Effect<UserResponse, DatabaseError | ValidationError, LocalUserRepository> =>
  Effect.gen(function* () {
    // Validate input
    if (!request.id.trim()) {
      yield* Effect.fail(new ValidationError({
        message: "Invalid user data",
        errors: ["User ID cannot be empty"],
      }))
    }

    if (!request.name.trim()) {
      yield* Effect.fail(new ValidationError({
        message: "Invalid user data",
        errors: ["User name cannot be empty"],
      }))
    }

    // Get repository from context
    const userRepository = yield* LocalUserRepository

    // Create user domain object
    const user = new User({
      id: request.id,
      name: request.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Save to repository
    const savedUser = yield* userRepository.create(user)

    // Return response
    return new UserResponse({
      id: savedUser.id,
      name: savedUser.name,
      createdAt: savedUser.createdAt.toISOString(),
      updatedAt: savedUser.updatedAt.toISOString(),
    })
  })

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Request body is required' })
      }
    }

    const requestData = JSON.parse(event.body)
    const request = new CreateUserRequest(requestData)

    // Create repository layer
    const repositoryLayer = Layer.effect(LocalUserRepository, makeLocalUserRepository())

    const program = Effect.provide(createUserLocal(request), repositoryLayer)
    const result = await Effect.runPromise(program)

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    }
  } catch (error) {
    console.error('Error creating user:', error)
    
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
