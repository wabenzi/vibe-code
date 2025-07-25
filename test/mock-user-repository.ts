import { Effect, Layer } from "effect"
import { User, UserNotFoundError, DatabaseError } from "../src/domain/user"
import { UserRepository } from "../src/infrastructure/user-repository"

// Mock User Repository for testing
export class MockUserRepository implements UserRepository {
  private users: Map<string, User> = new Map()

  create(user: User): Effect.Effect<User, DatabaseError> {
    return Effect.sync(() => {
      const createdUser = new User({
        ...user,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      
      this.users.set(createdUser.id, createdUser)
      console.log(`Mock: Created user ${createdUser.id}`)
      return createdUser
    })
  }

  findById(id: string): Effect.Effect<User, UserNotFoundError | DatabaseError> {
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
        return new DatabaseError({
          message: `Mock database error: ${error}`,
          cause: error,
        })
      }
    })
  }
}

// Mock Layer for testing
export const MockUserRepositoryLive = Layer.sync(
  UserRepository,
  () => new MockUserRepository()
)
