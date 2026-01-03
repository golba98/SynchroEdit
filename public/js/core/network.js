import { Auth } from '/js/ui/auth.js';

let _csrfToken = null;

export const Network = {
  async fetchCsrfToken() {
    try {
      const response = await fetch('/api/auth/csrf-token', { credentials: 'include' });
      const data = await response.json();
      _csrfToken = data.csrfToken;
      return _csrfToken;
    } catch (err) {
      console.error('Failed to fetch CSRF token:', err);
      return null;
    }
  },

  async fetchAPI(url, options = {}) {
    if (!_csrfToken && !url.includes('/csrf-token')) {
        await this.fetchCsrfToken();
    }

    let token = Auth.getToken();
    const headers = {
      'Content-Type': 'application/json',
      'X-CSRF-Token': _csrfToken,
      ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Debug CSRF
    // console.log(`[Network] Fetching ${url} with CSRF: ${_csrfToken ? _csrfToken.substring(0,10)+'...' : 'null'}`);

    let response = await fetch(url, { ...options, headers, credentials: 'include' });
    
    // Interceptor: Check for 403 (Forbidden) - could be CSRF failure
    if (response.status === 403 && !url.includes('/csrf-token')) {
        console.warn('Potential CSRF failure or access denied, retrying with fresh token...');
        await this.fetchCsrfToken();
        headers['X-CSRF-Token'] = _csrfToken;
        response = await fetch(url, { ...options, headers, credentials: 'include' });
    }

    // Interceptor: Check for 401 (Unauthorized)
    // Don't try to refresh if we are explicitly trying to login/signup/verify
    const isAuthRequest = url.includes('/login') || url.includes('/signup') || url.includes('/verify-email');
    
    if (response.status === 401 && !isAuthRequest) {
        console.log('Token expired, attempting refresh...');
        try {
            // Call refresh endpoint
            // Note: browser automatically sends cookies for same-origin requests
            const refreshResponse = await fetch('/api/auth/refresh-token', { 
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': _csrfToken
                },
                credentials: 'include'
            });
            
            if (refreshResponse.ok) {
                const data = await refreshResponse.json();
                Auth.setToken(data.token); // Update local token
                
                // Retry original request with new token
                headers.Authorization = `Bearer ${data.token}`;
                response = await fetch(url, { ...options, headers });
            } else {
                console.warn('Refresh failed, session expired.');
            }
        } catch (e) {
            console.error('Token refresh failed', e);
        }
    }

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

    const connect = async () => {
      if (isIntentionallyClosed) return;

      try {
          // 1. Get a fresh ticket before every connection attempt
          // This also verifies the session is still active
          const { ticket } = await this.fetchAPI('/api/auth/ws-ticket');
          
          const wsFullUrl = `${wsUrl}/?documentId=${documentId}&ticket=${ticket}`;
          ws = new WebSocket(wsFullUrl);

          ws.onopen = () => {
            console.log('Connected to server');
            reconnectAttempts = 0;
            if (onStatusChange) onStatusChange('connected');
            // No need to send join-document message as it is handled by URL params in upgrade
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
            // Don't call onStatusChange('offline') yet, let onclose handle reconnection
            ws.close();
          };
      } catch (err) {
          console.error('Failed to acquire WS ticket or connect:', err);
          if (onStatusChange) onStatusChange('reconnecting');
          
          // If the ticket fetch failed (e.g. 401), fetchAPI already tried to refresh the token.
          // If it still fails, the user is likely logged out.
          const delay = Math.min(Math.pow(2, reconnectAttempts) * 1000, maxReconnectDelay);
          reconnectAttempts++;
          setTimeout(connect, delay);
      }
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
