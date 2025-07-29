import { DynamoUserRepository } from '../src/infrastructure/dynamo-user-repository'
import { CreateUserRequest } from '../src/domain/user'
import { Effect } from 'effect'

// Set environment variables for LocalStack
process.env.DYNAMODB_ENDPOINT = 'http://localhost:4566'
process.env.DYNAMODB_TABLE_NAME = 'users-table'
process.env.AWS_REGION = 'us-west-2'

const createTestUser = () => {
  const createRequest = new CreateUserRequest({
    id: 'test-user-' + Date.now(),
    name: 'LocalStack Test User'
  })
  
  console.log('📝 Creating user...', createRequest)
  return DynamoUserRepository.create(createRequest).pipe(
    Effect.tap((user) => Effect.sync(() => console.log('✅ User created:', user)))
  )
}

const testUserRetrieval = (userId: string) => {
  console.log('📖 Getting user by ID...')
  return DynamoUserRepository.findById(userId).pipe(
    Effect.tap((user) => Effect.sync(() => console.log('✅ User retrieved:', user)))
  )
}

const testGetAllUsers = () => {
  console.log('📋 Getting all users...')
  return DynamoUserRepository.findAll().pipe(
    Effect.tap((users) => Effect.sync(() => console.log('✅ All users:', users)))
  )
}

const testRepositoryProgram = Effect.sync(() => console.log('🧪 Testing LocalStack DynamoDB Repository...')).pipe(
  Effect.flatMap(() => createTestUser()),
  Effect.flatMap((createdUser) => 
    testUserRetrieval(createdUser.id).pipe(
      Effect.flatMap(() => testGetAllUsers()),
      Effect.map((allUsers) => ({ createdUser, allUsers }))
    )
  ),
  Effect.tap(() => Effect.sync(() => console.log('🎉 All tests passed! LocalStack DynamoDB integration is working.')))
)

const program = testRepositoryProgram.pipe(
  Effect.catchAll((error) => 
    Effect.sync(() => {
      console.error('❌ Test failed:', error)
      process.exit(1)
    })
  )
)

Effect.runPromise(program)
