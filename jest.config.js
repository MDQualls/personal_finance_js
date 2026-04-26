const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

/** @type {import('jest').Config} */
const customConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/__tests__/factories/',
  ],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  collectCoverageFrom: [
    'lib/**/*.ts',
    'app/api/**/*.ts',
    'components/**/*.tsx',
    '!**/*.d.ts',
    '!**/__mocks__/**',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
  },
}

// createJestConfig concatenates transformIgnorePatterns rather than replacing,
// so we wrap the export to force-replace them after the merge.
module.exports = async () => {
  const config = await createJestConfig(customConfig)()
  config.transformIgnorePatterns = [
    '/node_modules/(?!(jose|openid-client|@panva|oidc-token-hash|oauth4webapi)/).*',
    '^.+\\.module\\.(css|sass|scss)$',
  ]
  return config
}
