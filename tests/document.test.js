const request = require('supertest');
const { app, server } = require('../src/server');
const mongoose = require('mongoose');
const Document = require('../src/models/Document');
const User = require('../src/models/User');
const jwt = require('jsonwebtoken');

jest.mock('../src/models/Document');
jest.mock('../src/models/User');
jest.mock('jsonwebtoken');
jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  return {
    ...actualMongoose,
    connect: jest.fn().mockResolvedValue(actualMongoose),
    connection: {
      ...actualMongoose.connection,
      readyState: 1,
      close: jest.fn().mockResolvedValue(true),
    },
  };
});

jest.mock('../src/middleware/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { id: 'mock-user-id', username: 'testuser' };
    next();
  }),
}));

describe('Document API Integration Tests', () => {
  const userId = 'mock-user-id';
  const token = 'mock-token';

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/documents', () => {
    it('should return paginated documents', async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ recentDocuments: [] }),
        }),
      });

      Document.countDocuments.mockResolvedValue(25);
      Document.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          { _id: '1', title: 'Doc 1' },
          { _id: '2', title: 'Doc 2' },
        ]),
      });

      const res = await request(app)
        .get('/api/documents?page=1&limit=2')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.documents).toHaveLength(2);
      expect(res.body.pagination.totalDocuments).toEqual(25);
      expect(res.body.pagination.totalPages).toEqual(13);
    });
  });
});
