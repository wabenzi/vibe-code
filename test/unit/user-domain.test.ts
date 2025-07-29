import { Effect } from 'effect'
import { User, CreateUserRequest, ValidationError, UserNotFoundError, DatabaseError } from '../../src/domain/user'

describe('User Domain Models', () => {
  describe('User entity', () => {
    it('should create a User with valid data', () => {
      const createdAt = new Date()
      const updatedAt = new Date()
      
      const user = new User({
        id: 'test-user-123',
        name: 'Test User',
        createdAt,
        updatedAt,
      })

      expect(user.id).toBe('test-user-123')
      expect(user.name).toBe('Test User')
      expect(user.createdAt).toBe(createdAt)
      expect(user.updatedAt).toBe(updatedAt)
    })

    it('should handle timestamps correctly', () => {
      const now = new Date()
      const user = new User({
        id: 'timestamp-test',
        name: 'Timestamp User',
        createdAt: now,
        updatedAt: now,
      })

      expect(user.createdAt).toBeInstanceOf(Date)
      expect(user.updatedAt).toBeInstanceOf(Date)
      expect(user.createdAt.getTime()).toBe(now.getTime())
      expect(user.updatedAt.getTime()).toBe(now.getTime())
    })

    it('should create users with different valid IDs', () => {
      const testCases = [
        'simple-id',
        'id-with-dashes',
        'id_with_underscores',
        'id123456789',
        'very-long-id-with-multiple-parts-and-numbers-123'
      ]

      testCases.forEach(id => {
        const user = new User({
          id,
          name: 'Test User',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        expect(user.id).toBe(id)
      })
    })
  })

  describe('CreateUserRequest', () => {
    it('should create a CreateUserRequest with valid data', () => {
      const request = new CreateUserRequest({
        id: 'create-test-456',
        name: 'Create Request User',
      })

      expect(request.id).toBe('create-test-456')
      expect(request.name).toBe('Create Request User')
    })

    it('should handle special characters in names', () => {
      const specialNames = [
        'User with Spaces',
        'User-with-dashes',
        'User_with_underscores',
        'User with "quotes"',
        'User with numbers 123',
        'User with special chars !@#$%'
      ]

      specialNames.forEach(name => {
        const request = new CreateUserRequest({
          id: `test-${Date.now()}`,
          name,
        })
        expect(request.name).toBe(name)
      })
    })

    it('should preserve data integrity', () => {
      const requestData = {
        id: 'integrity-test',
        name: 'Data Integrity User'
      }
      
      const request = new CreateUserRequest(requestData)
      
      expect(request.id).toBe(requestData.id)
      expect(request.name).toBe(requestData.name)
      
      // Verify immutability
      requestData.id = 'modified-id'
      expect(request.id).toBe('integrity-test')
    })
  })

  describe('Error Types', () => {
    it('should create ValidationError with proper structure', () => {
      const error = new ValidationError({
        message: 'Test validation error',
        errors: ['Field is required', 'Invalid format'],
      })

      expect(error.message).toBe('Test validation error')
      expect(error.errors).toEqual(['Field is required', 'Invalid format'])
      expect(error._tag).toBe('ValidationError')
    })

    it('should create UserNotFoundError with user ID', () => {
      const error = new UserNotFoundError({
        message: 'User not found',
        userId: 'missing-user-123'
      })

      expect(error.message).toBe('User not found')
      expect(error.userId).toBe('missing-user-123')
      expect(error._tag).toBe('UserNotFoundError')
    })

    it('should create DatabaseError with message', () => {
      const error = new DatabaseError({
        message: 'Connection failed'
      })

      expect(error.message).toBe('Connection failed')
      expect(error._tag).toBe('DatabaseError')
    })

    it('should handle ValidationError with single error', () => {
      const error = new ValidationError({
        message: 'Single error test',
        errors: ['Only one error'],
      })

      expect(error.errors).toHaveLength(1)
      expect(error.errors[0]).toBe('Only one error')
    })

    it('should handle ValidationError with multiple errors', () => {
      const errors = [
        'ID is required',
        'Name is required',
        'ID format is invalid',
        'Name too long'
      ]
      
      const error = new ValidationError({
        message: 'Multiple validation errors',
        errors,
      })

      expect(error.errors).toHaveLength(4)
      expect(error.errors).toEqual(errors)
    })
  })
})
