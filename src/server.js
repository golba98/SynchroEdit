require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const globalErrorHandler = require('./middleware/errorMiddleware');
const AppError = require('./utils/AppError');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const documentRoutes = require('./routes/document');
const documentSocket = require('./sockets/documentSocket');

const app = express();
const server = http.createServer(app);

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...', err);
  process.exit(1);
});

// Initialize WebSocket
const wss = documentSocket.init(server);

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// Security Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'cdnjs.cloudflare.com',
          'cdn.quilljs.com',
          'unpkg.com',
          'https://esm.sh',
        ],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'cdnjs.cloudflare.com',
          'cdn.quilljs.com',
          'fonts.googleapis.com',
        ],
        fontSrc: ["'self'", 'cdnjs.cloudflare.com', 'fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:', 'http:', 'https:'],
      },
    },
  })
);

app.set('trust proxy', 1);

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api/', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/documents', documentRoutes);

// 404 handler
app.all('*splat', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handling Middleware
app.use(globalErrorHandler);

// Database Connection
if (MONGODB_URI) {
  mongoose
    .connect(MONGODB_URI)
    .then(() => logger.info('Connected to MongoDB'))
    .catch((err) => logger.error('MongoDB connection error:', err));
} else {
  logger.warn('MONGODB_URI not found in .env. Database features will not work.');
}

// Graceful Shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  documentSocket.broadcastMaintenance(wss);

  // Give some time for maintenance broadcast to reach clients
  await new Promise((resolve) => setTimeout(resolve, 1000));

  server.close(async () => {
    logger.info('HTTP server closed.');

    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during MongoDB closure:', err);
      process.exit(1);
    }
  });

  // If graceful shutdown takes too long, force exit
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...', err);
  server.close(() => {
    process.exit(1);
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    logger.info(`Secure Server running on http://localhost:${PORT}`);
  });
}

module.exports = { app, server };
