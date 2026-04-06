const logger = require('../utils/logger');

const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Silence common browser noise (404s for non-app assets)
  const isNoise =
    err.statusCode === 404 &&
    (req.path.includes('com.chrome.devtools') ||
      req.path.includes('favicon.ico') ||
      req.path.includes('apple-touch-icon'));

  const isAuthError =
    err.message === 'Invalid token' ||
    err.message === 'jwt malformed' ||
    err.message === 'invalid csrf token' ||
    err.message === 'Access denied' ||
    err.message === 'User not found';

  if (process.env.NODE_ENV === 'development') {
    if (isNoise) {
      logger.debug(`Browser Noise (404): ${req.path}`);
    } else if (isAuthError) {
      // Downgrade auth errors to debug to avoid console spam
      logger.debug(`Auth Warning: ${err.message} [${req.method} ${req.path}]`);
    } else {
      logger.error(`Error: ${err.message}`, {
        stack: err.stack,
        path: req.path,
        method: req.method,
      });
    }
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  } else {
    // Production mode
    if (err.isOperational || (err.statusCode >= 400 && err.statusCode < 500)) {
      res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
    } else {
      // Programming or other unknown error: don't leak error details
      logger.error('ERROR 💥', err);
      res.status(500).json({
        status: 'error',
        message: 'Something went very wrong!',
      });
    }
  }
};

module.exports = globalErrorHandler;
