import { ApiClient, createTestUser, getApiUrl } from '../utils/api-client';
import { withRetry, withRetryTest } from '../utils/retry';
import { validateIntegrationEnvironment, printIntegrationError } from '../utils/docker-utils';

describe('Retry Mechanism Demonstration', () => {
  let apiClient: ApiClient;
  
  beforeAll(async () => {
    const apiUrl = getApiUrl();

    // Validate integration environment before running tests
    console.log('🔍 Validating integration test environment...');
    const validation = await validateIntegrationEnvironment(apiUrl);

    if (!validation.valid) {
      printIntegrationError(validation.errors);
      throw new Error('Integration test environment validation failed. See error message above.');
    }

    console.log('✅ Integration environment validated for retry demo tests');

    apiClient = new ApiClient(apiUrl, {
      maxAttempts: 3,
      baseDelayMs: 500, // Shorter delay for demo
      maxDelayMs: 2000,
      exponentialBase: 2
    });
  });

  // Standard test - no retry wrapper
  it('standard test - should create user (no retry wrapper)', async () => {
    const userData = createTestUser();
    const response = await apiClient.createUser(userData);
    
    expect(response.status).toBe(201);
    expect(response.data.id).toBe(userData.id);
    
    // Clean up
    await apiClient.deleteUser(userData.id);
  });

  // Test with retry wrapper - will show warnings if retries occur
  withRetryTest('retry test - should create user with retry protection', async () => {
    const userData = createTestUser();
    const response = await apiClient.createUser(userData);
    
    expect(response.status).toBe(201);
    expect(response.data.id).toBe(userData.id);
    
    // Clean up
    await apiClient.deleteUser(userData.id);
  });

  // Demonstration of retry info collection
  it('should collect retry information for debugging', async () => {
    const userData = createTestUser();
    
    // Using the WithRetryInfo methods to get detailed retry information
    const { result, attempts, warnings } = await apiClient.createUserWithRetryInfo(userData);
    
    expect(result.status).toBe(201);
    expect(attempts).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(warnings)).toBe(true);
    
    // Log retry information for visibility
    if (warnings.length > 0) {
      console.log('🔄 Retry information:');
      console.log(`   Attempts: ${attempts}`);
      console.log(`   Warnings: ${warnings.join('; ')}`);
    } else {
      console.log(`✅ Operation succeeded on first attempt`);
    }
    
    // Clean up
    await apiClient.deleteUser(userData.id);
  });

  // Test lifecycle with retry info
  withRetryTest('should handle complete lifecycle with retry protection', async () => {
    const userData = createTestUser();
    
    // Create
    const { result: createResult, warnings: createWarnings } = await apiClient.createUserWithRetryInfo(userData);
    expect(createResult.status).toBe(201);
    
    // Read
    const { result: getResult, warnings: getWarnings } = await apiClient.getUserWithRetryInfo(userData.id);
    expect(getResult.status).toBe(200);
    expect(getResult.data.id).toBe(userData.id);
    
    // Delete
    const { result: deleteResult, warnings: deleteWarnings } = await apiClient.deleteUserWithRetryInfo(userData.id);
    expect(deleteResult.status).toBe(204); // DELETE returns 204 No Content
    
    // Log any retry activity
    const allWarnings = [...createWarnings, ...getWarnings, ...deleteWarnings];
    if (allWarnings.length > 0) {
      console.log('🔄 Lifecycle operations required retries:');
      allWarnings.forEach(warning => console.log(`   ${warning}`));
    }
  });
});
