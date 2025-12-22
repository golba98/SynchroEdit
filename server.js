require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { sendVerificationEmail, generateVerificationCode } = require('./email');
const User = require('./models/User');
const Document = require('./models/Document');
const History = require('./models/History');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret';
const EMAIL_VERIFICATION_ENABLED = process.env.ENABLE_EMAIL_VERIFICATION !== 'false';

// Helper: Log History
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
        console.error('Error logging history:', err);
    }
}


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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Access denied' });

    jwt.verify(token, JWT_SECRET, async (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        
        try {
            const dbUser = await User.findById(user.id);
            if (!dbUser) return res.status(403).json({ message: 'User not found' });
            
            if (EMAIL_VERIFICATION_ENABLED && !dbUser.isEmailVerified) {
                return res.status(403).json({ message: 'Email not verified' });
            }
            
            req.user = user;
            next();
        } catch (dbErr) {
            console.error('Auth middleware error:', dbErr);
            return res.status(500).json({ message: 'Internal server error' });
        }
    });
};

// --- Auth Routes ---

app.post('/api/auth/signup', async (req, res) => {
    try {
        // Check database connection
        if (mongoose.connection.readyState !== 1) {
            console.error('Database not connected. Current state:', mongoose.connection.readyState);
            return res.status(500).json({ message: 'Database connection error. Please check server logs.' });
        }

        let { username, email, password } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Please provide username, email, and password' });
        }

        // Sanitize input
        username = username.trim();
        email = email.trim().toLowerCase();

        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            if (!existingUser.isEmailVerified) {
                if (!EMAIL_VERIFICATION_ENABLED) {
                    existingUser.username = username;
                    existingUser.password = password;
                    existingUser.isEmailVerified = true;
                    existingUser.verificationCode = null;
                    existingUser.verificationCodeExpires = null;
                    await existingUser.save();
                    const token = jwt.sign({ id: existingUser._id, username: existingUser.username }, JWT_SECRET, { expiresIn: '24h' });
                    return res.status(200).json({ token, username: existingUser.username, email: existingUser.email, message: 'Signup successful (verification disabled).' });
                }

                // User exists but is not verified. Treat this as a retry/resend.
                const verificationCode = generateVerificationCode();
                existingUser.username = username; // Update username if changed
                existingUser.password = password; // Update password (will be hashed by pre-save hook)
                existingUser.verificationCode = verificationCode;
                existingUser.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
                await existingUser.save();

                const emailSent = await sendVerificationEmail(email, verificationCode);
                if (!emailSent) {
                    return res.status(500).json({ message: 'Failed to send verification email' });
                }

                const token = jwt.sign({ id: existingUser._id, username: existingUser.username }, JWT_SECRET, { expiresIn: '24h' });

                return res.status(200).json({
                    token,
                    username: existingUser.username,
                    email: existingUser.email,
                    message: 'Verification code resent. Please check your email.'
                });
            }
            return res.status(400).json({ message: 'Username or email already exists' });
        }

        const verificationCode = generateVerificationCode();
        const user = new User({ 
            username, 
            email, 
            password,
            verificationCode: EMAIL_VERIFICATION_ENABLED ? verificationCode : null,
            verificationCodeExpires: EMAIL_VERIFICATION_ENABLED ? new Date(Date.now() + 10 * 60 * 1000) : null,
            isEmailVerified: !EMAIL_VERIFICATION_ENABLED
        });
        await user.save();

        let token;
        if (EMAIL_VERIFICATION_ENABLED) {
            const emailSent = await sendVerificationEmail(email, verificationCode);
            if (!emailSent) {
                await User.deleteOne({ _id: user._id });
                return res.status(500).json({ message: 'Failed to send verification email' });
            }
            token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
            res.status(201).json({ 
                token, 
                username: user.username,
                email: user.email,
                message: 'Signup successful! Check your email for verification code.'
            });
        } else {
            token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
            res.status(201).json({ 
                token, 
                username: user.username,
                email: user.email,
                message: 'Signup successful (verification disabled).' 
            });
        }
    } catch (err) {
        console.error('Signup error:', err);
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Username or email already exists' });
        }
        res.status(500).json({ message: err.message || 'Error creating user' });
    }
});

// Verify email code
app.post('/api/auth/verify-email', async (req, res) => {
    try {
        const { email, verificationCode } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'User not found' });

        if (!EMAIL_VERIFICATION_ENABLED) {
            user.isEmailVerified = true;
            user.verificationCode = null;
            user.verificationCodeExpires = null;
            await user.save();
            const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
            return res.status(200).json({ message: 'Verification disabled; user marked verified.', token, username: user.username });
        }

        if (user.isEmailVerified) {
            // Provide a fresh token so the user can continue without logging in again
            const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
            return res.status(200).json({ message: 'Email already verified', token, username: user.username });
        }

        if (!user.verificationCode || user.verificationCode !== verificationCode) {
            return res.status(400).json({ message: 'Invalid verification code' });
        }

        if (new Date() > user.verificationCodeExpires) {
            return res.status(400).json({ message: 'Verification code expired' });
        }

        user.isEmailVerified = true;
        user.verificationCode = null;
        user.verificationCodeExpires = null;
        await user.save();

        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ message: 'Email verified successfully', token, username: user.username });
    } catch (err) {
        console.error('Verification error:', err);
        res.status(500).json({ message: 'Error verifying email' });
    }
});

// Resend verification code
app.post('/api/auth/resend-code', async (req, res) => {
    try {
        if (!EMAIL_VERIFICATION_ENABLED) {
            return res.status(200).json({ message: 'Verification disabled; no code sent.' });
        }

        const { email } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'User not found' });

        if (user.isEmailVerified) {
            return res.status(400).json({ message: 'Email already verified' });
        }

        const verificationCode = generateVerificationCode();
        user.verificationCode = verificationCode;
        user.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        const emailSent = await sendVerificationEmail(email, verificationCode);
        if (!emailSent) {
            return res.status(500).json({ message: 'Failed to send email' });
        }

        res.json({ message: 'Verification code resent' });
    } catch (err) {
        console.error('Resend error:', err);
        res.status(500).json({ message: 'Error resending code' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        // Check database connection
        if (mongoose.connection.readyState !== 1) {
            return res.status(500).json({ message: 'Database connection error' });
        }

        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ message: 'User not found' });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        if (!user.isEmailVerified) {
            if (!EMAIL_VERIFICATION_ENABLED) {
                user.isEmailVerified = true;
                user.verificationCode = null;
                user.verificationCodeExpires = null;
                await user.save();
            } else {
                const verificationCode = generateVerificationCode();
                user.verificationCode = verificationCode;
                user.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
                await user.save();

                // Fire-and-forget to avoid slowing down the response
                sendVerificationEmail(user.email, verificationCode).catch(err => {
                    console.error('Deferred verification email failed:', err);
                });

                return res.status(403).json({ 
                    message: 'Email not verified. We just sent a fresh code.',
                    requiresVerification: true,
                    email: user.email,
                    username: user.username
                });
            }
        }

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
        
        // Initial history log
        logHistory(doc._id, req.user.id, req.user.username, 'Created Document');
        
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
        
        // Clean up history
        await History.deleteMany({ documentId: docId });

        res.json({ message: 'Document deleted' });
    } catch (err) {
        console.error('Error deleting document:', err);
        res.status(500).json({ message: 'Error deleting document' });
    }
});

// Get document history
app.get('/api/documents/:id/history', authenticateToken, async (req, res) => {
    try {
        const docId = req.params.id;
        // Verify access (basic check if doc exists and user has access)
        // For simplicity allowing any authenticated user to see history of any doc they can open
        // In a real app, you'd check ownership or shared permissions specifically
        
        const history = await History.find({ documentId: docId })
            .sort({ timestamp: -1 })
            .limit(50); // Limit to last 50 entries
            
        res.json(history);
    } catch (err) {
        console.error('Error fetching history:', err);
        res.status(500).json({ message: 'Error fetching history' });
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
                let profilePicture = null;
                
                if (token) {
                    try {
                        const decoded = jwt.verify(token, JWT_SECRET);
                        userId = decoded.id;
                        username = decoded.username;
                        
                        // Fetch fresh profile picture
                        if (mongoose.connection.readyState === 1) {
                            const dbUser = await User.findById(userId);
                            if (dbUser) {
                                profilePicture = dbUser.profilePicture;
                            }
                        }
                    } catch (e) {
                        console.error('Invalid token or DB error in WS join:', e);
                    }
                }

                const doc = await getOrCreateDocument(documentId);
                clients.set(ws, { documentId, userId, username, profilePicture });
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
                    logHistory(documentId, userId, username, 'Renamed Document', `New title: ${data.title}`);
                    break;
                case 'update-page':
                    if (doc.state.pages[data.pageIndex]) {
                        doc.state.pages[data.pageIndex].content = data.content;
                    }
                    broadcastToDocument(documentId, ws, { type: 'update-page', pageIndex: data.pageIndex, content: data.content, username });
                    logHistory(documentId, userId, username, `Edited Page ${data.pageIndex + 1}`);
                    break;
                case 'new-page':
                    doc.state.pages.push({ content: '' });
                    broadcastToDocument(documentId, ws, { type: 'new-page', totalPages: doc.state.pages.length, username });
                    logHistory(documentId, userId, username, 'Added New Page');
                    break;
                case 'delete-page':
                    if (doc.state.pages.length > 1) {
                        doc.state.pages.splice(data.pageIndex, 1);
                        broadcastToDocument(documentId, ws, { type: 'delete-page', pageIndex: data.pageIndex, totalPages: doc.state.pages.length, username });
                        logHistory(documentId, userId, username, `Deleted Page ${data.pageIndex + 1}`);
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
            activeUsers.push({ 
                username: info.username, 
                profilePicture: info.profilePicture 
            });
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
