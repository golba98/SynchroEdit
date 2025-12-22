const logger = require('./logger');
const History = require('../models/History');

async function logHistory(documentId, userId, username, action, details = '') {
    try {
        if (!documentId) return;

        // Debounce "Edited Page X" actions to avoid spamming DB
        if (action.startsWith('Edited Page')) {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            const recentEntry = await History.findOne({
                documentId,
                userId,
                action,
                details,
                timestamp: { $gte: fiveMinutesAgo }
            }).sort({ timestamp: -1 });

            if (recentEntry) {
                recentEntry.timestamp = new Date(); // Update timestamp
                await recentEntry.save();
                return;
            }
        }

        const history = new History({
            documentId,
            userId,
            username: username || 'Anonymous',
            action,
            details
        });
        await history.save();
    } catch (err) {
        logger.error('Error logging history:', err);
    }
}


module.exports = { logHistory };
