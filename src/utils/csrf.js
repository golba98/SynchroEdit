const { doubleCsrf } = require('csrf-csrf');
const logger = require('./logger');

const {
    doubleCsrfProtection,
    generateCsrfToken,
} = doubleCsrf({
    getSecret: () => {
        if (!process.env.CSRF_SECRET && process.env.NODE_ENV === 'production') {
            throw new Error('CSRF_SECRET environment variable is required in production');
        }
        return process.env.CSRF_SECRET || 'development-only-fallback-secret-must-be-changed';
    },
    cookieName: 'ps-csrf-secret', // Changed from x-csrf-token to avoid confusion
    cookieOptions: {
        httpOnly: true,
        sameSite: 'Lax', // Changed to Lax for better compatibility with some browser-localhost quirks
        secure: process.env.NODE_ENV === 'production' && process.env.DISABLE_SECURE_COOKIE !== 'true',
        path: '/',
    },
    size: 64,
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
    getTokenFromRequest: (req) => {
        const token = req.headers['x-csrf-token'];
        // DEBUG: Inspect what the server is receiving
        if (req.method === 'POST') {
             const cookie = req.cookies['ps-csrf-secret'];
             logger.debug(`[CSRF DEBUG] Method: ${req.method} | URL: ${req.url}`);
             logger.debug(`[CSRF DEBUG] Header Token: ${token ? token.substring(0, 15) + '...' : 'MISSING'}`);
             logger.debug(`[CSRF DEBUG] Cookie: ${cookie ? cookie.substring(0, 15) + '...' : 'MISSING'}`);
        }

        if (!token) {
            logger.debug(`CSRF token missing in header for ${req.method} ${req.url}`);
        }
        return token;
    },
    getSessionIdentifier: (req) => "", // Return empty string for stateless/session-less usage
});

// Wrapper to log validation failures
const doubleCsrfProtectionWithLogging = (req, res, next) => {
    doubleCsrfProtection(req, res, (err) => {
        if (err && err.code === 'EBADCSRFTOKEN') {
            logger.warn(`CSRF Validation Failed for ${req.method} ${req.url}. IP: ${req.ip}`);
        }
        next(err);
    });
};

module.exports = {
    doubleCsrfProtection: doubleCsrfProtectionWithLogging,
    generateToken: generateCsrfToken,
};