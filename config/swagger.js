const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Hubi API Documentation',
      version: '1.0.0',
      description: 'API documentation for Hubi - A social platform for hobby enthusiasts',
      contact: {
        name: 'Hubi Support',
        email: 'support@hubi.app',
      },
      license: {
        name: 'ISC',
      },
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://backend-production-7063.up.railway.app/api'
          : 'http://localhost:5000/api',
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            username: { type: 'string' },
            profileImage: { type: 'string', format: 'uri' },
            hobbies: { type: 'array', items: { type: 'string' } },
            age: { type: 'number' },
            location: {
              type: 'object',
              properties: {
                city: { type: 'string' },
                state: { type: 'string' },
                country: { type: 'string' },
              },
            },
            accountType: { type: 'string', enum: ['individual', 'business'] },
            businessName: { type: 'string' },
            businessType: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Post: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            authorId: { type: 'string' },
            authorName: { type: 'string' },
            content: { type: 'string' },
            media: { type: 'array', items: { type: 'string', format: 'uri' } },
            isEvent: { type: 'boolean' },
            isBusinessEvent: { type: 'boolean' },
            eventDetails: {
              type: 'object',
              properties: {
                date: { type: 'string', format: 'date-time' },
                location: { type: 'string' },
                topic: { type: 'string' },
                maxParticipants: { type: 'number' },
                currentParticipants: { type: 'number' },
                hobbyType: { type: 'string' },
                price: { type: 'string' },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            error: { type: 'string' },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './routes/*.js',
    './server.js',
  ],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;



