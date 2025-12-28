import * as Y from 'yjs';

export const PAGE_SIZES = {
    a4: { height: 1123, width: 794 }, 
    letter: { height: 1056, width: 816 }, 
    legal: { height: 1344, width: 816 }   
};

/**
 * PageManager
 * 
 * High-precision pagination engine.
 */
export class PageManager {
  constructor(editor) {
    this.editor = editor;
    this.isReflowing = false;
    this.pendingUpdate = null;
    
    // Initial Setup
    this.PAGE_HEIGHT = PAGE_SIZES.letter.height; 
    this.MEASUREMENT_LEEWAY_PX = 2; // Very tight buffer
    this.estimatedPageHeights = new Map(); 
    this.reflowTimeout = null;

    // Waterline calculation
    this.MAX_CONTENT_HEIGHT = this.PAGE_HEIGHT - 100; 
  }

  setPageSize(sizeName) {
      const size = PAGE_SIZES[sizeName] || PAGE_SIZES.letter;
      this.PAGE_HEIGHT = size.height;
      this.MAX_CONTENT_HEIGHT = this.PAGE_HEIGHT - 100;
      this.performReflowCheck();
  }

  getScale() {
    return (this.editor.currentZoom || 100) / 100;
  }

  handleContentChange(pageIndex, changeDelta, source) {
    if (source !== 'user') return;

    if (this.reflowTimeout) clearTimeout(this.reflowTimeout);
    this.reflowTimeout = setTimeout(() => {
        requestAnimationFrame(() => this.performReflowCheck());
    }, 50); 
  }

  performReflowCheck() {
    if (this.isReflowing) return;
    this.isReflowing = true;

    try {
        const pages = this.editor.yPages.toArray();
        for (let i = 0; i < pages.length; i++) {
            const pageMap = pages[i];
            const pageId = pageMap.get('id');
            const quill = this.editor.pageQuillInstances.get(pageId);
            if (!quill) continue;

            const scale = this.getScale();
            // Use precise last character check
            const totalLength = quill.getLength();
            if (totalLength <= 1) continue;

            const lastCharBounds = quill.getBounds(totalLength - 1);
            const actualBottom = (lastCharBounds ? lastCharBounds.bottom : 0) / scale;

            // --- OVERFLOW CHECK ---
            if (actualBottom > (this.MAX_CONTENT_HEIGHT + this.MEASUREMENT_LEEWAY_PX)) {
                console.log(`[PageManager] Page ${i} OVERFLOW: ${actualBottom.toFixed(1)}px > ${this.MAX_CONTENT_HEIGHT}px`);
                const overflow = this.findOverflowPointPrecise(quill);
                if (overflow.hasOverflow) {
                    this.splitAndMoveToNextPage(i, overflow.splitIndex);
                    return; 
                }
            }

            // --- UNDERFLOW CHECK ---
            if (actualBottom < (this.MAX_CONTENT_HEIGHT - 60)) {
                const merged = this.attemptMergeFromNextPage(i);
                if (merged) return; 
            }
        }
    } finally {
        this.isReflowing = false;
    }
  }

  findOverflowPointPrecise(quill) {
      const totalLength = quill.getLength();
      const scale = this.getScale();
      
      // Binary search characters to find exactly where the waterline is crossed
      let low = 0;
      let high = totalLength - 1;
      let splitIndex = -1;

      while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          const bounds = quill.getBounds(mid);
          const logicalBottom = (bounds ? bounds.bottom : 0) / scale;

          if (logicalBottom > this.MAX_CONTENT_HEIGHT) {
              splitIndex = mid;
              high = mid - 1;
          } else {
              low = mid + 1;
          }
      }

      if (splitIndex > 0) return { hasOverflow: true, splitIndex };
      return { hasOverflow: false, splitIndex: 0 };
  }

  splitAndMoveToNextPage(pageIndex, splitIndex) {
      const currentPageMap = this.editor.yPages.get(pageIndex);
      const currentQuill = this.editor.pageQuillInstances.get(currentPageMap.get('id'));
      
      const selection = currentQuill.getSelection();
      const shouldMoveCursor = selection && selection.index >= splitIndex;
      const relativeCursorIndex = shouldMoveCursor ? selection.index - splitIndex : 0;

      const contentToMove = currentQuill.getContents(splitIndex);

      console.log(`[PageManager] Splitting Page ${pageIndex} at index ${splitIndex}`);

      this.editor.doc.transact(() => {
          currentQuill.deleteText(splitIndex, currentQuill.getLength() - splitIndex, 'user');

          const nextPageIndex = pageIndex + 1;
          const nextPageMap = this.editor.yPages.get(nextPageIndex);
          const nextQuill = nextPageMap ? this.editor.pageQuillInstances.get(nextPageMap.get('id')) : null;

          if (nextQuill) {
              nextQuill.updateContents({ ops: [...contentToMove.ops] }, 'user');
          } else {
              const newPageMap = new Y.Map();
              newPageMap.set('id', Math.random().toString(36).substr(2, 9));
              const yText = new Y.Text();
              yText.applyDelta(contentToMove.ops);
              newPageMap.set('content', yText);
              this.editor.yPages.insert(nextPageIndex, [newPageMap]);
          }
      });

      if (shouldMoveCursor) {
          requestAnimationFrame(() => {
              this.editor.switchToPage(pageIndex + 1);
              const nextPageMap = this.editor.yPages.get(pageIndex + 1);
              if (nextPageMap) {
                  const targetQuill = this.editor.pageQuillInstances.get(nextPageMap.get('id'));
                  if (targetQuill) {
                      targetQuill.focus();
                      targetQuill.setSelection(Math.max(0, relativeCursorIndex), 0);
                  }
              }
          });
      }

      requestAnimationFrame(() => this.performReflowCheck());
  }

  attemptMergeFromNextPage(pageIndex) {
      // Underflow merges are temporarily disabled to prevent new pages from being collapsed immediately.
      // This keeps only overflow-driven splits active, which guarantees new pages form as soon as content
      // crosses the waterline.
      return false;
  }

  isCursorAtBottom(pageIndex, cursorIndex) {
      const pageMap = this.editor.yPages.get(pageIndex);
      if (!pageMap) return false;
      const quill = this.editor.pageQuillInstances.get(pageMap.get('id'));
      if (!quill) return false;
      const bounds = quill.getBounds(cursorIndex);
      const scale = this.getScale();
      const logicalBottom = (bounds ? bounds.bottom : 0) / scale;
      return bounds && logicalBottom > (this.MAX_CONTENT_HEIGHT - 50);
  }

  insertPageBreak(pageIndex) {
      const pageMap = this.editor.yPages.get(pageIndex);
      if (!pageMap) return;
      const quill = this.editor.pageQuillInstances.get(pageMap.get('id'));
      const selection = quill.getSelection();
      if (selection) this.splitAndMoveToNextPage(pageIndex, selection.index);
  }

  mergeWithPreviousPage(pageIndex) {
      if (pageIndex <= 0) return;
      const currentMap = this.editor.yPages.get(pageIndex);
      const prevMap = this.editor.yPages.get(pageIndex - 1);
      const currentQuill = this.editor.pageQuillInstances.get(currentMap.get('id'));
      const prevQuill = this.editor.pageQuillInstances.get(prevMap.get('id'));
      
      const content = currentQuill.getContents();
      const prevLength = prevQuill.getLength();
      
      this.editor.doc.transact(() => {
          prevQuill.updateContents({ ops: [{ retain: prevLength - 1 }, ...content.ops] }, 'user');
          this.editor.yPages.delete(pageIndex, 1);
      });
      
      requestAnimationFrame(() => {
          this.editor.switchToPage(pageIndex - 1);
          prevQuill.focus();
          prevQuill.setSelection(prevLength - 1, 0);
          this.performReflowCheck();
      });
  }
}