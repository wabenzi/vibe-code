import { beforeAll, afterAll } from '@jest/globals'

// Environment setup for integration tests
beforeAll(async () => {
  // Set up environment variables for LocalStack
  process.env.AWS_ENDPOINT_URL = 'http://localhost:4566'
  process.env.AWS_ACCESS_KEY_ID = 'test'
  process.env.AWS_SECRET_ACCESS_KEY = 'test'
  process.env.AWS_DEFAULT_REGION = 'us-west-2'
  process.env.POSTGRES_HOST = 'localhost'
  process.env.POSTGRES_PORT = '5432'
  process.env.POSTGRES_DB = 'users_db'
  process.env.POSTGRES_USER = 'testuser'
  process.env.POSTGRES_PASSWORD = 'testpass'
  
  // Wait for services to be ready
  await new Promise(resolve => setTimeout(resolve, 2000))
})

afterAll(async () => {
  // Cleanup if needed
})
