// admin-service/tests/eventController.test.js
const request = require('supertest');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Mock database setup
const testDbPath = path.join(__dirname, 'test-events.db');
let db;
let app;

// Initialize test app
beforeAll((done) => {
  // Create test database
  db = new sqlite3.Database(testDbPath);
  
  // Create tables
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
      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eventId INTEGER NOT NULL,
        seatNumber TEXT,
        price REAL NOT NULL,
        isBooked INTEGER DEFAULT 0,
        FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE
      )
    `);
  });

  // Setup Express app for testing
  app = express();
  app.use(express.json());
  
  // Mock routes (simplified for testing)
  app.post('/api/events', createEvent);
  app.get('/api/events', getEvents);
  app.get('/api/events/:id', getEventById);
  app.put('/api/events/:id', updateEvent);
  app.delete('/api/events/:id', deleteEvent);
  
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

// Controller functions (simplified for testing)
function createEvent(req, res) {
  const { name, date, location, totalTickets, price, description } = req.body;
  
  // Validation
  if (!name || !date || !location || !totalTickets || !price) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  if (totalTickets < 1) {
    return res.status(400).json({ error: 'Total tickets must be at least 1' });
  }
  
  if (price < 0) {
    return res.status(400).json({ error: 'Price cannot be negative' });
  }
  
  const sql = `
    INSERT INTO events (name, date, location, totalTickets, availableTickets, price, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.run(sql, [name, date, location, totalTickets, totalTickets, price, description || ''], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.status(201).json({
      id: this.lastID,
      name,
      date,
      location,
      totalTickets,
      availableTickets: totalTickets,
      price,
      description
    });
  });
}

function getEvents(req, res) {
  db.all('SELECT * FROM events', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
}

function getEventById(req, res) {
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

function updateEvent(req, res) {
  const { id } = req.params;
  const { name, date, location, price, description } = req.body;
  
  // Check if event exists
  db.get('SELECT * FROM events WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Update event
    const sql = `
      UPDATE events 
      SET name = COALESCE(?, name),
          date = COALESCE(?, date),
          location = COALESCE(?, location),
          price = COALESCE(?, price),
          description = COALESCE(?, description)
      WHERE id = ?
    `;
    
    db.run(sql, [name, date, location, price, description, id], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Return updated event
      db.get('SELECT * FROM events WHERE id = ?', [id], (err, updatedRow) => {
        res.json(updatedRow);
      });
    });
  });
}

function deleteEvent(req, res) {
  const { id } = req.params;
  
  db.run('DELETE FROM events WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.status(204).send();
  });
}

// TEST SUITES
describe('Admin Service - Event Controller', () => {
  
  describe('POST /api/events - Create Event', () => {
    
    test('should create event with valid data', async () => {
      const eventData = {
        name: 'Basketball Game',
        date: '2025-11-15',
        location: 'Littlejohn Coliseum',
        totalTickets: 100,
        price: 25.00,
        description: 'Clemson vs Duke'
      };
      
      const response = await request(app)
        .post('/api/events')
        .send(eventData)
        .expect(201);
      
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(eventData.name);
      expect(response.body.availableTickets).toBe(100);
    });
    
    test('should reject event with missing required fields', async () => {
      const incompleteData = {
        name: 'Football Game',
        date: '2025-11-20'
        // Missing location, totalTickets, price
      };
      
      const response = await request(app)
        .post('/api/events')
        .send(incompleteData)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required fields');
    });
    
    test('should reject event with negative price', async () => {
      const invalidData = {
        name: 'Free Event',
        date: '2025-11-15',
        location: 'Stadium',
        totalTickets: 50,
        price: -10.00
      };
      
      const response = await request(app)
        .post('/api/events')
        .send(invalidData)
        .expect(400);
      
      expect(response.body.error).toContain('negative');
    });
    
  });
  
  describe('GET /api/events - Get All Events', () => {
    
    beforeEach(async () => {
      // Clear events before each test
      await new Promise((resolve) => {
        db.run('DELETE FROM events', resolve);
      });
    });
    
    test('should return empty array when no events exist', async () => {
      const response = await request(app)
        .get('/api/events')
        .expect(200);
      
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });
    
    test('should return all events', async () => {
      // Create test events
      await request(app).post('/api/events').send({
        name: 'Event 1',
        date: '2025-11-15',
        location: 'Venue 1',
        totalTickets: 50,
        price: 20.00
      });
      
      await request(app).post('/api/events').send({
        name: 'Event 2',
        date: '2025-11-20',
        location: 'Venue 2',
        totalTickets: 75,
        price: 30.00
      });
      
      const response = await request(app)
        .get('/api/events')
        .expect(200);
      
      expect(response.body.length).toBe(2);
    });
  });
  
  describe('GET /api/events/:id - Get Event By ID', () => {
    
    test('should return event by ID', async () => {
      // Create event
      const createResponse = await request(app)
        .post('/api/events')
        .send({
          name: 'Soccer Match',
          date: '2025-12-01',
          location: 'Soccer Field',
          totalTickets: 200,
          price: 15.00
        });
      
      const eventId = createResponse.body.id;
      
      // Get event by ID
      const response = await request(app)
        .get(`/api/events/${eventId}`)
        .expect(200);
      
      expect(response.body.id).toBe(eventId);
      expect(response.body.name).toBe('Soccer Match');
    });
    
    test('should return 404 for non-existent event', async () => {
      const response = await request(app)
        .get('/api/events/99999')
        .expect(404);
      
      expect(response.body.error).toContain('not found');
    });
  });
  
  describe('PUT /api/events/:id - Update Event', () => {
    
    test('should update event successfully', async () => {
      // Create event
      const createResponse = await request(app)
        .post('/api/events')
        .send({
          name: 'Old Name',
          date: '2025-11-15',
          location: 'Old Location',
          totalTickets: 100,
          price: 25.00
        });
      
      const eventId = createResponse.body.id;
      
      // Update event
      const updateData = {
        name: 'New Name',
        location: 'New Location',
        price: 30.00
      };
      
      const response = await request(app)
        .put(`/api/events/${eventId}`)
        .send(updateData)
        .expect(200);
      
      expect(response.body.name).toBe('New Name');
      expect(response.body.location).toBe('New Location');
      expect(response.body.price).toBe(30.00);
    });
    
    test('should return 404 when updating non-existent event', async () => {
      const response = await request(app)
        .put('/api/events/99999')
        .send({ name: 'New Name' })
        .expect(404);
      
      expect(response.body.error).toContain('not found');
    });
    
    test('should partially update event (only some fields)', async () => {
      // Create event
      const createResponse = await request(app)
        .post('/api/events')
        .send({
          name: 'Concert',
          date: '2025-12-10',
          location: 'Arena',
          totalTickets: 500,
          price: 50.00
        });
      
      const eventId = createResponse.body.id;
      
      // Update only price
      const response = await request(app)
        .put(`/api/events/${eventId}`)
        .send({ price: 55.00 })
        .expect(200);
      
      expect(response.body.price).toBe(55.00);
      expect(response.body.name).toBe('Concert'); // Should remain unchanged
    });
  });
  
  describe('DELETE /api/events/:id - Delete Event', () => {
    
    test('should delete event successfully', async () => {
      // Create event
      const createResponse = await request(app)
        .post('/api/events')
        .send({
          name: 'Event to Delete',
          date: '2025-11-15',
          location: 'Location',
          totalTickets: 50,
          price: 20.00
        });
      
      const eventId = createResponse.body.id;
      
      // Delete event
      await request(app)
        .delete(`/api/events/${eventId}`)
        .expect(204);
      
      // Verify deletion
      await request(app)
        .get(`/api/events/${eventId}`)
        .expect(404);
    });
    
    test('should return 404 when deleting non-existent event', async () => {
      const response = await request(app)
        .delete('/api/events/99999')
        .expect(404);
      
      expect(response.body.error).toContain('not found');
    });
    
  });
});

describe('Admin Service - Input Validation', () => {
  
  test('should sanitize SQL injection attempts', async () => {
    const maliciousData = {
      name: "'; DROP TABLE events; --",
      date: '2025-11-15',
      location: 'Location',
      totalTickets: 50,
      price: 20.00
    };
    
    const response = await request(app)
      .post('/api/events')
      .send(maliciousData)
      .expect(201);
    
    // Event should be created with the exact string (not executed as SQL)
    expect(response.body.name).toBe(maliciousData.name);
    
    // Verify events table still exists
    const events = await request(app).get('/api/events').expect(200);
    expect(Array.isArray(events.body)).toBe(true);
  });
  
  test('should handle very long strings', async () => {
    const longString = 'A'.repeat(10000);
    const eventData = {
      name: longString,
      date: '2025-11-15',
      location: 'Location',
      totalTickets: 50,
      price: 20.00
    };
    
    const response = await request(app)
      .post('/api/events')
      .send(eventData)
      .expect(201);
    
    expect(response.body.name.length).toBe(10000);
  });
  
  test('should handle special characters in event names', async () => {
    const eventData = {
      name: 'Event with émojis 🎉 and spëciål çhars!',
      date: '2025-11-15',
      location: 'Lócátïön',
      totalTickets: 50,
      price: 20.00
    };
    
    const response = await request(app)
      .post('/api/events')
      .send(eventData)
      .expect(201);
    
    expect(response.body.name).toBe(eventData.name);
  });
});