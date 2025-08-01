/**
 * Setup for production API tests
 * This file is executed before each test file runs
 */

import { validateIntegrationEnvironment, printIntegrationError } from '../utils/docker-utils';
import { getApiUrl } from '../utils/api-client';

// Enhanced setup for production API testing
beforeAll(async () => {
  console.log('🔧 Setting up production API test environment...');
  
  // Check if API_BASE_URL is set (should be set by deployment script)
  const apiUrl = process.env.API_BASE_URL || getApiUrl();
  
  if (!apiUrl) {
    throw new Error('API_BASE_URL environment variable not set. Run deployment script first.');
  }
  
  console.log(`📡 Testing API at: ${apiUrl}`);
  
  // Skip LocalStack validation for production API tests
  if (!apiUrl.includes('localhost') && !apiUrl.includes('localstack')) {
    console.log('✅ Production API environment detected, skipping LocalStack checks');
    return;
  }
  
  // For LocalStack environments, still validate
  const validation = await validateIntegrationEnvironment(apiUrl);
  if (!validation.valid) {
    printIntegrationError(validation.errors);
    throw new Error('LocalStack environment validation failed.');
  }
  
  console.log('✅ API test environment ready');
});
