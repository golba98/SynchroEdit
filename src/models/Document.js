const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
    title: {
        type: String,
        default: 'Untitled document'
    },
    pages: [{
        content: {
            type: String,
            default: ''
        }
    }],
    currentPageIndex: {
        type: Number,
        default: 0
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sharedWith: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    lastModified: {
        type: Date,
        default: Date.now
    },
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

module.exports = mongoose.model('Document', documentSchema);
