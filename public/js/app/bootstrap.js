export async function initEditorPage() {
  if (window.__syncroEditApp) {
    return window.__syncroEditApp;
  }

  window.__SYNCROEDIT_USE_MAIN_ENTRY__ = true;
  const { App } = await import('/js/app/app.js');
  const app = new App();
  window.__syncroEditApp = app;
  return app;
}
