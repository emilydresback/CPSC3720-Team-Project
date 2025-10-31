// tests/setup.js - Test Environment Setup
const path = require('path');
const fs = require('fs');

// Setup test database
const testDbPath = path.join(__dirname, '../test-database.sqlite');

// Clean up test database before each test run
beforeAll(() => {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});

// Clean up after all tests
afterAll(() => {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});

// Global test timeout
jest.setTimeout(10000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to suppress logs during tests
  // log: jest.fn(),
  // error: jest.fn(),
  // warn: jest.fn(),
};