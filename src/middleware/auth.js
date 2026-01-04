const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;
const EMAIL_VERIFICATION_ENABLED = process.env.ENABLE_EMAIL_VERIFICATION !== 'false';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // Explicitly check for "null" string which might come from frontend bugs
  if (!token || token === 'null' || token === 'undefined') {
      return next(new AppError('Access denied', 401));
  }

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) {
      const status = err.name === 'TokenExpiredError' ? 401 : 403;
      return next(new AppError(err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token', status));
    }

    try {
      const dbUser = await User.findById(user.id);
      if (!dbUser) return next(new AppError('User not found', 403));

      if (EMAIL_VERIFICATION_ENABLED && !dbUser.isEmailVerified) {
        return next(new AppError('Email not verified', 403));
      }

      // Verify Session exists
      if (user.sessionId) {
          const sessionExists = dbUser.sessions.some(s => s.sessionId === user.sessionId);
          if (!sessionExists) {
              return next(new AppError('Session expired or revoked', 401));
          }
      }

      req.user = user; // Now contains id, username, and sessionId
      next();
    } catch (dbErr) {
      logger.error('Auth middleware database error:', dbErr);
      return next(new AppError('Internal server error', 500));
    }
  });
};

module.exports = { authenticateToken };
