const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  displayName: 'Integration Tests',
  testMatch: [
    '**/test/integration/**/*.test.ts',
    '**/test/integration/**/*.spec.ts'
  ],
  testTimeout: 60000,
  maxWorkers: 1,
  setupFilesAfterEnv: [
    '<rootDir>/test/setup/jest.setup.ts',
    '<rootDir>/test/setup/integration.setup.ts'
  ],
  globalSetup: '<rootDir>/test/setup/integration.global.setup.ts',
  globalTeardown: '<rootDir>/test/setup/integration.global.teardown.ts',
  collectCoverage: false,
  verbose: true
};
