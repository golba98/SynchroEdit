const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
    const MONGODB_URI = process.env.MONGODB_URI;

    if (MONGODB_URI) {
        try {
            await mongoose.connect(MONGODB_URI);
            logger.info('Connected to MongoDB');
        } catch (err) {
            logger.error('MongoDB connection error:', err);
        }
    } else {
        logger.warn('MONGODB_URI not found in .env. Database features will not work.');
    }
};

module.exports = connectDB;
