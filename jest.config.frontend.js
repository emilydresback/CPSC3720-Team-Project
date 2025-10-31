// jest.config.frontend.js - Updated for Frontend Tests
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/frontend/src/setupTests.js'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js'
  },
  collectCoverageFrom: [
    'frontend/src/**/*.{js,jsx}',
    '!frontend/src/index.js',
    '!frontend/src/reportWebVitals.js',
    '!frontend/src/**/*.test.{js,jsx}',
    '!frontend/src/setupTests.js'
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  },
  testMatch: [
    '<rootDir>/frontend/src/__tests__/**/*.test.{js,jsx}',
    '<rootDir>/frontend/src/**/*.test.{js,jsx}'
  ],
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', { rootMode: 'upward' }]
  },
  testPathIgnorePatterns: ['/node_modules/', '/build/', '/dist/'],
  roots: ['<rootDir>/frontend'],
  moduleDirectories: ['node_modules', '<rootDir>'],
  verbose: true
};