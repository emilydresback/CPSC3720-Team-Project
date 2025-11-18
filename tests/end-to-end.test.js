// tests/end-to-end.test.js
/**
 * End-to-End Tests
 * Tests complete user workflows from frontend through backend
 */

const request = require('supertest');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const testDbPath = path.join(__dirname, 'test-e2e.db');
const JWT_SECRET = 'test-secret';
let db;
let app;

// Setup complete application
beforeAll((done) => {
  db = new sqlite3.Database(testDbPath);
  
  db.serialize(() => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Events table
    db.run(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        location TEXT NOT NULL,
        totalTickets INTEGER NOT NULL,
        availableTickets INTEGER NOT NULL,
        price REAL NOT NULL,
        description TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Bookings table
    db.run(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        eventId INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        totalPrice REAL NOT NULL,
        bookingDate TEXT DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'confirmed',
        source TEXT DEFAULT 'manual',
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (eventId) REFERENCES events(id)
      )
    `, done);
  });
  
  setupApp();
});

afterAll((done) => {
  db.close(() => {
    const fs = require('fs');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    done();
  });
});

beforeEach((done) => {
  db.serialize(() => {
    db.run('DELETE FROM bookings');
    db.run('DELETE FROM events');
    db.run('DELETE FROM users', done);
  });
});

function setupApp() {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  
  // Auth middleware
  const authenticateToken = (req, res, next) => {
    let token = req.cookies?.auth_token;
    
    if (!token && req.headers.authorization) {
      const [scheme, value] = req.headers.authorization.split(' ');
      if (scheme === 'Bearer') token = value;
    }
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, payload) => {
      if (err) return res.status(401).json({ error: 'Invalid token' });
      req.user = { id: payload.sub, email: payload.email };
      next();
    });
  };
  
  // Auth routes
  app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    db.run(
      'INSERT INTO users (email, passwordHash) VALUES (?, ?)',
      [email, passwordHash],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Email already exists' });
          }
          return res.status(500).json({ error: 'Database error' });
        }
        
        const token = jwt.sign({ sub: this.lastID, email }, JWT_SECRET, { expiresIn: '30m' });
        
        res.cookie('auth_token', token, { httpOnly: true });
        res.status(201).json({
          user: { id: this.lastID, email },
          token
        });
      }
    );
  });
  
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });
      
      const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30m' });
      
      res.cookie('auth_token', token, { httpOnly: true });
      res.json({ user: { id: user.id, email: user.email }, token });
    });
  });
  
  app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json({ user: req.user });
  });
  
  // Admin routes (for creating events)
  app.post('/api/events', (req, res) => {
    const { name, date, location, totalTickets, price, description } = req.body;
    
    if (!name || !date || !location || !totalTickets || price === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    db.run(
      `INSERT INTO events (name, date, location, totalTickets, availableTickets, price, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, date, location, totalTickets, totalTickets, price, description || ''],
      function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.status(201).json({
          id: this.lastID,
          name,
          date,
          location,
          totalTickets,
          availableTickets: totalTickets,
          price
        });
      }
    );
  });
  
  app.get('/api/events', (req, res) => {
    db.all('SELECT * FROM events ORDER BY date', (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ events: rows });
    });
  });
  
  app.get('/api/events/:id', (req, res) => {
    db.get('SELECT * FROM events WHERE id = ?', [req.params.id], (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!row) return res.status(404).json({ error: 'Event not found' });
      res.json(row);
    });
  });
  
  // Booking routes (protected)
  app.post('/api/bookings', authenticateToken, (req, res) => {
    const { eventId, quantity } = req.body;
    const userId = req.user.id;
    
    if (!eventId || !quantity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    db.get('SELECT * FROM events WHERE id = ?', [eventId], (err, event) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!event) return res.status(404).json({ error: 'Event not found' });
      if (event.availableTickets < quantity) {
        return res.status(400).json({ error: 'Not enough tickets available' });
      }
      
      const totalPrice = event.price * quantity;
      
      db.run('BEGIN TRANSACTION');
      
      db.run(
        'UPDATE events SET availableTickets = availableTickets - ? WHERE id = ?',
        [quantity, eventId],
        (err) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Update failed' });
          }
          
          db.run(
            'INSERT INTO bookings (userId, eventId, quantity, totalPrice) VALUES (?, ?, ?, ?)',
            [userId, eventId, quantity, totalPrice],
            function(err) {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Booking failed' });
              }
              
              db.run('COMMIT');
              res.status(201).json({
                id: this.lastID,
                userId,
                eventId,
                quantity,
                totalPrice,
                status: 'confirmed'
              });
            }
          );
        }
      );
    });
  });
  
  app.get('/api/bookings', authenticateToken, (req, res) => {
    const sql = `
      SELECT b.*, e.name as eventName, e.date, e.location, e.price
      FROM bookings b
      JOIN events e ON b.eventId = e.id
      WHERE b.userId = ?
      ORDER BY b.bookingDate DESC
    `;
    
    db.all(sql, [req.user.id], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ bookings: rows });
    });
  });
  
  app.delete('/api/bookings/:id', authenticateToken, (req, res) => {
    db.get(
      'SELECT * FROM bookings WHERE id = ? AND userId = ?',
      [req.params.id, req.user.id],
      (err, booking) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!booking) return res.status(404).json({ error: 'Booking not found' });
        
        db.run('BEGIN TRANSACTION');
        
        db.run(
          'UPDATE events SET availableTickets = availableTickets + ? WHERE id = ?',
          [booking.quantity, booking.eventId]
        );
        
        db.run('DELETE FROM bookings WHERE id = ?', [req.params.id], function(err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Cancellation failed' });
          }
          
          db.run('COMMIT');
          res.json({ message: 'Booking cancelled successfully' });
        });
      }
    );
  });
  
  // LLM routes
  app.post('/api/llm/parse', (req, res) => {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }
    
    const lowerMessage = message.toLowerCase();
    
    const quantityMatch = message.match(/(\d+)\s+ticket/i);
    const quantity = quantityMatch ? parseInt(quantityMatch[1]) : null;
    
    let eventType = null;
    if (lowerMessage.includes('basketball')) eventType = 'basketball';
    else if (lowerMessage.includes('football')) eventType = 'football';
    
    let date = null;
    if (lowerMessage.includes('tomorrow')) date = 'tomorrow';
    else if (lowerMessage.includes('friday')) date = 'friday';
    
    const missingInfo = [];
    if (!eventType) missingInfo.push('event type');
    if (!quantity) missingInfo.push('quantity');
    if (!date) missingInfo.push('date');
    
    res.json({
      intent: 'book_tickets',
      eventType,
      quantity,
      date,
      needsClarification: missingInfo.length > 0,
      missingInfo
    });
  });
  
  app.post('/api/llm/book', authenticateToken, (req, res) => {
    const { eventId, quantity, confirmation } = req.body;
    
    if (!confirmation) {
      return res.status(400).json({ error: 'Confirmation required for LLM booking' });
    }
    
    // Same logic as regular booking
    const userId = req.user.id;
    
    db.get('SELECT * FROM events WHERE id = ?', [eventId], (err, event) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!event) return res.status(404).json({ error: 'Event not found' });
      if (event.availableTickets < quantity) {
        return res.status(400).json({ error: 'Not enough tickets' });
      }
      
      const totalPrice = event.price * quantity;
      
      db.run('BEGIN TRANSACTION');
      db.run('UPDATE events SET availableTickets = availableTickets - ? WHERE id = ?', [quantity, eventId]);
      db.run(
        'INSERT INTO bookings (userId, eventId, quantity, totalPrice, source) VALUES (?, ?, ?, ?, ?)',
        [userId, eventId, quantity, totalPrice, 'llm'],
        function(err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Booking failed' });
          }
          
          db.run('COMMIT');
          res.status(201).json({
            id: this.lastID,
            message: `Successfully booked ${quantity} tickets for ${event.name}`,
            booking: { id: this.lastID, eventId, quantity, totalPrice }
          });
        }
      );
    });
  });
}

describe('End-to-End User Workflows', () => {
  
  describe('Complete User Registration and Booking Flow', () => {
    
    test('new user registers -> browses events -> books tickets -> views bookings', async () => {
      // Step 1: User registers
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@clemson.edu',
          password: 'SecurePass123'
        });
      
      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.user).toHaveProperty('id');
      const token = registerResponse.body.token;
      const userId = registerResponse.body.user.id;
      
      // Step 2: Admin creates events (in real app, admin would be separate)
      const event1 = await request(app)
        .post('/api/events')
        .send({
          name: 'Basketball Game',
          date: '2025-12-15',
          location: 'Littlejohn Coliseum',
          totalTickets: 100,
          price: 25.00,
          description: 'Clemson vs Duke'
        });
      
      const event2 = await request(app)
        .post('/api/events')
        .send({
          name: 'Football Game',
          date: '2025-12-20',
          location: 'Memorial Stadium',
          totalTickets: 200,
          price: 35.00,
          description: 'Clemson vs Carolina'
        });
      
      expect(event1.status).toBe(201);
      expect(event2.status).toBe(201);
      
      // Step 3: User browses events
      const eventsResponse = await request(app)
        .get('/api/events');
      
      expect(eventsResponse.status).toBe(200);
      expect(eventsResponse.body.events).toHaveLength(2);
      
      // Step 4: User books tickets for event 1
      const bookingResponse = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          eventId: event1.body.id,
          quantity: 3
        });
      
      expect(bookingResponse.status).toBe(201);
      expect(bookingResponse.body.quantity).toBe(3);
      expect(bookingResponse.body.totalPrice).toBe(75.00);
      
      // Step 5: User views their bookings
      const myBookingsResponse = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${token}`);
      
      expect(myBookingsResponse.status).toBe(200);
      expect(myBookingsResponse.body.bookings).toHaveLength(1);
      expect(myBookingsResponse.body.bookings[0].eventName).toBe('Basketball Game');
      expect(myBookingsResponse.body.bookings[0].quantity).toBe(3);
      
      // Step 6: Verify event tickets decreased
      const updatedEvent = await request(app)
        .get(`/api/events/${event1.body.id}`);
      
      expect(updatedEvent.body.availableTickets).toBe(97);
    });
  });
  
  describe('Authentication Flow', () => {
    
    test('user registers -> logs out -> logs back in', async () => {
      // Register
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'authtest@clemson.edu',
          password: 'TestPass123'
        });
      
      expect(registerResponse.status).toBe(201);
      const token1 = registerResponse.body.token;
      
      // Verify authenticated
      const meResponse1 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token1}`);
      
      expect(meResponse1.status).toBe(200);
      expect(meResponse1.body.user.email).toBe('authtest@clemson.edu');
      
      // Login again
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'authtest@clemson.edu',
          password: 'TestPass123'
        });
      
      expect(loginResponse.status).toBe(200);
      const token2 = loginResponse.body.token;
      
      // Verify new token works
      const meResponse2 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token2}`);
      
      expect(meResponse2.status).toBe(200);
    });
    
    test('cannot access protected routes without authentication', async () => {
      // Try to create booking without auth
      const bookingResponse = await request(app)
        .post('/api/bookings')
        .send({ eventId: 1, quantity: 2 });
      
      expect(bookingResponse.status).toBe(401);
      
      // Try to view bookings without auth
      const viewResponse = await request(app)
        .get('/api/bookings');
      
      expect(viewResponse.status).toBe(401);
    });
  });
  
  describe('LLM-Driven Booking Flow', () => {
    
    test('user uses natural language to book tickets', async () => {
      // Setup: Register user and create event
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'llmuser@clemson.edu',
          password: 'LLMTest123'
        });
      
      const token = registerResponse.body.token;
      
      const eventResponse = await request(app)
        .post('/api/events')
        .send({
          name: 'Basketball Championship',
          date: '2025-12-25',
          location: 'Arena',
          totalTickets: 50,
          price: 40.00
        });
      
      const eventId = eventResponse.body.id;
      
      // Step 1: User types natural language request
      const parseResponse = await request(app)
        .post('/api/llm/parse')
        .send({
          message: 'I want 2 tickets for the basketball game tomorrow'
        });
      
      expect(parseResponse.status).toBe(200);
      expect(parseResponse.body.eventType).toBe('basketball');
      expect(parseResponse.body.quantity).toBe(2);
      
      // Step 2: User confirms booking via LLM
      const llmBookingResponse = await request(app)
        .post('/api/llm/book')
        .set('Authorization', `Bearer ${token}`)
        .send({
          eventId: eventId,
          quantity: 2,
          confirmation: true
        });
      
      expect(llmBookingResponse.status).toBe(201);
      expect(llmBookingResponse.body.message).toContain('Successfully booked');
      expect(llmBookingResponse.body.booking.quantity).toBe(2);
      
      // Step 3: Verify booking was created
      const bookingsResponse = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${token}`);
      
      expect(bookingsResponse.body.bookings).toHaveLength(1);
      expect(bookingsResponse.body.bookings[0].source).toBe('llm');
    });
    
    test('LLM requires confirmation before booking', async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({ email: 'confirm@clemson.edu', password: 'Test123' });
      
      const token = registerResponse.body.token;
      
      const eventResponse = await request(app)
        .post('/api/events')
        .send({
          name: 'Test Event',
          date: '2025-12-30',
          location: 'Venue',
          totalTickets: 30,
          price: 20.00
        });
      
      // Try to book without confirmation
      const noConfirmResponse = await request(app)
        .post('/api/llm/book')
        .set('Authorization', `Bearer ${token}`)
        .send({
          eventId: eventResponse.body.id,
          quantity: 2,
          confirmation: false
        });
      
      expect(noConfirmResponse.status).toBe(400);
      expect(noConfirmResponse.body.error).toContain('Confirmation required');
    });
  });
  
  describe('Booking Cancellation Flow', () => {
    
    test('user books tickets -> cancels booking -> tickets restored', async () => {
      // Setup
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({ email: 'cancel@clemson.edu', password: 'Cancel123' });
      
      const token = registerResponse.body.token;
      
      const eventResponse = await request(app)
        .post('/api/events')
        .send({
          name: 'Cancellable Event',
          date: '2025-12-31',
          location: 'Test Venue',
          totalTickets: 20,
          price: 15.00
        });
      
      const eventId = eventResponse.body.id;
      
      // Book tickets
      const bookingResponse = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId, quantity: 5 });
      
      expect(bookingResponse.status).toBe(201);
      const bookingId = bookingResponse.body.id;
      
      // Verify tickets decreased
      let eventCheck = await request(app).get(`/api/events/${eventId}`);
      expect(eventCheck.body.availableTickets).toBe(15);
      
      // Cancel booking
      const cancelResponse = await request(app)
        .delete(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(cancelResponse.status).toBe(200);
      
      // Verify tickets restored
      eventCheck = await request(app).get(`/api/events/${eventId}`);
      expect(eventCheck.body.availableTickets).toBe(20);
      
      // Verify booking no longer exists
      const bookingsResponse = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${token}`);
      
      expect(bookingsResponse.body.bookings).toHaveLength(0);
    });
  });
  
  describe('Multiple Users Booking Same Event', () => {
    
    test('multiple users can book tickets for same event', async () => {
      // Create event
      const eventResponse = await request(app)
        .post('/api/events')
        .send({
          name: 'Popular Event',
          date: '2026-01-01',
          location: 'Big Stadium',
          totalTickets: 100,
          price: 50.00
        });
      
      const eventId = eventResponse.body.id;
      
      // Register multiple users
      const user1Response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'user1@clemson.edu', password: 'Pass123' });
      
      const user2Response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'user2@clemson.edu', password: 'Pass123' });
      
      const user3Response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'user3@clemson.edu', password: 'Pass123' });
      
      // All users book tickets
      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user1Response.body.token}`)
        .send({ eventId, quantity: 10 });
      
      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user2Response.body.token}`)
        .send({ eventId, quantity: 15 });
      
      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user3Response.body.token}`)
        .send({ eventId, quantity: 20 });
      
      // Verify final ticket count
      const finalEvent = await request(app).get(`/api/events/${eventId}`);
      expect(finalEvent.body.availableTickets).toBe(55); // 100 - 10 - 15 - 20
      
      // Verify each user has their booking
      const user1Bookings = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${user1Response.body.token}`);
      expect(user1Bookings.body.bookings).toHaveLength(1);
      expect(user1Bookings.body.bookings[0].quantity).toBe(10);
      
      const user2Bookings = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${user2Response.body.token}`);
      expect(user2Bookings.body.bookings[0].quantity).toBe(15);
    });
  });
  
  describe('Error Handling Scenarios', () => {
    
    test('handles booking when event is sold out', async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({ email: 'soldout@clemson.edu', password: 'Test123' });
      
      const token = registerResponse.body.token;
      
      // Create event with limited tickets
      const eventResponse = await request(app)
        .post('/api/events')
        .send({
          name: 'Limited Event',
          date: '2026-01-05',
          location: 'Small Venue',
          totalTickets: 3,
          price: 25.00
        });
      
      const eventId = eventResponse.body.id;
      
      // Try to book more than available
      const bookingResponse = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId, quantity: 5 });
      
      expect(bookingResponse.status).toBe(400);
      expect(bookingResponse.body.error).toContain('Not enough tickets');
    });
    
    test('handles booking non-existent event', async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({ email: 'notfound@clemson.edu', password: 'Test123' });
      
      const token = registerResponse.body.token;
      
      const bookingResponse = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId: 9999, quantity: 2 });
      
      expect(bookingResponse.status).toBe(404);
      expect(bookingResponse.body.error).toBe('Event not found');
    });
  });
});
