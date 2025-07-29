import { Effect, Schema } from "effect"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  ScanCommand,
  DeleteCommand 
} from "@aws-sdk/lib-dynamodb"
import { User, CreateUserRequest, UserNotFoundError } from "../domain/user"

// DynamoDB configuration - supports both AWS and LocalStack
// AWS SDK will automatically use credentials from AWS profiles:
// - "leonhardt" profile for AWS deployments
// - "localstack" profile for LocalStack
/* istanbul ignore next */
const dynamoClientConfig: any = {
  region: process.env.AWS_REGION || 'us-west-2'
}

// If DYNAMODB_ENDPOINT is set (for LocalStack), add endpoint configuration
// No need to set credentials - AWS SDK will use profile-based authentication
/* istanbul ignore next */
if (process.env.DYNAMODB_ENDPOINT) {
  dynamoClientConfig.endpoint = process.env.DYNAMODB_ENDPOINT
}

/* istanbul ignore next */
const dynamoClient = new DynamoDBClient(dynamoClientConfig)
/* istanbul ignore next */
const docClient = DynamoDBDocumentClient.from(dynamoClient)

/* istanbul ignore next */
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'users-table'

export class DynamoUserRepositoryError extends Schema.TaggedError<DynamoUserRepositoryError>()(
  "DynamoUserRepositoryError",
  {
    message: Schema.String,
    cause: Schema.Unknown,
  }
) {}

export interface UserRepository {
  readonly create: (request: CreateUserRequest) => Effect.Effect<User, DynamoUserRepositoryError>
  readonly findById: (id: string) => Effect.Effect<User, UserNotFoundError | DynamoUserRepositoryError>
  readonly findAll: () => Effect.Effect<readonly User[], DynamoUserRepositoryError>
  readonly deleteById: (id: string) => Effect.Effect<void, UserNotFoundError | DynamoUserRepositoryError>
}

export const DynamoUserRepository: UserRepository = {
  create: (request: CreateUserRequest) => {
    const now = new Date()
    const user = new User({
      id: request.id,
      name: request.name,
      createdAt: now,
      updatedAt: now,
    })

    return Effect.tryPromise({
      try: () =>
        /* istanbul ignore next */
        docClient.send(new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            id: user.id,
            name: user.name,
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString(),
          },
          ConditionExpression: 'attribute_not_exists(id)', // Prevent overwriting existing users
        })),
      catch: (error) => new DynamoUserRepositoryError({
        message: `Failed to create user: ${error}`,
        cause: error,
      })
    }).pipe(
      Effect.map(() => user)
    )
  },

  findById: (id: string) =>
    Effect.tryPromise({
      try: () =>
        /* istanbul ignore next */
        docClient.send(new GetCommand({
          TableName: TABLE_NAME,
          Key: { id },
        })),
      catch: (error) => new DynamoUserRepositoryError({
        message: `Failed to find user by id ${id}: ${error}`,
        cause: error,
      })
    }).pipe(
      Effect.flatMap((result) =>
        !result.Item
          ? Effect.fail(new UserNotFoundError({ 
              message: `User with id ${id} not found`,
              userId: id 
            }))
          : Effect.succeed(new User({
              id: result.Item.id,
              name: result.Item.name,
              createdAt: new Date(result.Item.createdAt),
              updatedAt: new Date(result.Item.updatedAt),
            }))
      )
    ),

  findAll: () =>
    Effect.tryPromise({
      try: () =>
        /* istanbul ignore next */
        docClient.send(new ScanCommand({
          TableName: TABLE_NAME,
        })),
      catch: (error) => new DynamoUserRepositoryError({
        message: `Failed to find all users: ${error}`,
        cause: error,
      })
    }).pipe(
      Effect.map((result) =>
        /* istanbul ignore next */
        (result.Items || []).map(item => 
          new User({
            id: item.id,
            name: item.name,
            createdAt: new Date(item.createdAt),
            updatedAt: new Date(item.updatedAt),
          })
        )
      )
    ),

  deleteById: (id: string) =>
    DynamoUserRepository.findById(id).pipe(
      Effect.flatMap(() =>
        Effect.tryPromise({
          try: () =>
            /* istanbul ignore next */
            docClient.send(new DeleteCommand({
              TableName: TABLE_NAME,
              Key: { id },
            })),
          catch: (error) => new DynamoUserRepositoryError({
            message: `Failed to delete user by id ${id}: ${error}`,
            cause: error,
          })
        }).pipe(
          Effect.map(() => void 0)
        )
      )
    ),
}
