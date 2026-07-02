export const state = {
  currentUser: null,
  currentDocument: null,
  currentDocumentId: null,
  currentPage: 0,
  connectionState: 'idle',
  saveState: 'saved',
};

export function setCurrentUser(user) {
  state.currentUser = user || null;
}

export function setCurrentDocument(documentData) {
  state.currentDocument = documentData || null;
  state.currentDocumentId = documentData?.id || documentData?.documentId || null;
}

export function setCurrentDocumentId(documentId) {
  state.currentDocumentId = documentId || null;
}

export function setCurrentPage(pageIndex) {
  state.currentPage = Number.isInteger(pageIndex) ? pageIndex : 0;
}

export function setConnectionState(connectionState) {
  state.connectionState = connectionState || 'idle';
}

export function setSaveState(saveState) {
  state.saveState = saveState || 'saved';
}
