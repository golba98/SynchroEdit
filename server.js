require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Document = require('./models/Document');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret';

// Database Connection
if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log('Connected to MongoDB'))
        .catch(err => console.error('MongoDB connection error:', err));
} else {
    console.warn('MONGODB_URI not found in .env. Database features will not work.');
}

// Middleware
app.use(express.static(__dirname));
app.use(express.json());

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Access denied' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = user;
        next();
    });
};

// --- Auth Routes ---

app.post('/api/auth/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(400).json({ message: 'Username already exists' });

        const user = new User({ username, password });
        await user.save();

        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ token, username: user.username });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ message: err.message || 'Error creating user' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ message: 'User not found' });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, username: user.username });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: err.message || 'Login error' });
    }
});

// --- User Profile Routes ---

app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching profile' });
    }
});

app.put('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const { profilePicture } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (profilePicture !== undefined) user.profilePicture = profilePicture;
        await user.save();

        res.json({ message: 'Profile updated successfully', profilePicture: user.profilePicture });
    } catch (err) {
        res.status(500).json({ message: 'Error updating profile' });
    }
});

app.put('/api/user/password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) return res.status(400).json({ message: 'Current password incorrect' });

        user.password = newPassword;
        await user.save();

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error updating password' });
    }
});

// --- Document Routes ---

app.get('/api/documents', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const ownedDocs = await Document.find({ owner: req.user.id }).populate('lastModifiedBy', 'username');
        const recentDocs = await Document.find({ _id: { $in: user.recentDocuments || [] } }).populate('lastModifiedBy', 'username');
        
        // Combine and remove duplicates
        const allDocs = [...ownedDocs];
        recentDocs.forEach(rd => {
            if (!allDocs.some(od => od._id.toString() === rd._id.toString())) {
                allDocs.push(rd);
            }
        });

        // Sort by lastModified
        allDocs.sort((a, b) => b.lastModified - a.lastModified);
        
        res.json(allDocs);
    } catch (err) {
        console.error('Error fetching documents:', err);
        res.status(500).json({ message: 'Error fetching documents' });
    }
});

app.post('/api/documents/:id/recent', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const docId = req.params.id;
        
        // Check if document exists
        const doc = await Document.findById(docId);
        if (!doc) return res.status(404).json({ message: 'Document not found' });

        // Add to recent if not already there (or move to front)
        if (!user.recentDocuments) user.recentDocuments = [];
        
        const index = user.recentDocuments.findIndex(id => id.toString() === docId);
        if (index > -1) {
            user.recentDocuments.splice(index, 1);
        }
        user.recentDocuments.unshift(docId);
        
        // Limit to 20 recent documents
        if (user.recentDocuments.length > 20) {
            user.recentDocuments.pop();
        }

        await user.save();
        res.json({ message: 'Added to recent' });
    } catch (err) {
        console.error('Error adding to recent:', err);
        res.status(500).json({ message: 'Error adding to recent' });
    }
});

app.post('/api/documents', authenticateToken, async (req, res) => {
    try {
        const doc = new Document({
            owner: req.user.id,
            title: req.body.title || 'Untitled document',
            pages: req.body.pages || [{ content: '' }]
        });
        await doc.save();
        res.status(201).json(doc);
    } catch (err) {
        res.status(500).json({ message: 'Error creating document' });
    }
});

app.delete('/api/documents/:id', authenticateToken, async (req, res) => {
    try {
        const docId = req.params.id;
        const doc = await Document.findOneAndDelete({ _id: docId, owner: req.user.id });
        
        if (!doc) {
            // Not the owner or document doesn't exist
            // Just remove from user's recent list if it's there
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

        // If deleted by owner, notify all connected clients
        const docRoom = documents.get(docId);
        if (docRoom) {
            const message = JSON.stringify({ type: 'document-deleted' });
            docRoom.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
            documents.delete(docId);
        }
        
        res.json({ message: 'Document deleted' });
    } catch (err) {
        console.error('Error deleting document:', err);
        res.status(500).json({ message: 'Error deleting document' });
    }
});

// --- WebSocket Logic ---

let clients = new Map(); // Map of client -> { documentId, userId, username }
let documents = new Map(); // Map of documentId -> { state, clients: Set }

async function getOrCreateDocument(documentId) {
    if (!documents.has(documentId)) {
        // Try to load from DB first
        let docData;
        if (mongoose.connection.readyState === 1) {
            try {
                docData = await Document.findById(documentId);
            } catch (e) {}
        }

        documents.set(documentId, {
            state: docData ? {
                title: docData.title,
                pages: docData.pages,
                currentPageIndex: docData.currentPageIndex
            } : {
                title: 'Untitled document',
                pages: [{ content: '' }],
                currentPageIndex: 0
            },
            clients: new Set()
        });
    }
    return documents.get(documentId);
}

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'join-document') {
                const { documentId, token } = data;
                
                let userId = null;
                let username = 'Anonymous';
                
                if (token) {
                    try {
                        const decoded = jwt.verify(token, JWT_SECRET);
                        userId = decoded.id;
                        username = decoded.username;
                    } catch (e) {
                        console.error('Invalid token in WS join');
                    }
                }

                const doc = await getOrCreateDocument(documentId);
                clients.set(ws, { documentId, userId, username });
                doc.clients.add(ws);
                ws.send(JSON.stringify({ type: 'sync', data: doc.state }));
                
                // Broadcast updated collaborator list
                broadcastCollaborators(documentId);
                return;
            }
            
            const clientInfo = clients.get(ws);
            if (!clientInfo) return;
            const { documentId, userId, username } = clientInfo;
            const doc = await getOrCreateDocument(documentId);
            
            switch (data.type) {
                case 'update-title':
                    doc.state.title = data.title;
                    broadcastToDocument(documentId, ws, { type: 'update-title', title: data.title, username });
                    break;
                case 'update-page':
                    if (doc.state.pages[data.pageIndex]) {
                        doc.state.pages[data.pageIndex].content = data.content;
                    }
                    broadcastToDocument(documentId, ws, { type: 'update-page', pageIndex: data.pageIndex, content: data.content, username });
                    break;
                case 'new-page':
                    doc.state.pages.push({ content: '' });
                    broadcastToDocument(documentId, ws, { type: 'new-page', totalPages: doc.state.pages.length, username });
                    break;
                case 'delete-page':
                    if (doc.state.pages.length > 1) {
                        doc.state.pages.splice(data.pageIndex, 1);
                        broadcastToDocument(documentId, ws, { type: 'delete-page', pageIndex: data.pageIndex, totalPages: doc.state.pages.length, username });
                    }
                    break;
            }

            // Auto-save to DB every few changes (throttled in real apps)
            if (mongoose.connection.readyState === 1) {
                await Document.findByIdAndUpdate(documentId, {
                    title: doc.state.title,
                    pages: doc.state.pages,
                    lastModified: new Date(),
                    lastModifiedBy: userId
                });
            }

        } catch (error) {
            console.error('WebSocket error:', error);
        }
    });

    ws.on('close', () => {
        const clientInfo = clients.get(ws);
        if (clientInfo) {
            const { documentId } = clientInfo;
            const doc = documents.get(documentId);
            if (doc) {
                doc.clients.delete(ws);
                broadcastCollaborators(documentId);
            }
            clients.delete(ws);
        }
    });
});

function broadcastCollaborators(documentId) {
    const doc = documents.get(documentId);
    if (!doc) return;

    const activeUsers = [];
    const seenUsernames = new Set();

    doc.clients.forEach(client => {
        const info = clients.get(client);
        if (info && !seenUsernames.has(info.username)) {
            activeUsers.push({ username: info.username });
            seenUsernames.add(info.username);
        }
    });

    const message = JSON.stringify({ type: 'collaborators', users: activeUsers });
    doc.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

function broadcastToDocument(documentId, sender, message) {
    const doc = documents.get(documentId);
    if (!doc) return;
    const messageString = JSON.stringify(message);
    doc.clients.forEach(client => {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(messageString);
        }
    });
}

server.listen(PORT, () => {
    console.log(`Secure Server running on http://localhost:${PORT}`);
});
