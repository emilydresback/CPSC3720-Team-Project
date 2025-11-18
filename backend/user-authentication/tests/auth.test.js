// backend/user-authentication/tests/auth.test.js
/**
 * Authentication Integration Tests
 * Tests user registration, login, logout, and JWT token handling
 */

const request = require('supertest');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const testDbPath = path.join(__dirname, 'test-auth.db');
const JWT_SECRET = 'test-secret-key';
let db;
let app;

// Mock user model for testing
const userModel = {
  getUserByEmail: (email, callback) => {
    db.get('SELECT * FROM users WHERE email = ?', [email], callback);
  },
  getUserById: (id, callback) => {
    db.get('SELECT id, email, createdAt FROM users WHERE id = ?', [id], callback);
  },
  createUser: (email, passwordHash, callback) => {
    const sql = 'INSERT INTO users (email, passwordHash) VALUES (?, ?)';
    db.run(sql, [email, passwordHash], function(err) {
      if (err) return callback(err);
      callback(null, {
        id: this.lastID,
        email,
        createdAt: new Date().toISOString()
      });
    });
  }
};

// Auth controller functions
function generateToken(userId, email) {
  return jwt.sign({ sub: userId, email }, JWT_SECRET, { expiresIn: '30m' });
}

function authenticateToken(req, res, next) {
  let token = req.cookies?.auth_token;
  
  if (!token && req.headers.authorization) {
    const [scheme, value] = req.headers.authorization.split(' ');
    if (scheme === 'Bearer') token = value;
  }
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication token missing.' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(401).json({ 
        error: err.name === 'TokenExpiredError' ? 'Token expired.' : 'Invalid token.' 
      });
    }
    
    userModel.getUserById(payload.sub, (userErr, user) => {
      if (userErr || !user) {
        return res.status(401).json({ error: 'User not found.' });
      }
      req.user = { id: user.id, email: user.email };
      next();
    });
  });
}

async function register(req, res) {
  const { email, password } = req.body || {};
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }
  
  // Password validation
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  
  userModel.getUserByEmail(email, async (findErr, existingUser) => {
    if (findErr) {
      return res.status(500).json({ error: 'Internal server error.' });
    }
    
    if (existingUser) {
      return res.status(409).json({ error: 'A user with that email already exists.' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    userModel.createUser(email, passwordHash, (createErr, user) => {
      if (createErr) {
        return res.status(500).json({ error: 'Internal server error.' });
      }
      
      const token = generateToken(user.id, user.email);
      
      res.cookie('auth_token', token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 30 * 60 * 1000
      });
      
      return res.status(201).json({
        message: 'User registered successfully.',
        user,
        token
      });
    });
  });
}

async function login(req, res) {
  const { email, password } = req.body || {};
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  
  userModel.getUserByEmail(email, async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error.' });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    
    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    
    const token = generateToken(user.id, user.email);
    
    res.cookie('auth_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 60 * 1000
    });
    
    return res.json({
      message: 'Login successful.',
      user: { id: user.id, email: user.email },
      token
    });
  });
}

function logout(req, res) {
  res.clearCookie('auth_token');
  return res.json({ message: 'Logged out successfully.' });
}

function getCurrentUser(req, res) {
  return res.json({ user: req.user });
}

// Setup
beforeAll((done) => {
  db = new sqlite3.Database(testDbPath);
  
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `, done);
  });
  
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  
  app.post('/api/auth/register', register);
  app.post('/api/auth/login', login);
  app.post('/api/auth/logout', logout);
  app.get('/api/auth/me', authenticateToken, getCurrentUser);
  app.get('/api/protected', authenticateToken, (req, res) => {
    res.json({ message: 'Protected route accessed', user: req.user });
  });
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
  db.run('DELETE FROM users', done);
});

describe('Authentication System - Integration Tests', () => {
  
  describe('POST /api/auth/register - User Registration', () => {
    
    test('should register a new user with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@clemson.edu', password: 'SecurePass123' });
      
      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User registered successfully.');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe('test@clemson.edu');
      expect(response.body).toHaveProperty('token');
      expect(response.headers['set-cookie']).toBeDefined();
    });
    
    test('should return 400 when email is missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ password: 'SecurePass123' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email and password are required.');
    });
    
    test('should return 400 when password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@clemson.edu' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email and password are required.');
    });
    
    test('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'invalid-email', password: 'SecurePass123' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid email format.');
    });
    
    test('should return 400 for short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@clemson.edu', password: 'short' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Password must be at least 8 characters.');
    });
    
    test('should return 409 when email already exists', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@clemson.edu', password: 'SecurePass123' });
      
      // Duplicate registration
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@clemson.edu', password: 'DifferentPass456' });
      
      expect(response.status).toBe(409);
      expect(response.body.error).toBe('A user with that email already exists.');
    });
    
    test('should hash password before storing', async () => {
      const password = 'SecurePass123';
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@clemson.edu', password });
      
      return new Promise((resolve) => {
        db.get('SELECT passwordHash FROM users WHERE email = ?', ['test@clemson.edu'], async (err, row) => {
          expect(row.passwordHash).not.toBe(password);
          expect(row.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt hash pattern
          const isValid = await bcrypt.compare(password, row.passwordHash);
          expect(isValid).toBe(true);
          resolve();
        });
      });
    });
  });
  
  describe('POST /api/auth/login - User Login', () => {
    
    beforeEach(async () => {
      // Create a test user
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@clemson.edu', password: 'SecurePass123' });
    });
    
    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@clemson.edu', password: 'SecurePass123' });
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful.');
      expect(response.body.user.email).toBe('test@clemson.edu');
      expect(response.body).toHaveProperty('token');
      expect(response.headers['set-cookie']).toBeDefined();
    });
    
    test('should return 400 when email is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ password: 'SecurePass123' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email and password are required.');
    });
    
    test('should return 400 when password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@clemson.edu' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email and password are required.');
    });
    
    test('should return 401 for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@clemson.edu', password: 'SecurePass123' });
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials.');
    });
    
    test('should return 401 for incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@clemson.edu', password: 'WrongPassword' });
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials.');
    });
    
    test('should not reveal which credential is wrong', async () => {
      const wrongEmail = await request(app)
        .post('/api/auth/login')
        .send({ email: 'wrong@clemson.edu', password: 'SecurePass123' });
      
      const wrongPassword = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@clemson.edu', password: 'WrongPassword' });
      
      // Both should return the same generic error
      expect(wrongEmail.body.error).toBe(wrongPassword.body.error);
    });
  });
  
  describe('POST /api/auth/logout - User Logout', () => {
    
    test('should clear authentication cookie', async () => {
      const response = await request(app)
        .post('/api/auth/logout');
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out successfully.');
      
      const setCookie = response.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      expect(setCookie[0]).toContain('auth_token=;');
    });
  });
  
  describe('JWT Token Handling', () => {
    let token;
    let userId;
    
    beforeEach(async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@clemson.edu', password: 'SecurePass123' });
      
      token = response.body.token;
      userId = response.body.user.id;
    });
    
    test('should access protected route with valid token in header', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Protected route accessed');
      expect(response.body.user.email).toBe('test@clemson.edu');
    });
    
    test('should access protected route with valid token in cookie', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Cookie', [`auth_token=${token}`]);
      
      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('test@clemson.edu');
    });
    
    test('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/protected');
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication token missing.');
    });
    
    test('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token.');
    });
    
    test('should return 401 with expired token', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { sub: userId, email: 'test@clemson.edu' },
        JWT_SECRET,
        { expiresIn: '0s' }
      );
      
      // Wait a bit to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${expiredToken}`);
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token expired.');
    });
    
    test('should return 401 when user no longer exists', async () => {
      // Delete the user
      await new Promise((resolve) => {
        db.run('DELETE FROM users WHERE id = ?', [userId], resolve);
      });
      
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('User not found.');
    });
    
    test('should decode token payload correctly', () => {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      expect(decoded.sub).toBe(userId);
      expect(decoded.email).toBe('test@clemson.edu');
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });
  });
  
  describe('GET /api/auth/me - Get Current User', () => {
    let token;
    
    beforeEach(async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@clemson.edu', password: 'SecurePass123' });
      
      token = response.body.token;
    });
    
    test('should return current user with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('test@clemson.edu');
      expect(response.body.user).toHaveProperty('id');
    });
    
    test('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('Authentication Flow - End-to-End', () => {
    
    test('complete registration -> login -> protected route -> logout flow', async () => {
      // 1. Register
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({ email: 'flow@clemson.edu', password: 'FlowTest123' });
      
      expect(registerResponse.status).toBe(201);
      
      // 2. Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout');
      
      expect(logoutResponse.status).toBe(200);
      
      // 3. Login again
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: 'flow@clemson.edu', password: 'FlowTest123' });
      
      expect(loginResponse.status).toBe(200);
      const token = loginResponse.body.token;
      
      // 4. Access protected route
      const protectedResponse = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${token}`);
      
      expect(protectedResponse.status).toBe(200);
      expect(protectedResponse.body.user.email).toBe('flow@clemson.edu');
      
      // 5. Get current user
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      
      expect(meResponse.status).toBe(200);
      expect(meResponse.body.user.email).toBe('flow@clemson.edu');
    });
  });
});
