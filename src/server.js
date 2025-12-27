require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');

const logger = require('./utils/logger');
const globalErrorHandler = require('./middleware/errorMiddleware');
const AppError = require('./utils/AppError');
const setupShutdownHandlers = require('./utils/shutdown');
const setupMiddleware = require('./middleware/setupMiddleware');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const documentRoutes = require('./routes/document');
const documentSocket = require('./sockets/documentSocket');

const app = express();
const server = http.createServer(app);

// Initialize WebSocket
const wss = documentSocket.init(server);

// Setup Shutdown and Process Handlers
setupShutdownHandlers(server, wss);

// Setup Middleware
setupMiddleware(app);

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

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
    mongoose.connect(MONGODB_URI)
        .then(() => logger.info('Connected to MongoDB'))
        .catch(err => logger.error('MongoDB connection error:', err));
} else {
    logger.warn('MONGODB_URI not found in .env. Database features will not work.');
}

if (require.main === module) {
    server.listen(PORT, () => {
        logger.info(`Secure Server running on http://localhost:${PORT}`);
    });
}

module.exports = { app, server };
