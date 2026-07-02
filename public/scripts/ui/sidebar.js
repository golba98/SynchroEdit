export function showLibrary(app) {
  return app?.libraryManager?.showLibrary?.();
}

export function openDocument(app, documentId) {
  return app?.libraryManager?.openDocument?.(documentId);
}

export function createNewDocument(app) {
  return app?.libraryManager?.createNewDocument?.();
}
