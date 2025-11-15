# Testing Guide

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run only unit tests
```bash
npm run test:unit
```

## Test Structure

```
tests/
├── setup.js          # Test configuration and setup
├── auth.test.js      # Authentication endpoint tests
└── README.md         # This file
```

## Writing Tests

### Example Test Structure

```javascript
const request = require('supertest');
const app = require('../server');

describe('Feature Name', () => {
  beforeAll(async () => {
    // Setup before all tests
  });

  afterAll(async () => {
    // Cleanup after all tests
  });

  describe('GET /api/endpoint', () => {
    it('should return 200 with data', async () => {
      const response = await request(app)
        .get('/api/endpoint')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });
});
```

## Test Coverage

Coverage reports are generated automatically when running `npm test`. The coverage threshold is set to 50% for:
- Branches
- Functions
- Lines
- Statements

## Environment Variables

Tests use a separate test database. Set `MONGODB_URI` to point to your test database:

```env
MONGODB_URI=mongodb://localhost:27017/hubi-test
JWT_SECRET=test-secret-key
NODE_ENV=test
```

## Best Practices

1. **Clean up test data**: Always clean up data created during tests
2. **Use unique identifiers**: Use timestamps or UUIDs to avoid conflicts
3. **Mock external services**: Mock external APIs and services
4. **Test error cases**: Test both success and error scenarios
5. **Isolate tests**: Each test should be independent

## Critical Flows to Test

- [x] User authentication (signup, login)
- [ ] User profile management
- [ ] Hobby selection and updates
- [ ] Matching algorithm
- [ ] Forum post creation and interaction
- [ ] Team creation and management
- [ ] Business event creation and management
- [ ] Notification system

