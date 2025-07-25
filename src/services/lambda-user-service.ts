import { Effect } from "effect"
import { User, CreateUserRequest, UserResponse, UserNotFoundError, DatabaseError, ValidationError } from "../domain/user"
import { UserRepository, UserRepositoryLive } from "../infrastructure/simple-user-repository"

// User Service functions for Lambda (using simple repository)
export const createUser = (request: CreateUserRequest): Effect.Effect<UserResponse, DatabaseError | ValidationError, UserRepository> =>
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
    const userRepository = yield* UserRepository

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

export const getUserById = (id: string): Effect.Effect<UserResponse, UserNotFoundError | DatabaseError | ValidationError, UserRepository> =>
  Effect.gen(function* () {
    // Validate input
    if (!id.trim()) {
      yield* Effect.fail(new ValidationError({
        message: "Invalid user ID",
        errors: ["User ID cannot be empty"],
      }))
    }

    // Get repository from context
    const userRepository = yield* UserRepository

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

// Functions with repository layer provided
export const createUserWithLayer = (request: CreateUserRequest) =>
  createUser(request).pipe(Effect.provide(UserRepositoryLive))

export const getUserByIdWithLayer = (id: string) =>
  getUserById(id).pipe(Effect.provide(UserRepositoryLive))
