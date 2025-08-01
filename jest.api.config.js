const baseConfig = require('./jest.integration.config.js');

module.exports = {
  ...baseConfig,
  displayName: 'Production API Tests',
  testMatch: [
    '**/test/integration/**/*.test.ts',
    '**/test/api/**/*.test.ts'
  ],
  testTimeout: 30000, // Shorter timeout for production API tests
  maxWorkers: 2, // Can run more concurrent tests against AWS
  setupFilesAfterEnv: [
    '<rootDir>/test/setup/jest.setup.ts',
    '<rootDir>/test/setup/api.setup.ts'
  ],
  globalSetup: '<rootDir>/test/setup/api.global.setup.ts',
  globalTeardown: '<rootDir>/test/setup/api.global.teardown.ts',
  collectCoverage: false,
  verbose: true,
  // Environment variables for production API testing
  testEnvironment: 'node',
  forceExit: true,
  detectOpenHandles: true
};
