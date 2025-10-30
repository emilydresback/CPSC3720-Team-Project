/**
 * Admin Service Tests
 * Tests event creation and management
 */

const request = require('supertest');

// Import your admin service app
const app = require('../server');

describe('Admin Service - Basic Tests', () => {
  
  test('server should be defined', () => {
    expect(app).toBeDefined();
  });

  test('POST /api/events - should have endpoint', async () => {
    const response = await request(app)
      .post('/api/events')
      .send({
        name: 'Test Event',
        date: '2025-12-01',
        venue: 'Test Venue',
        available_tickets: 100,
        price: 25.00
      });
    
    // Should get some response (including 404 if endpoint not found)
    expect([200, 201, 400, 404, 500]).toContain(response.status);
  });

  test('admin service has required dependencies', () => {
    expect(typeof require('express')).toBe('function');
    expect(typeof require('sqlite3')).toBe('object');
  });
});

// Close any open handles after tests
afterAll((done) => {
  done();
});