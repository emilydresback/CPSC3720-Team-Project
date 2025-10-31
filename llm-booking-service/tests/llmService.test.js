// llm-booking-service/tests/llmService.test.js
const request = require('supertest');
const express = require('express');

// Mock LLM responses for testing
const mockLLMResponses = {
  simple: {
    intent: 'book_tickets',
    eventType: 'basketball',
    quantity: 2,
    date: 'tomorrow',
    confidence: 0.95
  },
  complex: {
    intent: 'book_tickets',
    eventType: 'football',
    quantity: 4,
    date: 'this Saturday',
    seatPreference: 'cheapest',
    confidence: 0.88
  },
  ambiguous: {
    intent: 'book_tickets',
    eventType: 'game',
    quantity: null,
    date: null,
    needsClarification: true,
    missingInfo: ['specific event', 'date', 'quantity'],
    confidence: 0.45
  }
};

let app;

beforeAll(() => {
  app = express();
  app.use(express.json());
  
  app.post('/api/llm/parse', parseNaturalLanguage);
  app.post('/api/llm/propose', generateBookingProposal);
  app.post('/api/llm/confirm', confirmBooking);
  app.post('/api/llm/chat', handleChatMessage);
});

// Mock LLM service functions
function parseNaturalLanguage(req, res) {
  const { message } = req.body;
  
  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  const lowerMessage = message.toLowerCase();
  
  // Detect booking intent
  if (lowerMessage.includes('book') || lowerMessage.includes('tickets') || 
      lowerMessage.includes('want') || lowerMessage.includes('buy')) {
    
    // Extract quantity
    const quantityMatch = message.match(/(\d+)\s+ticket/i);
    const quantity = quantityMatch ? parseInt(quantityMatch[1]) : null;
    
    // Extract event type
    let eventType = null;
    if (lowerMessage.includes('basketball')) eventType = 'basketball';
    else if (lowerMessage.includes('football')) eventType = 'football';
    else if (lowerMessage.includes('soccer')) eventType = 'soccer';
    else if (lowerMessage.includes('game')) eventType = 'game';
    
    // Extract date
    let date = null;
    if (lowerMessage.includes('tomorrow')) date = 'tomorrow';
    else if (lowerMessage.includes('today')) date = 'today';
    else if (lowerMessage.includes('saturday')) date = 'this Saturday';
    else if (lowerMessage.includes('friday')) date = 'this Friday';
    
    // Extract seat preference
    let seatPreference = null;
    if (lowerMessage.includes('cheap')) seatPreference = 'cheapest';
    else if (lowerMessage.includes('front')) seatPreference = 'front';
    else if (lowerMessage.includes('best')) seatPreference = 'best';
    
    // Determine if clarification needed
    const needsClarification = !eventType || !quantity || !date;
    const missingInfo = [];
    if (!eventType || eventType === 'game') missingInfo.push('specific event type');
    if (!quantity) missingInfo.push('number of tickets');
    if (!date) missingInfo.push('event date');
    
    const confidence = needsClarification ? 0.5 : 0.9;
    
    return res.json({
      intent: 'book_tickets',
      eventType,
      quantity,
      date,
      seatPreference,
      needsClarification,
      missingInfo: needsClarification ? missingInfo : [],
      confidence,
      originalMessage: message
    });
  }
  
  // Other intents
  return res.json({
    intent: 'unknown',
    confidence: 0.1,
    needsClarification: true,
    message: 'I could not understand your request'
  });
}

function generateBookingProposal(req, res) {
  const { parsedIntent, availableEvents } = req.body;
  
  if (!parsedIntent || !availableEvents) {
    return res.status(400).json({ error: 'Invalid request data' });
  }
  
  if (parsedIntent.needsClarification) {
    return res.status(400).json({
      error: 'Cannot generate proposal',
      reason: 'Missing required information',
      missingInfo: parsedIntent.missingInfo,
      clarificationPrompt: `I need more information. Please specify: ${parsedIntent.missingInfo.join(', ')}`
    });
  }
  
  // Find matching event
  const matchingEvent = availableEvents.find(event => 
    event.name.toLowerCase().includes(parsedIntent.eventType) ||
    event.description.toLowerCase().includes(parsedIntent.eventType)
  );
  
  if (!matchingEvent) {
    return res.status(404).json({
      error: 'No matching event found',
      searchedFor: parsedIntent.eventType
    });
  }
  
  if (matchingEvent.availableTickets < parsedIntent.quantity) {
    return res.status(400).json({
      error: 'Not enough tickets available',
      requested: parsedIntent.quantity,
      available: matchingEvent.availableTickets
    });
  }
  
  const totalPrice = matchingEvent.price * parsedIntent.quantity;
  
  const proposal = {
    proposalId: `PROP-${Date.now()}`,
    event: {
      id: matchingEvent.id,
      name: matchingEvent.name,
      date: matchingEvent.date,
      location: matchingEvent.location
    },
    quantity: parsedIntent.quantity,
    pricePerTicket: matchingEvent.price,
    totalPrice,
    seatPreference: parsedIntent.seatPreference,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
    summary: `Booking ${parsedIntent.quantity} ticket(s) for ${matchingEvent.name} on ${matchingEvent.date} at ${matchingEvent.location}. Total: $${totalPrice.toFixed(2)}`
  };
  
  return res.json(proposal);
}

function confirmBooking(req, res) {
  const { proposalId, userId } = req.body;
  
  if (!proposalId || !userId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // In real implementation, verify proposal hasn't expired
  // and create actual booking
  
  const booking = {
    bookingId: `BOOK-${Date.now()}`,
    proposalId,
    userId,
    status: 'confirmed',
    confirmedAt: new Date().toISOString(),
    message: 'Your booking has been confirmed successfully!'
  };
  
  return res.status(201).json(booking);
}

function handleChatMessage(req, res) {
  const { message, context } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  const lowerMessage = message.toLowerCase();
  
  // Handle greetings
  if (lowerMessage.match(/^(hi|hello|hey)/)) {
    return res.json({
      response: "Hello! I'm your TigerTix booking assistant. How can I help you book tickets today?",
      suggestions: [
        "Show me upcoming events",
        "I want to book tickets",
        "What events are available?"
      ]
    });
  }
  
  // Handle help requests
  if (lowerMessage.includes('help')) {
    return res.json({
      response: "I can help you book tickets! Just tell me what event you'd like to attend, how many tickets you need, and when you'd like to go.",
      examples: [
        "Book 2 tickets for basketball game tomorrow",
        "I want 4 tickets for the football game this Saturday",
        "Get me tickets for the soccer match"
      ]
    });
  }
  
  // Default response
  return res.json({
    response: "I'm here to help with ticket bookings. What would you like to do?",
    suggestions: ["Book tickets", "View events", "Cancel booking"]
  });
}

// TEST SUITES
describe('LLM Booking Service', () => {
  
  describe('POST /api/llm/parse - Parse Natural Language', () => {
    
    test('should extract booking intent from simple request', async () => {
      const message = "I want 2 tickets for the basketball game tomorrow";
      
      const response = await request(app)
        .post('/api/llm/parse')
        .send({ message })
        .expect(200);
      
      expect(response.body.intent).toBe('book_tickets');
      expect(response.body.quantity).toBe(2);
      expect(response.body.eventType).toBe('basketball');
      expect(response.body.date).toBe('tomorrow');
      expect(response.body.needsClarification).toBe(false);
      expect(response.body.confidence).toBeGreaterThan(0.8);
    });
    
    test('should extract complex booking request with seat preference', async () => {
      const message = "Book 4 tickets for the cheapest seats at the football game this Saturday";
      
      const response = await request(app)
        .post('/api/llm/parse')
        .send({ message })
        .expect(200);
      
      expect(response.body.intent).toBe('book_tickets');
      expect(response.body.quantity).toBe(4);
      expect(response.body.eventType).toBe('football');
      expect(response.body.date).toBe('this Saturday');
      expect(response.body.seatPreference).toBe('cheapest');
      expect(response.body.needsClarification).toBe(false);
    });
    
    test('should request clarification for ambiguous request', async () => {
      const message = "I want to book some tickets";
      
      const response = await request(app)
        .post('/api/llm/parse')
        .send({ message })
        .expect(200);
      
      expect(response.body.intent).toBe('book_tickets');
      expect(response.body.needsClarification).toBe(true);
      expect(response.body.missingInfo).toContain('specific event type');
      expect(response.body.missingInfo).toContain('number of tickets');
      expect(response.body.missingInfo).toContain('event date');
    });
    
    test('should handle vague event reference', async () => {
      const message = "Book tickets for the game";
      
      const response = await request(app)
        .post('/api/llm/parse')
        .send({ message })
        .expect(200);
      
      expect(response.body.eventType).toBe('game');
      expect(response.body.needsClarification).toBe(true);
    });
    
    test('should reject empty message', async () => {
      const response = await request(app)
        .post('/api/llm/parse')
        .send({ message: '' })
        .expect(400);
      
      expect(response.body.error).toContain('required');
    });
    
    test('should handle various date formats', async () => {
      const testCases = [
        { message: "2 tickets for basketball tomorrow", expectedDate: "tomorrow" },
        { message: "2 tickets for basketball today", expectedDate: "today" },
        { message: "2 tickets for basketball Friday", expectedDate: "this Friday" }
      ];
      
      for (const testCase of testCases) {
        const response = await request(app)
          .post('/api/llm/parse')
          .send({ message: testCase.message })
          .expect(200);
        
        expect(response.body.date).toBe(testCase.expectedDate);
      }
    });
    
    test('should extract different quantities', async () => {
      const testCases = [1, 2, 5, 10, 100];
      
      for (const quantity of testCases) {
        const message = `I need ${quantity} tickets for basketball tomorrow`;
        
        const response = await request(app)
          .post('/api/llm/parse')
          .send({ message })
          .expect(200);
        
        expect(response.body.quantity).toBe(quantity);
      }
    });
    
    test('should identify different event types', async () => {
      const eventTypes = ['basketball', 'football', 'soccer'];
      
      for (const eventType of eventTypes) {
        const message = `Book 2 tickets for ${eventType} tomorrow`;
        
        const response = await request(app)
          .post('/api/llm/parse')
          .send({ message })
          .expect(200);
        
        expect(response.body.eventType).toBe(eventType);
      }
    });
    
    test('should handle case-insensitive input', async () => {
      const variations = [
        "BOOK 2 TICKETS FOR BASKETBALL",
        "book 2 tickets for basketball",
        "BoOk 2 TiCkEtS fOr BaSkEtBaLl"
      ];
      
      for (const message of variations) {
        const response = await request(app)
          .post('/api/llm/parse')
          .send({ message })
          .expect(200);
        
        expect(response.body.intent).toBe('book_tickets');
        expect(response.body.eventType).toBe('basketball');
      }
    });
  });
  
  describe('POST /api/llm/propose - Generate Booking Proposal', () => {
    
    const mockEvents = [
      {
        id: 1,
        name: 'Basketball Game - Clemson vs Duke',
        date: '2025-11-15',
        location: 'Littlejohn Coliseum',
        description: 'Exciting basketball matchup',
        availableTickets: 100,
        price: 25.00
      },
      {
        id: 2,
        name: 'Football Game - Clemson vs USC',
        date: '2025-11-20',
        location: 'Memorial Stadium',
        description: 'Rivalry football game',
        availableTickets: 500,
        price: 50.00
      }
    ];
    
    test('should generate valid booking proposal', async () => {
      const parsedIntent = {
        intent: 'book_tickets',
        eventType: 'basketball',
        quantity: 2,
        date: 'tomorrow',
        needsClarification: false
      };
      
      const response = await request(app)
        .post('/api/llm/propose')
        .send({ parsedIntent, availableEvents: mockEvents })
        .expect(200);
      
      expect(response.body).toHaveProperty('proposalId');
      expect(response.body.event.name).toContain('Basketball');
      expect(response.body.quantity).toBe(2);
      expect(response.body.totalPrice).toBe(50.00);
      expect(response.body).toHaveProperty('expiresAt');
      expect(response.body).toHaveProperty('summary');
    });
    
    test('should reject proposal when clarification needed', async () => {
      const parsedIntent = {
        intent: 'book_tickets',
        needsClarification: true,
        missingInfo: ['event type', 'quantity']
      };
      
      const response = await request(app)
        .post('/api/llm/propose')
        .send({ parsedIntent, availableEvents: mockEvents })
        .expect(400);
      
      expect(response.body.error).toContain('Cannot generate proposal');
      expect(response.body.missingInfo).toBeDefined();
      expect(response.body).toHaveProperty('clarificationPrompt');
    });
    
    test('should return error when no matching event found', async () => {
      const parsedIntent = {
        intent: 'book_tickets',
        eventType: 'hockey',
        quantity: 2,
        date: 'tomorrow',
        needsClarification: false
      };
      
      const response = await request(app)
        .post('/api/llm/propose')
        .send({ parsedIntent, availableEvents: mockEvents })
        .expect(404);
      
      expect(response.body.error).toContain('No matching event');
      expect(response.body.searchedFor).toBe('hockey');
    });
    
    test('should handle insufficient ticket availability', async () => {
      const parsedIntent = {
        intent: 'book_tickets',
        eventType: 'basketball',
        quantity: 150, // More than available (100)
        date: 'tomorrow',
        needsClarification: false
      };
      
      const response = await request(app)
        .post('/api/llm/propose')
        .send({ parsedIntent, availableEvents: mockEvents })
        .expect(400);
      
      expect(response.body.error).toContain('Not enough tickets');
      expect(response.body.requested).toBe(150);
      expect(response.body.available).toBe(100);
    });
    
    test('should calculate total price correctly', async () => {
      const testCases = [
        { quantity: 1, expectedTotal: 25.00 },
        { quantity: 5, expectedTotal: 125.00 },
        { quantity: 10, expectedTotal: 250.00 }
      ];
      
      for (const testCase of testCases) {
        const parsedIntent = {
          intent: 'book_tickets',
          eventType: 'basketball',
          quantity: testCase.quantity,
          date: 'tomorrow',
          needsClarification: false
        };
        
        const response = await request(app)
          .post('/api/llm/propose')
          .send({ parsedIntent, availableEvents: mockEvents })
          .expect(200);
        
        expect(response.body.totalPrice).toBe(testCase.expectedTotal);
      }
    });
    
    test('should include seat preference in proposal', async () => {
      const parsedIntent = {
        intent: 'book_tickets',
        eventType: 'basketball',
        quantity: 2,
        date: 'tomorrow',
        seatPreference: 'cheapest',
        needsClarification: false
      };
      
      const response = await request(app)
        .post('/api/llm/propose')
        .send({ parsedIntent, availableEvents: mockEvents })
        .expect(200);
      
      expect(response.body.seatPreference).toBe('cheapest');
    });
    
    test('should set proposal expiration time', async () => {
      const parsedIntent = {
        intent: 'book_tickets',
        eventType: 'basketball',
        quantity: 2,
        date: 'tomorrow',
        needsClarification: false
      };
      
      const beforeTime = Date.now();
      
      const response = await request(app)
        .post('/api/llm/propose')
        .send({ parsedIntent, availableEvents: mockEvents })
        .expect(200);
      
      const expiresAt = new Date(response.body.expiresAt).getTime();
      const expectedExpiry = beforeTime + 10 * 60 * 1000; // 10 minutes
      
      // Allow 1 second tolerance
      expect(expiresAt).toBeGreaterThan(expectedExpiry - 1000);
      expect(expiresAt).toBeLessThan(expectedExpiry + 1000);
    });
  });
  
  describe('POST /api/llm/confirm - Confirm Booking', () => {
    
    test('should confirm valid booking', async () => {
      const proposalId = 'PROP-123456';
      const userId = 1;
      
      const response = await request(app)
        .post('/api/llm/confirm')
        .send({ proposalId, userId })
        .expect(201);
      
      expect(response.body).toHaveProperty('bookingId');
      expect(response.body.proposalId).toBe(proposalId);
      expect(response.body.userId).toBe(userId);
      expect(response.body.status).toBe('confirmed');
      expect(response.body).toHaveProperty('confirmedAt');
      expect(response.body.message).toContain('confirmed');
    });
    
    test('should reject confirmation with missing proposalId', async () => {
      const response = await request(app)
        .post('/api/llm/confirm')
        .send({ userId: 1 })
        .expect(400);
      
      expect(response.body.error).toContain('required');
    });
    
    test('should reject confirmation with missing userId', async () => {
      const response = await request(app)
        .post('/api/llm/confirm')
        .send({ proposalId: 'PROP-123' })
        .expect(400);
      
      expect(response.body.error).toContain('required');
    });
  });
  
  describe('POST /api/llm/chat - Handle Chat Messages', () => {
    
    test('should respond to greeting', async () => {
      const greetings = ['hi', 'hello', 'hey'];
      
      for (const greeting of greetings) {
        const response = await request(app)
          .post('/api/llm/chat')
          .send({ message: greeting })
          .expect(200);
        
        expect(response.body.response).toContain('Hello');
        expect(response.body.suggestions).toBeDefined();
        expect(Array.isArray(response.body.suggestions)).toBe(true);
      }
    });
    
    test('should provide help when requested', async () => {
      const response = await request(app)
        .post('/api/llm/chat')
        .send({ message: 'I need help' })
        .expect(200);
      
      expect(response.body.response).toContain('help');
      expect(response.body.examples).toBeDefined();
      expect(Array.isArray(response.body.examples)).toBe(true);
    });
    
    test('should provide default response for unknown messages', async () => {
      const response = await request(app)
        .post('/api/llm/chat')
        .send({ message: 'random message' })
        .expect(200);
      
      expect(response.body.response).toBeDefined();
      expect(response.body.suggestions).toBeDefined();
    });
    
    test('should reject empty message', async () => {
      const response = await request(app)
        .post('/api/llm/chat')
        .send({ message: '' })
        .expect(400);
      
      expect(response.body.error).toContain('required');
    });
  });
  
  describe('Edge Cases and Error Handling', () => {
    
    test('should handle special characters in messages', async () => {
      const message = "Book 2 tickets for <script>alert('xss')</script> basketball";
      
      const response = await request(app)
        .post('/api/llm/parse')
        .send({ message })
        .expect(200);
      
      expect(response.body.originalMessage).toBe(message);
      expect(response.body.intent).toBe('book_tickets');
    });
    
    test('should handle very long messages', async () => {
      const longMessage = 'Book tickets for basketball '.repeat(100);
      
      const response = await request(app)
        .post('/api/llm/parse')
        .send({ message: longMessage })
        .expect(200);
      
      expect(response.body.intent).toBe('book_tickets');
    });
    
    test('should handle messages with emojis', async () => {
      const message = "Book 2 tickets for basketball 🏀 tomorrow 🎉";
      
      const response = await request(app)
        .post('/api/llm/parse')
        .send({ message })
        .expect(200);
      
      expect(response.body.intent).toBe('book_tickets');
      expect(response.body.quantity).toBe(2);
    });
  });
});