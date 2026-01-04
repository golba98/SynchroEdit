const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
    const MONGODB_URI = process.env.MONGODB_URI;

    if (!MONGODB_URI) {
        logger.error('MONGODB_URI is missing from environment variables. Exiting.');
        process.exit(1);
    }

    // Log the username and host for debugging, but hide the password
    try {
        const url = new URL(MONGODB_URI);
        logger.info(`Attempting to connect to MongoDB as user: ${url.username} at host: ${url.host}`);
    } catch (e) {
        // Fallback for srv strings which URL parser might struggle with if not formatted perfectly
        const maskedUri = MONGODB_URI.replace(/:([^@]+)@/, ':****@');
        logger.info(`Attempting to connect to MongoDB: ${maskedUri}`);
    }

    try {
        await mongoose.connect(MONGODB_URI);
        logger.info('Connected to MongoDB');
    } catch (err) {
        logger.error('MongoDB connection error:', err);
        process.exit(1);
    }
};

module.exports = connectDB;
