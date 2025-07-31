import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function integrationGlobalTeardown() {
  console.log('🧹 Cleaning up integration test environment...');
  
  // Skip teardown if NODE_ENV is production (for AWS testing)
  if (process.env.NODE_ENV === 'production') {
    console.log('🚀 Skipping LocalStack teardown - was running against AWS production');
    return;
  }
  
  // Check if we should keep LocalStack running for development
  const keepLocalStack = process.env.KEEP_LOCALSTACK === 'true' ||
                         process.env.NODE_ENV === 'development';

  try {
    if (keepLocalStack) {
      console.log('🔧 Development mode: Keeping LocalStack running for debugging');
      console.log('💡 To stop LocalStack manually, run: ./scripts/deployment/deploy-localstack.sh teardown');
    } else {
      console.log('🗑️  Tearing down LocalStack infrastructure...');
      await execAsync('./scripts/deployment/deploy-localstack.sh teardown', {
        env: { ...process.env },
        cwd: process.cwd()
      });
      console.log('✅ LocalStack teardown completed');
    }
    
    console.log('✅ Integration test cleanup complete');
  } catch (error) {
    console.error('❌ Error during integration test cleanup:', error);
    // Don't throw to avoid masking test failures
  }
}
