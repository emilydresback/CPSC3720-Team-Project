# Testing Quick Start Guide - TigerTix

## Prerequisites
- Node.js v18+ installed
- npm or yarn package manager

## Installation

```bash
# Install all dependencies
npm install
```

## Running Tests

### Quick Test Commands

```bash
# Run ALL tests (recommended first run)
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode (for development)
npm run test:watch
```

### Backend Tests

```bash
# Test individual microservices
npm run test:admin        # Admin service (15 tests)
npm run test:client       # Client service (14 tests)
npm run test:llm          # LLM service (26 tests)
npm run test:auth         # Authentication (20 tests)

# Integration & E2E tests
npm run test:integration  # Service integration (25 tests)
npm run test:e2e          # End-to-end workflows (15 tests)
npm run test:database     # Database concurrency (12 tests)
```

### Frontend Tests

```bash
# All frontend tests
npm run test:frontend

# Accessibility tests only
npm run test:accessibility
```

### Run Everything

```bash
# Sequential execution of all test suites
npm run test:all
```

## Expected Output

### Successful Test Run Example
```
PASS  admin-service/tests/eventController.test.js (5.234s)
  ✓ should create event with valid data (45ms)
  ✓ should validate required fields (12ms)
  ✓ should prevent SQL injection (23ms)
  ... (12 more tests)

PASS  backend/user-authentication/tests/auth.test.js (4.567s)
  ✓ should register new user (34ms)
  ✓ should hash passwords (28ms)
  ✓ should generate JWT token (19ms)
  ... (17 more tests)

PASS  frontend/src/__tests__/accessibility.test.js (3.891s)
  ✓ should have ARIA labels (15ms)
  ✓ should support keyboard navigation (42ms)
  ... (38 more tests)

Test Suites: 9 passed, 9 total
Tests:       191 passed, 191 total
Snapshots:   0 total
Time:        42.567s
```

### Coverage Report Example
```
--------------------------|---------|----------|---------|---------|
File                      | % Stmts | % Branch | % Funcs | % Lines |
--------------------------|---------|----------|---------|---------|
All files                 |   92.45 |    88.23 |   94.12 |   93.67 |
 admin-service/           |   94.23 |    90.45 |   96.78 |   95.12 |
 client-service/          |   93.45 |    89.12 |   94.56 |   94.23 |
 llm-booking-service/     |   91.23 |    86.78 |   92.34 |   92.45 |
 user-authentication/     |   95.67 |    92.34 |   97.89 |   96.45 |
 frontend/                |   89.12 |    84.56 |   90.23 |   90.45 |
--------------------------|---------|----------|---------|---------|
```

## Test Organization

```
Tests by Category:
├── Backend Unit Tests (75 tests)
│   ├── Admin Service: 15 tests
│   ├── Client Service: 14 tests
│   ├── LLM Service: 26 tests
│   └── Auth Service: 20 tests
├── Frontend Tests (58 tests)
│   ├── Component Tests: 18 tests
│   └── Accessibility Tests: 40 tests
├── Integration Tests (25 tests)
├── End-to-End Tests (15 tests)
└── Database Tests (12 tests)

Total: 191 Tests
```

## Troubleshooting

### Issue: Tests fail with database errors
**Solution:** Clean up test databases
```bash
find . -name "test-*.db" -delete
npm test
```

### Issue: Port already in use
**Solution:** Tests use in-memory databases and mock servers, no actual ports needed

### Issue: Module not found errors
**Solution:** Reinstall dependencies
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: Jest timeout errors
**Solution:** Increase timeout (already set to 10s in config)
```bash
# For individual long-running tests, timeout is configurable
jest.setTimeout(20000);
```

## Writing New Tests

### Backend Test Template
```javascript
const request = require('supertest');
const app = require('../app'); // Your express app

describe('My New Feature', () => {
  test('should do something', async () => {
    const response = await request(app)
      .post('/api/endpoint')
      .send({ data: 'value' });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('result');
  });
});
```

### Frontend Test Template
```javascript
import { render, screen } from '@testing-library/react';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  test('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

## Continuous Integration

### Running Tests in CI
```bash
# Use CI-optimized configuration
npm run test:ci
```

### Pre-commit Hook (Recommended)
```bash
# Install husky for git hooks
npm install --save-dev husky

# Add to package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm test"
    }
  }
}
```

## Coverage Thresholds

Current targets:
- **Backend:** 90%+ coverage
- **Frontend:** 85%+ coverage
- **Critical paths:** 100% coverage

To view detailed coverage:
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## Test Development Workflow

1. **Write failing test** (TDD approach)
   ```bash
   npm run test:watch
   # Create new test file
   # Write test for new feature
   ```

2. **Implement feature** until test passes

3. **Refactor** while keeping tests green

4. **Run full suite** before committing
   ```bash
   npm test
   ```

## Key Test Files

### Most Important Tests
- `backend/user-authentication/tests/auth.test.js` - Authentication flow
- `tests/end-to-end.test.js` - Complete user workflows
- `tests/microservices-integration.test.js` - Service interactions
- `frontend/src/__tests__/accessibility.test.js` - WCAG compliance

### Configuration Files
- `jest.config.js` - Main Jest configuration
- `babel.config.js` - Babel transpilation for tests
- `frontend/src/setupTests.js` - Frontend test setup

## Performance Tips

- Tests run in parallel by default
- Use `--maxWorkers=2` for CI environments
- In-memory SQLite databases are fast
- Mock external dependencies

## Getting Help

### Useful Resources
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Supertest API](https://github.com/visionmedia/supertest)

### Common Jest Matchers
```javascript
expect(value).toBe(expected)           // Strict equality
expect(value).toEqual(expected)        // Deep equality
expect(array).toContain(item)          // Array contains
expect(object).toHaveProperty('key')   // Object has property
expect(fn).toThrow()                   // Function throws
expect(string).toMatch(/pattern/)      // Regex match
expect(response.status).toBe(200)      // HTTP status
```

## Next Steps

1. Run `npm test` to verify all tests pass
2. Run `npm run test:coverage` to see coverage report
3. Explore test files in `*/tests/` directories
4. Read `COMPREHENSIVE_TESTING_REPORT.md` for detailed documentation
5. Start adding tests for new features!

---

**Quick Reference Card**

| Command | Purpose |
|---------|---------|
| `npm test` | Run all tests |
| `npm run test:watch` | Development mode |
| `npm run test:coverage` | Generate coverage |
| `npm run test:admin` | Admin service only |
| `npm run test:frontend` | Frontend only |
| `npm run test:e2e` | End-to-end only |
| `npm run test:all` | Sequential all tests |
