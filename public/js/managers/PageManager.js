import * as Y from 'yjs';

/**
 * PageManager
 * 
 * Implements the "Page Management and Page Forming Logic" from page.md.
 * 
 * Core Mandate:
 * "The system needs a layout engine that takes the ADM and iteratively places content onto pages. 
 * It starts with page 1, fills it until an overflow trigger occurs, then creates page 2, and so on."
 */
export class PageManager {
  constructor(editor) {
    this.editor = editor;
    this.isReflowing = false;

    // Constants (US Letter / A4 approximate)
    this.PAGE_HEIGHT = 1056; 
    this.PAGE_PADDING_Y = 80; // 30px top + 30px bottom + 20px editor top padding
    this.EDITOR_PADDING_BOTTOM = 20; 
    
    // The visual "waterline" - content below this pixel value must go to next page
    this.MAX_CONTENT_HEIGHT = this.PAGE_HEIGHT - this.PAGE_PADDING_Y - this.EDITOR_PADDING_BOTTOM;
  }

  getScale() {
    return (this.editor.currentZoom || 100) / 100;
  }

  /**
   * Main Entry Point: Called whenever content changes on a page.
   * Acts as the "Layout Engine" trigger.
   */
  handlePageUpdate(pageIndex) {
    // Debounce the reflow slightly to allow for faster typing
    if (this.reflowTimeout) clearTimeout(this.reflowTimeout);
    this.reflowTimeout = setTimeout(() => {
        if (this.isReflowing) return;
        this.isReflowing = true;
        requestAnimationFrame(() => {
            try {
                this.processPage(pageIndex);
            } finally {
                this.isReflowing = false;
            }
        });
    }, 100); // 100ms debounce
  }

  /**
   * Process a single page to enforce layout rules:
   * 1. Check for Vertical Overflow (Push to Next)
   * 2. Check for Underflow (Pull from Next)
   */
  processPage(pageIndex) {
    const quill = this.editor.pageQuillInstances[pageIndex];
    if (!quill) return;

    // --- STEP 1: CHECK OVERFLOW (The "New Page" Trigger) ---
    const overflowPoint = this.findOverflowPoint(quill);
    
    if (overflowPoint.hasOverflow) {
        // Safety: Only move if splitIndex > 0. 
        // If splitIndex is 0, it means the FIRST line overflows.
        // We cannot move it to the next page as it would cause an infinite loop.
        if (overflowPoint.splitIndex > 0) {
            this.splitAndMoveToNextPage(pageIndex, overflowPoint.splitIndex);
            return;
        }
    }

    // --- STEP 2: CHECK UNDERFLOW (Dynamic Reflow / Pull Back) ---
    // Only if we are NOT overflowing, we check if we can fit more.
    this.attemptMergeFromNextPage(pageIndex);
  }

  /**
   * Identifies if and where content overflows the page boundary.
   * Returns { hasOverflow: boolean, splitIndex: number }
   */
  findOverflowPoint(quill) {
      const totalLength = quill.getLength();
      if (totalLength <= 1) return { hasOverflow: false, splitIndex: 0 };

      const scale = this.getScale();
      const editorEl = quill.root;
      
      // A. Quick Check: Scroll Height (Normalized)
      // scrollHeight in some browsers is physical, in others logical. 
      // We'll prioritize bounds which are reliably scaled by transforms.
      const lastCharBounds = quill.getBounds(Math.max(0, totalLength - 1));
      if (lastCharBounds && (lastCharBounds.bottom / scale) <= this.MAX_CONTENT_HEIGHT) {
          return { hasOverflow: false, splitIndex: 0 };
      }

      // B. Binary Search for the specific character causing overflow
      let low = 0;
      let high = totalLength - 1;
      let splitIndex = -1;

      while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          const bounds = quill.getBounds(mid);
          
          // Normalize physical pixels to logical pixels
          const logicalBottom = bounds ? (bounds.bottom / scale) : 0;
          
          if (logicalBottom > this.MAX_CONTENT_HEIGHT) {
              splitIndex = mid;
              high = mid - 1;
          } else {
              low = mid + 1;
          }
      }

      // Safety: Only split if it's not the very beginning. 
      if (splitIndex > 0) {
          return { hasOverflow: true, splitIndex: splitIndex };
      }

      return { hasOverflow: false, splitIndex: 0 };
  }

  /**
   * Moves content from splitIndex onwards to the next page.
   */
  splitAndMoveToNextPage(pageIndex, splitIndex) {
      const currentQuill = this.editor.pageQuillInstances[pageIndex];
      const totalLength = currentQuill.getLength();
      
      // Safety: Don't move if the split is at the very beginning (prevent loops)
      if (splitIndex <= 0) return;

      console.log(`[Reflow] Page ${pageIndex} overflowing at index ${splitIndex}. Moving content to next page.`);

      const lengthToMove = totalLength - splitIndex;
      const contentToMove = currentQuill.getContents(splitIndex, lengthToMove);
      
      // Preserve selection state
      const selection = currentQuill.getSelection();
      const shouldMoveCursor = selection && selection.index >= splitIndex;
      const relativeCursorIndex = shouldMoveCursor ? selection.index - splitIndex : 0;

      this.editor.doc.transact(() => {
          // 1. Delete from current page
          currentQuill.deleteText(splitIndex, lengthToMove, 'user');

          // 2. Add to next page
          const nextPageIndex = pageIndex + 1;
          const nextQuill = this.editor.pageQuillInstances[nextPageIndex];

          if (nextQuill) {
              console.log(`[Reflow] Prepending content to existing Page ${nextPageIndex}`);
              // Prepend to next page
              const delta = { ops: contentToMove.ops };
              nextQuill.updateContents(delta, 'user');
          } else {
              console.log(`[Reflow] Creating NEW Page ${nextPageIndex}`);
              // Create new page
              const newPageMap = new Y.Map();
              const yText = new Y.Text();
              yText.applyDelta(contentToMove.ops);
              newPageMap.set('content', yText);
              this.editor.yPages.insert(nextPageIndex, [newPageMap]);
          }
      });

      // Handle Cursor Focus
      if (shouldMoveCursor) {
          setTimeout(() => {
              const nextQuill = this.editor.pageQuillInstances[pageIndex + 1];
              if (nextQuill) {
                  this.editor.switchToPage(pageIndex + 1);
                  nextQuill.setSelection(Math.max(0, relativeCursorIndex), 0);
              }
          }, 50);
      }

      // Ripple: Check the next page now
      setTimeout(() => {
          this.handlePageUpdate(pageIndex + 1);
      }, 50);
  }

  /**
   * Tries to pull content from the next page if there is space.
   */
  attemptMergeFromNextPage(pageIndex) {
      const currentQuill = this.editor.pageQuillInstances[pageIndex];
      const nextQuill = this.editor.pageQuillInstances[pageIndex + 1];

      if (!currentQuill || !nextQuill) return;

      // 1. Check Space on Current Page
      const currentLength = currentQuill.getLength();
      // Use the bounds of the last character/newline to determine current bottom
      const currentBounds = currentQuill.getBounds(Math.max(0, currentLength - 1));
      const scale = this.getScale();
      const currentBottom = currentBounds ? (currentBounds.bottom / scale) : 0;
      const spaceRemaining = this.MAX_CONTENT_HEIGHT - currentBottom;

      // Buffer to avoid precision issues and aggressive oscillation
      if (spaceRemaining < 15) return; 

      // 2. Identify Content to Pull (First Paragraph)
      const nextText = nextQuill.getText();
      const nextLength = nextQuill.getLength();
      
      // If next page is effectively empty (just a newline), we ignore it here.
      if (nextLength <= 1) return;

      const firstNewLine = nextText.indexOf('\n');
      const pullLength = (firstNewLine === -1) ? nextLength : firstNewLine + 1;

      // 3. Safety Check: Does at least one line fit?
      const firstCharBounds = nextQuill.getBounds(0);
      const firstLineHeight = firstCharBounds ? (firstCharBounds.height / scale) : 20;

      if (firstLineHeight > spaceRemaining) {
          // Not even a single line fits. Don't pull.
          return;
      }

      // 4. Move Content
      const contentToMove = nextQuill.getContents(0, pullLength);
      let nextPageDeleted = false;

      this.editor.doc.transact(() => {
          // Append to current page
          currentQuill.updateContents({ ops: contentToMove.ops }, 'user');

          // Delete from next page
          nextQuill.deleteText(0, pullLength, 'user');
          
          // Check if next page is now empty
          if (nextQuill.getLength() <= 1) {
              this.editor.yPages.delete(pageIndex + 1, 1);
              nextPageDeleted = true;
          }
      });

      // 5. Trigger Updates
      setTimeout(() => {
          this.handlePageUpdate(pageIndex);
          if (!nextPageDeleted) {
              this.handlePageUpdate(pageIndex + 1);
          }
      }, 50);
  }

  /**
   * Manual Break Support (Ctrl+Enter)
   */
  insertPageBreak(pageIndex) {
      const currentQuill = this.editor.pageQuillInstances[pageIndex];
      if (!currentQuill) return;
      
      const selection = currentQuill.getSelection();
      if (!selection) return;

      this.splitAndMoveToNextPage(pageIndex, selection.index);
  }

  /**
   * Helper: Backspace Merge
   */
  mergeWithPreviousPage(pageIndex) {
      if (pageIndex <= 0) return;
      // Just pull everything from current to previous
      const currentQuill = this.editor.pageQuillInstances[pageIndex];
      const prevQuill = this.editor.pageQuillInstances[pageIndex - 1];
      
      const content = currentQuill.getContents();
      const prevLength = prevQuill.getLength();
      
      this.editor.doc.transact(() => {
          prevQuill.updateContents(content, 'user');
          this.editor.yPages.delete(pageIndex, 1);
      });
      
      setTimeout(() => {
          prevQuill.focus();
          prevQuill.setSelection(prevLength - 1, 0);
          this.handlePageUpdate(pageIndex - 1);
      }, 50);
  }

  isCursorAtBottom(pageIndex, cursorIndex) {
      const currentQuill = this.editor.pageQuillInstances[pageIndex];
      if (!currentQuill) return false;
      const bounds = currentQuill.getBounds(cursorIndex);
      const scale = this.getScale();
      const logicalBottom = bounds ? (bounds.bottom / scale) : 0;
      return bounds && logicalBottom > (this.MAX_CONTENT_HEIGHT - 50);
  }
}