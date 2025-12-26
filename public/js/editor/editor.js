import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { QuillBinding } from 'y-quill';
import { PageManager } from '/js/managers/PageManager.js';
import { BorderManager } from '/js/managers/BorderManager.js';
import { CursorManager } from '/js/managers/CursorManager.js';
import { ImageManager } from '/js/managers/ImageManager.js';
import { ToolbarController } from '/js/ui/ToolbarController.js';
import { Auth } from '/js/ui/auth.js';
import { debounce, Storage } from '/js/core/utils.js';

export class Editor {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (this.container) this.container.innerHTML = ''; // Clear static content
    this.quill = null; // Current active quill
    this.pageQuillInstances = {}; // index -> Quill
    this.pageBindings = {}; // index -> QuillBinding
    this.currentPageIndex = 0;
    this.currentZoom = 100;
    this.docId = new URLSearchParams(window.location.search).get('doc');
    
    // Callbacks
    this.onPageChange = options.onPageChange || (() => {});
    this.onTitleChange = options.onTitleChange || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onCollaboratorsChange = options.onCollaboratorsChange || (() => {});

    // Managers
    this.pageManager = new PageManager(this);
    this.borderManager = new BorderManager(this);
    this.cursorManager = new CursorManager(this);
    this.imageManager = new ImageManager(this);
    this.toolbarController = new ToolbarController(this);

    this.initQuill();
    
    // Yjs Setup
    this.doc = new Y.Doc();
    const token = Auth.getToken();
    const user = options.user || { username: 'Anonymous', accentColor: '#ff0000' };
    
    // Phase 2: Load local snapshot for instant rendering
    this.loadSnapshot();

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}/ws`;
    this.provider = new WebsocketProvider(
        wsUrl,
        this.docId,
        this.doc,
        { params: { token: token } }
    );
    
    this.provider.awareness.setLocalStateField('user', {
        name: user.username,
        color: user.accentColor || user.color || '#' + Math.floor(Math.random()*16777215).toString(16)
    });
    
    this.provider.awareness.on('change', () => {
        const states = this.provider.awareness.getStates();
        const users = [];
        states.forEach(state => {
            if (state.user) {
                users.push(state.user);
            }
        });
        this.onCollaboratorsChange(users);
    });
    
    this.statusTimeout = null;
    this.provider.on('status', event => {
        console.log('Yjs WebSocket status:', event.status);
        
        if (event.status === 'connected') {
            if (this.statusTimeout) {
                clearTimeout(this.statusTimeout);
                this.statusTimeout = null;
            }
            this.onStatusChange(event.status);
        } else {
            // Delay reporting disconnected/connecting status to avoid flicker
            if (!this.statusTimeout) {
                this.statusTimeout = setTimeout(() => {
                    this.onStatusChange(event.status);
                    this.statusTimeout = null;
                }, 5000);
            }
        }
    });

    this.yPages = this.doc.getArray('pages');
    this.yPages.observe(event => {
        this.renderAllPages();
    });
    
    // Wait for initial sync to render or create default page
    this.provider.on('sync', isSynced => {
        if (isSynced) {
            if (this.yPages.length === 0) {
                // Create initial page if empty
                const newPage = new Y.Map();
                const content = new Y.Text();
                newPage.set('content', content);
                this.yPages.push([newPage]);
            }
            this.renderAllPages();
            this.saveSnapshot(); // Save once synced
        }
    });

    this.doc.on('update', () => {
        // Debounced save for performance
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => this.saveSnapshot(), 2000);
    });

    this.setupTitleDebounce();
    
    // Render placeholder immediately for perceived performance
    this.createPlaceholderPage();
  }

  async loadSnapshot() {
    try {
        const snapshot = await Storage.get(`snapshot_${this.docId}`);
        if (snapshot) {
            console.log('Loading instant snapshot from local storage...');
            Y.applyUpdate(this.doc, snapshot, 'local-snapshot');
            this.renderAllPages();
        }
    } catch (e) {
        console.warn('Failed to load local snapshot', e);
    }
  }

  async saveSnapshot() {
    try {
        const state = Y.encodeStateAsUpdate(this.doc);
        await Storage.set(`snapshot_${this.docId}`, state);
    } catch (e) {
        console.warn('Failed to save snapshot', e);
    }
  }

  createPlaceholderPage() {
      // Create a visual placeholder that looks exactly like a page
      const placeholderId = 'page-placeholder';
      if (document.getElementById(placeholderId)) return;
      
      const newPageContainer = document.createElement('div');
      newPageContainer.className = 'editor-container';
      newPageContainer.id = placeholderId;
      newPageContainer.style.opacity = '0.7'; // Slight transparency to indicate loading
      newPageContainer.innerHTML = `
              <div class="page-border-inner" style="position: absolute; top: 20px; left: 20px; right: 20px; bottom: 20px; pointer-events: none; border: 1px solid transparent; z-index: 5;"></div>
              <div class="page-editor ql-container ql-snow" style="position: relative; z-index: 1;">
                  <div class="ql-editor" data-placeholder="Loading document..." contenteditable="false"></div>
              </div>
          `;
  
      this.container.appendChild(newPageContainer);
      
      // Apply current border settings if possible
      const borderElement = newPageContainer.querySelector('.page-border-inner');
      if (borderElement) {
        this.borderManager.applyBorderToElement(borderElement);
      }
      
      this.applyZoom();
  }

  initQuill() {
    const Size = Quill.import('attributors/style/size');
    Size.whitelist = ['8px', '9px', '10px', '11px', '12px', '14px', '16px', '18px', '20px', '22px', '24px', '26px', '28px', '36px', '48px', '72px'];
    Quill.register(Size, true);

    const Font = Quill.import('formats/font');
    Font.whitelist = ['roboto', 'open-sans', 'lato', 'montserrat', 'oswald', 'merriweather', 'arial', 'times-new-roman', 'courier-new', 'georgia', 'verdana'];
    Quill.register(Font, true);

    // Image Styles
    const Parchment = Quill.import('parchment');
    const Style = Parchment.Attributor.Style;
    
    const Width = new Style('width', 'width', { scope: Parchment.Scope.INLINE });
    const Height = new Style('height', 'height', { scope: Parchment.Scope.INLINE });
    const Float = new Style('float', 'float', { whitelist: ['left', 'right', 'none'], scope: Parchment.Scope.INLINE });
    const Display = new Style('display', 'display', { whitelist: ['inline', 'block', 'inline-block'], scope: Parchment.Scope.INLINE });
    const Margin = new Style('margin', 'margin', { scope: Parchment.Scope.INLINE });

    Quill.register(Width, true);
    Quill.register(Height, true);
    Quill.register(Float, true);
    Quill.register(Display, true);
    Quill.register(Margin, true);
  }

  setupTitleDebounce() {
    const docTitle = document.getElementById('docTitle');
    // Bind title to Yjs (simple map for metadata)
    const meta = this.doc.getMap('meta');
    
    if (docTitle) {
      // Incoming changes
      meta.observe(event => {
          if (event.keysChanged.has('title')) {
              const newTitle = meta.get('title');
              if (docTitle.value !== newTitle) {
                  docTitle.value = newTitle;
                  this.onTitleChange(newTitle);
              }
          }
      });
      
      // Outgoing changes
      docTitle.addEventListener('input', (e) => {
        meta.set('title', e.target.value);
        this.onTitleChange(e.target.value);
      });
    }
  }

  renderAllPages() {
    if (!this.container) return;

    // Remove placeholder if exists
    const placeholder = document.getElementById('page-placeholder');
    if (placeholder) {
        placeholder.remove();
    }

    const pages = this.yPages.toArray();
    
    // 1. Remove pages that no longer exist
    Object.keys(this.pageQuillInstances).forEach(idxStr => {
        const idx = parseInt(idxStr);
        if (idx >= pages.length) {
            const container = document.getElementById(`page-container-${idx}`);
            if (container) container.remove();
            
            if (this.pageBindings[idx]) {
                this.pageBindings[idx].destroy();
                delete this.pageBindings[idx];
            }
            delete this.pageQuillInstances[idx];
        }
    });

    // 2. Add or update pages
    pages.forEach((pageMap, index) => {
        if (!this.pageQuillInstances[index]) {
            this.createPageEditor(index, pageMap);
        }
    });
    
    this.applyZoom();
    
    // Ensure active quill is set
    if (!this.quill && this.pageQuillInstances[0]) {
        this.switchToPage(0);
    }
  }

  createPageEditor(pageIndex, pageMap) {
    const newPageContainer = document.createElement('div');
    newPageContainer.className = 'editor-container';
    newPageContainer.id = `page-container-${pageIndex}`;
    newPageContainer.innerHTML = `
            <div class="page-border-inner" style="position: absolute; top: 20px; left: 20px; right: 20px; bottom: 20px; pointer-events: none; border: 1px solid transparent; z-index: 5;"></div>
            <div id="editor-${pageIndex}" class="page-editor" data-page-index="${pageIndex}" style="position: relative; z-index: 1;"></div>
        `;

    this.container.appendChild(newPageContainer);

    const borderElement = newPageContainer.querySelector('.page-border-inner');
    if (borderElement) {
      this.borderManager.applyBorderToElement(borderElement);
    }

    const pageQuill = new Quill(`#editor-${pageIndex}`, {
      theme: 'snow',
      placeholder: 'Start typing...',
      modules: { 
          toolbar: false,
          history: { // Disable Quill's history, use Yjs history
             userOnly: true 
          }
      },
    });

    this.pageQuillInstances[pageIndex] = pageQuill;
    
    // Bind Y.Text
    const yText = pageMap.get('content');
    const binding = new QuillBinding(yText, pageQuill, this.provider.awareness);
    this.pageBindings[pageIndex] = binding;

    this.cursorManager.setupPageListeners(pageQuill, pageIndex);

    const qlEditor = newPageContainer.querySelector('.ql-editor');
    if (qlEditor) {
      qlEditor.addEventListener('keydown', (e) => this.handleKeyDown(e, pageIndex), true);
    }
  }

  handleKeyDown(e, pageIndex) {
    const pageQuill = this.pageQuillInstances[pageIndex];
    if (e.key === 'Backspace' && pageIndex > 0) {
      const range = pageQuill.getSelection();
      if ((range && range.index === 0 && range.length === 0) || pageQuill.getLength() <= 1) {
        e.preventDefault();
        this.mergeWithPreviousPage(pageIndex); // Moved logic here or update PageManager
      }
    }

    if (e.key === 'ArrowLeft' && pageIndex > 0) {
      const range = pageQuill.getSelection();
      if (range && range.index === 0) {
        e.preventDefault();
        this.switchToPage(pageIndex - 1, 'end');
      }
    }

    if (e.key === 'ArrowRight' && pageIndex < this.yPages.length - 1) {
      const range = pageQuill.getSelection();
      if (range && range.index >= pageQuill.getLength() - 1) {
        e.preventDefault();
        this.switchToPage(pageIndex + 1, 'start');
      }
    }
  }
  
  // Custom Page Logic adapted for Yjs
  addNewPage() {
      const newPage = new Y.Map();
      const content = new Y.Text();
      newPage.set('content', content);
      this.yPages.push([newPage]);
  }
  
  deletePage(index) {
      if (this.yPages.length > 1) {
          this.yPages.delete(index, 1);
      }
  }
  
  mergeWithPreviousPage(index) {
      if (index <= 0) return;
      
      const prevPageMap = this.yPages.get(index - 1);
      const currPageMap = this.yPages.get(index);
      
      const prevText = prevPageMap.get('content');
      const currText = currPageMap.get('content');
      
      // Move content to previous page
      // Y.Text doesn't support direct append easily without formatted delta
      // Actually, we can insert content. 
      // Simplified: We rely on user to manually move content if they delete the page break,
      // or we programmatically move it.
      
      // For now, let's just delete the empty page if it's empty
      if (currText.length === 0) {
          this.deletePage(index);
          this.switchToPage(index - 1, 'end');
      }
  }

  switchToPage(pageIndex, cursorPosition = null) {
    if (pageIndex < 0 || pageIndex >= this.yPages.length) return;

    this.currentPageIndex = pageIndex;
    this.quill = this.pageQuillInstances[pageIndex];

    if (this.quill) {
      this.cursorManager.focus();
      if (cursorPosition === 'end') {
        this.cursorManager.setSelection(this.quill.getLength() - 1, 0);
      } else if (cursorPosition === 'start') {
        this.cursorManager.setSelection(0, 0);
      }

      this.cursorManager.scrollToCursor(pageIndex);
      this.onPageChange(pageIndex);
    }
  }

  applyZoom() {
    const containers = document.querySelectorAll('.editor-container');
    const scale = this.currentZoom / 100;
    const pageHeight = 950;

    containers.forEach((container) => {
      container.style.transform = `scale(${scale})`;
      container.style.transformOrigin = 'top center';
      container.style.marginBottom = `${40 + pageHeight * (scale - 1)}px`;
    });
  }
  
  // Public API compatibility
  get pages() {
      return this.yPages.toArray().map(map => ({ content: map.get('content') })); // Mock for read-only access
  }
}