const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 3000;

// Middleware
app.use(express.static(__dirname));
app.use(express.json());

// Store connected clients and document states
let clients = new Map(); // Map of client -> documentId
let documents = new Map(); // Map of documentId -> { state, clients: Set }

function getOrCreateDocument(documentId) {
    if (!documents.has(documentId)) {
        documents.set(documentId, {
            state: {
                title: 'Untitled document',
                pages: [{ content: '' }],
                currentPageIndex: 0
            },
            clients: new Set()
        });
    }
    return documents.get(documentId);
}

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('New client connected');
    
    // Handle incoming messages
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'join-document') {
                // Client joining a specific document
                const documentId = data.documentId;
                const doc = getOrCreateDocument(documentId);
                
                // Associate client with document
                clients.set(ws, documentId);
                doc.clients.add(ws);
                
                console.log(`Client joined document: ${documentId}`);
                
                // Send current document state to new client
                ws.send(JSON.stringify({
                    type: 'sync',
                    data: doc.state
                }));
                
                return;
            }
            
            // Get client's document
            const documentId = clients.get(ws);
            if (!documentId) return;
            
            const doc = getOrCreateDocument(documentId);
            
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

                case 'change-page':
                    doc.state.currentPageIndex = data.pageIndex;
                    broadcastToDocument(documentId, ws, { type: 'change-page', pageIndex: data.pageIndex });
                    break;
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        const documentId = clients.get(ws);
        if (documentId) {
            const doc = documents.get(documentId);
            if (doc) {
                doc.clients.delete(ws);
                // Clean up empty documents after 1 hour
                if (doc.clients.size === 0) {
                    setTimeout(() => {
                        const currentDoc = documents.get(documentId);
                        if (currentDoc && currentDoc.clients.size === 0) {
                            documents.delete(documentId);
                            console.log(`Cleaned up empty document: ${documentId}`);
                        }
                    }, 3600000); // 1 hour
                }
            }
            clients.delete(ws);
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Broadcast to all clients in a specific document except sender
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

// REST API endpoints
app.get('/api/document', (req, res) => {
    res.json(documentState);
});

app.post('/api/document/save', (req, res) => {
    const { title, pages, currentPageIndex } = req.body;
    documentState = { title, pages, currentPageIndex };
    res.json({ success: true });
});

// Start server
server.listen(PORT, () => {
    console.log('========================================');
    console.log('   SynchroEdit Server Running');
    console.log('========================================');
    console.log(`Server: http://localhost:${PORT}`);
    console.log(`Start:  http://localhost:${PORT}/start.html`);
    console.log(`Login:  http://localhost:${PORT}/login.html`);
    console.log('========================================');
    console.log('Ready for real-time collaboration!');
});
