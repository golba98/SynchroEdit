const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
    const MONGODB_URI = process.env.MONGODB_URI;

    if (!MONGODB_URI) {
        logger.error('MONGODB_URI is missing from environment variables. Exiting.');
        process.exit(1);
    }

    // Log a masked version of the URI for debugging
    const maskedUri = MONGODB_URI.replace(/:([^@]+)@/, ':****@');
    logger.info(`Attempting to connect to MongoDB: ${maskedUri}`);

    try {
        await mongoose.connect(MONGODB_URI);
        logger.info('Connected to MongoDB');
    } catch (err) {
        logger.error('MongoDB connection error:', err);
        process.exit(1);
    }
};

module.exports = connectDB;
