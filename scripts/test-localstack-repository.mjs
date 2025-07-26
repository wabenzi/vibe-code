#!/usr/bin/env node

// Simple test script to verify LocalStack DynamoDB integration
import { DynamoUserRepository } from '../src/infrastructure/dynamo-user-repository.js'
import { CreateUserRequest } from '../src/domain/user.js'
import { Effect } from 'effect'

// Set environment variables for LocalStack
process.env.DYNAMODB_ENDPOINT = 'http://localhost:4566'
process.env.DYNAMODB_TABLE_NAME = 'users-table'
process.env.AWS_REGION = 'us-west-2'

async function testRepository() {
  console.log('🧪 Testing LocalStack DynamoDB Repository...')
  
  try {
    // Test create user
    const createRequest = new CreateUserRequest({
      id: 'test-user-' + Date.now(),
      name: 'LocalStack Test User'
    })
    
    console.log('📝 Creating user...', createRequest)
    const createdUser = await Effect.runPromise(DynamoUserRepository.create(createRequest))
    console.log('✅ User created:', createdUser)
    
    // Test get user
    console.log('📖 Getting user by ID...')
    const retrievedUser = await Effect.runPromise(DynamoUserRepository.findById(createdUser.id))
    console.log('✅ User retrieved:', retrievedUser)
    
    // Test get all users
    console.log('📋 Getting all users...')
    const allUsers = await Effect.runPromise(DynamoUserRepository.findAll())
    console.log('✅ All users:', allUsers)
    
    console.log('🎉 All tests passed! LocalStack DynamoDB integration is working.')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

testRepository()
