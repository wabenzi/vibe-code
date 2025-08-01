/**
 * Global teardown for API tests
 * This runs once after all test suites complete
 */

export default async (): Promise<void> => {
  console.log('🧹 API test suite cleanup complete');
};
