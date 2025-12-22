import { Auth } from '/js/ui/auth.js';

export const Network = {
  async fetchAPI(url, options = {}) {
    const token = Auth.getToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
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
      body: JSON.stringify({ title, pages }),
    });
  },

  async deleteDocument(docId) {
    return this.fetchAPI(`/api/documents/${docId}`, {
      method: 'DELETE',
    });
  },

  async addToRecent(docId) {
    return this.fetchAPI(`/api/documents/${docId}/recent`, {
      method: 'POST',
    });
  },

  async getHistory(docId) {
    return this.fetchAPI(`/api/documents/${docId}/history`);
  },

  initWebSocket(documentId, onMessage, onStatusChange) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    let ws = null;
    let reconnectAttempts = 0;
    const maxReconnectDelay = 30000;
    let isIntentionallyClosed = false;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Connected to server');
        reconnectAttempts = 0;
        if (onStatusChange) onStatusChange('connected');
        ws.send(
          JSON.stringify({
            type: 'join-document',
            documentId,
            token: Auth.getToken(),
          })
        );
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
        if (isIntentionallyClosed) return;

        console.log('Disconnected from server');
        if (onStatusChange) onStatusChange('reconnecting');

        const delay = Math.min(Math.pow(2, reconnectAttempts) * 1000, maxReconnectDelay);
        reconnectAttempts++;

        setTimeout(connect, delay);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (onStatusChange) onStatusChange('offline');
        ws.close();
      };

      return ws;
    };

    const socketProxy = {
      send: (message) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
          return true;
        }
        return false;
      },
      close: () => {
        isIntentionallyClosed = true;
        if (ws) ws.close();
      },
    };

    connect();
    return socketProxy;
  },

  sendWS(wsProxy, message) {
    if (wsProxy) {
      wsProxy.send(message);
    }
  },
};
