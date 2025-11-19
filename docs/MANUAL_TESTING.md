# Manual Testing Report

**Project:** TigerTix  
**Date:** November 19, 2025

---

## Test Scenarios

Manual testing focused on real-world user interactions that are difficult to automate, including natural language processing, voice interface, accessibility navigation, and concurrent user behavior.

---

### 1. Natural Language Booking with Confirmation

**Test Case:** User books tickets using natural language and must confirm before purchase

**Steps:**
1. User enters: "I want 2 tickets for Auburn vs Alabama"
2. System finds matching event: "Auburn vs Alabama - Nov 30, 2025"
3. System displays confirmation: "2 tickets × $80.00 = $160.00. Confirm?"
4. User clicks "Confirm"
5. System creates booking

**Expected Result:** System requires explicit confirmation before charging user  
**Actual Result:** PASS - Confirmation prompt displayed, booking created only after approval

**Screenshot:** LLM confirmation prompt showing event details, price calculation, and "Confirm" button

---

### 2. Voice Input/Output Interaction

**Test Case:** User books tickets using voice interface

**Steps:**
1. User clicks microphone icon
2. System starts listening (visual indicator)
3. User says: "Book 3 tickets for graduation ceremony"
4. System transcribes: "book 3 tickets for graduation ceremony"
5. System displays results and confirmation prompt
6. User confirms via voice: "Yes, confirm"

**Expected Result:** Voice input is accurately transcribed and processed  
**Actual Result:** PASS - Speech recognition working, transcription accurate, confirmation required

**Notes:**
- Tested with Chrome Web Speech API
- Works best in quiet environment
- Fallback to text input available

---

### 3. Accessibility Navigation

**Test Case:** Keyboard-only navigation and screen reader compatibility

**Steps:**
1. **Tab Navigation:** Press Tab to navigate through events, forms, buttons
2. **Arrow Keys:** Use arrow keys to navigate menu items
3. **Enter Key:** Activate voice input with Enter
4. **Screen Reader:** Test with VoiceOver (macOS)

**Expected Result:** All interactive elements are keyboard-accessible with clear focus indicators  
**Actual Result:** PASS

| Element | Keyboard | Focus Indicator | ARIA Label | Screen Reader |
|---------|----------|----------------|------------|---------------|
| Event list | Tab | Blue outline | Present | Announces |
| Booking form | Tab | Blue outline | Present | Announces |
| Voice button | Enter | Blue outline | "Activate voice input" | Announces |
| Menu items | Arrow keys | Blue outline | Present | Announces |

**Screenshot:** Keyboard focus on voice input button showing visible blue focus ring

---

### 4. Concurrent Booking Attempts

**Test Case:** Multiple users attempt to book last remaining tickets simultaneously

**Setup:**
- Event: "Spring Concert" with 5 tickets available
- User A attempts to book 3 tickets
- User B attempts to book 4 tickets (at same time)

**Steps:**
1. Open two browser windows (User A and User B)
2. Both users navigate to "Spring Concert"
3. User A enters 3 tickets, clicks "Book Now"
4. User B enters 4 tickets, clicks "Book Now" (within 1 second)
5. Observe results

**Expected Result:** Database prevents overbooking (one user succeeds, other gets error)  
**Actual Result:** PASS

| User | Tickets Requested | Result | Final Availability |
|------|-------------------|--------|-------------------|
| User A | 3 | Success | 2 remaining |
| User B | 4 | Error: "Not enough tickets available" | 2 remaining |

**Database Integrity:** Total tickets remain consistent (5 → 3 booked → 2 available)

---

### 5. Authentication Flow Testing

#### Test 5A: Wrong Credentials

**Steps:**
1. Navigate to login page
2. Enter email: "user@example.com"
3. Enter wrong password: "wrongpassword"
4. Click "Login"

**Expected Result:** Display "Invalid credentials" error  
**Actual Result:** PASS - Error message displayed, no login

---

#### Test 5B: Expired Token

**Steps:**
1. User logs in successfully
2. Wait 31 minutes (token expires after 30 minutes)
3. Attempt to access protected route (e.g., "My Bookings")

**Expected Result:** Redirect to login page with "Session expired" message  
**Actual Result:** PASS - User redirected, must re-authenticate

**Token Expiration:** Verified JWT expiration set to 30 minutes (`expiresIn: '30m'`)

---

#### Test 5C: Logout Behavior

**Steps:**
1. User logs in successfully
2. Navigate to protected page
3. Click "Logout"
4. Attempt to access protected page

**Expected Result:** Cookie cleared, redirect to login page  
**Actual Result:** PASS

**Cookie Verification:**
- Before logout: `token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- After logout: Cookie deleted (verified in DevTools)
- Protected route access: Redirect to login

---

#### Test 5D: Registration with Weak Password

**Steps:**
1. Navigate to registration page
2. Enter email: "newuser@auburn.edu"
3. Enter password: "12345" (too short)
4. Click "Register"

**Expected Result:** Error: "Password must be at least 6 characters"  
**Actual Result:** PASS - Validation error displayed

---

#### Test 5E: Duplicate Email Registration

**Steps:**
1. Register user: "test@auburn.edu" / "password123"
2. Attempt to register again with same email
3. Observe error

**Expected Result:** Error: "Email already registered"  
**Actual Result:** PASS - 409 Conflict response, clear error message

---

## Summary

| Test Scenario | Result | Issues Found |
|---------------|--------|--------------|
| Natural Language + Confirmation | PASS | None |
| Voice Input/Output | PASS | Works best in quiet environment |
| Accessibility Navigation | PASS | None |
| Concurrent Bookings | PASS | None |
| Wrong Credentials | PASS | None |
| Expired Token | PASS | None |
| Logout Behavior | PASS | None |
| Weak Password | PASS | None |
| Duplicate Email | PASS | None |

**Total Tests:** 9  
**Passed:** 9 (100%)  
**Failed:** 0

**All Requirements Met:**
- Natural language booking with confirmation
- Voice interface interaction
- Accessibility (keyboard + screen reader)
- Concurrent booking consistency
- Authentication edge cases (wrong password, expired token, logout)
