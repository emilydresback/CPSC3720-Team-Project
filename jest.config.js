module.exports = {
  projects: [
    {
      displayName: 'backend',
      testEnvironment: 'node',
      testMatch: [
        '**/admin-service/tests/**/*.test.js',
        '**/client-service/tests/**/*.test.js',
        '**/llm-booking-service/tests/**/*.test.js'
      ],
      testPathIgnorePatterns: ['/node_modules/', '/frontend/']
    },
    {
      displayName: 'frontend',
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/frontend/src/setupTests.js'],
      testMatch: ['<rootDir>/frontend/src/__tests__/**/*.test.js'],
      moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js'
      },
      transform: {
        '^.+\\.(js|jsx)$': ['babel-jest', { rootMode: 'upward' }]
      }
    }
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 10000
};
