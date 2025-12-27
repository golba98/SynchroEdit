import { get, set } from 'https://unpkg.com/idb-keyval@6.2.1/dist/index.js';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { QuillBinding } from 'y-quill';
import { PageManager } from '/js/managers/PageManager.js';
import { BorderManager } from '/js/managers/BorderManager.js';
import { CursorManager } from '/js/managers/CursorManager.js';
import { ImageManager } from '/js/managers/ImageManager.js';
import { ToolbarController } from '/js/ui/ToolbarController.js';
import { ReadabilityManager } from '/js/managers/ReadabilityManager.js';
import { NavigationManager } from '/js/managers/NavigationManager.js';
import { Auth } from '/js/ui/auth.js';
import { debounce } from '/js/core/utils.js';

export class Editor {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (this.container) this.container.innerHTML = ''; // Clear static content
    this.quill = null; // Current active quill
    this.pageQuillInstances = {}; // index -> Quill
    this.pageBindings = {}; // index -> QuillBinding
    this.currentPageIndex = 0;
    this.currentZoom = 100;
    
    // Callbacks
    this.onPageChange = options.onPageChange || (() => {});
    this.onTitleChange = options.onTitleChange || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onCollaboratorsChange = options.onCollaboratorsChange || (() => {});

    this.initQuill();
    
    // Yjs Setup
    this.doc = new Y.Doc();
    const docId = new URLSearchParams(window.location.search).get('doc');
    const token = Auth.getToken();
    const user = options.user || { username: 'Anonymous', accentColor: '#ff0000' };
    this.user = user;
    this.yPages = this.doc.getArray('pages');

    // Managers
    this.pageManager = new PageManager(this);
    this.borderManager = new BorderManager(this);
    this.cursorManager = new CursorManager(this);
    this.imageManager = new ImageManager(this);
    this.toolbarController = new ToolbarController(this);
    this.readabilityManager = new ReadabilityManager(this);
    this.navigationManager = new NavigationManager(this);
    
    this.setupGlobalListeners();

    // 1. Instant Load from IndexedDB
    this.loadFromCache(docId).then(() => {
        // Only connect after cache check (or concurrently, but we apply cache first)
        this.connectWebSocket(docId, user);
    });

    this.yPages.observe(event => {
        this.renderAllPages();
    });

    this.setupTitleDebounce();
    this.setupScrollListener();
    
    // Render placeholder immediately for perceived performance
    this.createPlaceholderPage();
  }

  setupScrollListener() {
    const container = document.getElementById('pagesContainer');
    if (!container) return;

    container.addEventListener('scroll', debounce(() => {
        // If user is actively typing in a specific quill, prioritize that page's index
        // to prevent the status bar from flickering while they work at the edge of a page.
        if (document.activeElement && document.activeElement.closest('.ql-editor')) {
            const activePageEl = document.activeElement.closest('.editor-container');
            if (activePageEl) {
                const activeIndex = Array.from(this.container.querySelectorAll('.editor-container')).indexOf(activePageEl);
                if (activeIndex !== -1 && activeIndex !== this.currentPageIndex) {
                    this.currentPageIndex = activeIndex;
                    this.quill = this.pageQuillInstances[activeIndex];
                    this.onPageChange(activeIndex);
                    return;
                }
            }
        }

        const pages = this.container.querySelectorAll('.editor-container');
        let closestPageIndex = this.currentPageIndex;
        let minDistance = Infinity;

        const containerRect = container.getBoundingClientRect();
        const containerCenter = containerRect.top + (containerRect.height / 2);
        const scale = this.currentZoom / 100;

        pages.forEach((page, index) => {
            const rect = page.getBoundingClientRect();
            // Calculate center in logical space
            const pageCenter = rect.top + (rect.height / 2);
            
            // At 50% zoom, the visual distance is half, but we want the logical priority.
            // Using distance is fine, but we divide by scale to normalize.
            const distance = Math.abs(pageCenter - containerCenter) / scale;

            if (distance < minDistance) {
                minDistance = distance;
                closestPageIndex = index;
            }
        });

        if (closestPageIndex !== this.currentPageIndex) {
            console.log(`[Scroll] Page changed from ${this.currentPageIndex} to ${closestPageIndex} (Closest to center)`);
            this.currentPageIndex = closestPageIndex;
            this.quill = this.pageQuillInstances[closestPageIndex];
            this.onPageChange(closestPageIndex);
        }
    }, 150));
  }

  async loadFromCache(docId) {
      if (!docId) return;
      try {
          const cachedUpdate = await get(`doc-store-${docId}`);
          if (cachedUpdate) {
              console.log('Loaded document from IndexedDB cache');
              Y.applyUpdate(this.doc, cachedUpdate);
              this.renderAllPages(); // Force render immediately with cached content
          }
      } catch (err) {
          console.warn('Failed to load from IndexedDB:', err);
      }
  }

  async connectWebSocket(docId, user) {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    
    // Fetch a fresh ticket
    let ticket;
    try {
        const response = await fetch('/api/auth/ws-ticket', {
            headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                // Attempt refresh
                const refreshed = await Auth.tryRefresh();
                if (refreshed) {
                    return this.connectWebSocket(docId, user);
                }
            }
            throw new Error(`Failed to fetch ticket: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        ticket = data.ticket;
    } catch (err) {
        console.error('Failed to get WS ticket:', err);
        // Retry later
        setTimeout(() => this.connectWebSocket(docId, user), 1000);
        return;
    }

    if (this.provider) {
        this.provider.destroy();
    }

    this.provider = new WebsocketProvider(
        `${protocol}://${window.location.host}`, 
        docId, // Pass docId as room name
        this.doc,
        { params: { ticket: ticket } } // Pass ticket as param
    );

    this.provider.on('status', async ({ status }) => {
        this.onStatusChange(status);
        if (status === 'disconnected') {
            console.log('[WebSocket] Disconnected. Fetching fresh ticket for next retry...');
            try {
                let response = await fetch('/api/auth/ws-ticket', {
                    headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
                });
                
                if (response.status === 401) {
                    const refreshed = await Auth.tryRefresh();
                    if (refreshed) {
                        response = await fetch('/api/auth/ws-ticket', {
                            headers: { 'Authorization': `Bearer ${refreshed}` }
                        });
                    }
                }

                if (response.ok) {
                    const data = await response.json();
                    this.provider.params.ticket = data.ticket;
                    console.log('[WebSocket] Ticket refreshed.');
                }
            } catch (err) {
                console.warn('[WebSocket] Failed to refresh ticket:', err);
            }
        }
    });
    
    this.provider.on('sync', isSynced => {
        if (isSynced && this.yPages.length === 0) {
            const newPage = new Y.Map();
            const content = new Y.Text();
            newPage.set('content', content);
            this.yPages.push([newPage]);
        }
        if (isSynced) {
             // After sync, ensure all existing pages are bound to awareness
             Object.keys(this.pageQuillInstances).forEach(index => {
                 if (!this.pageBindings[index]) {
                     const pageQuill = this.pageQuillInstances[index];
                     const pageMap = this.yPages.get(parseInt(index));
                     if (pageMap) {
                         const yText = pageMap.get('content');
                         if (this.provider && this.provider.awareness) {
                             const binding = new QuillBinding(yText, pageQuill, this.provider.awareness);
                             this.pageBindings[index] = binding;
                         }
                     }
                 }
             });
             this.renderAllPages();
             this.saveToCache(docId);
        }
    });
  }

  async reconnect(user = null) {
      console.log('Forcing editor reconnection...');
      if (user) {
          this.user = user;
      }
      const docId = new URLSearchParams(window.location.search).get('doc');
      await this.connectWebSocket(docId, this.user);
  }

  updateUser(user) {
    this.user = user;
    if (this.provider && this.provider.awareness) {
        if (user.showOnlineStatus !== false) {
            this.provider.awareness.setLocalStateField('user', {
                username: user.username,
                profilePicture: user.profilePicture,
                color: user.accentColor || user.color || '#' + Math.floor(Math.random()*16777215).toString(16)
            });
        } else {
            this.provider.awareness.setLocalStateField('user', null);
        }
    }
  }

  async saveToCache(docId) {
      if (!docId) return;
      // Debounce saving if needed, but IDB is fast enough for occasional updates
      // Y.encodeStateAsUpdate is efficient
      const update = Y.encodeStateAsUpdate(this.doc);
      await set(`doc-store-${docId}`, update);
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
    
    // 1. Reconcile bindings/editors (Handle insertions/shifts)
    pages.forEach((pageMap, index) => {
        const yText = pageMap.get('content');
        const currentBinding = this.pageBindings[index];
        
        // If there is a binding but it doesn't match the current Y.Text (index shift), destroy it
        if (currentBinding && currentBinding.type !== yText) {
            this.destroyPageEditor(index);
        }
        
        // If no editor exists (or was just destroyed), create/recreate it
        if (!this.pageQuillInstances[index]) {
            this.createPageEditor(index, pageMap);
        }
    });

    // 2. Remove extra pages that no longer exist (Handle deletions from end)
    Object.keys(this.pageQuillInstances).forEach(idxStr => {
        const idx = parseInt(idxStr);
        if (idx >= pages.length) {
            this.destroyPageEditor(idx);
        }
    });

    this.applyZoom();
    
    // Ensure active quill is synced with current instance (might have been recreated)
    if (this.pageQuillInstances[this.currentPageIndex]) {
        this.quill = this.pageQuillInstances[this.currentPageIndex];
    }

    // Ensure active quill is set if not already
    if (!this.quill && this.pageQuillInstances[0]) {
        this.switchToPage(0);
    }
  }

  setupGlobalListeners() {
    // Fallback: If user clicks the container but no editor is focused, focus the current one
    this.container.addEventListener('click', (e) => {
        if (e.target === this.container && this.quill) {
            this.quill.focus();
        }
    });
  }

  destroyPageEditor(index) {
      const container = document.getElementById(`page-container-${index}`);
      if (container) container.remove();
      
      if (this.pageBindings[index]) {
          this.pageBindings[index].destroy();
          delete this.pageBindings[index];
      }
      if (this.pageQuillInstances[index]) {
          delete this.pageQuillInstances[index];
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
          syntax: {
            highlight: text => hljs.highlightAuto(text).value,
          },
          history: { // Disable Quill's history, use Yjs history
             userOnly: true 
          }
      },
    });

    this.pageQuillInstances[pageIndex] = pageQuill;
    
    // Update line numbers on change
    pageQuill.on('text-change', () => {
        if (this.readabilityManager.showLineNumbers) {
            this.readabilityManager.updateGutter(pageIndex);
        }
        // CALL THE NEW FLOW ALGORITHM
        this.pageManager.handlePageUpdate(pageIndex);
    });
    
    // Bind Y.Text (if provider/awareness is ready)
    const yText = pageMap.get('content');
    if (this.provider && this.provider.awareness) {
        const binding = new QuillBinding(yText, pageQuill, this.provider.awareness);
        this.pageBindings[pageIndex] = binding;
    }

    this.cursorManager.setupPageListeners(pageQuill, pageIndex);
    this.readabilityManager.onPageCreated(pageIndex, newPageContainer);

    const qlEditor = newPageContainer.querySelector('.ql-editor');
    if (qlEditor) {
      qlEditor.addEventListener('keydown', (e) => this.handleKeyDown(e, pageIndex), true);
    }
  }

  handleKeyDown(e, pageIndex) {
    const pageQuill = this.pageQuillInstances[pageIndex];

    // MANUAL PAGE BREAK (Ctrl + Enter)
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.pageManager.insertPageBreak(pageIndex);
        return;
    }
    
    // STANDARD PAGE FLOW ON ENTER
    if (e.key === 'Enter') {
        const range = pageQuill.getSelection();
        if (range) {
             const isAtBottom = this.pageManager.isCursorAtBottom(pageIndex, range.index);
             if (isAtBottom) {
                 console.log(`[Input] Enter pressed at bottom of Page ${pageIndex}. Triggering break.`);
                 e.preventDefault();
                 this.pageManager.insertPageBreak(pageIndex);
                 return;
             }
        }
    }

    // BACKSPACE MERGE
    if (e.key === 'Backspace' && pageIndex > 0) {
      const range = pageQuill.getSelection();
      if ((range && range.index === 0 && range.length === 0) || pageQuill.getLength() <= 1) {
        e.preventDefault();
        this.pageManager.mergeWithPreviousPage(pageIndex);
      }
    }

    // NAVIGATION
    
    // Horizontal Navigation (Left/Right)
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

    // Vertical Navigation (Up/Down)
    if (e.key === 'ArrowUp' && pageIndex > 0) {
        const range = pageQuill.getSelection();
        if (range) {
            const [line] = pageQuill.getLine(range.index);
            // If no previous line exists, we are at the top
            if (!line.prev) {
                e.preventDefault();
                this.switchToPage(pageIndex - 1, 'end');
            }
        }
    }

    if (e.key === 'ArrowDown' && pageIndex < this.yPages.length - 1) {
        const range = pageQuill.getSelection();
        if (range) {
            const [line] = pageQuill.getLine(range.index);
            // If no next line exists, we are at the bottom
            if (!line.next) {
                e.preventDefault();
                this.switchToPage(pageIndex + 1, 'start');
            }
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

  isPageEffectivelyEmpty(pageIndex) {
      const quill = this.pageQuillInstances[pageIndex];
      if (!quill) return true;
      const text = quill.getText().trim();
      return quill.getLength() <= 1 || text === '';
  }

  removeTrailingEmptyPage(pageIndex) {
      const isLastPage = pageIndex === this.yPages.length - 1;
      if (!isLastPage || this.yPages.length <= 1) return false;
      if (!this.isPageEffectivelyEmpty(pageIndex)) return false;
      this.deletePage(pageIndex);
      return true;
  }

  switchToPage(pageIndex, cursorPosition = null) {
    // If we're leaving an empty trailing page, remove it so navigation back collapses it.
    const leavingIndex = this.currentPageIndex;
    if (pageIndex !== leavingIndex) {
      const removed = this.removeTrailingEmptyPage(leavingIndex);
      if (removed && pageIndex >= this.yPages.length) {
        pageIndex = this.yPages.length - 1;
      }
    }

    if (pageIndex < 0 || pageIndex >= this.yPages.length) return;

    console.log(`[Switch] Switching to page ${pageIndex} (Previous: ${this.currentPageIndex})`);
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
    const pageHeight = 1056;
    const TARGET_GAP = 40; // Desired visual gap in screen pixels

    // Update layout engine height (logical pixels)
    if (this.pageManager) {
        this.pageManager.MAX_CONTENT_HEIGHT = (this.pageManager.PAGE_HEIGHT - this.pageManager.PAGE_PADDING_Y - this.pageManager.EDITOR_PADDING_BOTTOM);
        console.log(`[Zoom] Level: ${this.currentZoom}%, Scale: ${scale}, MAX_CONTENT_HEIGHT: ${this.pageManager.MAX_CONTENT_HEIGHT}`);
    }

    containers.forEach((container) => {
      container.style.transform = `scale(${scale})`;
      container.style.transformOrigin = 'top center';
      
      // Calculate inverse margin:
      // When scaled, the container's physical height is pageHeight * scale.
      // The space it occupies in the flow is still pageHeight (unscaled) because transform doesn't change flow.
      // So we need to subtract the 'shrunk' part and add the desired gap.
      const shrunkAmount = pageHeight * (1 - scale);
      container.style.marginBottom = `${TARGET_GAP - shrunkAmount}px`;
    });
  }
  
  // Public API compatibility
  get pages() {
      return this.yPages.toArray().map(map => ({ content: map.get('content') })); // Mock for read-only access
  }
}