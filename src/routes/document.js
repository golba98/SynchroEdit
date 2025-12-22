const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, documentController.getDocuments);
router.post('/', authenticateToken, documentController.createDocument);
router.post('/:id/recent', authenticateToken, documentController.addToRecent);
router.delete('/:id', authenticateToken, documentController.deleteDocument);
router.get('/:id/history', authenticateToken, documentController.getHistory);

module.exports = router;
