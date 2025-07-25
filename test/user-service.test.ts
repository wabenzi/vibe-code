import { Effect } from 'effect'
import { User, CreateUserRequest, ValidationError } from '../src/domain/user'

// Simple test without AWS dependencies
describe('User Domain', () => {
  describe('User creation', () => {
    it('should create a User with valid data', () => {
      const user = new User({
        id: 'test-123',
        name: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      expect(user.id).toBe('test-123')
      expect(user.name).toBe('Test User')
      expect(user.createdAt).toBeInstanceOf(Date)
      expect(user.updatedAt).toBeInstanceOf(Date)
    })

    it('should create a CreateUserRequest with valid data', () => {
      const request = new CreateUserRequest({
        id: 'test-456',
        name: 'Another User',
      })

      expect(request.id).toBe('test-456')
      expect(request.name).toBe('Another User')
    })

    it('should create ValidationError with proper structure', () => {
      const error = new ValidationError({
        message: 'Test validation error',
        errors: ['Field is required'],
      })

      expect(error.message).toBe('Test validation error')
      expect(error.errors).toEqual(['Field is required'])
      expect(error._tag).toBe('ValidationError')
    })
  })

  describe('Effect basic operations', () => {
    it('should handle Effect.succeed', async () => {
      const effect = Effect.succeed('Hello World')
      const result = await Effect.runPromise(effect)
      expect(result).toBe('Hello World')
    })

    it('should handle Effect.fail with ValidationError', async () => {
      const error = new ValidationError({
        message: 'Test error',
        errors: ['Invalid input'],
      })
      
      const effect = Effect.fail(error)
      const result = await Effect.runPromise(Effect.either(effect))
      
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(ValidationError)
        expect(result.left.message).toBe('Test error')
      }
    })
  })
})
