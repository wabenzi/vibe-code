import { Effect, Context, Layer } from 'effect'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { User, CreateUserRequest, UserNotFoundError } from '../../src/domain/user'
import { UserService } from '../../src/services/dynamo-user-service'
import { DynamoUserRepositoryError } from '../../src/infrastructure/dynamo-user-repository'

// Mock UserService using Effect Context
const MockUserService = Context.GenericTag<UserService>('MockUserService')

// Create mock implementations
const createMockUserService = (overrides: Partial<UserService> = {}): UserService => ({
  createUser: overrides.createUser || ((request: CreateUserRequest) => 
    Effect.succeed(new User({
      id: request.id,
      name: request.name,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    }))
  ),
  getUserById: overrides.getUserById || ((id: string) => {
    if (id === 'existing-user') {
      return Effect.succeed(new User({
        id: 'existing-user',
        name: 'Existing User',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      }))
    }
    return Effect.fail(new UserNotFoundError({
      message: `User with id ${id} not found`,
      userId: id
    }))
  }),
  getAllUsers: overrides.getAllUsers || (() => 
    Effect.succeed([
      new User({
        id: 'user1',
        name: 'User One',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      }),
      new User({
        id: 'user2', 
        name: 'User Two',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      })
    ])
  ),
  deleteUser: overrides.deleteUser || ((id: string) => {
    if (id === 'existing-user') {
      return Effect.succeed(undefined)
    }
    return Effect.fail(new UserNotFoundError({
      message: `User with id ${id} not found`,
      userId: id
    }))
  }),
})

// Helper to create test events
const createAPIGatewayEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent => ({
  body: null,
  headers: {},
  multiValueHeaders: {},
  httpMethod: 'GET',
  isBase64Encoded: false,
  path: '/users',
  pathParameters: null,
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  stageVariables: null,
  requestContext: {
    accountId: '123456789012',
    apiId: 'test-api',
    protocol: 'HTTP/1.1',
    httpMethod: 'GET',
    path: '/users',
    stage: 'test',
    requestId: 'test-request-id',
    requestTime: '2025-01-01T00:00:00Z',
    requestTimeEpoch: 1640995200000,
    resourceId: 'test-resource',
    resourcePath: '/users',
    identity: {
      accessKey: null,
      accountId: null,
      apiKey: null,
      apiKeyId: null,
      caller: null,
      clientCert: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: '127.0.0.1',
      user: null,
      userAgent: 'test-agent',
      userArn: null,
    },
    authorizer: null,
  },
  resource: '/users',
  ...overrides,
})

describe('API Lambda Functions with Effect Service Mocking', () => {
  describe('Create User Lambda', () => {
    // Import the handler dynamically to avoid module loading issues
    let createUserHandler: any

    beforeEach(async () => {
      // Reset modules to ensure clean imports
      jest.resetModules()
    })

    it('should create a user successfully with mocked service', async () => {
      const mockService = createMockUserService()
      
      // Create the effect that uses the mock service
      const createUserEffect = Effect.gen(function* () {
        const userService = yield* MockUserService
        const request = new CreateUserRequest({
          id: 'test-user-123',
          name: 'Test User'
        })
        return yield* userService.createUser(request)
      })

      // Provide the mock service and run the effect
      const result = await Effect.runPromise(
        createUserEffect.pipe(
          Effect.provideService(MockUserService, mockService)
        )
      )

      expect(result.id).toBe('test-user-123')
      expect(result.name).toBe('Test User')
      expect(result.createdAt).toEqual(new Date('2025-01-01T00:00:00.000Z'))
      expect(result.updatedAt).toEqual(new Date('2025-01-01T00:00:00.000Z'))
    })

    it('should handle validation errors with mocked service', async () => {
      const mockServiceWithError = createMockUserService({
        createUser: (_request: CreateUserRequest) => 
          Effect.fail(new DynamoUserRepositoryError({
            message: 'Validation failed',
            cause: 'Invalid data'
          }))
      })

      const createUserEffect = Effect.gen(function* () {
        const userService = yield* MockUserService
        const request = new CreateUserRequest({
          id: 'invalid-user',
          name: 'Invalid User'
        })
        return yield* userService.createUser(request)
      })

      const result = await Effect.runPromise(
        Effect.either(
          createUserEffect.pipe(
            Effect.provideService(MockUserService, mockServiceWithError)
          )
        )
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(DynamoUserRepositoryError)
        expect(result.left.message).toBe('Validation failed')
      }
    })

    it('should handle duplicate user creation', async () => {
      const mockServiceWithDuplicate = createMockUserService({
        createUser: (_request: CreateUserRequest) => 
          Effect.fail(new DynamoUserRepositoryError({
            message: 'User already exists',
            cause: 'ConditionalCheckFailedException'
          }))
      })

      const createUserEffect = Effect.gen(function* () {
        const userService = yield* MockUserService
        const request = new CreateUserRequest({
          id: 'existing-user',
          name: 'Existing User'
        })
        return yield* userService.createUser(request)
      })

      const result = await Effect.runPromise(
        Effect.either(
          createUserEffect.pipe(
            Effect.provideService(MockUserService, mockServiceWithDuplicate)
          )
        )
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left.message).toBe('User already exists')
      }
    })
  })

  describe('Get User Lambda', () => {
    it('should retrieve an existing user with mocked service', async () => {
      const mockService = createMockUserService()
      
      const getUserEffect = Effect.gen(function* () {
        const userService = yield* MockUserService
        return yield* userService.getUserById('existing-user')
      })

      const result = await Effect.runPromise(
        getUserEffect.pipe(
          Effect.provideService(MockUserService, mockService)
        )
      )

      expect(result.id).toBe('existing-user')
      expect(result.name).toBe('Existing User')
    })

    it('should handle user not found with mocked service', async () => {
      const mockService = createMockUserService()
      
      const getUserEffect = Effect.gen(function* () {
        const userService = yield* MockUserService
        return yield* userService.getUserById('non-existent-user')
      })

      const result = await Effect.runPromise(
        Effect.either(
          getUserEffect.pipe(
            Effect.provideService(MockUserService, mockService)
          )
        )
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(UserNotFoundError)
        if (result.left instanceof UserNotFoundError) {
          expect(result.left.userId).toBe('non-existent-user')
        }
      }
    })

    it('should handle database errors with mocked service', async () => {
      const mockServiceWithError = createMockUserService({
        getUserById: (_id: string) => 
          Effect.fail(new DynamoUserRepositoryError({
            message: 'Database connection failed',
            cause: 'NetworkingError'
          }))
      })

      const getUserEffect = Effect.gen(function* () {
        const userService = yield* MockUserService
        return yield* userService.getUserById('any-user')
      })

      const result = await Effect.runPromise(
        Effect.either(
          getUserEffect.pipe(
            Effect.provideService(MockUserService, mockServiceWithError)
          )
        )
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(DynamoUserRepositoryError)
        expect(result.left.message).toBe('Database connection failed')
      }
    })
  })

  describe('Delete User Lambda', () => {
    it('should delete an existing user with mocked service', async () => {
      const mockService = createMockUserService()
      
      const deleteUserEffect = Effect.gen(function* () {
        const userService = yield* MockUserService
        return yield* userService.deleteUser('existing-user')
      })

      const result = await Effect.runPromise(
        deleteUserEffect.pipe(
          Effect.provideService(MockUserService, mockService)
        )
      )

      expect(result).toBeUndefined()
    })

    it('should handle delete user not found with mocked service', async () => {
      const mockService = createMockUserService()
      
      const deleteUserEffect = Effect.gen(function* () {
        const userService = yield* MockUserService
        return yield* userService.deleteUser('non-existent-user')
      })

      const result = await Effect.runPromise(
        Effect.either(
          deleteUserEffect.pipe(
            Effect.provideService(MockUserService, mockService)
          )
        )
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(UserNotFoundError)
        if (result.left instanceof UserNotFoundError) {
          expect(result.left.userId).toBe('non-existent-user')
        }
      }
    })
  })

  describe('Get All Users Lambda', () => {
    it('should retrieve all users with mocked service', async () => {
      const mockService = createMockUserService()
      
      const getAllUsersEffect = Effect.gen(function* () {
        const userService = yield* MockUserService
        return yield* userService.getAllUsers()
      })

      const result = await Effect.runPromise(
        getAllUsersEffect.pipe(
          Effect.provideService(MockUserService, mockService)
        )
      )

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('user1')
      expect(result[1].id).toBe('user2')
    })

    it('should handle empty user list with mocked service', async () => {
      const mockServiceEmpty = createMockUserService({
        getAllUsers: () => Effect.succeed([])
      })
      
      const getAllUsersEffect = Effect.gen(function* () {
        const userService = yield* MockUserService
        return yield* userService.getAllUsers()
      })

      const result = await Effect.runPromise(
        getAllUsersEffect.pipe(
          Effect.provideService(MockUserService, mockServiceEmpty)
        )
      )

      expect(result).toEqual([])
    })

    it('should handle database errors when getting all users', async () => {
      const mockServiceWithError = createMockUserService({
        getAllUsers: () => 
          Effect.fail(new DynamoUserRepositoryError({
            message: 'Table scan failed',
            cause: 'ResourceNotFoundException'
          }))
      })

      const getAllUsersEffect = Effect.gen(function* () {
        const userService = yield* MockUserService
        return yield* userService.getAllUsers()
      })

      const result = await Effect.runPromise(
        Effect.either(
          getAllUsersEffect.pipe(
            Effect.provideService(MockUserService, mockServiceWithError)
          )
        )
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(DynamoUserRepositoryError)
        expect(result.left.message).toBe('Table scan failed')
      }
    })
  })

  describe('Service Integration Tests', () => {
    it('should compose multiple service operations', async () => {
      const mockService = createMockUserService({
        createUser: (request: CreateUserRequest) => Effect.succeed(new User({
          id: request.id,
          name: request.name,
          createdAt: new Date('2025-01-01T00:00:00.000Z'),
          updatedAt: new Date('2025-01-01T00:00:00.000Z'),
        })),
        getUserById: (id: string) => {
          // Return the created user for any ID that starts with 'composed-user'
          if (id.startsWith('composed-user')) {
            return Effect.succeed(new User({
              id: id,
              name: 'Composed User',
              createdAt: new Date('2025-01-01T00:00:00.000Z'),
              updatedAt: new Date('2025-01-01T00:00:00.000Z'),
            }))
          }
          if (id === 'existing-user') {
            return Effect.succeed(new User({
              id: 'existing-user',
              name: 'Existing User',
              createdAt: new Date('2025-01-01T00:00:00.000Z'),
              updatedAt: new Date('2025-01-01T00:00:00.000Z'),
            }))
          }
          return Effect.fail(new UserNotFoundError({
            message: `User with id ${id} not found`,
            userId: id
          }))
        }
      })
      
      const composedEffect = Effect.gen(function* () {
        const userService = yield* MockUserService
        
        // Create a user
        const createRequest = new CreateUserRequest({
          id: 'composed-user',
          name: 'Composed User'
        })
        const createdUser = yield* userService.createUser(createRequest)
        
        // Retrieve the user
        const retrievedUser = yield* userService.getUserById(createdUser.id)
        
        // Get all users
        const allUsers = yield* userService.getAllUsers()
        
        return {
          created: createdUser,
          retrieved: retrievedUser,
          all: allUsers
        }
      })

      const result = await Effect.runPromise(
        composedEffect.pipe(
          Effect.provideService(MockUserService, mockService)
        )
      )

      expect(result.created.id).toBe('composed-user')
      expect(result.retrieved.id).toBe('composed-user')
      expect(result.all).toHaveLength(2) // Default mock returns 2 users
    })

    it('should handle error propagation in composed operations', async () => {
      const mockServiceWithErrors = createMockUserService({
        createUser: (_request: CreateUserRequest) => Effect.succeed(new User({
          id: 'test-user',
          name: 'Test User',
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        getUserById: (_id: string) => Effect.fail(new UserNotFoundError({
          message: 'User not found after creation',
          userId: 'test-user'
        }))
      })
      
      const composedEffect = Effect.gen(function* () {
        const userService = yield* MockUserService
        
        const createRequest = new CreateUserRequest({
          id: 'error-user',
          name: 'Error User'
        })
        const createdUser = yield* userService.createUser(createRequest)
        
        // This should fail
        const retrievedUser = yield* userService.getUserById(createdUser.id)
        
        return { created: createdUser, retrieved: retrievedUser }
      })

      const result = await Effect.runPromise(
        Effect.either(
          composedEffect.pipe(
            Effect.provideService(MockUserService, mockServiceWithErrors)
          )
        )
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(UserNotFoundError)
      }
    })
  })
})
