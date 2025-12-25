const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  title: {
    type: String,
    default: 'Untitled document',
  },
  pages: [
    {
      content: {
        type: mongoose.Schema.Types.Mixed,
        default: '',
      },
    },
  ],
  borders: {
    style: { type: String, default: 'solid' },
    width: { type: String, default: '1pt' },
    color: { type: String, default: '#333333' },
    type: { type: String, default: 'box' },
  },
  currentPageIndex: {
    type: Number,
    default: 0,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sharedWith: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  viewers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  lastModified: {
    type: Date,
    default: Date.now,
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  comments: [
    {
      id: String,
      content: String,
      author: String, // Username
      timestamp: { type: Date, default: Date.now },
      pageIndex: Number, // To help jump to it
      quote: String, // The text that was highlighted
    },
  ],
  yjsState: {
    type: String, // Base64 encoded Buffer
    select: false, // Don't return by default in queries
  },
});

// Indexes for faster document retrieval
documentSchema.index({ owner: 1 });
documentSchema.index({ sharedWith: 1 });
documentSchema.index({ lastModified: -1 });

module.exports = mongoose.model('Document', documentSchema);
