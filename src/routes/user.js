const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

router.get('/profile', authenticateToken, userController.getProfile);
router.put('/profile', authenticateToken, userController.updateProfile);
router.put('/password', authenticateToken, userController.updatePassword);

// Session Management
router.get('/sessions', authenticateToken, userController.getSessions);
router.delete('/sessions/:sessionId', authenticateToken, authController.revokeSession);
router.delete('/sessions', authenticateToken, authController.revokeAllOtherSessions);

module.exports = router;
