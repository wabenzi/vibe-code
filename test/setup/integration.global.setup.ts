import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);

async function waitForLocalStack(timeout = 60000): Promise<void> {
  const start = Date.now();
  const localStackUrl = 'http://localhost:4566';
  
  while (Date.now() - start < timeout) {
    try {
      await axios.get(`${localStackUrl}/_localstack/health`);
      console.log('✅ LocalStack is ready');
      return;
    } catch (error) {
      console.log('⏳ Waiting for LocalStack...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  throw new Error('LocalStack failed to start within timeout period');
}

async function deployLocalStack(): Promise<void> {
  console.log('🐳 Starting LocalStack and deploying infrastructure...');

  try {
    // Deploy complete LocalStack infrastructure using the existing script
    await execAsync('./scripts/deployment/deploy-localstack.sh deploy', {
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'test' },
      cwd: process.cwd()
    });

    console.log('✅ LocalStack deployment completed');
  } catch (error) {
    console.error('❌ LocalStack deployment failed:', error);
    throw error;
  }
}

export default async function integrationGlobalSetup() {
  console.log('🐳 Setting up integration test environment...');
  
  // Skip LocalStack setup if NODE_ENV is production (for AWS testing)
  if (process.env.NODE_ENV === 'production') {
    console.log('🚀 Skipping LocalStack setup - running against AWS production');
    return;
  }
  
  try {
    // Check if LocalStack is already running
    try {
      await axios.get('http://localhost:4566/_localstack/health');
      console.log('📋 LocalStack already running, checking infrastructure...');

      // If LocalStack is running, just deploy/update infrastructure
      console.log('🏗️  Deploying test infrastructure...');
      await execAsync('./scripts/deployment/deploy-localstack.sh deploy', {
        env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'test' }
      });
    } catch {
      // LocalStack not running, do full deployment
      await deployLocalStack();
    }
    
    // Final health check and wait for infrastructure to be ready
    await waitForLocalStack();
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('✅ Integration test environment ready');
  } catch (error) {
    console.error('❌ Failed to setup integration test environment:', error);
    throw error;
  }
}
