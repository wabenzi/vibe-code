import { Effect, Layer } from "effect"
import { CreateUserRequest, UserResponse, ValidationError, DatabaseError, UserNotFoundError } from "../domain/user"
import { LocalDynamoUserRepository, LocalDynamoUserRepositoryLive } from "../infrastructure/local-dynamo-user-repository"
import { User } from "../domain/user"

export const createUserLocal = (request: CreateUserRequest): Effect.Effect<UserResponse, DatabaseError | ValidationError, LocalDynamoUserRepository> =>
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
    const userRepository = yield* LocalDynamoUserRepository

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

export const getUserLocal = (id: string): Effect.Effect<UserResponse, UserNotFoundError | DatabaseError | ValidationError, LocalDynamoUserRepository> =>
  Effect.gen(function* () {
    // Validate input
    if (!id.trim()) {
      yield* Effect.fail(new ValidationError({
        message: "Invalid user data",
        errors: ["User ID cannot be empty"],
      }))
    }

    // Get repository from context
    const userRepository = yield* LocalDynamoUserRepository

    // Find user in repository
    const user = yield* userRepository.findById(id)

    // Return response
    return new UserResponse({
      id: user.id,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    })
  })

// Run the effects with the LocalStack DynamoDB repository
export const runCreateUserLocal = (request: CreateUserRequest) =>
  Effect.provide(createUserLocal(request), Layer.succeed(LocalDynamoUserRepository, LocalDynamoUserRepositoryLive))

export const runGetUserLocal = (id: string) =>
  Effect.provide(getUserLocal(id), Layer.succeed(LocalDynamoUserRepository, LocalDynamoUserRepositoryLive))
