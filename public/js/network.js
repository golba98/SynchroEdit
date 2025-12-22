import { Auth } from './auth.js';

export const Network = {
    async fetchAPI(url, options = {}) {
        const token = Auth.getToken();
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        };
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        return response.json();
    },

    async getDocuments() {
        return this.fetchAPI('/api/documents');
    },

    async createDocument(title = 'Untitled document', pages = [{ content: '' }]) {
        return this.fetchAPI('/api/documents', {
            method: 'POST',
            body: JSON.stringify({ title, pages })
        });
    },

    async deleteDocument(docId) {
        return this.fetchAPI(`/api/documents/${docId}`, {
            method: 'DELETE'
        });
    },

    async addToRecent(docId) {
        return this.fetchAPI(`/api/documents/${docId}/recent`, {
            method: 'POST'
        });
    },

    async getHistory(docId) {
        return this.fetchAPI(`/api/documents/${docId}/history`);
    },

    initWebSocket(documentId, onMessage, onClose) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('Connected to server');
            ws.send(JSON.stringify({
                type: 'join-document',
                documentId,
                token: Auth.getToken()
            }));
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                onMessage(data);
            } catch (error) {
                console.error('WebSocket message error:', error);
            }
        };

        ws.onclose = () => {
            console.log('Disconnected from server');
            if (onClose) onClose();
        };

        return ws;
    },

    sendWS(ws, message) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
};
