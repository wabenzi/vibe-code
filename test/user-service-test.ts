import { Effect, Context } from "effect"
import { User, CreateUserRequest, UserResponse, UserNotFoundError, DatabaseError, ValidationError } from '../src/domain/user'

// Create a test-specific UserRepository tag
export interface TestUserRepository {
  create(user: User): Effect.Effect<User, DatabaseError>
  findById(id: string): Effect.Effect<User, UserNotFoundError | DatabaseError>
}

export const TestUserRepository = Context.GenericTag<TestUserRepository>("TestUserRepository")

// Test-specific user service functions that don't import AWS dependencies
export const createUserTest = (request: CreateUserRequest): Effect.Effect<UserResponse, DatabaseError | ValidationError, TestUserRepository> =>
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
    const userRepository = yield* TestUserRepository

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

export const getUserByIdTest = (id: string): Effect.Effect<UserResponse, UserNotFoundError | DatabaseError | ValidationError, TestUserRepository> =>
  Effect.gen(function* () {
    // Validate input
    if (!id.trim()) {
      yield* Effect.fail(new ValidationError({
        message: "Invalid user ID",
        errors: ["User ID cannot be empty"],
      }))
    }

    // Get repository from context
    const userRepository = yield* TestUserRepository

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
