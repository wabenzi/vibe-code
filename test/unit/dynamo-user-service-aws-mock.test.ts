import { mockClient } from 'aws-sdk-client-mock'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { Effect } from 'effect'
import { DynamoUserService } from '../../src/services/dynamo-user-service'
import { CreateUserRequest, User, UserNotFoundError } from '../../src/domain/user'

// Create AWS SDK mocks
const dynamoDBMock = mockClient(DynamoDBClient)
const docClientMock = mockClient(DynamoDBDocumentClient)

describe('DynamoUserService with AWS SDK Mocks', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    dynamoDBMock.reset()
    docClientMock.reset()
    
    // Set test environment
    process.env.DYNAMODB_TABLE_NAME = 'users-table'
    process.env.AWS_REGION = 'us-west-2'
  })

  afterEach(() => {
    // Clean up environment
    delete process.env.DYNAMODB_TABLE_NAME
    delete process.env.AWS_REGION
  })

  describe('createUser', () => {
    it('should successfully create a user through the service', async () => {
      // Arrange
      const createRequest = new CreateUserRequest({ 
        id: 'service-test-123', 
        name: 'Service Test User' 
      })
      
      // Mock successful DynamoDB put operation
      docClientMock.on(PutCommand).resolves({})

      // Act
      const effect = DynamoUserService.createUser(createRequest)
      const result = await Effect.runPromise(effect)

      // Assert
      expect(result).toBeInstanceOf(User)
      expect(result.id).toBe('service-test-123')
      expect(result.name).toBe('Service Test User')
      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.updatedAt).toBeInstanceOf(Date)

      // Verify the service called the repository which called AWS SDK
      expect(docClientMock.calls()).toHaveLength(1)
      const putCall = docClientMock.call(0)
      expect(putCall.args[0].input).toMatchObject({
        TableName: 'users-table',
        Item: {
          id: 'service-test-123',
          name: 'Service Test User',
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        ConditionExpression: 'attribute_not_exists(id)',
      })
    })

    it('should handle repository errors gracefully', async () => {
      // Arrange
      const createRequest = new CreateUserRequest({ 
        id: 'failing-user', 
        name: 'Failing User' 
      })
      
      // Mock DynamoDB to fail
      docClientMock.on(PutCommand).rejects(new Error('AWS service unavailable'))

      // Act & Assert
      const effect = DynamoUserService.createUser(createRequest)
      
      await expect(Effect.runPromise(effect)).rejects.toThrow()    })
  })

  describe('getUserById', () => {
    it('should successfully retrieve a user through the service', async () => {
      // Arrange
      const userId = 'service-user-456'
      const mockUserData = {
        Item: {
          id: userId,
          name: 'Service Retrieved User',
          createdAt: '2025-01-01T12:00:00.000Z',
          updatedAt: '2025-01-01T12:00:00.000Z',
        }
      }
      
      docClientMock.on(GetCommand).resolves(mockUserData)

      // Act
      const effect = DynamoUserService.getUserById(userId)
      const result = await Effect.runPromise(effect)

      // Assert
      expect(result).toBeInstanceOf(User)
      expect(result.id).toBe(userId)
      expect(result.name).toBe('Service Retrieved User')
      expect(result.createdAt).toEqual(new Date('2025-01-01T12:00:00.000Z'))
      expect(result.updatedAt).toEqual(new Date('2025-01-01T12:00:00.000Z'))

      // Verify the service called the repository which called AWS SDK
      expect(docClientMock.calls()).toHaveLength(1)
      const getCall = docClientMock.call(0)
      expect(getCall.args[0].input).toMatchObject({
        TableName: 'users-table',
        Key: { id: userId },
      })
    })

    it('should propagate UserNotFoundError from repository', async () => {
      // Arrange
      const userId = 'non-existent-service-user'
      
      // Mock empty response (user not found)
      docClientMock.on(GetCommand).resolves({})

      // Act & Assert
      const effect = DynamoUserService.getUserById(userId)
      
      await expect(Effect.runPromise(effect)).rejects.toThrow()    })
  })

  describe('getAllUsers', () => {
    it('should successfully retrieve all users through the service', async () => {
      // Arrange
      const mockUsersData = {
        Items: [
          {
            id: 'service-user-1',
            name: 'Service User One',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 'service-user-2',
            name: 'Service User Two',
            createdAt: '2025-01-02T00:00:00.000Z',
            updatedAt: '2025-01-02T00:00:00.000Z',
          }
        ]
      }
      
      docClientMock.on(ScanCommand).resolves(mockUsersData)

      // Act
      const effect = DynamoUserService.getAllUsers()
      const result = await Effect.runPromise(effect)

      // Assert
      expect(result).toHaveLength(2)
      expect(result[0]).toBeInstanceOf(User)
      expect(result[0].id).toBe('service-user-1')
      expect(result[0].name).toBe('Service User One')
      expect(result[1]).toBeInstanceOf(User)
      expect(result[1].id).toBe('service-user-2')
      expect(result[1].name).toBe('Service User Two')

      // Verify the service called the repository which called AWS SDK
      expect(docClientMock.calls()).toHaveLength(1)
      const scanCall = docClientMock.call(0)
      expect(scanCall.args[0].input).toMatchObject({
        TableName: 'users-table',
      })
    })

    it('should handle empty user list gracefully', async () => {
      // Arrange
      docClientMock.on(ScanCommand).resolves({ Items: [] })

      // Act
      const effect = DynamoUserService.getAllUsers()
      const result = await Effect.runPromise(effect)

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('deleteUser', () => {
    it('should successfully delete a user through the service', async () => {
      // Arrange
      const userId = 'service-user-to-delete'
      
      // Mock successful findById followed by successful delete
      docClientMock.on(GetCommand).resolves({
        Item: {
          id: userId,
          name: 'Service User To Delete',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        }
      })
      docClientMock.on(DeleteCommand).resolves({})

      // Act
      const effect = DynamoUserService.deleteUser(userId)
      const result = await Effect.runPromise(effect)

      // Assert
      expect(result).toBeUndefined() // void return

      // Verify the service called the repository which called AWS SDK
      expect(docClientMock.calls()).toHaveLength(2) // findById + delete
      
      const getCall = docClientMock.call(0)
      expect(getCall.args[0].input).toMatchObject({
        TableName: 'users-table',
        Key: { id: userId },
      })
      
      const deleteCall = docClientMock.call(1)
      expect(deleteCall.args[0].input).toMatchObject({
        TableName: 'users-table',
        Key: { id: userId },
      })
    })

    it('should propagate UserNotFoundError when deleting non-existent user', async () => {
      // Arrange
      const userId = 'non-existent-service-user'
      
      // Mock findById returning empty (user not found)
      docClientMock.on(GetCommand).resolves({})

      // Act & Assert
      const effect = DynamoUserService.deleteUser(userId)
      
      await expect(Effect.runPromise(effect)).rejects.toThrow()
      // Verify only findById was called, not delete
      expect(docClientMock.calls()).toHaveLength(1)
    })
  })

  describe('service layer integration', () => {
    it('should handle complex user workflow with real service logic', async () => {
      // Arrange
      const createRequest = new CreateUserRequest({ 
        id: 'workflow-user', 
        name: 'Workflow Test User' 
      })

      // Mock successful create, then successful retrieve
      docClientMock.on(PutCommand).resolves({})
      docClientMock.on(GetCommand).resolves({
        Item: {
          id: 'workflow-user',
          name: 'Workflow Test User',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        }
      })

      // Act - Create user then retrieve it
      const createEffect = DynamoUserService.createUser(createRequest)
      const createdUser = await Effect.runPromise(createEffect)

      const retrieveEffect = DynamoUserService.getUserById('workflow-user')
      const retrievedUser = await Effect.runPromise(retrieveEffect)

      // Assert
      expect(createdUser).toBeInstanceOf(User)
      expect(createdUser.id).toBe('workflow-user')
      expect(retrievedUser).toBeInstanceOf(User)
      expect(retrievedUser.id).toBe('workflow-user')
      expect(retrievedUser.name).toBe('Workflow Test User')

      // Verify both operations called AWS SDK
      expect(docClientMock.calls()).toHaveLength(2) // PUT + GET
    })
  })
})
