// Test setup file
require('dotenv').config({ path: './config.env' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hubi-test';

// Increase timeout for database operations
jest.setTimeout(30000);

