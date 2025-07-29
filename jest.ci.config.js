module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: [
    // Include unit tests and contract tests (they use mocks)
    '**/test/unit/**/*.test.ts',
    '**/test/unit/**/*.spec.ts',
    '**/test/contract/**/*.test.ts',
    '**/test/contract/**/*.spec.ts',
    '**/test/**/!(integration|retry-demo)*.test.ts',
    '**/test/**/!(integration|retry-demo)*.spec.ts',
  ],
  testPathIgnorePatterns: [
    // Exclude integration tests that require external infrastructure
    '<rootDir>/test/integration/',
    '<rootDir>/test/utils/',
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: false,
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'cobertura'],
  coverageThreshold: {
    global: {
      branches: 75,    // Slightly below current 79.31% to allow for some flexibility
      functions: 90,   // High standard since we're achieving 100%
      lines: 85,       // High standard since we're achieving 93%+
      statements: 85   // High standard since we're achieving 93%+
    }
  },
  // Ensure we run silently in CI
  silent: false,
  verbose: true,
  // Fail fast in CI
  bail: 1,
  // Don't run in watch mode in CI
  watchman: false,
  // Detect open handles to help debug cleanup issues
  detectOpenHandles: true,
  // Force exit to prevent hanging
  forceExit: true,
  // Set test timeout for contract tests
  testTimeout: 30000,
}
