export default async function integrationGlobalTeardown() {
  console.log('🧹 Cleaning up integration test environment...');
  
  // Optional: Clean up test data or tear down infrastructure
  // For development, we might want to keep LocalStack running
  // await execAsync('npm run deploy:localstack:teardown');
  
  console.log('✅ Integration test cleanup complete');
}
