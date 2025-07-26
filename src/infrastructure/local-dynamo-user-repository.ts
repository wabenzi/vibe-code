import { Effect, Context } from "effect"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb"
import { User, UserNotFoundError, DatabaseError } from "../domain/user"

export interface LocalDynamoUserRepository {
  create(user: User): Effect.Effect<User, DatabaseError>
  findById(id: string): Effect.Effect<User, UserNotFoundError | DatabaseError>
}

export const LocalDynamoUserRepository = Context.GenericTag<LocalDynamoUserRepository>("LocalDynamoUserRepository")

export const makeLocalDynamoUserRepository = (): Effect.Effect<LocalDynamoUserRepository, never> =>
  Effect.succeed({
    create: (user: User): Effect.Effect<User, DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          // Configure DynamoDB client for LocalStack
          const client = new DynamoDBClient({
            region: process.env.AWS_REGION || 'us-west-2',
            endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:4566',
            credentials: {
              accessKeyId: 'test',
              secretAccessKey: 'test'
            }
          })
          
          const docClient = DynamoDBDocumentClient.from(client)
          const tableName = process.env.DYNAMODB_TABLE_NAME || 'users-table'

          const item = {
            id: user.id,
            name: user.name,
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString()
          }

          await docClient.send(new PutCommand({
            TableName: tableName,
            Item: item
          }))

          return new User({
            id: user.id,
            name: user.name,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          })
        },
        catch: (error) => {
          console.error("LocalStack DynamoDB create error:", error)
          return new DatabaseError({
            message: "Failed to create user in LocalStack DynamoDB",
            cause: error
          })
        }
      }),

    findById: (id: string): Effect.Effect<User, UserNotFoundError | DatabaseError> =>
      Effect.tryPromise({
        try: async () => {
          // Configure DynamoDB client for LocalStack
          const client = new DynamoDBClient({
            region: process.env.AWS_REGION || 'us-west-2',
            endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:4566',
            credentials: {
              accessKeyId: 'test',
              secretAccessKey: 'test'
            }
          })
          
          const docClient = DynamoDBDocumentClient.from(client)
          const tableName = process.env.DYNAMODB_TABLE_NAME || 'users-table'

          const result = await docClient.send(new GetCommand({
            TableName: tableName,
            Key: { id }
          }))

          if (!result.Item) {
            throw new UserNotFoundError({
              message: `User with id ${id} not found in LocalStack`,
              userId: id
            })
          }

          return new User({
            id: result.Item.id,
            name: result.Item.name,
            createdAt: new Date(result.Item.createdAt),
            updatedAt: new Date(result.Item.updatedAt)
          })
        },
        catch: (error) => {
          if (error instanceof UserNotFoundError) {
            return error
          }
          console.error("LocalStack DynamoDB findById error:", error)
          return new DatabaseError({
            message: "Failed to retrieve user from LocalStack DynamoDB",
            cause: error
          })
        }
      })
  })

export const LocalDynamoUserRepositoryLive = LocalDynamoUserRepository.of(
  Effect.runSync(makeLocalDynamoUserRepository())
)
