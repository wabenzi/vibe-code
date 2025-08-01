/**
 * Global setup for API tests
 * This runs once before all test suites
 */

export default async (): Promise<void> => {
  console.log('🚀 Starting API test suite...');
  
  // Set API URL from environment variable if available
  if (process.env.API_BASE_URL) {
    process.env.API_URL = process.env.API_BASE_URL;
  }
  
  // Ensure JWT token utilities are available
  if (!process.env.JWT_SECRET) {
    console.warn('⚠️  No JWT_SECRET set, using development default');
    process.env.JWT_SECRET = 'development-secret-key';
    process.env.API_KEY = 'tr5ycwc5m3';
  }
  
  console.log('✅ API test global setup complete');
};
