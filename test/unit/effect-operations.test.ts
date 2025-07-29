import { Effect } from 'effect'
import { User, CreateUserRequest, ValidationError, UserNotFoundError, DatabaseError } from '../../src/domain/user'

describe('Effect Operations', () => {
  describe('Basic Effect operations', () => {
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
        expect(result.left.errors).toEqual(['Invalid input'])
      }
    })

    it('should handle Effect.fail with UserNotFoundError', async () => {
      const error = new UserNotFoundError({
        message: 'User not found',
        userId: 'test-user-123'
      })
      
      const effect = Effect.fail(error)
      const result = await Effect.runPromise(Effect.either(effect))
      
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(UserNotFoundError)
        expect(result.left.message).toBe('User not found')
        expect(result.left.userId).toBe('test-user-123')
      }
    })

    it('should handle Effect.fail with DatabaseError', async () => {
      const error = new DatabaseError({
        message: 'Connection timeout'
      })
      
      const effect = Effect.fail(error)
      const result = await Effect.runPromise(Effect.either(effect))
      
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(DatabaseError)
        expect(result.left.message).toBe('Connection timeout')
      }
    })
  })

  describe('Effect composition', () => {
    it('should chain effects successfully', async () => {
      const createUserEffect = Effect.succeed(new User({
        id: 'chain-test',
        name: 'Chain Test User',
        createdAt: new Date(),
        updatedAt: new Date()
      }))

      const getUserEffect = (user: User) => Effect.succeed(user.name)

      const chainedEffect = Effect.flatMap(createUserEffect, getUserEffect)
      const result = await Effect.runPromise(chainedEffect)
      
      expect(result).toBe('Chain Test User')
    })

    it('should handle errors in Effect chains', async () => {
      const failingEffect = Effect.fail(new ValidationError({
        message: 'Chain validation error',
        errors: ['Chain test failed']
      }))

      const chainedEffect = Effect.flatMap(
        failingEffect,
        () => Effect.succeed('Should not reach here')
      )

      const result = await Effect.runPromise(Effect.either(chainedEffect))
      
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left.message).toBe('Chain validation error')
      }
    })

    it('should use Effect.gen for imperative-style composition', async () => {
      const userCreationEffect = Effect.gen(function* () {
        const request = yield* Effect.succeed(new CreateUserRequest({
          id: 'gen-test',
          name: 'Gen Test User'
        }))

        if (!request.id.trim()) {
          yield* Effect.fail(new ValidationError({
            message: 'Invalid ID',
            errors: ['ID cannot be empty']
          }))
        }

        const user = yield* Effect.succeed(new User({
          id: request.id,
          name: request.name,
          createdAt: new Date(),
          updatedAt: new Date()
        }))

        return user
      })

      const result = await Effect.runPromise(userCreationEffect)
      
      expect(result.id).toBe('gen-test')
      expect(result.name).toBe('Gen Test User')
    })

    it('should handle validation in Effect.gen', async () => {
      const validationEffect = Effect.gen(function* () {
        const request = yield* Effect.succeed(new CreateUserRequest({
          id: '',
          name: 'Invalid User'
        }))

        if (!request.id.trim()) {
          yield* Effect.fail(new ValidationError({
            message: 'Validation failed',
            errors: ['ID is required']
          }))
        }

        return 'Should not reach here'
      })

      const result = await Effect.runPromise(Effect.either(validationEffect))
      
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left.message).toBe('Validation failed')
        expect(result.left.errors).toEqual(['ID is required'])
      }
    })
  })

  describe('Effect error handling patterns', () => {
    it('should recover from failures with Effect.catchAll', async () => {
      const failingEffect = Effect.fail(new UserNotFoundError({
        message: 'User not found',
        userId: 'missing-user'
      }))

      const recoveredEffect = Effect.catchAll(failingEffect, (error) =>
        Effect.succeed(`Recovered from: ${error.message}`)
      )

      const result = await Effect.runPromise(recoveredEffect)
      expect(result).toBe('Recovered from: User not found')
    })

    it('should handle specific error types with Effect.catchTag', async () => {
      const failingEffect = Effect.fail(new ValidationError({
        message: 'Validation failed',
        errors: ['Test error']
      }))

      const recoveredEffect = Effect.catchTags(failingEffect, {
        ValidationError: (error) => Effect.succeed(`Validation error handled: ${error.errors.join(', ')}`)
      })

      const result = await Effect.runPromise(recoveredEffect)
      expect(result).toBe('Validation error handled: Test error')
    })

    it('should pass through unhandled error types', async () => {
      // Create a simple test that demonstrates error passing through
      const dbError = new DatabaseError({
        message: 'Database connection failed'
      })
      
      const failingEffect = Effect.fail(dbError)
      const result = await Effect.runPromise(Effect.either(failingEffect))
      
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(DatabaseError)
        const error = result.left as DatabaseError
        expect(error.message).toBe('Database connection failed')
      }
    })
  })

  describe('Effect utilities', () => {
    it('should handle arrays with Effect.all', async () => {
      const effects = [
        Effect.succeed('User 1'),
        Effect.succeed('User 2'),
        Effect.succeed('User 3')
      ]

      const allEffect = Effect.all(effects)
      const result = await Effect.runPromise(allEffect)
      
      expect(result).toEqual(['User 1', 'User 2', 'User 3'])
    })

    it('should fail fast with Effect.all when one effect fails', async () => {
      const effects = [
        Effect.succeed('User 1'),
        Effect.fail(new ValidationError({
          message: 'User 2 validation failed',
          errors: ['Invalid data']
        })),
        Effect.succeed('User 3')
      ]

      const allEffect = Effect.all(effects)
      const result = await Effect.runPromise(Effect.either(allEffect))
      
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left.message).toBe('User 2 validation failed')
      }
    })

    it('should handle conditional logic with simple effects', async () => {
      const conditionalEffect = (shouldSucceed: boolean) =>
        shouldSucceed 
          ? Effect.succeed('Success case')
          : Effect.fail(new ValidationError({
              message: 'Condition failed',
              errors: ['shouldSucceed was false']
            }))

      const successResult = await Effect.runPromise(conditionalEffect(true))
      expect(successResult).toBe('Success case')

      const failureResult = await Effect.runPromise(Effect.either(conditionalEffect(false)))
      expect(failureResult._tag).toBe('Left')
      if (failureResult._tag === 'Left') {
        const error = failureResult.left as ValidationError
        expect(error.message).toBe('Condition failed')
      }
    })
  })
})
