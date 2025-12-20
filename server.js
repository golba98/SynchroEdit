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

// --- Document Routes ---

app.get('/api/documents', authenticateToken, async (req, res) => {
    try {
        const docs = await Document.find({ owner: req.user.id }).sort({ lastModified: -1 });
        res.json(docs);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching documents' });
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

// --- WebSocket Logic ---

let clients = new Map(); // Map of client -> documentId
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
                const documentId = data.documentId;
                const doc = await getOrCreateDocument(documentId);
                clients.set(ws, documentId);
                doc.clients.add(ws);
                ws.send(JSON.stringify({ type: 'sync', data: doc.state }));
                return;
            }
            
            const documentId = clients.get(ws);
            if (!documentId) return;
            const doc = await getOrCreateDocument(documentId);
            
            switch (data.type) {
                case 'update-title':
                    doc.state.title = data.title;
                    broadcastToDocument(documentId, ws, { type: 'update-title', title: data.title });
                    break;
                case 'update-page':
                    if (doc.state.pages[data.pageIndex]) {
                        doc.state.pages[data.pageIndex].content = data.content;
                    }
                    broadcastToDocument(documentId, ws, { type: 'update-page', pageIndex: data.pageIndex, content: data.content });
                    break;
                case 'new-page':
                    doc.state.pages.push({ content: '' });
                    broadcastToDocument(documentId, ws, { type: 'new-page', totalPages: doc.state.pages.length });
                    break;
                case 'delete-page':
                    if (doc.state.pages.length > 1) {
                        doc.state.pages.splice(data.pageIndex, 1);
                        broadcastToDocument(documentId, ws, { type: 'delete-page', pageIndex: data.pageIndex, totalPages: doc.state.pages.length });
                    }
                    break;
            }

            // Auto-save to DB every few changes (throttled in real apps)
            if (mongoose.connection.readyState === 1) {
                await Document.findByIdAndUpdate(documentId, {
                    title: doc.state.title,
                    pages: doc.state.pages,
                    lastModified: new Date()
                });
            }

        } catch (error) {
            console.error('WebSocket error:', error);
        }
    });

    ws.on('close', () => {
        const documentId = clients.get(ws);
        if (documentId) {
            const doc = documents.get(documentId);
            if (doc) doc.clients.delete(ws);
            clients.delete(ws);
        }
    });
});

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
