const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET;
const EMAIL_VERIFICATION_ENABLED = process.env.ENABLE_EMAIL_VERIFICATION !== 'false';

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Access denied' });

    jwt.verify(token, JWT_SECRET, async (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        
        try {
            const dbUser = await User.findById(user.id);
            if (!dbUser) return res.status(403).json({ message: 'User not found' });
            
            if (EMAIL_VERIFICATION_ENABLED && !dbUser.isEmailVerified) {
                return res.status(403).json({ message: 'Email not verified' });
            }
            
            req.user = user;
            next();
        } catch (dbErr) {
            console.error('Auth middleware error:', dbErr);
            return res.status(500).json({ message: 'Internal server error' });
        }
    });
};

module.exports = { authenticateToken };
