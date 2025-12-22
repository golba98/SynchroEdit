const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Document = require('../models/Document');
const { logHistory } = require('../utils/history');

const JWT_SECRET = process.env.JWT_SECRET;

let clients = new Map(); // Map of client -> { documentId, userId, username }
let documents = new Map(); // Map of documentId -> { state, clients: Set }

const logger = require('../utils/logger');

async function getOrCreateDocument(documentId) {
    if (!documents.has(documentId)) {
        let docData;
        if (mongoose.connection.readyState === 1) {
            try {
                docData = await Document.findById(documentId);
            } catch (e) {
                logger.error('Error fetching document for socket cache:', e);
            }
        }
// ... (omitting some lines for context match if needed, but I'll use enough context)

        documents.set(documentId, {
            state: docData ? {
                title: docData.title,
                pages: docData.pages,
                borders: docData.borders,
                currentPageIndex: docData.currentPageIndex
            } : {
                title: 'Untitled document',
                pages: [{ content: '' }],
                borders: { style: 'solid', width: '1pt', color: '#333333', type: 'box' },
                currentPageIndex: 0
            },
            clients: new Set()
        });
    }
    return documents.get(documentId);
}

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

function init(server) {
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                
                if (data.type === 'join-document') {
                    const { documentId, token } = data;
                    
                    if (!token) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Authentication required' }));
                        return;
                    }

                    try {
                        const decoded = jwt.verify(token, JWT_SECRET);
                        const userId = decoded.id;
                        const username = decoded.username;
                        
                        // Execute user, doc existence, and cache retrieval in parallel
                        const [dbUser, dbDoc, doc] = await Promise.all([
                            User.findById(userId).select('profilePicture').lean(),
                            Document.findById(documentId).select('owner sharedWith').lean(),
                            getOrCreateDocument(documentId)
                        ]);

                        if (!dbDoc) {
                            ws.send(JSON.stringify({ type: 'error', message: 'Document not found' }));
                            return;
                        }

                        // Check permissions and add to sharedWith if needed
                        const isOwner = dbDoc.owner.toString() === userId;
                        const isShared = dbDoc.sharedWith && dbDoc.sharedWith.some(id => id.toString() === userId);

                        if (!isOwner && !isShared) {
                            await Document.findByIdAndUpdate(documentId, { $addToSet: { sharedWith: userId } });
                            logHistory(documentId, userId, username, 'Joined Document via link');
                        }

                        clients.set(ws, { documentId, userId, username, profilePicture: dbUser?.profilePicture });
                        doc.clients.add(ws);
                        ws.send(JSON.stringify({ type: 'sync', data: doc.state }));
                        
                        broadcastCollaborators(documentId);
                    } catch (e) {
                        logger.error('Join error:', e);
                        ws.send(JSON.stringify({ type: 'error', message: 'Authentication or access error' }));
                    }
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
                        // Log history in background (no await)
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
                    case 'update-borders':
                        doc.state.borders = {
                            style: data.style,
                            width: data.width,
                            color: data.color,
                            type: data.type
                        };
                        broadcastToDocument(documentId, ws, { type: 'update-borders', ...data, username });
                        logHistory(documentId, userId, username, 'Updated Page Borders');
                        break;
                }

                // Background database update - don't await to keep socket responsive
                if (mongoose.connection.readyState === 1) {
                    Document.findByIdAndUpdate(documentId, {
                        title: doc.state.title,
                        pages: doc.state.pages,
                        borders: doc.state.borders,
                        lastModified: new Date(),
                        lastModifiedBy: userId
                    }).catch(err => logger.error('Auto-save error:', err));
                }

            } catch (error) {
                logger.error('WebSocket message parsing error:', error);
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

    return wss;
}

function notifyDocumentDeleted(documentId) {
    const docRoom = documents.get(documentId);
    if (docRoom) {
        const message = JSON.stringify({ type: 'document-deleted' });
        docRoom.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
        documents.delete(documentId);
    }
}

function broadcastMaintenance(wss, message) {
    const msg = JSON.stringify({ 
        type: 'server-maintenance', 
        message: message || 'Server is deploying new features. We will be back shortly!' 
    });

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
}

module.exports = { init, notifyDocumentDeleted, broadcastMaintenance };
