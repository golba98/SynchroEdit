import { PageManager } from '/js/managers/PageManager.js';
import { BorderManager } from '/js/managers/BorderManager.js';
import { CursorManager } from '/js/managers/CursorManager.js';
import { ToolbarController } from '/js/ui/ToolbarController.js';
import { ptToPx, debounce } from '/js/core/utils.js';

export class Editor {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.quill = null;
    this.pageQuillInstances = {};
    this.pages = options.pages || [{ content: '' }];
    this.currentPageIndex = 0;
    this.currentZoom = 100;
    this.isLoadingFromServer = false;

    this.onContentChange = options.onContentChange || (() => {});
    this.onPageChange = options.onPageChange || (() => {});
    this.onTitleChange = options.onTitleChange || (() => {});

    this.pageManager = new PageManager(this);
    this.borderManager = new BorderManager(this);
    this.cursorManager = new CursorManager(this);
    this.toolbarController = new ToolbarController(this);

    this.initQuill();
    this.setupTitleDebounce();

    // Debounce the content change notification to avoid overwhelming the server
    this.debouncedNotifyContentChange = debounce((pageIndex, content) => {
      this.onContentChange('update-page', { pageIndex, content });
    }, 500);
  }

  initQuill() {
    const Size = Quill.import('attributors/style/size');
    Size.whitelist = [
      '8px',
      '9px',
      '10px',
      '11px',
      '12px',
      '14px',
      '16px',
      '18px',
      '20px',
      '22px',
      '24px',
      '26px',
      '28px',
      '36px',
      '48px',
      '72px',
    ];
    Quill.register(Size, true);

    const Font = Quill.import('formats/font');
    Font.whitelist = [
      'roboto',
      'open-sans',
      'lato',
      'montserrat',
      'oswald',
      'merriweather',
      'arial',
      'times-new-roman',
      'courier-new',
      'georgia',
      'verdana',
    ];
    Quill.register(Font, true);
  }

  setupTitleDebounce() {
    const docTitle = document.getElementById('docTitle');
    if (docTitle) {
      const debouncedTitle = debounce((title) => {
        this.onTitleChange(title);
      }, 1000);

      docTitle.addEventListener('input', (e) => {
        debouncedTitle(e.target.value);
      });
    }
  }

  renderAllPages() {
    if (!this.container) return;

    const wasLoading = this.isLoadingFromServer;
    this.isLoadingFromServer = true;

    this.container.innerHTML = '';
    this.pageQuillInstances = {};

    // Render pages sequentially to keep UI responsive
    const renderRemaining = (indices) => {
      if (indices.length === 0) {
        this.isLoadingFromServer = wasLoading;
        this.applyZoom();
        return;
      }

      const index = indices.shift();
      this.createPageEditor(index);

      // Yield to UI thread
      requestAnimationFrame(() => renderRemaining(indices));
    };

    const indices = this.pages.map((_, i) => i);
    renderRemaining(indices);

    // Ensure we focus the correct page after rendering
    setTimeout(() => this.switchToPage(this.currentPageIndex), 100);
  }

  createPageEditor(pageIndex) {
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
      modules: { toolbar: false },
    });

    this.pageQuillInstances[pageIndex] = pageQuill;
    this.cursorManager.setupPageListeners(pageQuill, pageIndex);

    if (this.pages[pageIndex] && this.pages[pageIndex].content) {
      pageQuill.setContents(this.pages[pageIndex].content);
    }

    const qlEditor = newPageContainer.querySelector('.ql-editor');
    if (qlEditor) {
      qlEditor.addEventListener('keydown', (e) => this.handleKeyDown(e, pageIndex), true);
    }

    pageQuill.on('text-change', (delta, oldDelta, source) => {
      if (source === 'user' && !this.isLoadingFromServer) {
        const currentDelta = pageQuill.getContents();

        // Optimistic local state update
        this.pages[pageIndex].content = currentDelta;

        // Debounced server notification
        this.debouncedNotifyContentChange(pageIndex, currentDelta);

        // Check for page overflow
        this.pageManager.checkAndCreateNewPage(pageIndex);
      }
    });
  }

  handleKeyDown(e, pageIndex) {
    const pageQuill = this.pageQuillInstances[pageIndex];
    if (e.key === 'Backspace' && pageIndex > 0) {
      const range = pageQuill.getSelection();
      if ((range && range.index === 0 && range.length === 0) || pageQuill.getLength() <= 1) {
        e.preventDefault();
        this.pageManager.mergeWithPreviousPage(pageIndex);
      }
    }

    if (e.key === 'ArrowLeft' && pageIndex > 0) {
      const range = pageQuill.getSelection();
      if (range && range.index === 0) {
        e.preventDefault();
        this.switchToPage(pageIndex - 1, 'end');
      }
    }

    if (e.key === 'ArrowRight' && pageIndex < this.pages.length - 1) {
      const range = pageQuill.getSelection();
      if (range && range.index >= pageQuill.getLength() - 1) {
        e.preventDefault();
        this.switchToPage(pageIndex + 1, 'start');
      }
    }
  }

  switchToPage(pageIndex, cursorPosition = null) {
    if (pageIndex < 0 || pageIndex >= this.pages.length) return;

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

  updateFromSync(data) {
    this.isLoadingFromServer = true;
    this.pages = data.pages;
    this.currentPageIndex = data.currentPageIndex || 0;
    this.renderAllPages();
    this.isLoadingFromServer = false;
  }

  updatePageContent(pageIndex, content) {
    if (this.pages[pageIndex]) {
      this.pages[pageIndex].content = content;
    }
    const targetQuill = this.pageQuillInstances[pageIndex];
    if (targetQuill && !this.isLoadingFromServer) {
      const wasLoading = this.isLoadingFromServer;
      this.isLoadingFromServer = true;
      targetQuill.setContents(content);
      this.isLoadingFromServer = wasLoading;
    }
  }
}
