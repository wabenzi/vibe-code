export default async function globalTeardown() {
  console.log('🧹 Cleaning up global test environment...');
  
  // Clean up any global resources
  // This could include stopping test servers, cleaning temp files, etc.
  
  console.log('✅ Global test environment cleanup complete');
}
