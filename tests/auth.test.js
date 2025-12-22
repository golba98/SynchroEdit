const request = require('supertest');
const { app, server } = require('../src/server');
const mongoose = require('mongoose');
const User = require('../src/models/User');

// Mock User model
jest.mock('../src/models/User');

// Mock mongoose connection
jest.mock('mongoose', () => {
    const actualMongoose = jest.requireActual('mongoose');
    return {
        ...actualMongoose,
        connect: jest.fn().mockResolvedValue(actualMongoose),
        connection: {
            ...actualMongoose.connection,
            readyState: 1,
            close: jest.fn().mockResolvedValue(true)
        }
    };
});

describe('Auth API Tests', () => {
    afterAll(async () => {
        await server.close();
        await mongoose.connection.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return 400 if missing fields in signup', async () => {
        const res = await request(app)
            .post('/api/auth/signup')
            .send({ username: 'testuser' });
        
        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toContain('Please provide username, email, and password');
    });

    it('should return 400 if user already exists', async () => {
        User.findOne.mockResolvedValue({ 
            username: 'testuser', 
            email: 'test@example.com',
            isEmailVerified: true 
        });

        const res = await request(app)
            .post('/api/auth/signup')
            .send({ username: 'testuser', email: 'test@example.com', password: 'password123' });
        
        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toEqual('Username or email already exists');
    });
});
