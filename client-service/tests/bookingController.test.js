// client-service/tests/bookingController.test.js
const request = require('supertest');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const testDbPath = path.join(__dirname, 'test-bookings.db');
let db;
let app;

beforeAll((done) => {
  db = new sqlite3.Database(testDbPath);
  
  db.serialize(() => {
    // Create tables
    db.run(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        location TEXT NOT NULL,
        totalTickets INTEGER NOT NULL,
        availableTickets INTEGER NOT NULL,
        price REAL NOT NULL
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
        FOREIGN KEY (eventId) REFERENCES events(id)
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL
      )
    `);
  });
  
  app = express();
  app.use(express.json());
  
  app.post('/api/bookings', createBooking);
  app.get('/api/bookings/user/:userId', getUserBookings);
  app.delete('/api/bookings/:id', cancelBooking);
  app.get('/api/events/:id', getEvent);
  
  done();
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

// Helper function to create test data
async function setupTestData() {
  return new Promise((resolve) => {
    db.serialize(() => {
      // Create test user
      db.run(
        'INSERT INTO users (username, email) VALUES (?, ?)',
        ['testuser', 'test@test.com']
      );
      
      // Create test event
      db.run(
        `INSERT INTO events (name, date, location, totalTickets, availableTickets, price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['Test Event', '2025-12-01', 'Test Venue', 100, 100, 25.00],
        function() {
          resolve(this.lastID);
        }
      );
    });
  });
}

// Controller functions
function createBooking(req, res) {
  const { userId, eventId, quantity } = req.body;
  
  if (!userId || !eventId || !quantity) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  if (quantity < 1) {
    return res.status(400).json({ error: 'Quantity must be at least 1' });
  }
  
  // Begin transaction
  db.serialize(() => {
    // Check event availability
    db.get('SELECT * FROM events WHERE id = ?', [eventId], (err, event) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      
      if (event.availableTickets < quantity) {
        return res.status(400).json({ 
          error: 'Not enough tickets available',
          available: event.availableTickets,
          requested: quantity
        });
      }
      
      const totalPrice = event.price * quantity;
      
      // Create booking
      db.run(
        `INSERT INTO bookings (userId, eventId, quantity, totalPrice)
         VALUES (?, ?, ?, ?)`,
        [userId, eventId, quantity, totalPrice],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to create booking' });
          }
          
          const bookingId = this.lastID;
          
          // Update available tickets
          db.run(
            'UPDATE events SET availableTickets = availableTickets - ? WHERE id = ?',
            [quantity, eventId],
            (err) => {
              if (err) {
                // Rollback: delete booking
                db.run('DELETE FROM bookings WHERE id = ?', [bookingId]);
                return res.status(500).json({ error: 'Failed to update tickets' });
              }
              
              res.status(201).json({
                id: bookingId,
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
}

function getUserBookings(req, res) {
  const { userId } = req.params;
  
  const sql = `
    SELECT b.*, e.name as eventName, e.date as eventDate, e.location as eventLocation
    FROM bookings b
    JOIN events e ON b.eventId = e.id
    WHERE b.userId = ?
    ORDER BY b.bookingDate DESC
  `;
  
  db.all(sql, [userId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
}

function cancelBooking(req, res) {
  const { id } = req.params;
  
  // Get booking details
  db.get('SELECT * FROM bookings WHERE id = ?', [id], (err, booking) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Booking already cancelled' });
    }
    
    // Update booking status and restore tickets
    db.serialize(() => {
      db.run(
        'UPDATE bookings SET status = ? WHERE id = ?',
        ['cancelled', id]
      );
      
      db.run(
        'UPDATE events SET availableTickets = availableTickets + ? WHERE id = ?',
        [booking.quantity, booking.eventId],
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to restore tickets' });
          }
          
          res.json({ 
            message: 'Booking cancelled successfully',
            refundAmount: booking.totalPrice
          });
        }
      );
    });
  });
}

function getEvent(req, res) {
  const { id } = req.params;
  
  db.get('SELECT * FROM events WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(row);
  });
}

// TEST SUITES
describe('Client Service - Booking Controller', () => {
  
  beforeEach(async () => {
    // Clear tables before each test
    await new Promise((resolve) => {
      db.serialize(() => {
        db.run('DELETE FROM bookings');
        db.run('DELETE FROM events');
        db.run('DELETE FROM users', resolve);
      });
    });
  });
  
  describe('POST /api/bookings - Create Booking', () => {
    
    test('should create booking with available tickets', async () => {
      const eventId = await setupTestData();
      
      const bookingData = {
        userId: 1,
        eventId: eventId,
        quantity: 2
      };
      
      const response = await request(app)
        .post('/api/bookings')
        .send(bookingData)
        .expect(201);
      
      expect(response.body).toHaveProperty('id');
      expect(response.body.quantity).toBe(2);
      expect(response.body.totalPrice).toBe(50.00); // 2 * 25.00
      expect(response.body.status).toBe('confirmed');
    });
    
    test('should prevent overbooking', async () => {
      const eventId = await setupTestData();
      
      const bookingData = {
        userId: 1,
        eventId: eventId,
        quantity: 150 // More than available (100)
      };
      
      const response = await request(app)
        .post('/api/bookings')
        .send(bookingData)
        .expect(400);
      
      expect(response.body.error).toContain('Not enough tickets');
      expect(response.body.available).toBe(100);
      expect(response.body.requested).toBe(150);
    });
    
    test('should reject booking for non-existent event', async () => {
      await setupTestData();
      
      const bookingData = {
        userId: 1,
        eventId: 99999,
        quantity: 2
      };
      
      const response = await request(app)
        .post('/api/bookings')
        .send(bookingData)
        .expect(404);
      
      expect(response.body.error).toContain('Event not found');
    });
    
    test('should reject booking with missing fields', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .send({ userId: 1 })
        .expect(400);
      
      expect(response.body.error).toContain('required fields');
    });
    
    
    test('should update available tickets after booking', async () => {
      const eventId = await setupTestData();
      
      await request(app)
        .post('/api/bookings')
        .send({ userId: 1, eventId, quantity: 10 })
        .expect(201);
      
      const eventResponse = await request(app)
        .get(`/api/events/${eventId}`)
        .expect(200);
      
      expect(eventResponse.body.availableTickets).toBe(90); // 100 - 10
    });
  });
  
  describe('GET /api/bookings/user/:userId - Get User Bookings', () => {
    
    test('should retrieve user bookings', async () => {
      const eventId = await setupTestData();
      
      // Create bookings
      await request(app).post('/api/bookings').send({
        userId: 1,
        eventId: eventId,
        quantity: 2
      });
      
      await request(app).post('/api/bookings').send({
        userId: 1,
        eventId: eventId,
        quantity: 3
      });
      
      const response = await request(app)
        .get('/api/bookings/user/1')
        .expect(200);
      
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(response.body[0]).toHaveProperty('eventName');
      expect(response.body[0]).toHaveProperty('eventDate');
    });
    
    test('should return empty array for user with no bookings', async () => {
      await setupTestData();
      
      const response = await request(app)
        .get('/api/bookings/user/999')
        .expect(200);
      
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });
  });
  
  describe('DELETE /api/bookings/:id - Cancel Booking', () => {
    
    test('should cancel booking successfully', async () => {
      const eventId = await setupTestData();
      
      // Create booking
      const bookingResponse = await request(app)
        .post('/api/bookings')
        .send({ userId: 1, eventId, quantity: 5 });
      
      const bookingId = bookingResponse.body.id;
      
      // Cancel booking
      const response = await request(app)
        .delete(`/api/bookings/${bookingId}`)
        .expect(200);
      
      expect(response.body.message).toContain('cancelled successfully');
      expect(response.body.refundAmount).toBe(125.00); // 5 * 25.00
    });
    
    test('should restore tickets after cancellation', async () => {
      const eventId = await setupTestData();
      
      // Create booking
      const bookingResponse = await request(app)
        .post('/api/bookings')
        .send({ userId: 1, eventId, quantity: 10 });
      
      const bookingId = bookingResponse.body.id;
      
      // Verify tickets reduced
      let eventResponse = await request(app).get(`/api/events/${eventId}`);
      expect(eventResponse.body.availableTickets).toBe(90);
      
      // Cancel booking
      await request(app).delete(`/api/bookings/${bookingId}`).expect(200);
      
      // Verify tickets restored
      eventResponse = await request(app).get(`/api/events/${eventId}`);
      expect(eventResponse.body.availableTickets).toBe(100);
    });
    
    test('should return 404 for non-existent booking', async () => {
      const response = await request(app)
        .delete('/api/bookings/99999')
        .expect(404);
      
      expect(response.body.error).toContain('not found');
    });
    
    test('should reject cancelling already cancelled booking', async () => {
      const eventId = await setupTestData();
      
      // Create and cancel booking
      const bookingResponse = await request(app)
        .post('/api/bookings')
        .send({ userId: 1, eventId, quantity: 2 });
      
      const bookingId = bookingResponse.body.id;
      
      await request(app).delete(`/api/bookings/${bookingId}`).expect(200);
      
      // Try to cancel again
      const response = await request(app)
        .delete(`/api/bookings/${bookingId}`)
        .expect(400);
      
      expect(response.body.error).toContain('already cancelled');
    });
  });
  
  describe('Concurrent Booking Prevention', () => {
    
    test('should handle concurrent bookings correctly', async () => {
      const eventId = await setupTestData();
      
      // Simulate concurrent bookings
      const booking1 = request(app)
        .post('/api/bookings')
        .send({ userId: 1, eventId, quantity: 60 });
      
      const booking2 = request(app)
        .post('/api/bookings')
        .send({ userId: 2, eventId, quantity: 60 });
      
      const [response1, response2] = await Promise.all([booking1, booking2]);
      
      // One should succeed, one should fail
      const successCount = [response1, response2].filter(r => r.status === 201).length;
      const failCount = [response1, response2].filter(r => r.status === 400).length;
      
      expect(successCount).toBe(1);
      expect(failCount).toBe(1);
      
      // Check final ticket count
      const eventResponse = await request(app).get(`/api/events/${eventId}`);
      expect(eventResponse.body.availableTickets).toBe(40); // 100 - 60
    });
    
  });
  
  describe('Booking Validation', () => {
    
    test('should handle large quantity bookings', async () => {
      const eventId = await setupTestData();
      
      const response = await request(app)
        .post('/api/bookings')
        .send({ userId: 1, eventId, quantity: 100 })
        .expect(201);
      
      expect(response.body.totalPrice).toBe(2500.00); // 100 * 25.00
      
      // Event should be sold out
      const eventResponse = await request(app).get(`/api/events/${eventId}`);
      expect(eventResponse.body.availableTickets).toBe(0);
    });
    
    test('should calculate total price correctly', async () => {
      const eventId = await setupTestData();
      
      const testCases = [
        { quantity: 1, expectedPrice: 25.00 },
        { quantity: 5, expectedPrice: 125.00 },
        { quantity: 10, expectedPrice: 250.00 }
      ];
      
      for (const testCase of testCases) {
        await new Promise(resolve => db.run('DELETE FROM bookings', resolve));
        await new Promise(resolve => 
          db.run('UPDATE events SET availableTickets = 100 WHERE id = ?', [eventId], resolve)
        );
        
        const response = await request(app)
          .post('/api/bookings')
          .send({ userId: 1, eventId, quantity: testCase.quantity })
          .expect(201);
        
        expect(response.body.totalPrice).toBe(testCase.expectedPrice);
      }
    });
  });
});