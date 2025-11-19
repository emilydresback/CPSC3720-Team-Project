// tests/microservices-integration.test.js
/**
 * Microservices Integration Tests
 * Tests interactions between Admin, Client, and LLM services
 */

const request = require('supertest');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const testDbPath = path.join(__dirname, 'test-integration.db');
let db;
let adminApp;
let clientApp;
let llmApp;

// Setup shared database
beforeAll((done) => {
  db = new sqlite3.Database(testDbPath);
  
  db.serialize(() => {
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
        FOREIGN KEY (eventId) REFERENCES events(id)
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS llm_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        message TEXT NOT NULL,
        intent TEXT,
        eventType TEXT,
        quantity INTEGER,
        dateRequested TEXT,
        status TEXT DEFAULT 'pending',
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `, done);
  });
  
  setupApps();
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
    db.run('DELETE FROM llm_sessions', done);
  });
});

function setupApps() {
  // Admin Service App
  adminApp = express();
  adminApp.use(express.json());
  
  adminApp.post('/api/events', (req, res) => {
    const { name, date, location, totalTickets, price, description } = req.body;
    
    if (!name || !date || !location || !totalTickets || price === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const sql = `INSERT INTO events (name, date, location, totalTickets, availableTickets, price, description)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [name, date, location, totalTickets, totalTickets, price, description || ''], function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.status(201).json({ id: this.lastID, name, date, location, totalTickets, availableTickets: totalTickets, price });
    });
  });
  
  adminApp.get('/api/events', (req, res) => {
    db.all('SELECT * FROM events ORDER BY date', (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ events: rows });
    });
  });
  
  adminApp.get('/api/events/:id', (req, res) => {
    db.get('SELECT * FROM events WHERE id = ?', [req.params.id], (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!row) return res.status(404).json({ error: 'Event not found' });
      res.json(row);
    });
  });
  
  adminApp.put('/api/events/:id', (req, res) => {
    const { name, date, location, price, description } = req.body;
    const updates = [];
    const values = [];
    
    if (name) { updates.push('name = ?'); values.push(name); }
    if (date) { updates.push('date = ?'); values.push(date); }
    if (location) { updates.push('location = ?'); values.push(location); }
    if (price !== undefined) { updates.push('price = ?'); values.push(price); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(req.params.id);
    const sql = `UPDATE events SET ${updates.join(', ')} WHERE id = ?`;
    
    db.run(sql, values, function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ error: 'Event not found' });
      res.json({ message: 'Event updated successfully' });
    });
  });
  
  adminApp.delete('/api/events/:id', (req, res) => {
    db.run('DELETE FROM events WHERE id = ?', [req.params.id], function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ error: 'Event not found' });
      res.json({ message: 'Event deleted successfully' });
    });
  });
  
  // Client Service App
  clientApp = express();
  clientApp.use(express.json());
  
  clientApp.post('/api/bookings', (req, res) => {
    const { userId, eventId, quantity } = req.body;
    
    if (!userId || !eventId || !quantity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    db.get('SELECT * FROM events WHERE id = ?', [eventId], (err, event) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!event) return res.status(404).json({ error: 'Event not found' });
      if (event.availableTickets < quantity) {
        return res.status(400).json({ error: 'Not enough tickets available' });
      }
      
      const totalPrice = event.price * quantity;
      
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) return res.status(500).json({ error: 'Transaction error' });
        
        db.run(
          'UPDATE events SET availableTickets = availableTickets - ? WHERE id = ?',
          [quantity, eventId],
          (err) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: 'Failed to update tickets' });
            }
            
            db.run(
              'INSERT INTO bookings (userId, eventId, quantity, totalPrice, source) VALUES (?, ?, ?, ?, ?)',
              [userId, eventId, quantity, totalPrice, 'manual'],
              function(err) {
                if (err) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: 'Failed to create booking' });
                }
                
                db.run('COMMIT', (err) => {
                  if (err) return res.status(500).json({ error: 'Failed to commit transaction' });
                  res.status(201).json({
                    id: this.lastID,
                    userId,
                    eventId,
                    quantity,
                    totalPrice,
                    status: 'confirmed'
                  });
                });
              }
            );
          }
        );
      });
    });
  });
  
  clientApp.get('/api/bookings/user/:userId', (req, res) => {
    const sql = `
      SELECT b.*, e.name as eventName, e.date, e.location 
      FROM bookings b
      JOIN events e ON b.eventId = e.id
      WHERE b.userId = ?
      ORDER BY b.bookingDate DESC
    `;
    
    db.all(sql, [req.params.userId], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ bookings: rows });
    });
  });
  
  // LLM Service App
  llmApp = express();
  llmApp.use(express.json());
  
  llmApp.post('/api/llm/parse', (req, res) => {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const lowerMessage = message.toLowerCase();
    
    const parsed = {
      intent: 'book_tickets',
      eventType: null,
      quantity: null,
      date: null,
      needsClarification: false,
      missingInfo: []
    };
    
    // Extract quantity
    const quantityMatch = message.match(/(\d+)\s+ticket/i);
    if (quantityMatch) parsed.quantity = parseInt(quantityMatch[1]);
    
    // Extract event type
    if (lowerMessage.includes('basketball')) parsed.eventType = 'basketball';
    else if (lowerMessage.includes('football')) parsed.eventType = 'football';
    else if (lowerMessage.includes('soccer')) parsed.eventType = 'soccer';
    
    // Extract date
    if (lowerMessage.includes('tomorrow')) parsed.date = 'tomorrow';
    else if (lowerMessage.includes('saturday')) parsed.date = 'this Saturday';
    else if (lowerMessage.includes('friday')) parsed.date = 'this Friday';
    
    // Check if clarification needed
    if (!parsed.eventType) parsed.missingInfo.push('event type');
    if (!parsed.quantity) parsed.missingInfo.push('quantity');
    if (!parsed.date) parsed.missingInfo.push('date');
    
    parsed.needsClarification = parsed.missingInfo.length > 0;
    
    res.json(parsed);
  });
  
  llmApp.post('/api/llm/propose', async (req, res) => {
    const { userId, parsedIntent } = req.body;
    
    if (!userId || !parsedIntent) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Find matching event
    const searchDate = parsedIntent.date || new Date().toISOString().split('T')[0];
    
    db.all(
      'SELECT * FROM events WHERE availableTickets >= ? ORDER BY date',
      [parsedIntent.quantity || 1],
      (err, events) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        const matchingEvent = events.find(e => {
          const nameMatch = parsedIntent.eventType && 
            e.name.toLowerCase().includes(parsedIntent.eventType);
          return nameMatch;
        });
        
        if (!matchingEvent) {
          return res.json({
            proposal: null,
            message: 'No matching events found. Would you like to see all available events?',
            needsClarification: true
          });
        }
        
        const totalPrice = matchingEvent.price * parsedIntent.quantity;
        
        res.json({
          proposal: {
            event: matchingEvent,
            quantity: parsedIntent.quantity,
            totalPrice,
            message: `I found a ${matchingEvent.name} on ${matchingEvent.date} at ${matchingEvent.location}. ${parsedIntent.quantity} tickets would cost $${totalPrice.toFixed(2)}. Would you like to book these tickets?`
          },
          needsClarification: false
        });
      }
    );
  });
  
  llmApp.post('/api/llm/book', (req, res) => {
    const { userId, eventId, quantity } = req.body;
    
    if (!userId || !eventId || !quantity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Use client service booking logic
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
        [quantity, eventId]
      );
      
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
            userId,
            eventId,
            quantity,
            totalPrice,
            status: 'confirmed',
            source: 'llm',
            message: `Booking confirmed! You have booked ${quantity} tickets for ${event.name}.`
          });
        }
      );
    });
  });
}

describe('Microservices Integration Tests', () => {
  
  describe('Admin -> Client Service Flow', () => {
    
    test('should create event in admin and book it in client service', async () => {
      // 1. Admin creates event
      const createResponse = await request(adminApp)
        .post('/api/events')
        .send({
          name: 'Basketball Game',
          date: '2025-12-01',
          location: 'Littlejohn Coliseum',
          totalTickets: 100,
          price: 25.00,
          description: 'Clemson vs Duke'
        });
      
      expect(createResponse.status).toBe(201);
      const eventId = createResponse.body.id;
      
      // 2. Client books tickets
      const bookingResponse = await request(clientApp)
        .post('/api/bookings')
        .send({
          userId: 1,
          eventId: eventId,
          quantity: 2
        });
      
      expect(bookingResponse.status).toBe(201);
      expect(bookingResponse.body.quantity).toBe(2);
      expect(bookingResponse.body.totalPrice).toBe(50.00);
      
      // 3. Verify event tickets decreased
      const eventResponse = await request(adminApp)
        .get(`/api/events/${eventId}`);
      
      expect(eventResponse.body.availableTickets).toBe(98);
    });
    
    test('should prevent booking when event is deleted', async () => {
      // 1. Create event
      const createResponse = await request(adminApp)
        .post('/api/events')
        .send({
          name: 'Football Game',
          date: '2025-11-25',
          location: 'Memorial Stadium',
          totalTickets: 50,
          price: 30.00
        });
      
      const eventId = createResponse.body.id;
      
      // 2. Delete event
      await request(adminApp)
        .delete(`/api/events/${eventId}`);
      
      // 3. Try to book - should fail
      const bookingResponse = await request(clientApp)
        .post('/api/bookings')
        .send({
          userId: 1,
          eventId: eventId,
          quantity: 2
        });
      
      expect(bookingResponse.status).toBe(404);
      expect(bookingResponse.body.error).toBe('Event not found');
    });
    
    test('should update event price and reflect in new bookings', async () => {
      // 1. Create event
      const createResponse = await request(adminApp)
        .post('/api/events')
        .send({
          name: 'Soccer Match',
          date: '2025-12-10',
          location: 'Historic Riggs Field',
          totalTickets: 75,
          price: 15.00
        });
      
      const eventId = createResponse.body.id;
      
      // 2. Update price
      await request(adminApp)
        .put(`/api/events/${eventId}`)
        .send({ price: 20.00 });
      
      // 3. Book tickets at new price
      const bookingResponse = await request(clientApp)
        .post('/api/bookings')
        .send({
          userId: 1,
          eventId: eventId,
          quantity: 3
        });
      
      expect(bookingResponse.status).toBe(201);
      expect(bookingResponse.body.totalPrice).toBe(60.00); // 3 * 20.00
    });
  });
  
  describe('LLM -> Client Service Flow', () => {
    
    test('should parse natural language and create booking', async () => {
      // 1. Admin creates event
      const createResponse = await request(adminApp)
        .post('/api/events')
        .send({
          name: 'Basketball Game',
          date: '2025-12-01',
          location: 'Littlejohn Coliseum',
          totalTickets: 100,
          price: 25.00
        });
      
      const eventId = createResponse.body.id;
      
      // 2. LLM parses natural language
      const parseResponse = await request(llmApp)
        .post('/api/llm/parse')
        .send({ message: 'I want 2 tickets for the basketball game tomorrow' });
      
      expect(parseResponse.status).toBe(200);
      expect(parseResponse.body.eventType).toBe('basketball');
      expect(parseResponse.body.quantity).toBe(2);
      
      // 3. LLM proposes booking
      const proposeResponse = await request(llmApp)
        .post('/api/llm/propose')
        .send({
          userId: 1,
          parsedIntent: parseResponse.body
        });
      
      expect(proposeResponse.status).toBe(200);
      expect(proposeResponse.body.proposal).toBeDefined();
      
      // 4. LLM completes booking
      const bookingResponse = await request(llmApp)
        .post('/api/llm/book')
        .send({
          userId: 1,
          eventId: eventId,
          quantity: 2
        });
      
      expect(bookingResponse.status).toBe(201);
      expect(bookingResponse.body.source).toBe('llm');
      
      // 5. Verify booking in client service
      const userBookings = await request(clientApp)
        .get('/api/bookings/user/1');
      
      expect(userBookings.body.bookings.length).toBe(1);
      expect(userBookings.body.bookings[0].source).toBe('llm');
    });
    
    test('should handle ambiguous requests with clarification', async () => {
      const parseResponse = await request(llmApp)
        .post('/api/llm/parse')
        .send({ message: 'I want some tickets' });
      
      expect(parseResponse.status).toBe(200);
      expect(parseResponse.body.needsClarification).toBe(true);
      expect(parseResponse.body.missingInfo).toContain('event type');
      expect(parseResponse.body.missingInfo).toContain('quantity');
      expect(parseResponse.body.missingInfo).toContain('date');
    });
  });
  
  describe('Complete End-to-End Workflow', () => {
    
    test('admin creates -> user searches via LLM -> books -> retrieves booking', async () => {
      // 1. Admin creates multiple events
      const event1 = await request(adminApp)
        .post('/api/events')
        .send({
          name: 'Basketball Game',
          date: '2025-12-01',
          location: 'Littlejohn',
          totalTickets: 100,
          price: 25.00
        });
      
      const event2 = await request(adminApp)
        .post('/api/events')
        .send({
          name: 'Football Game',
          date: '2025-12-05',
          location: 'Memorial Stadium',
          totalTickets: 200,
          price: 35.00
        });
      
      expect(event1.status).toBe(201);
      expect(event2.status).toBe(201);
      
      // 2. User searches via LLM
      const parseResponse = await request(llmApp)
        .post('/api/llm/parse')
        .send({ message: 'I want 4 tickets for the basketball game tomorrow' });
      
      expect(parseResponse.body.eventType).toBe('basketball');
      expect(parseResponse.body.quantity).toBe(4);
      
      // 3. LLM proposes booking
      const proposeResponse = await request(llmApp)
        .post('/api/llm/propose')
        .send({
          userId: 123,
          parsedIntent: parseResponse.body
        });
      
      expect(proposeResponse.body.proposal).toBeDefined();
      expect(proposeResponse.body.proposal.totalPrice).toBe(100.00);
      
      // 4. User confirms via LLM
      const bookingResponse = await request(llmApp)
        .post('/api/llm/book')
        .send({
          userId: 123,
          eventId: event1.body.id,
          quantity: 4
        });
      
      expect(bookingResponse.status).toBe(201);
      expect(bookingResponse.body.message).toContain('confirmed');
      
      // 5. Retrieve user bookings
      const userBookings = await request(clientApp)
        .get('/api/bookings/user/123');
      
      expect(userBookings.body.bookings.length).toBe(1);
      expect(userBookings.body.bookings[0].eventName).toBe('Basketball Game');
      expect(userBookings.body.bookings[0].quantity).toBe(4);
      
      // 6. Verify tickets decreased
      const updatedEvent = await request(adminApp)
        .get(`/api/events/${event1.body.id}`);
      
      expect(updatedEvent.body.availableTickets).toBe(96);
    });
  });
});
