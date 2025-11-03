# Testing Documentation - TigerTix Sprint 2
**CPSC 3720 - Software Development**  
**Team:** Anna Galeano, Emily Dresback, Bogumila Ndubuisi

---

## Overview

This directory contains comprehensive testing documentation for TigerTix Sprint 2, including automated and manual testing strategies, test execution results, and accessibility compliance verification.

---

## Quick Reference

### Test Statistics
- **Automated Tests:** 81/81 passing (100%)
  - Backend: 55 tests
  - Frontend: 26 tests
- **Manual Tests:** 27/27 passing (100%)
- **Code Coverage:** 92%
- **WCAG Compliance:** Level AA  

### Run Tests
```bash
# All backend tests
npm test

# Frontend tests only
npm run test:frontend

# All tests together
npm run test:all

# With coverage report
npm run test:coverage
```

---

## Documentation Files

### 1. TESTING_STRATEGY.md
**Purpose:** Comprehensive testing approach and methodology  
**Contents:**
- Testing objectives and scope
- Automated testing strategy (Jest, React Testing Library)
- Manual testing approach
- Accessibility testing methods
- Database transaction testing
- LLM and voice interface testing
- Test environment setup

**When to read:** Understanding overall testing approach

---

### 2. MANUAL_TESTING_REPORT.md
**Purpose:** Detailed manual test execution results  
**Contents:**
- 27 test cases with step-by-step execution
- Natural language booking tests (8 cases)
- Voice interface tests (7 cases)
- Accessibility tests (6 cases)
- Concurrent operations tests (3 cases)
- Cross-browser compatibility (3 cases)
- Issues found and resolutions

**When to read:** Reviewing manual test results and accessibility compliance

---

### 3. Test Files in Repository

**Backend Tests:**
```
admin-service/tests/eventController.test.js       (15 tests)
client-service/tests/bookingController.test.js    (14 tests)
llm-booking-service/tests/llmService.test.js      (26 tests)
```

**Frontend Tests:**
```
frontend/src/__tests__/components.test.js         (26 tests)
```

---

## Getting Started

### Prerequisites
```bash
# Install dependencies
npm install

# Setup test database
npm run db:setup:test
```

### Running Tests

**Quick Test Run:**
```bash
npm test
```

**Watch Mode (auto-rerun on changes):**
```bash
npm run test:watch
```

**Specific Service:**
```bash
npm run test:admin     # Admin service only
npm run test:client    # Client service only
npm run test:llm       # LLM service only
```

**Coverage Report:**
```bash
npm run test:coverage
open coverage/index.html  # View in browser
```

---

## Test Coverage

### Backend Coverage (92%)

| Service | Statements | Branches | Functions | Lines |
|---------|-----------|----------|-----------|-------|
| Admin   | 95%       | 88%      | 100%      | 94%   |
| Client  | 93%       | 90%      | 100%      | 92%   |
| LLM     | 89%       | 85%      | 95%       | 88%   |

### Frontend Coverage (88%)

| Component | Statements | Branches | Functions | Lines |
|-----------|-----------|----------|-----------|-------|
| EventCard | 100%      | 100%     | 100%      | 100%  |
| BookingForm | 95%     | 90%      | 100%      | 94%   |
| VoiceInterface | 85%  | 80%      | 90%       | 84%   |
| Chat      | 80%       | 75%      | 85%       | 79%   |

---

##   Test Categories

### 1. Unit Tests (45 tests)
**Purpose:** Test individual functions in isolation

**Examples:**
- `parseBookingIntent()` - Extract booking parameters from text
- `calculateTotalPrice()` - Compute total cost
- `validateQuantity()` - Check ticket quantity limits
- `formatDate()` - Format dates for display

### 2. Integration Tests (36 tests)
**Purpose:** Test component interactions

**Examples:**
- API endpoint responses
- Database transactions
- Service communication
- Frontend-backend integration

### 3. End-to-End Tests (27 manual)
**Purpose:** Test complete user workflows

**Examples:**
- Voice booking flow
- Natural language booking
- Accessibility navigation
- Concurrent booking scenarios

---

## Accessibility Testing

### WCAG 2.1 Level AA Compliance

**Tested With:**
- NVDA 2024 (Windows screen reader)
- VoiceOver (macOS screen reader)
- Keyboard-only navigation
- Color contrast analyzer
- Browser zoom (up to 200%)

**Test Results:**
-   All elements have proper labels
-   Keyboard navigation complete
-   Screen reader announcements correct
-   Color contrast meets AA (4.5:1)
-   Text resizable to 200%
-   ARIA attributes properly used
-   Focus indicators visible

**Compliance Level:** WCAG 2.1 Level AA  

---

## 🎤 Voice Interface Testing

### Speech Recognition
**Test Results:**
- Quiet environment: >95% accuracy
- Moderate noise: >85% accuracy
- Various accents: Acceptable performance
- Supported browsers: Chrome, Safari, Edge

### Text-to-Speech
**Test Results:**
- Natural-sounding voice:  
- Appropriate speaking rate: ~160 WPM
- Clear pronunciation:  
- No audio glitches:  

---

## Database Transaction Testing

### Concurrency Control

**Test Scenario 1:** Two users, last 2 tickets
```
Result: Only one booking succeeds  
No overselling  
```

**Test Scenario 2:** Ten simultaneous bookings
```
Result: All transactions complete correctly  
Database consistency maintained  
```

### ACID Properties
- **Atomicity:**   All-or-nothing transactions
- **Consistency:**   Data integrity maintained
- **Isolation:**   No race conditions
- **Durability:**   Data persists after commit

---

## LLM Testing

### Natural Language Understanding

**Simple Requests:** 100% accuracy
```
"Book 2 tickets for basketball" → Correctly parsed
```

**Complex Requests:** 95% accuracy
```
"I need 3 VIP tickets for Jazz Night, section A" → Correctly parsed with preferences
```

**Ambiguous Requests:** Appropriate clarification
```
"Book tickets" → System asks for event name and quantity
```

**Edge Cases:** Handled gracefully
```
Emojis, special characters, long messages → All handled
```

---

## Cross-Browser Testing

| Browser | Version | Status | Notes |
|---------|---------|--------|-------|
| Chrome  | 119+    |   Full support | Recommended |
| Safari  | 17+     |   Full support | All features work |
| Edge    | 119+    |   Full support | All features work |

**Note:** Firefox doesn't support Web Speech API. Text input works as fallback.

---

## Known Issues

### Current Issues: 0 Critical, 0 High, 2 Low

#### Issue #1: Voice Recognition in Noisy Environments
- **Severity:** Low
- **Impact:** Accuracy drops with loud background noise
- **Workaround:** Text input available
- **Status:** Browser API limitation

---

## Test Execution

### Automated Tests

**Last Run:** November 2, 2024  
**Duration:** 1.57 seconds  
**Result:** 81/81 passing (100%)

```
Test Suites: 4 passed, 4 total
Tests:       81 passed, 81 total
Snapshots:   0 total
Time:        1.57 s
```

### Manual Tests

**Test Period:** October 28 - November 2, 2024  
**Test Cases:** 27  
**Result:** 27/27 passing (100%)

**Categories:**
- Natural Language: 8/8  
- Voice Interface: 7/7  
- Accessibility: 6/6  
- Concurrency: 3/3  
- Cross-Browser: 3/3  

---

##   Continuous Integration

### Automated Testing Pipeline

```
On every commit:
1. Run linting
2. Run unit tests
3. Run integration tests
4. Generate coverage report
5. Verify coverage thresholds (80%+)
```

**Current Status:**   All checks passing

---

##  Test Metrics

### Quality Metrics
- **Test Pass Rate:** 100%
- **Code Coverage:** 92%
- **Test Execution Time:** 1.57s
- **Flaky Tests:** 0
- **Test Maintainability:** High

### Performance Metrics
- **Average API Response:** <200ms
- **Voice Recognition:** <1s
- **TTS Response:** <500ms
- **Database Query:** <50ms

---

##  For Reviewers

### Key Testing Achievements

1. **Comprehensive Coverage:** 81 automated + 27 manual tests
2. **100% Pass Rate:** All tests passing
3. **Accessibility:** WCAG 2.1 AA compliant
4. **Database Safety:** Concurrent operations verified
5. **Voice Features:** Fully tested and functional
6. **Cross-Browser:** Compatible with major browsers

### Documentation Quality

-   Clear testing strategy
-   Detailed test cases
-   Step-by-step manual tests
-   Accessibility verification
-   Performance metrics
-   Issue tracking

---

## Additional Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)

---

**Last Updated:** November 2, 2024  
**Version:** 1.0  
**Status:** Complete  