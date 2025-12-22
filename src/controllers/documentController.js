const Document = require('../models/Document');
const User = require('../models/User');
const History = require('../models/History');
const { logHistory } = require('../utils/history');
const { notifyDocumentDeleted } = require('../sockets/documentSocket');

exports.getDocuments = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const accessibleDocs = await Document.find({ 
            $or: [
                { owner: req.user.id },
                { sharedWith: req.user.id }
            ]
        }).populate('lastModifiedBy', 'username');
        
        const recentDocs = await Document.find({ _id: { $in: user.recentDocuments || [] } }).populate('lastModifiedBy', 'username');
        
        const allDocs = [...accessibleDocs];
        recentDocs.forEach(rd => {
            if (!allDocs.some(od => od._id.toString() === rd._id.toString())) {
                allDocs.push(rd);
            }
        });

        const filteredDocs = allDocs.filter(doc => 
            doc.owner.toString() === req.user.id || 
            (doc.sharedWith && doc.sharedWith.some(id => id.toString() === req.user.id))
        );

        filteredDocs.sort((a, b) => b.lastModified - a.lastModified);
        
        res.json(filteredDocs);
    } catch (err) {
        console.error('Error fetching documents:', err);
        res.status(500).json({ message: 'Error fetching documents' });
    }
};

exports.addToRecent = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const docId = req.params.id;
        const doc = await Document.findById(docId);
        if (!doc) return res.status(404).json({ message: 'Document not found' });

        const isOwner = doc.owner.toString() === req.user.id;
        const isShared = doc.sharedWith && doc.sharedWith.some(id => id.toString() === req.user.id);

        if (!isOwner && !isShared) {
            return res.status(403).json({ message: 'Access denied' });
        }

        if (!user.recentDocuments) user.recentDocuments = [];
        
        const index = user.recentDocuments.findIndex(id => id.toString() === docId);
        if (index > -1) {
            user.recentDocuments.splice(index, 1);
        }
        user.recentDocuments.unshift(docId);
        
        if (user.recentDocuments.length > 20) {
            user.recentDocuments.pop();
        }

        await user.save();
        res.json({ message: 'Added to recent' });
    } catch (err) {
        console.error('Error adding to recent:', err);
        res.status(500).json({ message: 'Error adding to recent' });
    }
};

exports.createDocument = async (req, res) => {
    try {
        const doc = new Document({
            owner: req.user.id,
            title: req.body.title || 'Untitled document',
            pages: req.body.pages || [{ content: '' }]
        });
        await doc.save();
        
        logHistory(doc._id, req.user.id, req.user.username, 'Created Document');
        
        res.status(201).json(doc);
    } catch (err) {
        res.status(500).json({ message: 'Error creating document' });
    }
};

exports.deleteDocument = async (req, res) => {
    try {
        const docId = req.params.id;
        const doc = await Document.findOneAndDelete({ _id: docId, owner: req.user.id });
        
        if (!doc) {
            const user = await User.findById(req.user.id);
            if (user && user.recentDocuments) {
                const index = user.recentDocuments.findIndex(id => id.toString() === docId);
                if (index > -1) {
                    user.recentDocuments.splice(index, 1);
                    await user.save();
                    return res.json({ message: 'Removed from recent' });
                }
            }
            return res.status(404).json({ message: 'Document not found or access denied' });
        }

        notifyDocumentDeleted(docId);
        
        await History.deleteMany({ documentId: docId });

        res.json({ message: 'Document deleted' });
    } catch (err) {
        console.error('Error deleting document:', err);
        res.status(500).json({ message: 'Error deleting document' });
    }
};

exports.getHistory = async (req, res) => {
    try {
        const docId = req.params.id;
        const doc = await Document.findById(docId);
        if (!doc) return res.status(404).json({ message: 'Document not found' });

        const isOwner = doc.owner.toString() === req.user.id;
        const isShared = doc.sharedWith && doc.sharedWith.some(id => id.toString() === req.user.id);

        if (!isOwner && !isShared) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        const history = await History.find({ documentId: docId })
            .sort({ timestamp: -1 })
            .limit(50);
            
        res.json(history);
    } catch (err) {
        console.error('Error fetching history:', err);
        res.status(500).json({ message: 'Error fetching history' });
    }
};
