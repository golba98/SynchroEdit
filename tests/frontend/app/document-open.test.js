/**
 * @jest-environment jsdom
 */
import { UIManager } from '../../../public/js/features/ui/UIManager.js';
import { LibraryManager } from '../../../public/js/features/library/LibraryManager.js';

jest.mock('../../../public/js/features/editor/editor.js');
jest.mock('../../../public/js/app/network.js');
jest.mock('../../../public/js/features/theme/background.js', () => ({
  DynamicBackground: jest.fn().mockImplementation(() => ({
    init: jest.fn(),
    destroy: jest.fn(),
    setTheme: jest.fn(),
  })),
}));

describe('Document Opening Flow', () => {
  let app;
  let uiManager;
  let libraryManager;
  let nextToken;

  beforeEach(() => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
    document.body.innerHTML = `
      <div id="bootLoader" style="display:none"></div>
      <div id="docLibrary" style="display:block" class="view-visible"></div>
      <div id="libraryOverlay" style="display:block" class="view-visible"></div>
      <div class="header"></div>
      <div class="ribbon-tabs"></div>
      <div class="ribbon-content"></div>
      <div class="main-workspace">
        <div id="editorSkeleton" class="hidden" aria-busy="false">
          <div class="editor-loading-paper"><img src="/logo.svg" alt="" /></div>
          <div id="editorSkeletonStatus"></div>
          <div id="editorSkeletonTitle"></div>
          <div id="editorSkeletonDescription"></div>
          <div id="editorSkeletonMessage" hidden></div>
          <div id="editorOpenError" hidden>
            <div id="editorOpenErrorMessage"></div>
            <button id="editorOpenRetry"></button>
            <button id="editorOpenBack"></button>
          </div>
        </div>
        <div id="pagesContainer" style="opacity:0"></div>
      </div>
      <button id="createNewDoc"></button>
      <input id="docSearch" />
    `;

    nextToken = 0;
    app = {
      user: { isEmailVerified: true },
      documentId: null,
      openingDocumentId: null,
      documentLoadState: 'idle',
      isEditorReadyForCurrentDocument: jest.fn().mockReturnValue(false),
      loadDocument: jest.fn().mockResolvedValue(true),
    };
    uiManager = new UIManager(app);
    libraryManager = new LibraryManager(app);
    app.uiManager = uiManager;
    app.libraryManager = libraryManager;
    app.beginDocumentOpen = jest.fn(({ mode }) => {
      nextToken += 1;
      app.documentLoadState = mode;
      uiManager.setDocumentOpenState(mode);
      return nextToken;
    });

    const { Network } = require('../../../public/js/app/network.js');
    Network.createDocument = jest.fn().mockResolvedValue({ _id: 'new-doc-id' });
    document.body.dataset.viewState = 'dashboard';
  });

  test('create starts one paper-first session and passes its token through loading', async () => {
    const surface = document.getElementById('editorSkeleton');
    const promise = libraryManager.createNewDocument();

    expect(surface.classList.contains('hidden')).toBe(false);
    expect(surface.getAttribute('aria-busy')).toBe('true');
    expect(document.getElementById('editorSkeletonTitle').textContent).toBe('Creating document...');
    expect(document.body.dataset.viewState).toBe('opening-document');

    await promise;
    expect(app.beginDocumentOpen).toHaveBeenCalledTimes(1);
    expect(app.loadDocument).toHaveBeenCalledWith({
      mode: 'loading-content',
      isNewDocument: true,
      requestToken: 1,
    });
  });

  test('open starts one session and passes the same token to content loading', async () => {
    const surface = document.getElementById('editorSkeleton');
    const promise = libraryManager.openDocument('some-doc-id');

    expect(surface.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('editorSkeletonTitle').textContent).toBe('Opening document...');
    await promise;

    expect(app.beginDocumentOpen).toHaveBeenCalledTimes(1);
    expect(app.loadDocument).toHaveBeenCalledWith({
      mode: 'loading-content',
      isNewDocument: false,
      requestToken: 1,
    });
  });

  test('all loading phases update the same DOM surface', () => {
    const surface = document.getElementById('editorSkeleton');
    uiManager.setDocumentOpenState('creating');
    expect(document.getElementById('editorSkeletonTitle').textContent).toBe('Creating document...');

    uiManager.setDocumentOpenState('loading-content');
    expect(document.getElementById('editorSkeleton')).toBe(surface);
    expect(document.getElementById('editorSkeletonTitle').textContent).toBe('Opening document...');

    uiManager.setDocumentOpenState('initial-syncing');
    expect(document.getElementById('editorSkeleton')).toBe(surface);
    expect(document.getElementById('editorSkeletonTitle').textContent).toBe('Syncing document...');
  });

  test('the obsolete loading surfaces are not present', () => {
    expect(document.getElementById('documentOpeningLoader')).toBeNull();
    expect(document.getElementById('editorWorkspaceLoader')).toBeNull();
  });

  test('ready hides the one loading surface and reveals pages', () => {
    const surface = document.getElementById('editorSkeleton');
    uiManager.setDocumentOpenState('opening');
    expect(surface.classList.contains('hidden')).toBe(false);

    uiManager.clearOpeningDocumentState();
    expect(surface.classList.contains('hidden')).toBe(true);
    expect(surface.getAttribute('aria-busy')).toBe('false');
    expect(document.body.dataset.documentOpenState).toBe('ready');
  });

  test('failure stays in the same surface with accessible recovery actions', () => {
    const surface = document.getElementById('editorSkeleton');
    const retry = jest.fn();
    const back = jest.fn();
    uiManager.setDocumentOpenState('opening');
    uiManager.showDocumentOpenError({
      message: 'Open failed',
      onRetry: retry,
      onBack: back,
    });

    expect(document.getElementById('editorSkeleton')).toBe(surface);
    expect(surface.classList.contains('hidden')).toBe(false);
    expect(surface.classList.contains('has-error')).toBe(true);
    expect(surface.getAttribute('aria-busy')).toBe('false');
    expect(document.getElementById('editorOpenErrorMessage').textContent).toBe('Open failed');
  });

  test('post-ready connection changes cannot revive loading', () => {
    uiManager.clearOpeningDocumentState();
    app.isEditorReadyForCurrentDocument.mockReturnValue(true);
    uiManager.setDocumentOpenState('initial-syncing');

    expect(uiManager.documentOpenState).toBe('ready');
    expect(document.getElementById('editorSkeleton').classList.contains('hidden')).toBe(true);
  });
});
