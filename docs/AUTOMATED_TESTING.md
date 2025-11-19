# Automated Testing Report

**Project:** TigerTix  
**Team:** Anna Galeano, Emily Dresback, Bogumila Ndubuisi  
**Date:** November 19, 2025

---

## Test Results

```
Test Suites: 8 passed, 8 total
Tests:       138 passed, 138 totalck
Time:        2.7 seconds
```

**Pass Rate:** 100% (138/138)

---

## A. Testing Strategy

### Unit Tests
- Individual functions: JWT generation, password hashing, price calculation, intent parsing
- Components: Event cards, booking forms, voice interface, login/register forms

### Integration Tests
- Microservice communication: Admin↔Client, LLM↔Client
- Database operations: Transactions, concurrent bookings
- Service workflows: Event creation → booking flow

### End-to-End Tests
- Complete user flows: Registration → login → booking → logout
- Multi-user scenarios: Concurrent bookings, sold-out handling

---

## B. Automated Test Coverage

### Tools Used (All Free)
- **Backend:** Jest 29.7.0, Supertest 6.3.3, SQLite (in-memory)
- **Frontend:** React Testing Library 14.1.2, Jest, jsdom

### Test Breakdown

#### 1. Authentication (24 tests - 100%)
**File:** `backend/user-authentication/tests/auth.test.js`

| Category | Tests | Coverage |
|----------|-------|----------|
| Registration | 7 | Email validation, password strength, duplicates |
| Login | 6 | Valid/invalid credentials, generic errors |
| JWT Tokens | 8 | Header/cookie validation, expiration, protected routes |
| Complete Flow | 3 | Register→login→access→logout |

**Key Tests:**
```javascript
✓ Register with valid credentials
✓ Return 409 when email already exists
✓ Hash password before storing (bcrypt)
✓ Login with valid credentials
✓ Return 401 for incorrect password
✓ Access protected route with valid token in header
✓ Access protected route with valid token in cookie
✓ Return 401 with expired token
✓ Complete authentication flow
```

#### 2. Admin Service (15 tests - 100%)
**File:** `admin-service/tests/eventController.test.js`

```javascript
✓ Create event with valid data
✓ Reject event with missing fields
✓ Get all events
✓ Get event by ID
✓ Update event successfully
✓ Delete event successfully
✓ Sanitize SQL injection attempts
✓ Handle special characters
```

#### 3. Client Service (14 tests - 100%)
**File:** `client-service/tests/bookingController.test.js`

```javascript
✓ Create booking with available tickets
✓ Prevent overbooking
✓ Reject booking for non-existent event
✓ Update available tickets after booking
✓ Cancel booking successfully
✓ Restore tickets after cancellation
✓ Handle concurrent bookings correctly
✓ Calculate total price correctly
```

#### 4. LLM Service (27 tests - 100%)
**File:** `llm-booking-service/tests/llmService.test.js`

**Natural Language Processing:**
```javascript
✓ Extract booking intent from simple request
✓ Extract complex booking with preferences
✓ Request clarification for ambiguous input
✓ Handle various date formats
✓ Identify different event types
✓ Handle case-insensitive input
```

**Confirmation Workflow:**
```javascript
✓ Generate valid booking proposal
✓ Require confirmation before booking
✓ Confirm valid booking
✓ Reject confirmation with missing data
```

#### 5. Integration Tests (6 tests - 100%)
**File:** `tests/microservices-integration.test.js`

```javascript
✓ Create event in admin and book it in client
✓ Prevent booking when event is deleted
✓ Update event price and reflect in new bookings
✓ Parse natural language and create booking
✓ Handle ambiguous requests with clarification
✓ Complete workflow: admin→LLM→booking
```

#### 6. End-to-End Tests (9 tests - 100%)
**File:** `tests/end-to-end.test.js`

```javascript
✓ New user registers→books tickets→views bookings
✓ User registers→logs out→logs back in
✓ Cannot access protected routes without auth
✓ User uses natural language to book tickets
✓ LLM requires confirmation before booking
✓ User books→cancels→tickets restored
✓ Multiple users can book same event
✓ Handles booking when event is sold out
```

#### 7. Frontend Components (26 tests - 100%)
**File:** `frontend/src/__tests__/components.test.js`

```javascript
✓ Render event information correctly
✓ Display ticket availability
✓ Show sold out state
✓ Handle booking button click
✓ Submit valid booking
✓ Display transcription (voice interface)
✓ Handle text input (natural language)
✓ Clear input after submission
```

#### 8. Accessibility (18 tests - 100%)
**File:** `frontend/src/__tests__/accessibility.test.js`

```javascript
✓ Event list has proper ARIA labels
✓ Booking form has ARIA attributes
✓ Buttons have descriptive aria-labels
✓ Voice interface has ARIA live regions
✓ Navigate through events with Tab key
✓ Keyboard-navigable menu with arrow keys
✓ Activate voice input with keyboard
✓ Focus indicators are visible
✓ Headings create proper document structure
✓ Voice button has clear accessible name
```

---

## Test Execution

```bash
# Run all tests
npm test

# Run specific suites
npm run test:auth          # 24 tests
npm run test:admin         # 15 tests
npm run test:client        # 14 tests
npm run test:llm           # 27 tests
npm run test:integration   # 6 tests
npm run test:e2e           # 9 tests
npm run test:frontend      # 26 tests
npm run test:accessibility # 18 tests
```

---

## Coverage Summary

|    Component    | Tests | Pass Rate |
|-----------------|-------|-----------|
| Authentication  |   24  |      100% |
| Admin Service   |   15  |      100% |
| Client Service  |   14  |      100% |
| LLM Service     |   27  |      100% |
| Integration     |    6  |      100% |
| End-to-End      |    9  |      100% |
| Frontend        |   26  |      100% |
| Accessibility   |   18  |      100% |
| **TOTAL** | **138** | **100%** |

**Features Covered:**
- Admin and Client microservices
- LLM-driven ticket booking
- Voice-enabled interface
- Accessibility features
- User authentication (registration, login, logout, tokens)
- Database transactions and concurrency

**Execution Time:** 2.7 seconds for all 138 tests
