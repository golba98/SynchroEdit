const authController = require('../../../src/controllers/authController');
const User = require('../../../src/models/User');
const { sendVerificationEmail } = require('../../../src/utils/email');
const { createTicket } = require('../../../src/utils/ticketStore');
const jwt = require('jsonwebtoken');

// Mock Dependencies
jest.mock('../../../src/utils/email');
jest.mock('../../../src/utils/ticketStore');
jest.mock('jsonwebtoken');
jest.mock('../../../src/utils/logger'); // Silence logs
jest.mock('mongoose', () => {
  class MockSchema {
    constructor() {
      this.methods = {};
    }
    pre() {}
  }
  MockSchema.Types = { ObjectId: 'ObjectId' };

  const MockModel = jest.fn().mockImplementation((doc) => ({
    ...doc,
    save: jest.fn().mockResolvedValue(doc),
  }));
  
  MockModel.findOne = jest.fn();
  MockModel.findById = jest.fn();
  MockModel.deleteOne = jest.fn();
  MockModel.deleteMany = jest.fn();
  
  return {
    connection: {
      readyState: 1
    },
    Schema: MockSchema,
    model: jest.fn(() => MockModel),
  };
});

describe('Auth Controller Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {}, user: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('getWsTicket', () => {
    it('should create a ticket and return it', () => {
      req.user.id = 'user123';
      createTicket.mockReturnValue('mock-ticket');

      authController.getWsTicket(req, res, next);

      expect(createTicket).toHaveBeenCalledWith('user123');
      expect(res.json).toHaveBeenCalledWith({ ticket: 'mock-ticket' });
    });
  });

  describe('signup', () => {
    it('should return generic message if user exists (enumeration prevention)', async () => {
      req.body = { username: 'existing', email: 'test@test.com', password: 'TestPassword123!' };
      
      User.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: '123' }),
      });

      await authController.signup(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
            message: 'If your email is not registered, you will receive a verification code.'
        })
      );
    });

    it('should create new user and send verification email if enabled', async () => {
        // We assume env var is enabled for this test context or mock it if possible.
        // Since we can't easily change process.env inside a running module without reloading,
        // we test the path assuming defaults (which seems to be ENABLED based on code read).
        
        req.body = { username: 'new', email: 'new@test.com', password: 'TestPassword123!' };
        
        User.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
        });
        
        const mockSave = jest.fn();
        User.mockImplementation(() => ({
            save: mockSave,
            _id: 'newid',
            username: 'new',
            email: 'new@test.com'
        }));
        
        sendVerificationEmail.mockResolvedValue(true);
        
        await authController.signup(req, res, next);
        
        expect(mockSave).toHaveBeenCalled();
        expect(sendVerificationEmail).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('login', () => {
      it('should return token if login successful', async () => {
          req.body = { username: 'user', password: 'password' };
          req.headers = { 'user-agent': 'test-agent' };
          req.ip = '127.0.0.1';
          
          const mockUser = {
              _id: 'user123',
              username: 'user',
              comparePassword: jest.fn().mockResolvedValue(true),
              isEmailVerified: true,
              sessions: [],
              save: jest.fn()
          };
          
          User.findOne.mockResolvedValue(mockUser);
          jwt.sign.mockReturnValue('mock-token');
          
          await authController.login(req, res, next);
          
          expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ token: 'mock-token' }));
      });
  });

  describe('logout', () => {
    it('should clear refresh token cookie and return success', () => {
        authController.logout(req, res);
        
        expect(res.cookie).toHaveBeenCalledWith('refreshToken', '', expect.objectContaining({
            expires: expect.any(Date),
            httpOnly: true
        }));
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: 'Logged out successfully' });
    });
  });
});
