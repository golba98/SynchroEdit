import { Network } from '/js/app/network.js';
import { getWebSocketBaseUrl } from '../config.js';
import { setConnectionState } from '../state.js';

export { getWebSocketBaseUrl };

export function connectDocumentSocket(documentId, onMessage, onStatusChange) {
  return Network.initWebSocket(documentId, onMessage, (status) => {
    setConnectionState(status);
    onStatusChange?.(status);
  });
}

export function sendSocketMessage(socket, message) {
  return Network.sendWS(socket, message);
}
