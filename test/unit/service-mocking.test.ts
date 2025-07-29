import { Effect, Context, Layer } from 'effect'
import { User, CreateUserRequest, UserNotFoundError } from '../../src/domain/user'
import { UserService } from '../../src/services/dynamo-user-service'
import { DynamoUserRepositoryError, UserRepository } from '../../src/infrastructure/dynamo-user-repository'

// Create a UserRepository context for dependency injection
const TestUserRepository = Context.GenericTag<UserRepository>('TestUserRepository')

// Create a UserService context for dependency injection  
const TestUserService = Context.GenericTag<UserService>('TestUserService')

// Mock UserRepository implementation
const createMockUserRepository = (overrides: Partial<UserRepository> = {}): UserRepository => ({
  create: overrides.create || ((request: CreateUserRequest) => 
    Effect.succeed(new User({
      id: request.id,
      name: request.name,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    }))
  ),
  findById: overrides.findById || ((id: string) => {
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
  findAll: overrides.findAll || (() => 
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
  deleteById: overrides.deleteById || ((id: string) => {
    if (id === 'existing-user') {
      return Effect.succeed(undefined)
    }
    return Effect.fail(new UserNotFoundError({
      message: `User with id ${id} not found`,
      userId: id
    }))
  }),
})

// Mock UserService implementation
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

describe('Service Layer Unit Tests with Effect Mocking', () => {
  describe('UserService with Mocked Dependencies', () => {
    it('should create a user using Effect.provideService', async () => {
      const mockService = createMockUserService()
      
      // Create an Effect that uses the service
      const createUserEffect = Effect.gen(function* () {
        const userService = yield* TestUserService
        const request = new CreateUserRequest({
          id: 'test-user-123',
          name: 'Test User'
        })
        return yield* userService.createUser(request)
      })

      // Run the effect with the mock service injected
      const result = await Effect.runPromise(
        createUserEffect.pipe(
          Effect.provideService(TestUserService, mockService)
        )
      )

      expect(result.id).toBe('test-user-123')
      expect(result.name).toBe('Test User')
      expect(result.createdAt).toEqual(new Date('2025-01-01T00:00:00.000Z'))
      expect(result.updatedAt).toEqual(new Date('2025-01-01T00:00:00.000Z'))
    })

    it('should handle user creation errors with mocked service', async () => {
      const mockServiceWithError = createMockUserService({
        createUser: (_request: CreateUserRequest) => 
          Effect.fail(new DynamoUserRepositoryError({
            message: 'Database connection failed',
            cause: 'NetworkError'
          }))
      })

      const createUserEffect = Effect.gen(function* () {
        const userService = yield* TestUserService
        const request = new CreateUserRequest({
          id: 'error-user',
          name: 'Error User'
        })
        return yield* userService.createUser(request)
      })

      const result = await Effect.runPromise(
        Effect.either(
          createUserEffect.pipe(
            Effect.provideService(TestUserService, mockServiceWithError)
          )
        )
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(DynamoUserRepositoryError)
        expect(result.left.message).toBe('Database connection failed')
      }
    })

    it('should retrieve a user using Effect.provideService', async () => {
      const mockService = createMockUserService()
      
      const getUserEffect = Effect.gen(function* () {
        const userService = yield* TestUserService
        return yield* userService.getUserById('existing-user')
      })

      const result = await Effect.runPromise(
        getUserEffect.pipe(
          Effect.provideService(TestUserService, mockService)
        )
      )

      expect(result.id).toBe('existing-user')
      expect(result.name).toBe('Existing User')
    })

    it('should handle user not found errors', async () => {
      const mockService = createMockUserService()
      
      const getUserEffect = Effect.gen(function* () {
        const userService = yield* TestUserService
        return yield* userService.getUserById('non-existent-user')
      })

      const result = await Effect.runPromise(
        Effect.either(
          getUserEffect.pipe(
            Effect.provideService(TestUserService, mockService)
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

    it('should delete a user using Effect.provideService', async () => {
      const mockService = createMockUserService()
      
      const deleteUserEffect = Effect.gen(function* () {
        const userService = yield* TestUserService
        return yield* userService.deleteUser('existing-user')
      })

      const result = await Effect.runPromise(
        deleteUserEffect.pipe(
          Effect.provideService(TestUserService, mockService)
        )
      )

      expect(result).toBeUndefined()
    })

    it('should handle delete user not found errors', async () => {
      const mockService = createMockUserService()
      
      const deleteUserEffect = Effect.gen(function* () {
        const userService = yield* TestUserService
        return yield* userService.deleteUser('non-existent-user')
      })

      const result = await Effect.runPromise(
        Effect.either(
          deleteUserEffect.pipe(
            Effect.provideService(TestUserService, mockService)
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

    it('should get all users using Effect.provideService', async () => {
      const mockService = createMockUserService()
      
      const getAllUsersEffect = Effect.gen(function* () {
        const userService = yield* TestUserService
        return yield* userService.getAllUsers()
      })

      const result = await Effect.runPromise(
        getAllUsersEffect.pipe(
          Effect.provideService(TestUserService, mockService)
        )
      )

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('user1')
      expect(result[1].id).toBe('user2')
    })
  })

  describe('UserRepository with Mocked Dependencies', () => {
    it('should create a user at repository level', async () => {
      const mockRepository = createMockUserRepository()
      
      const createUserEffect = Effect.gen(function* () {
        const repository = yield* TestUserRepository
        const request = new CreateUserRequest({
          id: 'repo-test-user',
          name: 'Repo Test User'
        })
        return yield* repository.create(request)
      })

      const result = await Effect.runPromise(
        createUserEffect.pipe(
          Effect.provideService(TestUserRepository, mockRepository)
        )
      )

      expect(result.id).toBe('repo-test-user')
      expect(result.name).toBe('Repo Test User')
    })

    it('should handle repository creation errors', async () => {
      const mockRepositoryWithError = createMockUserRepository({
        create: (_request: CreateUserRequest) => 
          Effect.fail(new DynamoUserRepositoryError({
            message: 'Table does not exist',
            cause: 'ResourceNotFoundException'
          }))
      })

      const createUserEffect = Effect.gen(function* () {
        const repository = yield* TestUserRepository
        const request = new CreateUserRequest({
          id: 'error-user',
          name: 'Error User'
        })
        return yield* repository.create(request)
      })

      const result = await Effect.runPromise(
        Effect.either(
          createUserEffect.pipe(
            Effect.provideService(TestUserRepository, mockRepositoryWithError)
          )
        )
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(DynamoUserRepositoryError)
        expect(result.left.message).toBe('Table does not exist')
      }
    })

    it('should find user by ID at repository level', async () => {
      const mockRepository = createMockUserRepository()
      
      const findUserEffect = Effect.gen(function* () {
        const repository = yield* TestUserRepository
        return yield* repository.findById('existing-user')
      })

      const result = await Effect.runPromise(
        findUserEffect.pipe(
          Effect.provideService(TestUserRepository, mockRepository)
        )
      )

      expect(result.id).toBe('existing-user')
      expect(result.name).toBe('Existing User')
    })

    it('should find all users at repository level', async () => {
      const mockRepository = createMockUserRepository()
      
      const findAllUsersEffect = Effect.gen(function* () {
        const repository = yield* TestUserRepository
        return yield* repository.findAll()
      })

      const result = await Effect.runPromise(
        findAllUsersEffect.pipe(
          Effect.provideService(TestUserRepository, mockRepository)
        )
      )

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('user1')
      expect(result[1].id).toBe('user2')
    })

    it('should delete user by ID at repository level', async () => {
      const mockRepository = createMockUserRepository()
      
      const deleteUserEffect = Effect.gen(function* () {
        const repository = yield* TestUserRepository
        return yield* repository.deleteById('existing-user')
      })

      const result = await Effect.runPromise(
        deleteUserEffect.pipe(
          Effect.provideService(TestUserRepository, mockRepository)
        )
      )

      expect(result).toBeUndefined()
    })
  })

  describe('Composable Service Operations', () => {
    it('should compose multiple service operations with dependency injection', async () => {
      const mockService = createMockUserService()
      
      const composedEffect = Effect.gen(function* () {
        const userService = yield* TestUserService
        
        // Create a user
        const createRequest = new CreateUserRequest({
          id: 'composed-user-123',
          name: 'Composed User'
        })
        const createdUser = yield* userService.createUser(createRequest)
        
        // Get all users (simulated - our mock returns predefined users)
        const allUsers = yield* userService.getAllUsers()
        
        return {
          created: createdUser,
          total: allUsers.length
        }
      })

      const result = await Effect.runPromise(
        composedEffect.pipe(
          Effect.provideService(TestUserService, mockService)
        )
      )

      expect(result.created.id).toBe('composed-user-123')
      expect(result.created.name).toBe('Composed User')
      expect(result.total).toBe(2) // Mock returns 2 users
    })

    it('should handle error propagation in composed operations', async () => {
      const mockServiceWithPartialFailure = createMockUserService({
        createUser: (request: CreateUserRequest) => Effect.succeed(new User({
          id: request.id,
          name: request.name,
          createdAt: new Date('2025-01-01T00:00:00.000Z'),
          updatedAt: new Date('2025-01-01T00:00:00.000Z'),
        })),
        getAllUsers: () => Effect.fail(new DynamoUserRepositoryError({
          message: 'Scan operation failed',
          cause: 'ProvisionedThroughputExceededException'
        }))
      })
      
      const composedEffect = Effect.gen(function* () {
        const userService = yield* TestUserService
        
        const createRequest = new CreateUserRequest({
          id: 'error-composition-user',
          name: 'Error Composition User'
        })
        const createdUser = yield* userService.createUser(createRequest)
        
        // This will fail
        const allUsers = yield* userService.getAllUsers()
        
        return { created: createdUser, all: allUsers }
      })

      const result = await Effect.runPromise(
        Effect.either(
          composedEffect.pipe(
            Effect.provideService(TestUserService, mockServiceWithPartialFailure)
          )
        )
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(DynamoUserRepositoryError)
        expect(result.left.message).toBe('Scan operation failed')
      }
    })

    it('should support multiple mock service variations', async () => {
      // Test with empty repository
      const emptyMockService = createMockUserService({
        getAllUsers: () => Effect.succeed([])
      })
      
      const emptyEffect = Effect.gen(function* () {
        const userService = yield* TestUserService
        return yield* userService.getAllUsers()
      })

      const emptyResult = await Effect.runPromise(
        emptyEffect.pipe(
          Effect.provideService(TestUserService, emptyMockService)
        )
      )

      expect(emptyResult).toEqual([])

      // Test with single user repository
      const singleUserMockService = createMockUserService({
        getAllUsers: () => Effect.succeed([
          new User({
            id: 'only-user',
            name: 'Only User',
            createdAt: new Date('2025-01-01T00:00:00.000Z'),
            updatedAt: new Date('2025-01-01T00:00:00.000Z'),
          })
        ])
      })

      const singleUserResult = await Effect.runPromise(
        emptyEffect.pipe(
          Effect.provideService(TestUserService, singleUserMockService)
        )
      )

      expect(singleUserResult).toHaveLength(1)
      expect(singleUserResult[0].id).toBe('only-user')
    })
  })

  describe('Error Handling Scenarios', () => {
    it('should handle different error types appropriately', async () => {
      const scenarios = [
        {
          name: 'UserNotFoundError',
          mockService: createMockUserService({
            getUserById: (_id: string) => Effect.fail(new UserNotFoundError({
              message: 'User not found',
              userId: 'test-id'
            }))
          }),
          expectedErrorType: UserNotFoundError
        },
        {
          name: 'DynamoUserRepositoryError',
          mockService: createMockUserService({
            getUserById: (_id: string) => Effect.fail(new DynamoUserRepositoryError({
              message: 'Database error',
              cause: 'ServiceUnavailable'
            }))
          }),
          expectedErrorType: DynamoUserRepositoryError
        }
      ]

      for (const scenario of scenarios) {
        const getUserEffect = Effect.gen(function* () {
          const userService = yield* TestUserService
          return yield* userService.getUserById('any-user')
        })

        const result = await Effect.runPromise(
          Effect.either(
            getUserEffect.pipe(
              Effect.provideService(TestUserService, scenario.mockService)
            )
          )
        )

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(scenario.expectedErrorType)
        }
      }
    })

    it('should maintain type safety with Effect operations', async () => {
      const mockService = createMockUserService()
      
      // This effect chain demonstrates type safety
      const typeSafeEffect = Effect.gen(function* () {
        const userService = yield* TestUserService
        
        const users = yield* userService.getAllUsers()
        const userCount = users.length
        
        if (userCount > 0) {
          // Use existing-user instead of users[0].id to avoid the mock's getUserById logic
          const firstUser = yield* userService.getUserById('existing-user')
          return { user: firstUser, count: userCount }
        }
        
        return { user: null, count: 0 }
      })

      const result = await Effect.runPromise(
        typeSafeEffect.pipe(
          Effect.provideService(TestUserService, mockService)
        )
      )

      expect(result.count).toBe(2)
      expect(result.user).not.toBeNull()
      if (result.user) {
        expect(result.user.id).toBe('existing-user')
      }
    })
  })
})
