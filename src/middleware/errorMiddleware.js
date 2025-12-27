const logger = require('../utils/logger');

const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Silence common browser noise (404s for non-app assets)
  const isNoise = err.statusCode === 404 && (
      req.path.includes('com.chrome.devtools') || 
      req.path.includes('favicon.ico') ||
      req.path.includes('apple-touch-icon')
  );

  if (process.env.NODE_ENV === 'development') {
    if (isNoise) {
        logger.debug(`Browser Noise (404): ${req.path}`);
    } else {
        logger.error(`Error: ${err.message}`, { stack: err.stack, path: req.path, method: req.method });
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
