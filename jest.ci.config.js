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
    '**/test/**/!integration*.test.ts',
    '**/test/**/!integration*.spec.ts',
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
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
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
