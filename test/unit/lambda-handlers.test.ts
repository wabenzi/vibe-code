import { Effect, Context, Exit } from 'effect'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { User, CreateUserRequest, UserNotFoundError, UserResponse } from '../../src/domain/user'
import { UserService } from '../../src/services/dynamo-user-service'
import { DynamoUserRepositoryError } from '../../src/infrastructure/dynamo-user-repository'

// Define the UserService context for dependency injection
const TestUserService = Context.GenericTag<UserService>('TestUserService')

// Testable lambda handler that accepts dependency injection
const createTestableCreateUserHandler = (userService: UserService) => 
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.log('Create User Lambda invoked', { event })

    try {
      // Parse request body
      if (!event.body) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'Request body is required',
          }),
        }
      }

      let requestData
      try {
        requestData = JSON.parse(event.body)
      } catch (parseError) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'Invalid JSON in request body',
          }),
        }
      }
      
      // Validate required fields
      if (!requestData.id || !requestData.name) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'Missing required fields: id and name are required',
            details: {
              id: !requestData.id ? 'id is required' : null,
              name: !requestData.name ? 'name is required' : null,
            },
          }),
        }
      }

      // Validate data types
      if (typeof requestData.id !== 'string' || typeof requestData.name !== 'string') {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'Invalid data types',
            details: {
              id: typeof requestData.id !== 'string' ? 'id must be a string' : null,
              name: typeof requestData.name !== 'string' ? 'name must be a string' : null,
            },
          }),
        }
      }
      
      // Create request object
      const createUserRequest = new CreateUserRequest({
        id: requestData.id,
        name: requestData.name,
      })

      // Execute the Effect program with injected service
      const exit = await Effect.runPromiseExit(userService.createUser(createUserRequest))

      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === 'Fail' ? exit.cause.error : exit.cause
        console.error('Effect error creating user:', error)
        
        // Handle typed Effect errors
        if (error && typeof error === 'object' && '_tag' in error) {
          switch (error._tag) {
            case 'DynamoUserRepositoryError':
              return {
                statusCode: 500,
                headers: {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                  error: 'Database error',
                  message: (error as any).message,
                }),
              }
          }
        }
        
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'Internal server error',
            message: typeof error === 'string' ? error : 'Unknown error',
          }),
        }
      }

      const result = Effect.isSuccess(exit) ? (exit as Exit.Success<User, DynamoUserRepositoryError | UserNotFoundError>).value : null
      if (!result) {
        throw new Error('Unexpected error: no result value')
      }

      // Convert to response format
      const userResponse = new UserResponse({
        id: result.id,
        name: result.name,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
      })

      return {
        statusCode: 201,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(userResponse),
      }
    } catch (error) {
      console.error('Error creating user:', error)

      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      }
    }
  }

// Testable get user handler
const createTestableGetUserHandler = (userService: UserService) => 
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.log('Get User Lambda invoked', { event })

    try {
      const userId = event.pathParameters?.id
      if (!userId) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'User ID is required',
          }),
        }
      }

      // Validate user ID format
      if (!userId.trim() || userId.includes('/') || userId.includes('?') || userId.includes('#') || userId.includes('%') || userId.length > 100) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'Invalid user ID format',
          }),
        }
      }

      // Execute the Effect program with injected service
      const exit = await Effect.runPromiseExit(userService.getUserById(userId))

      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === 'Fail' ? exit.cause.error : exit.cause
        console.error('Effect error getting user:', error)
        
        // Handle typed Effect errors
        if (error && typeof error === 'object' && '_tag' in error) {
          switch (error._tag) {
            case 'UserNotFoundError':
              return {
                statusCode: 404,
                headers: {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                  error: 'User not found',
                  message: (error as any).message,
                  userId: (error as any).userId,
                }),
              }
            case 'DynamoUserRepositoryError':
              return {
                statusCode: 500,
                headers: {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                  error: 'Database error',
                  message: (error as any).message,
                }),
              }
          }
        }
        
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'Internal server error',
            message: typeof error === 'string' ? error : 'Unknown error',
          }),
        }
      }

      const result = (exit as Exit.Success<User, UserNotFoundError | DynamoUserRepositoryError>).value

      // Convert to response format
      const userResponse = new UserResponse({
        id: result.id,
        name: result.name,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
      })

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(userResponse),
      }
    } catch (error) {
      console.error('Error getting user:', error)

      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      }
    }
  }

// Testable delete user handler
const createTestableDeleteUserHandler = (userService: UserService) => 
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.log('Delete User Lambda invoked', { event })

    try {
      const userId = event.pathParameters?.id
      if (!userId) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'User ID is required',
          }),
        }
      }

      // Validate user ID format
      if (!userId.trim() || userId.includes('/') || userId.includes('?') || userId.includes('#') || userId.includes('%') || userId.length > 100) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'Invalid user ID format',
          }),
        }
      }

      // Execute the Effect program with injected service
      const exit = await Effect.runPromiseExit(userService.deleteUser(userId))

      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === 'Fail' ? exit.cause.error : exit.cause
        console.error('Effect error deleting user:', error)
        
        // Handle typed Effect errors
        if (error && typeof error === 'object' && '_tag' in error) {
          switch (error._tag) {
            case 'UserNotFoundError':
              return {
                statusCode: 404,
                headers: {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                  error: 'User not found',
                  message: (error as any).message,
                  userId: (error as any).userId,
                }),
              }
            case 'DynamoUserRepositoryError':
              return {
                statusCode: 500,
                headers: {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                  error: 'Database error',
                  message: (error as any).message,
                }),
              }
          }
        }
        
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'Internal server error',
            message: typeof error === 'string' ? error : 'Unknown error',
          }),
        }
      }

      return {
        statusCode: 204,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: '',
      }
    } catch (error) {
      console.error('Error deleting user:', error)

      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      }
    }
  }

// Mock UserService implementations
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

describe('Lambda Handlers with Mocked Services', () => {
  describe('Create User Handler', () => {
    it('should create a user successfully', async () => {
      const mockService = createMockUserService()
      const handler = createTestableCreateUserHandler(mockService)

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          id: 'test-user-123',
          name: 'Test User'
        })
      })

      const result = await handler(event)

      expect(result.statusCode).toBe(201)
      expect(result.headers?.['Content-Type']).toBe('application/json')
      
      const responseBody = JSON.parse(result.body)
      expect(responseBody.id).toBe('test-user-123')
      expect(responseBody.name).toBe('Test User')
      expect(responseBody.createdAt).toBe('2025-01-01T00:00:00.000Z')
    })

    it('should return 400 for missing request body', async () => {
      const mockService = createMockUserService()
      const handler = createTestableCreateUserHandler(mockService)

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: null
      })

      const result = await handler(event)

      expect(result.statusCode).toBe(400)
      const responseBody = JSON.parse(result.body)
      expect(responseBody.error).toBe('Request body is required')
    })

    it('should return 400 for invalid JSON', async () => {
      const mockService = createMockUserService()
      const handler = createTestableCreateUserHandler(mockService)

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: '{ invalid json }'
      })

      const result = await handler(event)

      expect(result.statusCode).toBe(400)
      const responseBody = JSON.parse(result.body)
      expect(responseBody.error).toBe('Invalid JSON in request body')
    })

    it('should return 400 for missing required fields', async () => {
      const mockService = createMockUserService()
      const handler = createTestableCreateUserHandler(mockService)

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          name: 'Test User'
          // missing id
        })
      })

      const result = await handler(event)

      expect(result.statusCode).toBe(400)
      const responseBody = JSON.parse(result.body)
      expect(responseBody.error).toBe('Missing required fields: id and name are required')
      expect(responseBody.details.id).toBe('id is required')
    })

    it('should return 400 for invalid data types', async () => {
      const mockService = createMockUserService()
      const handler = createTestableCreateUserHandler(mockService)

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          id: 123, // should be string
          name: 'Test User'
        })
      })

      const result = await handler(event)

      expect(result.statusCode).toBe(400)
      const responseBody = JSON.parse(result.body)
      expect(responseBody.error).toBe('Invalid data types')
      expect(responseBody.details.id).toBe('id must be a string')
    })

    it('should handle database errors', async () => {
      const mockServiceWithError = createMockUserService({
        createUser: (_request: CreateUserRequest) => 
          Effect.fail(new DynamoUserRepositoryError({
            message: 'Database connection failed',
            cause: 'NetworkError'
          }))
      })
      const handler = createTestableCreateUserHandler(mockServiceWithError)

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          id: 'test-user-123',
          name: 'Test User'
        })
      })

      const result = await handler(event)

      expect(result.statusCode).toBe(500)
      const responseBody = JSON.parse(result.body)
      expect(responseBody.error).toBe('Database error')
      expect(responseBody.message).toBe('Database connection failed')
    })
  })

  describe('Get User Handler', () => {
    it('should retrieve an existing user', async () => {
      const mockService = createMockUserService()
      const handler = createTestableGetUserHandler(mockService)

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        pathParameters: { id: 'existing-user' }
      })

      const result = await handler(event)

      expect(result.statusCode).toBe(200)
      const responseBody = JSON.parse(result.body)
      expect(responseBody.id).toBe('existing-user')
      expect(responseBody.name).toBe('Existing User')
    })

    it('should return 400 for missing user ID', async () => {
      const mockService = createMockUserService()
      const handler = createTestableGetUserHandler(mockService)

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        pathParameters: null
      })

      const result = await handler(event)

      expect(result.statusCode).toBe(400)
      const responseBody = JSON.parse(result.body)
      expect(responseBody.error).toBe('User ID is required')
    })

    it('should return 400 for invalid user ID format', async () => {
      const mockService = createMockUserService()
      const handler = createTestableGetUserHandler(mockService)

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        pathParameters: { id: 'user/with/slashes' }
      })

      const result = await handler(event)

      expect(result.statusCode).toBe(400)
      const responseBody = JSON.parse(result.body)
      expect(responseBody.error).toBe('Invalid user ID format')
    })

    it('should return 404 for non-existent user', async () => {
      const mockService = createMockUserService()
      const handler = createTestableGetUserHandler(mockService)

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        pathParameters: { id: 'non-existent-user' }
      })

      const result = await handler(event)

      expect(result.statusCode).toBe(404)
      const responseBody = JSON.parse(result.body)
      expect(responseBody.error).toBe('User not found')
      expect(responseBody.userId).toBe('non-existent-user')
    })
  })

  describe('Delete User Handler', () => {
    it('should delete an existing user', async () => {
      const mockService = createMockUserService()
      const handler = createTestableDeleteUserHandler(mockService)

      const event = createAPIGatewayEvent({
        httpMethod: 'DELETE',
        pathParameters: { id: 'existing-user' }
      })

      const result = await handler(event)

      expect(result.statusCode).toBe(204)
      expect(result.body).toBe('')
    })

    it('should return 400 for missing user ID', async () => {
      const mockService = createMockUserService()
      const handler = createTestableDeleteUserHandler(mockService)

      const event = createAPIGatewayEvent({
        httpMethod: 'DELETE',
        pathParameters: null
      })

      const result = await handler(event)

      expect(result.statusCode).toBe(400)
      const responseBody = JSON.parse(result.body)
      expect(responseBody.error).toBe('User ID is required')
    })

    it('should return 404 for non-existent user', async () => {
      const mockService = createMockUserService()
      const handler = createTestableDeleteUserHandler(mockService)

      const event = createAPIGatewayEvent({
        httpMethod: 'DELETE',
        pathParameters: { id: 'non-existent-user' }
      })

      const result = await handler(event)

      expect(result.statusCode).toBe(404)
      const responseBody = JSON.parse(result.body)
      expect(responseBody.error).toBe('User not found')
      expect(responseBody.userId).toBe('non-existent-user')
    })
  })
})
