const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, documentController.getDocuments);
router.post('/', authenticateToken, documentController.createDocument);
router.post('/:id/recent', authenticateToken, documentController.addToRecent);
router.get('/:id/settings', authenticateToken, documentController.getSettings);
router.patch('/:id/settings', authenticateToken, documentController.updateSettings);
router.delete('/:id', authenticateToken, documentController.deleteDocument);
router.post('/:id/transfer', authenticateToken, documentController.transferOwnership);
router.get('/:id/history', authenticateToken, documentController.getHistory);

module.exports = router;
