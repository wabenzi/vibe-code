const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  displayName: 'Contract Tests',
  testMatch: [
    '**/test/contract/**/*.test.ts',
    '**/test/contract/**/*.spec.ts'
  ],
  testTimeout: 60000,
  setupFilesAfterEnv: [
    '<rootDir>/test/setup/jest.setup.ts',
    '<rootDir>/test/setup/contract.setup.ts'
  ],
  globalSetup: '<rootDir>/test/setup/contract.global.setup.ts',
  globalTeardown: '<rootDir>/test/setup/contract.global.teardown.ts'
};
