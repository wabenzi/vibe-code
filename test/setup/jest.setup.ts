import { config } from 'dotenv';

// Load environment variables for testing
config({ path: '.env.local' });

// Global test configuration
global.console = {
  ...console,
  // Suppress console.log in tests unless DEBUG is set
  log: process.env.DEBUG ? console.log : () => {},
  debug: process.env.DEBUG ? console.debug : () => {},
  info: console.info,
  warn: console.warn,
  error: console.error,
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';
process.env.AWS_DEFAULT_REGION = 'us-east-1';
process.env.DYNAMODB_TABLE_NAME = 'users-table';
process.env.LOG_LEVEL = 'ERROR'; // Reduce log noise in tests

// Increase timeout for async operations
jest.setTimeout(30000);
