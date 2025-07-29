import { mockClient } from 'aws-sdk-client-mock'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { Effect } from 'effect'
import { DynamoUserRepository, DynamoUserRepositoryError } from '../../src/infrastructure/dynamo-user-repository'
import { CreateUserRequest, User, UserNotFoundError } from '../../src/domain/user'

// Create AWS SDK mocks
const dynamoDBMock = mockClient(DynamoDBClient)
const docClientMock = mockClient(DynamoDBDocumentClient)

describe('DynamoUserRepository with AWS SDK Mocks', () => {
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

  describe('create', () => {
    it('should successfully create a user', async () => {
      // Arrange
      const request = new CreateUserRequest({ 
        id: 'test-user-123', 
        name: 'Test User' 
      })
      
      // Mock the DynamoDB PutCommand to succeed
      docClientMock.on(PutCommand).resolves({})

      // Act
      const effect = DynamoUserRepository.create(request)
      const result = await Effect.runPromise(effect)

      // Assert
      expect(result).toBeInstanceOf(User)
      expect(result.id).toBe('test-user-123')
      expect(result.name).toBe('Test User')
      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.updatedAt).toBeInstanceOf(Date)

      // Verify the AWS SDK was called correctly
      expect(docClientMock.calls()).toHaveLength(1)
      const putCall = docClientMock.call(0)
      expect(putCall.args[0].input).toMatchObject({
        TableName: 'users-table',
        Item: {
          id: 'test-user-123',
          name: 'Test User',
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        ConditionExpression: 'attribute_not_exists(id)',
      })
    })

    it('should handle DynamoDB errors during user creation', async () => {
      // Arrange
      const request = new CreateUserRequest({ 
        id: 'test-user-123', 
        name: 'Test User' 
      })
      
      // Mock the DynamoDB PutCommand to fail
      docClientMock.on(PutCommand).rejects(new Error('DynamoDB connection failed'))

      // Act & Assert
      const effect = DynamoUserRepository.create(request)
      
      await expect(Effect.runPromise(effect)).rejects.toThrow()    })

    it('should handle conditional check failures (duplicate user)', async () => {
      // Arrange
      const request = new CreateUserRequest({ 
        id: 'existing-user', 
        name: 'Duplicate User' 
      })
      
      // Mock conditional check failure
      const conditionalCheckError = new Error('ConditionalCheckFailedException')
      conditionalCheckError.name = 'ConditionalCheckFailedException'
      docClientMock.on(PutCommand).rejects(conditionalCheckError)

      // Act & Assert
      const effect = DynamoUserRepository.create(request)
      
      await expect(Effect.runPromise(effect)).rejects.toThrow()    })
  })

  describe('findById', () => {
    it('should successfully find an existing user', async () => {
      // Arrange
      const userId = 'existing-user-123'
      const mockUserData = {
        Item: {
          id: userId,
          name: 'Existing User',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        }
      }
      
      docClientMock.on(GetCommand).resolves(mockUserData)

      // Act
      const effect = DynamoUserRepository.findById(userId)
      const result = await Effect.runPromise(effect)

      // Assert
      expect(result).toBeInstanceOf(User)
      expect(result.id).toBe(userId)
      expect(result.name).toBe('Existing User')
      expect(result.createdAt).toEqual(new Date('2025-01-01T00:00:00.000Z'))
      expect(result.updatedAt).toEqual(new Date('2025-01-01T00:00:00.000Z'))

      // Verify the AWS SDK was called correctly
      expect(docClientMock.calls()).toHaveLength(1)
      const getCall = docClientMock.call(0)
      expect(getCall.args[0].input).toMatchObject({
        TableName: 'users-table',
        Key: { id: userId },
      })
    })

    it('should return UserNotFoundError when user does not exist', async () => {
      // Arrange
      const userId = 'non-existent-user'
      
      // Mock empty response (user not found)
      docClientMock.on(GetCommand).resolves({})

      // Act & Assert
      const effect = DynamoUserRepository.findById(userId)
      
      await expect(Effect.runPromise(effect)).rejects.toThrow()    })

    it('should handle DynamoDB errors during findById', async () => {
      // Arrange
      const userId = 'test-user'
      
      docClientMock.on(GetCommand).rejects(new Error('DynamoDB connection failed'))

      // Act & Assert
      const effect = DynamoUserRepository.findById(userId)
      
      await expect(Effect.runPromise(effect)).rejects.toThrow()    })
  })

  describe('findAll', () => {
    it('should successfully return all users', async () => {
      // Arrange
      const mockUsersData = {
        Items: [
          {
            id: 'user1',
            name: 'User One',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 'user2',
            name: 'User Two',
            createdAt: '2025-01-02T00:00:00.000Z',
            updatedAt: '2025-01-02T00:00:00.000Z',
          }
        ]
      }
      
      docClientMock.on(ScanCommand).resolves(mockUsersData)

      // Act
      const effect = DynamoUserRepository.findAll()
      const result = await Effect.runPromise(effect)

      // Assert
      expect(result).toHaveLength(2)
      expect(result[0]).toBeInstanceOf(User)
      expect(result[0].id).toBe('user1')
      expect(result[0].name).toBe('User One')
      expect(result[1]).toBeInstanceOf(User)
      expect(result[1].id).toBe('user2')
      expect(result[1].name).toBe('User Two')

      // Verify the AWS SDK was called correctly
      expect(docClientMock.calls()).toHaveLength(1)
      const scanCall = docClientMock.call(0)
      expect(scanCall.args[0].input).toMatchObject({
        TableName: 'users-table',
      })
    })

    it('should return empty array when no users exist', async () => {
      // Arrange
      docClientMock.on(ScanCommand).resolves({ Items: [] })

      // Act
      const effect = DynamoUserRepository.findAll()
      const result = await Effect.runPromise(effect)

      // Assert
      expect(result).toEqual([])
    })

    it('should handle undefined Items in scan response', async () => {
      // Arrange
      docClientMock.on(ScanCommand).resolves({})

      // Act
      const effect = DynamoUserRepository.findAll()
      const result = await Effect.runPromise(effect)

      // Assert
      expect(result).toEqual([])
    })

    it('should handle DynamoDB errors during findAll', async () => {
      // Arrange
      docClientMock.on(ScanCommand).rejects(new Error('DynamoDB connection failed'))

      // Act & Assert
      const effect = DynamoUserRepository.findAll()
      
      await expect(Effect.runPromise(effect)).rejects.toThrow()    })
  })

  describe('deleteById', () => {
    it('should successfully delete an existing user', async () => {
      // Arrange
      const userId = 'user-to-delete'
      
      // Mock successful findById followed by successful delete
      docClientMock.on(GetCommand).resolves({
        Item: {
          id: userId,
          name: 'User To Delete',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        }
      })
      docClientMock.on(DeleteCommand).resolves({})

      // Act
      const effect = DynamoUserRepository.deleteById(userId)
      const result = await Effect.runPromise(effect)

      // Assert
      expect(result).toBeUndefined() // void return

      // Verify the AWS SDK was called correctly
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

    it('should return UserNotFoundError when trying to delete non-existent user', async () => {
      // Arrange
      const userId = 'non-existent-user'
      
      // Mock findById returning empty (user not found)
      docClientMock.on(GetCommand).resolves({})

      // Act & Assert
      const effect = DynamoUserRepository.deleteById(userId)
      
      await expect(Effect.runPromise(effect)).rejects.toThrow()
      // Verify only findById was called, not delete
      expect(docClientMock.calls()).toHaveLength(1)
    })

    it('should handle DynamoDB errors during delete operation', async () => {
      // Arrange
      const userId = 'user-to-delete'
      
      // Mock successful findById but failed delete
      docClientMock.on(GetCommand).resolves({
        Item: {
          id: userId,
          name: 'User To Delete',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        }
      })
      docClientMock.on(DeleteCommand).rejects(new Error('DynamoDB delete failed'))

      // Act & Assert
      const effect = DynamoUserRepository.deleteById(userId)
      
      await expect(Effect.runPromise(effect)).rejects.toThrow()    })
  })
})
