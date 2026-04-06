const logger = require('./logger');
const mongoose = require('mongoose');
const documentSocket = require('../documents/socket');

const setupShutdownHandlers = (server, wss) => {
  const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);

    if (wss) {
      documentSocket.broadcastMaintenance(wss);
    }

    // Give some time for maintenance broadcast to reach clients
    await new Promise((resolve) => setTimeout(resolve, 1000));

    server.close(async () => {
      logger.info('HTTP server closed.');

      try {
        if (mongoose.connection.readyState !== 0) {
          await mongoose.connection.close();
          logger.info('MongoDB connection closed.');
        }
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

  process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! 💥 Shutting down...', err);
    server.close(() => {
      process.exit(1);
    });
  });
};

module.exports = setupShutdownHandlers;
