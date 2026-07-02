import { Network } from '/js/app/network.js';
import { setCurrentDocument, setCurrentDocumentId } from '../state.js';

export function getDocumentIdFromUrl() {
  return new URLSearchParams(window.location.search).get('doc');
}

export async function fetchDocumentSettings(documentId) {
  return Network.getDocumentSettings(documentId);
}

export async function loadDocument(app, documentId = app?.documentId) {
  if (!app || !documentId) return null;
  setCurrentDocumentId(documentId);
  await app.loadDocument();
  return app.editor || null;
}

export function markCurrentDocument(documentData) {
  setCurrentDocument(documentData);
  return documentData;
}
