import {
  addToRecent,
  apiRequest,
  createDocument,
  deleteDocument,
  fetchDocuments,
  getApiUrl,
  getDocumentSettings,
  getHistory,
  getWebSocketBaseUrl,
  initWebSocket,
  sendWS,
  setAuthHooks,
  transferOwnership,
  updateDocumentSettings,
} from '/js/core/api.js';
import { Auth } from '/js/features/auth/auth.js';

setAuthHooks({
  getToken: () => Auth.getToken?.(),
  setToken: (token) => Auth.setToken?.(token),
  logout: () => Auth.logout?.(),
});

export const Network = {
  fetchAPI: apiRequest,
  getDocuments: fetchDocuments,
  createDocument,
  deleteDocument,
  addToRecent,
  getHistory,
  getDocumentSettings,
  updateDocumentSettings,
  transferOwnership,
  getApiUrl,
  getWebSocketBaseUrl,
  initWebSocket,
  sendWS,
};
