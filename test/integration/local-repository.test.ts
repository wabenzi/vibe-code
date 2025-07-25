import { describe, test, expect, beforeEach } from '@jest/globals'
import { Effect } from 'effect'
import { makeLocalUserRepository } from '../../src/infrastructure/local-user-repository'
import { User, CreateUserRequest, UserNotFoundError } from '../../src/domain/user'

describe('LocalStack Integration Tests', () => {
  let testIdCounter = 0

  beforeEach(() => {
    testIdCounter++
  })

  test('should connect to local PostgreSQL and create a user', async () => {
    const repositoryEffect = makeLocalUserRepository()
    const repository = await Effect.runPromise(repositoryEffect)

    const testUser = new User({
      id: `integration-test-create-${testIdCounter}`,
      name: 'Integration Test User',
      createdAt: new Date(),
      updatedAt: new Date()
    })

    const result = await Effect.runPromise(repository.create(testUser))
    
    expect(result).toMatchObject({
      id: `integration-test-create-${testIdCounter}`,
      name: 'Integration Test User'
    })
    expect(result.createdAt).toBeInstanceOf(Date)
    expect(result.updatedAt).toBeInstanceOf(Date)
  })

  test('should find an existing user by ID', async () => {
    const repositoryEffect = makeLocalUserRepository()
    const repository = await Effect.runPromise(repositoryEffect)

    // First create a user
    const testUser = new User({
      id: `integration-test-find-${testIdCounter}`,
      name: 'Find Test User',
      createdAt: new Date(),
      updatedAt: new Date()
    })

    await Effect.runPromise(repository.create(testUser))

    // Then find it
    const foundUser = await Effect.runPromise(repository.findById(`integration-test-find-${testIdCounter}`))
    
    expect(foundUser).toMatchObject({
      id: `integration-test-find-${testIdCounter}`,
      name: 'Find Test User'
    })
  })

  test('should throw UserNotFoundError for non-existent user', async () => {
    const repositoryEffect = makeLocalUserRepository()
    const repository = await Effect.runPromise(repositoryEffect)

    // Use Effect.runPromiseExit to capture the error properly
    const result = await Effect.runPromiseExit(repository.findById('non-existent-user'))
    
    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      expect(result.cause._tag).toBe('Fail')
      if (result.cause._tag === 'Fail') {
        const error = result.cause.error
        expect(error._tag).toBe('UserNotFoundError')
        if (error._tag === 'UserNotFoundError') {
          expect(error.userId).toBe('non-existent-user')
        }
      }
    }
  })

  test('should find the test user seeded in the database', async () => {
    const repositoryEffect = makeLocalUserRepository()
    const repository = await Effect.runPromise(repositoryEffect)

    const testUser = await Effect.runPromise(repository.findById('test'))
    
    expect(testUser).toMatchObject({
      id: 'test',
      name: 'Test User'
    })
  })
})
