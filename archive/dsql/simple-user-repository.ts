import { Effect, Context, Layer } from "effect"
import { User, UserNotFoundError, DatabaseError } from "../domain/user"

// User Repository interface
export interface UserRepository {
  create(user: User): Effect.Effect<User, DatabaseError>
  findById(id: string): Effect.Effect<User, UserNotFoundError | DatabaseError>
}

export const UserRepository = Context.GenericTag<UserRepository>("UserRepository")

// Simple User Repository implementation for Lambda
export class SimpleUserRepository implements UserRepository {
  private users: Map<string, User> = new Map()

  constructor(
    private readonly clusterArn: string,
    private readonly databaseName: string
  ) {
    // Initialize with test user
    this.users.set("test", new User({
      id: "test",
      name: "Test User",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    }))
  }

  create(user: User): Effect.Effect<User, DatabaseError> {
    return Effect.try({
      try: () => {
        console.log(`Creating user: ${JSON.stringify(user)}`)
        
        const createdUser = new User({
          ...user,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        
        // Store in memory for this demo
        this.users.set(createdUser.id, createdUser)
        
        console.log(`Successfully created user: ${createdUser.id}`)
        return createdUser
      },
      catch: (error) => new DatabaseError({
        message: `Failed to create user: ${error}`,
        cause: error,
      }),
    })
  }

  findById(id: string): Effect.Effect<User, UserNotFoundError | DatabaseError> {
    return Effect.try({
      try: () => {
        console.log(`Finding user by ID: ${id}`)
        
        const user = this.users.get(id)
        if (!user) {
          throw new UserNotFoundError({
            message: `User with ID ${id} not found`,
            userId: id,
          })
        }
        
        console.log(`Successfully found user: ${user.id}`)
        return user
      },
      catch: (error) => {
        if (error instanceof UserNotFoundError) {
          return error
        }
        return new DatabaseError({
          message: `Failed to find user: ${error}`,
          cause: error,
        })
      }
    })
  }
}

// Layer for providing the UserRepository
export const UserRepositoryLive = Layer.sync(
  UserRepository,
  () => {
    const clusterArn = process.env.DSQL_CLUSTER_ARN || ""
    const databaseName = process.env.DSQL_DATABASE_NAME || "users_db"
    return new SimpleUserRepository(clusterArn, databaseName)
  }
)
