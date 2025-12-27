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
    this.PAGE_PADDING_Y = 60; // 30px top + 30px bottom
    this.EDITOR_PADDING_BOTTOM = 20; 
    
    // The visual "waterline" - content below this pixel value must go to next page
    this.MAX_CONTENT_HEIGHT = this.PAGE_HEIGHT - this.PAGE_PADDING_Y - this.EDITOR_PADDING_BOTTOM;
  }

  /**
   * Main Entry Point: Called whenever content changes on a page.
   * Acts as the "Layout Engine" trigger.
   */
  handlePageUpdate(pageIndex) {
    if (this.isReflowing) return;
    this.isReflowing = true;

    // Wait for DOM to paint so measurements are accurate
    requestAnimationFrame(() => {
        try {
            this.processPage(pageIndex);
        } finally {
            this.isReflowing = false;
        }
    });
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
        this.splitAndMoveToNextPage(pageIndex, overflowPoint.splitIndex);
        return; // Moving content triggers update on next page, continuing the flow.
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
      if (totalLength === 0) return { hasOverflow: false, splitIndex: 0 };

      // A. Quick Check: Scroll Height
      // If the scrollHeight is within bounds, we likely don't need to do expensive checks.
      const editorEl = quill.root;
      if (editorEl.scrollHeight <= this.MAX_CONTENT_HEIGHT) {
           // Double check bounds of last char just to be safe (e.g. negative margins?)
           const endBounds = quill.getBounds(Math.max(0, totalLength - 1));
           if (!endBounds || endBounds.bottom <= this.MAX_CONTENT_HEIGHT) {
               return { hasOverflow: false, splitIndex: 0 };
           }
      }

      // B. Binary Search for the specific character causing overflow
      // We want the last character that *FITS*, or the first that *DOESN'T*.
      let low = 0;
      let high = totalLength - 1;
      let splitIndex = -1;

      while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          const bounds = quill.getBounds(mid);
          
          if (bounds && bounds.bottom > this.MAX_CONTENT_HEIGHT) {
              splitIndex = mid; // This one is too low, try earlier
              high = mid - 1;
          } else {
              low = mid + 1; // This one fits, try later
          }
      }

      if (splitIndex !== -1) {
          return { hasOverflow: true, splitIndex: splitIndex };
      }

      // Fallback: ScrollHeight says yes, but bounds said no?
      // This happens with empty newlines at the end or block elements.
      if (editorEl.scrollHeight > this.MAX_CONTENT_HEIGHT) {
          // Just split the last paragraph/block to force flow
          return { hasOverflow: true, splitIndex: Math.max(0, totalLength - 2) };
      }

      return { hasOverflow: false, splitIndex: 0 };
  }

  /**
   * Moves content from splitIndex onwards to the next page.
   */
  splitAndMoveToNextPage(pageIndex, splitIndex) {
      const currentQuill = this.editor.pageQuillInstances[pageIndex];
      const lengthToMove = currentQuill.getLength() - splitIndex;
      
      if (lengthToMove <= 0) return;

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
              // Prepend to next page
              nextQuill.updateContents([{ insert: '' }, ...contentToMove.ops], 'user');
          } else {
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
      if (!nextQuill) return;

      // 1. Calculate Space Remaining
      const totalLength = currentQuill.getLength();
      const endBounds = currentQuill.getBounds(Math.max(0, totalLength - 1));
      
      let currentBottom = 0;
      if (endBounds) currentBottom = endBounds.bottom;
      
      const spaceRemaining = this.MAX_CONTENT_HEIGHT - currentBottom;

      // If very little space, don't bother (hysteresis to prevent flickering)
      if (spaceRemaining < 25) return; 

      // 2. Identify "Block" to pull
      // We pull the first line (paragraph) from the next page.
      const nextText = nextQuill.getText();
      let firstNewLine = nextText.indexOf('\n');
      if (firstNewLine === -1) firstNewLine = nextText.length; // Pull everything if no newline

      const lengthToPull = firstNewLine + 1; // Include the newline

      // 3. Heuristic Check: Will it fit?
      // Since we can't measure it before moving, we guess based on character count density 
      // or just try it. A "Try and Revert" is expensive in Yjs.
      // Better heuristic: Assume 1 line ~ 20px. 
      // If we are pulling a huge paragraph, we might pull too much.
      // Let's rely on the "Split" logic to fix it if we pull too much. 
      // i.e., Pull it -> if it overflows -> Split logic will kick it back.
      // This "Ping Pong" is risky if thresholds are identical.
      // So we need a safety buffer. Only pull if we have SIGNIFICANT space (e.g. 50px).
      if (spaceRemaining < 50) return;

      const contentToPull = nextQuill.getContents(0, lengthToPull);

      this.editor.doc.transact(() => {
          currentQuill.updateContents(contentToPull, 'user');
          nextQuill.deleteText(0, lengthToPull, 'user');
          
          if (nextQuill.getLength() <= 1) {
              this.editor.yPages.delete(pageIndex + 1, 1);
          }
      });

      // Trigger update to verify fit (and potentially split back if we made a mistake)
      setTimeout(() => {
          this.handlePageUpdate(pageIndex);
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
      return bounds && bounds.bottom > (this.MAX_CONTENT_HEIGHT - 30);
  }
}