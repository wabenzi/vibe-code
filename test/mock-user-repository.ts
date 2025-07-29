import { Effect, Layer, Context } from "effect"
import { User, CreateUserRequest, UserNotFoundError } from "../src/domain/user"
import { UserRepository, DynamoUserRepositoryError } from "../src/infrastructure/dynamo-user-repository"

// Create Context tag for UserRepository
export const UserRepositoryTag = Context.GenericTag<UserRepository>("UserRepository")

// Mock User Repository for testing
export class MockUserRepository implements UserRepository {
  private users: Map<string, User> = new Map()

  create(request: CreateUserRequest): Effect.Effect<User, DynamoUserRepositoryError> {
    return Effect.sync(() => {
      const now = new Date()
      const createdUser = new User({
        id: request.id,
        name: request.name,
        createdAt: now,
        updatedAt: now,
      })
      
      this.users.set(createdUser.id, createdUser)
      console.log(`Mock: Created user ${createdUser.id}`)
      return createdUser
    })
  }

  findById(id: string): Effect.Effect<User, UserNotFoundError | DynamoUserRepositoryError> {
    return Effect.try({
      try: () => {
        // Always return test user for ID "test"
        if (id === "test") {
          return new User({
            id: "test",
            name: "Test User",
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
          })
        }

        const user = this.users.get(id)
        if (!user) {
          throw new UserNotFoundError({
            message: `User with ID ${id} not found`,
            userId: id,
          })
        }
        
        console.log(`Mock: Found user ${user.id}`)
        return user
      },
      catch: (error) => {
        if (error instanceof UserNotFoundError) {
          return error
        }
        return new DynamoUserRepositoryError({
          message: `Mock database error: ${error}`,
          cause: error,
        })
      }
    })
  }

  findAll(): Effect.Effect<readonly User[], DynamoUserRepositoryError> {
    return Effect.sync(() => {
      const allUsers = Array.from(this.users.values())
      console.log(`Mock: Retrieved ${allUsers.length} users`)
      return allUsers
    })
  }

  deleteById(id: string): Effect.Effect<void, UserNotFoundError | DynamoUserRepositoryError> {
    return Effect.try({
      try: () => {
        if (!this.users.has(id)) {
          throw new UserNotFoundError({
            message: `User with ID ${id} not found`,
            userId: id,
          })
        }
        
        this.users.delete(id)
        console.log(`Mock: Deleted user ${id}`)
      },
      catch: (error) => {
        if (error instanceof UserNotFoundError) {
          return error
        }
        return new DynamoUserRepositoryError({
          message: `Mock database error: ${error}`,
          cause: error,
        })
      }
    })
  }
}

// Mock Layer for testing
export const MockUserRepositoryLive = Layer.sync(
  UserRepositoryTag,
  () => new MockUserRepository()
)
