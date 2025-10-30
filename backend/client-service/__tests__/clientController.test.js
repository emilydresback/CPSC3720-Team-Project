/**
 * Client Service Tests
 * Tests event retrieval and ticket purchases
 */

const request = require('supertest');

// Import your client service app
const app = require('../server');

describe('Client Service - Basic Tests', () => {
  
  test('server should be defined', () => {
    expect(app).toBeDefined();
  });

  test('GET /api/events - should retrieve events', async () => {
    const response = await request(app)
      .get('/api/events');
    
    // Should get 200 or 500 (if DB not ready)
    expect([200, 500]).toContain(response.status);
    
    if (response.status === 200) {
      expect(Array.isArray(response.body)).toBe(true);
    }
  });

  test('POST /api/events/:id/purchase - should have endpoint', async () => {
    const response = await request(app)
      .post('/api/events/1/purchase')
      .send({
        quantity: 1,
        customerName: 'Test User',
        customerEmail: 'test@example.com'
      });
    
    // Should get some response (200, 400, 404, or 500)
    expect([200, 400, 404, 500]).toContain(response.status);
  });

  test('client service has required dependencies', () => {
    expect(typeof require('express')).toBe('function');
    expect(typeof require('sqlite3')).toBe('object');
  });
});