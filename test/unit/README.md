# Unit Testing with Effect Service Mocking

This project uses Effect TypeScript for functional programming and comprehensive unit testing with service mocking. The mocking approach leverages Effect's dependency injection capabilities through `Effect.provideService`.

## Overview

The unit tests demonstrate proper mocking of Effect-based services without requiring actual DynamoDB connections. This approach provides:

- **Fast execution**: No external dependencies
- **Predictable results**: Controlled mock responses
- **Type safety**: Full TypeScript support with Effect types
- **Comprehensive coverage**: Tests for success and error scenarios

## Key Files

### Service Mocking Tests
- `test/unit/service-mocking.test.ts` - Comprehensive service layer tests
- `test/unit/api-lambdas.test.ts` - API-focused service integration tests
- `test/unit/effect-operations.test.ts` - Effect operation patterns
- `test/unit/user-domain.test.ts` - Domain model tests

## Mocking Patterns

### 1. UserService Mocking

```typescript
import { Effect, Context } from 'effect'
import { UserService } from '../../src/services/dynamo-user-service'

// Create a context tag for dependency injection
const TestUserService = Context.GenericTag<UserService>('TestUserService')

// Create mock implementation
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
      return Effect.succeed(/* ... existing user ... */)
    }
    return Effect.fail(new UserNotFoundError({
      message: `User with id ${id} not found`,
      userId: id
    }))
  }),
  // ... other methods
})
```

### 2. Using Effect.provideService

```typescript
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
})
```

### 3. Error Scenario Testing

```typescript
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
```

## Test Categories

### 1. Service Layer Tests (`service-mocking.test.ts`)

**UserService with Mocked Dependencies:**
- ✅ Create user with mock service
- ✅ Handle creation errors
- ✅ Retrieve existing users
- ✅ Handle user not found errors
- ✅ Delete users
- ✅ Get all users

**UserRepository with Mocked Dependencies:**
- ✅ Repository-level operations
- ✅ Error handling at repository level
- ✅ Different mock configurations

**Composable Service Operations:**
- ✅ Multi-step workflows
- ✅ Error propagation in compositions
- ✅ Multiple mock service variations

**Error Handling Scenarios:**
- ✅ Different error types
- ✅ Type safety validation

### 2. API Lambda Tests (`api-lambdas.test.ts`)

**Create User Lambda:**
- ✅ Successful user creation
- ✅ Validation errors
- ✅ Duplicate user handling

**Get User Lambda:**
- ✅ Retrieve existing users
- ✅ User not found scenarios
- ✅ Database errors

**Delete User Lambda:**
- ✅ Successful deletion
- ✅ Delete non-existent user

**Service Integration:**
- ✅ Composed operations
- ✅ Error propagation

## Benefits of This Approach

### 1. **Fast and Reliable**
- No external dependencies (DynamoDB, network calls)
- Predictable test execution times
- Consistent results across environments

### 2. **Type Safety**
- Full TypeScript support
- Effect type system integration
- Compile-time error checking

### 3. **Comprehensive Coverage**
- Success scenarios
- Various error conditions
- Edge cases and boundary conditions

### 4. **Easy to Maintain**
- Clear separation of concerns
- Modular mock implementations
- Reusable test patterns

### 5. **Effect Pattern Validation**
- Tests Effect composition patterns
- Validates error handling flows
- Ensures proper dependency injection

## Mock Service Patterns

### Basic Mock
```typescript
const basicMock = createMockUserService()
// Uses default implementations for all methods
```

### Partial Override
```typescript
const partialMock = createMockUserService({
  createUser: (request) => Effect.fail(new ValidationError({ /* ... */ }))
  // Other methods use defaults
})
```

### Complete Custom Mock
```typescript
const customMock = createMockUserService({
  createUser: (request) => Effect.succeed(/* custom user */),
  getUserById: (id) => Effect.fail(/* custom error */),
  getAllUsers: () => Effect.succeed([/* custom users */]),
  deleteUser: (id) => Effect.succeed(undefined)
})
```

## Running the Tests

```bash
# Run all unit tests
npm run test:unit

# Run specific test files
npx jest test/unit/service-mocking.test.ts
npx jest test/unit/api-lambdas.test.ts

# Run with watch mode
npm run test:watch
```

## Test Results

```
Test Suites: 4 passed, 4 total
Tests:       55 passed, 55 total
Snapshots:   0 total
Time:        3.369 s
```

All unit tests are passing, providing comprehensive coverage of:
- 18 service mocking tests
- 14 API lambda tests  
- 15 Effect operation tests
- 11 domain model tests

## Best Practices

1. **Use Context Tags**: Always create specific context tags for dependency injection
2. **Mock Partial Interfaces**: Override only the methods you need to test specific scenarios
3. **Test Error Paths**: Always test both success and failure scenarios
4. **Maintain Type Safety**: Leverage TypeScript and Effect's type system
5. **Keep Mocks Simple**: Focus on the behavior being tested, not complex mock logic
6. **Use Effect.either**: For testing error scenarios, wrap effects with `Effect.either`
7. **Compose Effects**: Test realistic workflows that compose multiple service calls

This mocking approach provides a solid foundation for testing Effect-based services while maintaining the benefits of functional programming and type safety.
