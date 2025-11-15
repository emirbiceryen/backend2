const request = require('supertest');
const mongoose = require('mongoose');
const User = require('../models/User');

// Mock socket.io before requiring server
jest.mock('socket.io', () => {
  return jest.fn(() => ({
    on: jest.fn(),
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  }));
});

const app = require('../server');

describe('Authentication API', () => {
  let testUser;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (testUser) {
      await User.findByIdAndDelete(testUser._id);
    }
    await mongoose.connection.close();
  });

  describe('POST /api/auth/signup', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        name: 'Test User',
        email: `test${Date.now()}@example.com`,
        username: `testuser${Date.now()}`,
        password: 'password123',
        accountType: 'individual',
      };

      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', userData.email);
      expect(response.body.user).toHaveProperty('username', userData.username);

      // Store for cleanup
      testUser = await User.findById(response.body.user._id);
    });

    it('should return 400 for invalid email', async () => {
      const userData = {
        name: 'Test User',
        email: 'invalid-email',
        username: 'testuser',
        password: 'password123',
      };

      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 400 for duplicate email', async () => {
      const userData = {
        name: 'Test User',
        email: testUser?.email || 'duplicate@example.com',
        username: `testuser${Date.now()}`,
        password: 'password123',
      };

      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login user successfully', async () => {
      if (!testUser) {
        // Create a test user if not exists
        testUser = new User({
          name: 'Test User',
          email: `test${Date.now()}@example.com`,
          username: `testuser${Date.now()}`,
          password: 'password123',
        });
        await testUser.save();
      }

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'password123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
    });

    it('should return 400 for invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Invalid credentials');
    });
  });
});

