import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function globalSetup() {
  console.log('🔧 Setting up global test environment...');
  
  // Ensure test directories exist
  await execAsync('mkdir -p test/reports coverage pacts');
  
  // Set global test environment variables
  process.env.NODE_ENV = 'test';
  process.env.AWS_ACCESS_KEY_ID = 'test';
  process.env.AWS_SECRET_ACCESS_KEY = 'test';
  process.env.AWS_DEFAULT_REGION = 'us-east-1';
  
  console.log('✅ Global test environment setup complete');
}
