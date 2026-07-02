import { buildApiUrl, getRealtimeBackend, getWebSocketBaseUrl } from './config.js';

let refreshPromise = null;

let authHooks = {
  getToken: () => null,
  setToken: () => {},
  logout: async () => {},
};

export function setAuthHooks(hooks = {}) {
  authHooks = {
    ...authHooks,
    ...hooks,
  };
}

function isAuthRequest(url) {
  return (
    url.includes('/login') ||
    url.includes('/signup') ||
    url.includes('/send-verification') ||
    url.includes('/verify-email') ||
    url.includes('/logout') ||
    url.includes('/refresh-token')
  );
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function createApiError(response, data) {
  let message = `API error: ${response.status}`;
  if (data?.message) message = data.message;

  const error = new Error(message);
  error.status = response.status;
  error.data = data;

  if (
    response.status === 403 &&
    (message === 'Email verification required' || data?.code === 'email_verification_required')
  ) {
    error.code = 'EMAIL_VERIFICATION_REQUIRED';
  }

  return error;
}

async function refreshToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(buildApiUrl('/api/auth/refresh-token'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (response.ok) {
          const data = await parseJson(response);
          if (data?.token) {
            authHooks.setToken(data.token);
            return data.token;
          }
        }

        await authHooks.logout();
        return null;
      } catch {
        await authHooks.logout();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

export async function apiRequest(url, options = {}) {
  const token = authHooks.getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const requestUrl = buildApiUrl(url);
  let response = await fetch(requestUrl, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && !isAuthRequest(url)) {
    const newToken = await refreshToken();
    if (!newToken) return undefined;

    headers.Authorization = `Bearer ${newToken}`;
    response = await fetch(requestUrl, {
      ...options,
      headers,
      credentials: 'include',
    });
  }

  const data = await parseJson(response);
  if (!response.ok) {
    throw createApiError(response, data);
  }

  return data;
}

export function apiGet(url, options = {}) {
  return apiRequest(url, { ...options, method: options.method || 'GET' });
}

export function apiPost(url, body, options = {}) {
  return apiRequest(url, {
    ...options,
    method: options.method || 'POST',
    body: body === undefined ? options.body : JSON.stringify(body),
  });
}

export function apiPut(url, body, options = {}) {
  return apiRequest(url, {
    ...options,
    method: options.method || 'PUT',
    body: body === undefined ? options.body : JSON.stringify(body),
  });
}

export function apiPatch(url, body, options = {}) {
  return apiRequest(url, {
    ...options,
    method: options.method || 'PATCH',
    body: body === undefined ? options.body : JSON.stringify(body),
  });
}

export function apiDelete(url, options = {}) {
  return apiRequest(url, { ...options, method: options.method || 'DELETE' });
}

export function login(credentials) {
  return apiPost('/api/auth/login', credentials);
}

export function signup(payload) {
  return apiPost('/api/auth/signup', payload);
}

export function verifyEmail(payload) {
  return apiPost('/api/auth/verify-email', payload);
}

export function sendVerificationCode(payload) {
  return apiPost('/api/auth/send-verification', payload);
}

export function fetchDocuments() {
  return apiGet('/api/documents');
}

export function fetchDocument(documentId) {
  return apiGet(`/api/documents/${documentId}`);
}

export function saveDocument(documentId, payload) {
  return apiPut(`/api/documents/${documentId}`, payload);
}

export function createDocument(title = 'Untitled document', pages = [{ content: '' }]) {
  return apiPost('/api/documents', { title, pages });
}

export function deleteDocument(documentId) {
  return apiDelete(`/api/documents/${documentId}`);
}

export function addToRecent(documentId) {
  return apiPost(`/api/documents/${documentId}/recent`);
}

export function getHistory(documentId) {
  return apiGet(`/api/documents/${documentId}/history`);
}

export function getDocumentSettings(documentId) {
  return apiGet(`/api/documents/${documentId}/settings`);
}

export function updateDocumentSettings(documentId, settings) {
  return apiPatch(`/api/documents/${documentId}/settings`, settings);
}

export function transferOwnership(documentId, newOwnerUsername) {
  return apiPost(`/api/documents/${documentId}/transfer`, { newOwnerUsername });
}

export function updateProfile(payload) {
  return apiPatch('/api/user/profile', payload);
}

export function getApiUrl(url) {
  return buildApiUrl(url);
}

export { getWebSocketBaseUrl };

export function initWebSocket(documentId, onMessage, onStatusChange) {
  const wsUrl = getWebSocketBaseUrl();
  let ws = null;
  let reconnectAttempts = 0;
  const maxReconnectDelay = 30000;
  let isIntentionallyClosed = false;
  let reconnectTimer = null;
  let connectionGeneration = 0;

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const describeSocketEvent = (event, socket) => ({
    type: event?.type || 'unknown',
    code: typeof event?.code === 'number' ? event.code : null,
    reason: event?.reason || '',
    wasClean: typeof event?.wasClean === 'boolean' ? event.wasClean : null,
    readyState: socket?.readyState ?? null,
    documentId,
  });

  const scheduleReconnect = (reason) => {
    if (isIntentionallyClosed || reconnectTimer) return;

    const delay = Math.min(Math.pow(2, reconnectAttempts) * 1000, maxReconnectDelay);
    reconnectAttempts++;
    if (onStatusChange) onStatusChange('reconnecting');

    console.warn('Scheduling WebSocket reconnect', {
      documentId,
      reason,
      delay,
    });
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  const connect = async () => {
    if (isIntentionallyClosed) return;

    const generation = ++connectionGeneration;
    if (onStatusChange) onStatusChange('connecting');

    try {
      const { ticket } = await apiRequest('/api/auth/ws-ticket');
      if (isIntentionallyClosed || generation !== connectionGeneration) return;

      const realtimeBackend = getRealtimeBackend();
      let wsFullUrl;
      if (realtimeBackend === 'durable-object') {
        let base = wsUrl;
        if (!base.endsWith('/ws')) {
          base = `${base.replace(/\/+$/, '')}/ws`;
        }
        wsFullUrl = `${base}/${documentId}?ticket=${ticket}`;
      } else {
        wsFullUrl = `${wsUrl}/?documentId=${documentId}&ticket=${ticket}`;
      }

      const socket = new WebSocket(wsFullUrl);
      ws = socket;

      socket.onopen = () => {
        if (isIntentionallyClosed || generation !== connectionGeneration || socket !== ws) return;
        reconnectAttempts = 0;
        if (onStatusChange) onStatusChange('connected');
      };

      socket.onmessage = (event) => {
        if (isIntentionallyClosed || generation !== connectionGeneration || socket !== ws) return;
        try {
          onMessage(JSON.parse(event.data));
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      };

      socket.onclose = (event) => {
        if (generation !== connectionGeneration || socket !== ws) return;
        ws = null;
        if (isIntentionallyClosed) return;

        console.warn('WebSocket closed', describeSocketEvent(event, socket));
        scheduleReconnect('unexpected-close');
      };

      socket.onerror = (error) => {
        if (generation !== connectionGeneration || socket !== ws) return;
        console.error('WebSocket error:', describeSocketEvent(error, socket));
        socket.close();
      };
    } catch (error) {
      if (isIntentionallyClosed || generation !== connectionGeneration) return;
      console.error('Failed to acquire WS ticket or connect:', error);
      scheduleReconnect('connect-failed');
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
      connectionGeneration++;
      clearReconnectTimer();
      if (ws) {
        const socket = ws;
        ws = null;
        socket.close();
      }
    },
  };

  connect();
  return socketProxy;
}

export function sendWS(wsProxy, message) {
  if (wsProxy) {
    wsProxy.send(message);
  }
}
