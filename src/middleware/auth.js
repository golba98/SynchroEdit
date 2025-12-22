const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;
const EMAIL_VERIFICATION_ENABLED = process.env.ENABLE_EMAIL_VERIFICATION !== 'false';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return next(new AppError('Access denied', 401));

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) return next(new AppError('Invalid token', 403));

    try {
      const dbUser = await User.findById(user.id);
      if (!dbUser) return next(new AppError('User not found', 403));

      if (EMAIL_VERIFICATION_ENABLED && !dbUser.isEmailVerified) {
        return next(new AppError('Email not verified', 403));
      }

      req.user = user;
      next();
    } catch (dbErr) {
      logger.error('Auth middleware database error:', dbErr);
      return next(new AppError('Internal server error', 500));
    }
  });
};

module.exports = { authenticateToken };
