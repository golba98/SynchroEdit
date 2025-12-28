export class CursorManager {
  constructor(editor) {
    this.editor = editor;
    this.currentRange = null;
  }

  setupPageListeners(pageQuill, pageId) {
    // Selection Change
    pageQuill.on('selection-change', (range) => {
      if (range) {
        this.currentRange = range;
        const pages = this.editor.yPages.toArray();
        const pageIndex = pages.findIndex(p => p.get('id') === pageId);
        
        if (pageIndex !== -1) {
          // Notify SelectionManager
          if (this.editor.selectionManager) {
            this.editor.selectionManager.updateSelection(pageIndex, range);
          }

          if (pageIndex !== this.editor.currentPageIndex) {
            this.editor.quill = pageQuill;
            this.editor.currentPageIndex = pageIndex;
            this.editor.onPageChange(pageIndex);
          }
        }
      }
    });

    // Mouse Down - Start Selection
    pageQuill.root.addEventListener('mousedown', (e) => {
        const pages = this.editor.yPages.toArray();
        const pageIndex = pages.findIndex(p => p.get('id') === pageId);
        const range = pageQuill.getSelection();
        if (range && this.editor.selectionManager) {
            this.editor.selectionManager.handleMouseDown(pageIndex, range);
        }
    });
  }

  getSelection() {
    if (this.editor.quill) {
      return this.editor.quill.getSelection();
    }
    return null;
  }

  setSelection(index, length = 0, source = 'api') {
    if (this.editor.quill) {
      this.editor.quill.setSelection(index, length, source);
    }
  }

  focus() {
    if (this.editor.quill) {
      this.editor.quill.focus();
    }
  }

  scrollToCursor(pageIndex) {
    const pageMap = this.editor.yPages.get(pageIndex);
    if (!pageMap) return;
    const pageId = pageMap.get('id');
    const container = document.getElementById(`page-container-${pageId}`);
    if (container) {
      container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}
