const authController = require('../../../src/controllers/authController');
const User = require('../../../src/models/User');
const { sendVerificationEmail } = require('../../../src/utils/email');
const { createTicket } = require('../../../src/utils/ticketStore');
const jwt = require('jsonwebtoken');

// Mock Dependencies
jest.mock('../../../src/models/User');
jest.mock('../../../src/utils/email');
jest.mock('../../../src/utils/ticketStore');
jest.mock('jsonwebtoken');
jest.mock('../../../src/utils/logger'); // Silence logs

describe('Auth Controller Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {}, user: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
    
    // Default mongoose state
    const mongoose = require('mongoose');
    mongoose.connection = { readyState: 1 };
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
      req.body = { username: 'existing', email: 'test@test.com', password: 'password123' };
      
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
        
        req.body = { username: 'new', email: 'new@test.com', password: 'password123' };
        
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
          
          const mockUser = {
              _id: 'user123',
              username: 'user',
              comparePassword: jest.fn().mockResolvedValue(true),
              isEmailVerified: true,
              save: jest.fn()
          };
          
          User.findOne.mockResolvedValue(mockUser);
          jwt.sign.mockReturnValue('mock-token');
          
          await authController.login(req, res, next);
          
          expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ token: 'mock-token' }));
      });
  });
});
