const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
    documentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    username: {
        type: String,
        default: 'Anonymous'
    },
    action: {
        type: String,
        required: true
    },
    details: {
        type: String, // Optional details (e.g., "Page 1")
        default: ''
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Index for fast retrieval by document
historySchema.index({ documentId: 1, timestamp: -1 });

module.exports = mongoose.model('History', historySchema);
