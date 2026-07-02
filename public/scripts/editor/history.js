import { Network } from '/js/app/network.js';

export function fetchDocumentHistory(documentId) {
  return Network.getHistory(documentId);
}

export function showDocumentHistory(uiManager) {
  return uiManager?.showHistory?.();
}
