const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Y = require('yjs');
const syncProtocol = require('y-protocols/sync');
const awarenessProtocol = require('y-protocols/awareness');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');
const User = require('../models/User');
const Document = require('../models/Document');
const { logHistory } = require('../utils/history');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;

// Store active Y.Docs: documentId -> Y.Doc
const docs = new Map();

// Helper: Setup a Y.Doc with persistence
async function getOrCreateDoc(documentId, gc = true) {
  if (docs.has(documentId)) {
    return docs.get(documentId);
  }

  const doc = new Y.Doc({ gc });
  doc.conns = new Map(); // Map<WebSocket, Set<number>> - track imported scripts per client if needed

  // Load from MongoDB
  if (mongoose.connection.readyState === 1) {
    try {
      const dbDoc = await Document.findById(documentId);
      if (dbDoc && dbDoc.yjsState) {
        // Apply saved state
        const state = Buffer.from(dbDoc.yjsState, 'base64');
        Y.applyUpdate(doc, state);
      } else if (dbDoc && !dbDoc.yjsState && dbDoc.pages) {
        // Migration: Convert legacy pages to Yjs Text
        // This is a one-time migration for existing docs
        dbDoc.pages.forEach((page, index) => {
          // Simple migration: Just taking text content would lose formatting
          // Ideally, we'd convert the Quill delta to Y.Text
          // For now, let's assume empty or start fresh if no Yjs state
          // A proper migration would require parsing the Delta JSON
        });
      }
    } catch (e) {
      logger.error('Error loading document state:', e);
    }
  }

  // Setup Persistence (Debounced Save)
  let saveTimeout = null;
  const saveToDB = async () => {
    if (mongoose.connection.readyState !== 1) return;
    const state = Y.encodeStateAsUpdate(doc);
    const stateBase64 = Buffer.from(state).toString('base64');

    // Extract Metadata
    const meta = doc.getMap('meta');
    const title = meta.get('title');

    // Extract Content for Preview
    const pages = doc.getArray('pages');
    let previewContent = '';
    // Iterate to get text from all pages or just first?
    // For preview/search, getting at least the first page is good.
    if (pages.length > 0) {
      const firstPage = pages.get(0);
      // Ensure it's a Y.Map and has 'content' (Y.Text)
      if (firstPage && firstPage.get) {
         const content = firstPage.get('content');
         if (content && typeof content.toString === 'function') {
             previewContent = content.toString();
         }
      }
    }

    const updateData = {
        yjsState: stateBase64,
        lastModified: new Date(),
    };

    if (title) updateData.title = title;
    
    // Save preview content to pages[0]
    // This allows the file list to show a snippet or at least search to work
    if (previewContent || previewContent === '') {
         updateData.pages = [{ content: previewContent.substring(0, 500) }]; // Limit preview size
    }

    try {
      await Document.findByIdAndUpdate(documentId, updateData);
    } catch (e) {
      logger.error('Error saving document state:', e);
    }
  };

  doc.on('update', (update, origin) => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveToDB, 2000); // Save every 2 seconds of inactivity

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);

    doc.conns.forEach((_, c) => {
      if (origin !== c && c.readyState === WebSocket.OPEN) {
        c.send(message);
      }
    });
  });

  docs.set(documentId, doc);
  return doc;
}

const messageSync = 0;
const messageAwareness = 1;

function init(server) {
  const wss = new WebSocket.Server({ noServer: true });

  // Heartbeat to keep connections alive (especially on cloud providers like Render)
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  server.on('upgrade', (request, socket, head) => {
    // Parse URL for documentId and token
    // Expected format: /ws?docId=...&token=...
    const url = new URL(request.url, 'http://localhost');
    const documentId = url.searchParams.get('documentId');
    const token = url.searchParams.get('token');

    if (!documentId || !token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // Verify Token
    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Check Document Access
      try {
        const dbDoc = await Document.findById(documentId);
        if (!dbDoc) {
          socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
          socket.destroy();
          return;
        }

        const userId = decoded.id;
        const isOwner = dbDoc.owner.toString() === userId;
        const isShared =
          dbDoc.sharedWith && dbDoc.sharedWith.some((id) => id.toString() === userId);

        if (!isOwner && !isShared) {
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return;
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
          ws.isAlive = true;
          ws.on('pong', () => (ws.isAlive = true));
          wss.emit('connection', ws, request, { documentId, user: decoded });
        });
      } catch (e) {
        logger.error('Auth error during upgrade:', e);
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
      }
    });
  });

  wss.on('connection', async (conn, req, { documentId, user }) => {
    const doc = await getOrCreateDoc(documentId);
    
    // Setup Awareness (Cursors)
    // We create an awareness instance for this connection
    // Note: In standard y-websocket, awareness is shared via the doc.
    // Here we manually handle the protocol.
    
    conn.binaryType = 'arraybuffer';
    
    // Initialize Sync
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, doc);
    conn.send(encoding.toUint8Array(encoder));

    // Handle incoming messages
    conn.on('message', (message) => {
      try {
        const encoder = encoding.createEncoder();
        const decoder = decoding.createDecoder(new Uint8Array(message));
        const messageType = decoding.readVarUint(decoder);

        switch (messageType) {
          case messageSync:
            encoding.writeVarUint(encoder, messageSync);
            syncProtocol.readSyncMessage(decoder, encoder, doc, conn);
            if (encoding.length(encoder) > 1) {
              conn.send(encoding.toUint8Array(encoder));
            }
            break;
          case messageAwareness:
            // Propagate awareness updates to all other clients
            // Simple relay for now
            const awarenessUpdate = decoding.readVarUint8Array(decoder);
            docs.get(documentId).conns.forEach((_, c) => {
                if (c !== conn && c.readyState === WebSocket.OPEN) {
                    const awarenessEncoder = encoding.createEncoder();
                    encoding.writeVarUint(awarenessEncoder, messageAwareness);
                    encoding.writeVarUint8Array(awarenessEncoder, awarenessUpdate);
                    c.send(encoding.toUint8Array(awarenessEncoder));
                }
            });
            break;
        }
      } catch (err) {
        logger.error('Error handling message:', err);
      }
    });

    // Register connection
    if (!doc.conns.has(conn)) {
      doc.conns.set(conn, new Set());
    }
    
    conn.on('close', () => {
      doc.conns.delete(conn);
      if (doc.conns.size === 0) {
        // persistence is handled by debounce, but we could force save here
        // or unload doc from memory after a delay
      }
    });
  });

  return wss;
}

function notifyDocumentDeleted(documentId) {
    // ...
}

function broadcastMaintenance(wss) {
    // ...
}

module.exports = { init, notifyDocumentDeleted, broadcastMaintenance };