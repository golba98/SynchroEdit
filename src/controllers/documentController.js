const Document = require('../models/Document');
const User = require('../models/User');
const History = require('../models/History');
const { logHistory } = require('../utils/history');
const { notifyDocumentDeleted } = require('../sockets/documentSocket');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

exports.getDocuments = async (req, res, next) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const user = await User.findById(userId).select('recentDocuments').lean();

  const query = {
    $or: [
      { owner: userId },
      { sharedWith: userId },
      { _id: { $in: user ? user.recentDocuments : [] } },
    ],
  };

  const totalDocuments = await Document.countDocuments(query);
  const documents = await Document.find(query)
    .select('title lastModified lastModifiedBy pages owner')
    .populate('lastModifiedBy', 'username')
    .sort({ lastModified: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  res.json({
    documents,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalDocuments / limit),
      totalDocuments,
      hasNextPage: page * limit < totalDocuments,
      hasPrevPage: page > 1,
    },
  });
};

exports.addToRecent = async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) return next(new AppError('User not found', 404));

  const docId = req.params.id;
  const doc = await Document.findById(docId).select('owner sharedWith').lean();
  if (!doc) return next(new AppError('Document not found', 404));

  const isOwner = doc.owner.toString() === req.user.id;
  const isShared = doc.sharedWith && doc.sharedWith.some((id) => id.toString() === req.user.id);

  if (!isOwner && !isShared) {
    return next(new AppError('Access denied', 403));
  }

  if (!user.recentDocuments) user.recentDocuments = [];

  const index = user.recentDocuments.findIndex((id) => id.toString() === docId);
  if (index > -1) {
    user.recentDocuments.splice(index, 1);
  }
  user.recentDocuments.unshift(docId);

  if (user.recentDocuments.length > 20) {
    user.recentDocuments.pop();
  }

  await user.save();
  res.json({ message: 'Added to recent' });
};

exports.createDocument = async (req, res, next) => {
  const doc = new Document({
    owner: req.user.id,
    title: req.body.title || 'Untitled document',
    pages: req.body.pages || [{ content: '' }],
  });
  await doc.save();

  logHistory(doc._id, req.user.id, req.user.username, 'Created Document');

  logger.info(`Document created: ${doc._id} by ${req.user.id}`);
  res.status(201).json(doc);
};

exports.deleteDocument = async (req, res, next) => {
  const docId = req.params.id;
  const doc = await Document.findOneAndDelete({ _id: docId, owner: req.user.id });

  if (!doc) {
    const user = await User.findById(req.user.id);
    if (user && user.recentDocuments) {
      const index = user.recentDocuments.findIndex((id) => id.toString() === docId);
      if (index > -1) {
        user.recentDocuments.splice(index, 1);
        await user.save();
        return res.json({ message: 'Removed from recent' });
      }
    }
    return next(new AppError('Document not found or access denied', 404));
  }

  notifyDocumentDeleted(docId);

  await History.deleteMany({ documentId: docId });

  logger.info(`Document deleted: ${docId} by ${req.user.id}`);
  res.json({ message: 'Document deleted' });
};

exports.getHistory = async (req, res, next) => {
  const docId = req.params.id;
  const doc = await Document.findById(docId).select('owner sharedWith').lean();
  if (!doc) return next(new AppError('Document not found', 404));

  const isOwner = doc.owner.toString() === req.user.id;
  const isShared = doc.sharedWith && doc.sharedWith.some((id) => id.toString() === req.user.id);

  if (!isOwner && !isShared) {
    return next(new AppError('Access denied', 403));
  }

  const history = await History.find({ documentId: docId })
    .sort({ timestamp: -1 })
    .limit(50)
    .lean();

  res.json(history);
};
