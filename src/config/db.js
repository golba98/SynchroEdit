const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
    const MONGODB_URI = process.env.MONGODB_URI;

    if (!MONGODB_URI) {
        logger.error('MONGODB_URI not found in .env. Exiting.');
        process.exit(1);
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
