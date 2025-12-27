import * as Y from 'yjs';

/**
 * PageManager
 * 
 * Implements the "Page Management and Page Forming Logic" using an iterative layout algorithm.
 * 
 * CORE LOGIC:
 * 1. Initialize Layout State (currentVerticalPosition = 0).
 * 2. Iterate Through Blocks (Lines in Quill).
 * 3. Determine Block's Rendered Height.
 * 4. Evaluate Page Break Conditions (Manual Break, Keep With Next, Overflow).
 * 5. Move content to next page (Create new page) or pull content back as needed.
 */
export class PageManager {
  constructor(editor) {
    this.editor = editor;
    this.isReflowing = false; 
    
    // Page Constants
    this.PAGE_HEIGHT = 1056; 
    this.PAGE_PADDING_Y = 60; // 30px top + 30px bottom
    this.EDITOR_PADDING_BOTTOM = 20; 
    this.MAX_CONTENT_HEIGHT = this.PAGE_HEIGHT - this.PAGE_PADDING_Y - this.EDITOR_PADDING_BOTTOM;
  }

  /**
   * Triggers the iterative flow algorithm starting from the modified page.
   */
  handlePageUpdate(startPageIndex) {
    if (this.isReflowing) return;
    this.isReflowing = true;

    // We use requestAnimationFrame to ensure the browser has performed layout
    // so our measurements (getBounds) are accurate.
    requestAnimationFrame(() => {
        try {
            this.reflowPage(startPageIndex);
        } finally {
            this.isReflowing = false;
        }
    });
  }

  /**
   * The core iterative layout engine for a single page.
   * It measures blocks and decides if they stay, move to next, or if next page content comes here.
   */
  reflowPage(pageIndex) {
    const quill = this.editor.pageQuillInstances[pageIndex];
    if (!quill) return;

    // 1. Initialize Layout State
    // We don't track pixel-perfect absolute position from top of document, 
    // but relative to the current page's content area.
    
    // Check Overflow (Condition C)
    const overflowInfo = this.findOverflowPoint(quill);
    
    if (overflowInfo.hasOverflow) {
        // Move excess content to the next page
        this.moveContentToNextPage(pageIndex, overflowInfo.splitIndex);
        return; // The move triggers an update on next page, continuing the chain
    } 
    
    // Check Underflow (Condition D - Pull Back)
    // Only if we didn't overflow, we check if we can fit more from the next page.
    this.checkUnderflowAndPull(pageIndex);
  }

  /**
   * Iterates through blocks to find where content exceeds the page height.
   * @returns {Object} { hasOverflow: boolean, splitIndex: number }
   */
  findOverflowPoint(quill) {
      const totalLength = quill.getLength();
      if (totalLength === 0) return { hasOverflow: false, splitIndex: 0 };

      // We scan to find the exact character where the bounds cross the MAX_CONTENT_HEIGHT.
      // Optimization: Check the end first.
      const endBounds = quill.getBounds(totalLength - 1);
      if (!endBounds || endBounds.bottom <= this.MAX_CONTENT_HEIGHT) {
          return { hasOverflow: false, splitIndex: 0 };
      }

      // Binary search for the split point to be efficient
      let low = 0;
      let high = totalLength - 1;
      let splitIndex = high;

      while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          const bounds = quill.getBounds(mid);
          
          if (bounds && bounds.bottom > this.MAX_CONTENT_HEIGHT) {
              splitIndex = mid; // This char is outside, try earlier
              high = mid - 1;
          } else {
              low = mid + 1;
          }
      }

      // splitIndex is the first character that DOES NOT fit (or fits very tightly).
      // We should verify if we are splitting a block (line) or between blocks.
      
      return { hasOverflow: true, splitIndex: splitIndex };
  }

  /**
   * Moves content starting from startIndex to the next page.
   * Handles creating a new page if needed.
   */
  moveContentToNextPage(pageIndex, startIndex) {
      const currentQuill = this.editor.pageQuillInstances[pageIndex];
      const lengthToMove = currentQuill.getLength() - startIndex;
      if (lengthToMove <= 0) return;

      const contentDelta = currentQuill.getContents(startIndex, lengthToMove);
      
      // Preserve selection relative to moved content
      const selection = currentQuill.getSelection();
      const shouldMoveCursor = selection && selection.index >= startIndex;
      const relativeCursorIndex = shouldMoveCursor ? selection.index - startIndex : 0;

      this.editor.doc.transact(() => {
          // 1. Remove from current
          currentQuill.deleteText(startIndex, lengthToMove, 'user');

          // 2. Add to next
          const nextPageIndex = pageIndex + 1;
          const nextQuill = this.editor.pageQuillInstances[nextPageIndex];

          if (nextQuill) {
              // Prepend to next page
              nextQuill.updateContents([{ insert: '' }, ...contentDelta.ops], 'user');
          } else {
              // Create new page
              const newPageMap = new Y.Map();
              const yText = new Y.Text();
              yText.applyDelta(contentDelta.ops);
              newPageMap.set('content', yText);
              this.editor.yPages.insert(nextPageIndex, [newPageMap]);
          }
      });

      // Handle Cursor
      if (shouldMoveCursor) {
          setTimeout(() => {
              const nextQuill = this.editor.pageQuillInstances[pageIndex + 1];
              if (nextQuill) {
                  this.editor.switchToPage(pageIndex + 1);
                  nextQuill.setSelection(Math.max(0, relativeCursorIndex), 0);
              }
          }, 20);
      }

      // Ripple: The next page might now overflow
      setTimeout(() => {
          this.handlePageUpdate(pageIndex + 1);
      }, 20);
  }

  /**
   * Logic to pull content from the next page if there is space.
   * "Condition D" in the algorithm.
   */
  checkUnderflowAndPull(pageIndex) {
      const currentQuill = this.editor.pageQuillInstances[pageIndex];
      const nextQuill = this.editor.pageQuillInstances[pageIndex + 1];
      if (!currentQuill || !nextQuill) return;

      // 1. Calculate Remaining Space
      const totalLength = currentQuill.getLength();
      // Handle empty page case
      const endBounds = totalLength > 0 ? currentQuill.getBounds(Math.max(0, totalLength - 1)) : { bottom: 0 };
      if (!endBounds) return;

      const currentBottom = endBounds.bottom;
      const remainingSpace = this.MAX_CONTENT_HEIGHT - currentBottom;

      // If we have less than a line's height of space (approx 20px), don't bother pulling
      if (remainingSpace < 20) return;

      // 2. Check First Block of Next Page
      // We need to know how tall the first block (line) of the next page IS.
      // This is tricky because it's rendered on the NEXT page (y=0).
      // We have to estimate or trial-move it.
      
      // Let's grab the first line of the next page
      // In Quill, lines are separated by \n. 
      // We identify the first \n.
      const nextText = nextQuill.getText();
      const firstNewLine = nextText.indexOf('\n');
      
      // If next page is empty or weird, stop
      if (firstNewLine === -1 && nextQuill.getLength() > 0) {
           // It's a single line document
      }
      
      const lengthToPull = (firstNewLine === -1) ? nextQuill.getLength() : firstNewLine + 1;
      
      // We can't easily "measure" how tall this text WOULD be on the previous page 
      // without moving it or using a hidden test container.
      // Approximation: Use the height it currently occupies on the next page?
      // No, because width might be same, but context (lists) might change.
      // However, usually it's close.
      
      const nextFirstBlockBounds = nextQuill.getBounds(lengthToPull - 1);
      // nextFirstBlockBounds.bottom is effectively the height of that block since it starts at 0.
      
      if (nextFirstBlockBounds && nextFirstBlockBounds.bottom <= remainingSpace) {
          // IT FITS!
          this.pullContentFromNextPage(pageIndex, lengthToPull);
      }
  }

  pullContentFromNextPage(pageIndex, lengthToPull) {
      const currentQuill = this.editor.pageQuillInstances[pageIndex];
      const nextQuill = this.editor.pageQuillInstances[pageIndex + 1];
      
      const contentToPull = nextQuill.getContents(0, lengthToPull);

      this.editor.doc.transact(() => {
          // 1. Append to current
          currentQuill.updateContents(contentToPull, 'user');
          
          // 2. Remove from next
          nextQuill.deleteText(0, lengthToPull, 'user');
          
          // 3. If next page is now empty, delete it
          if (nextQuill.getLength() <= 1) { // Just a newline
              this.editor.yPages.delete(pageIndex + 1, 1);
          }
      });
      
      // Recursive check: We pulled content, maybe we can pull MORE?
      // Or maybe we overflowed (unlikely if logic is correct, but safe to check).
      setTimeout(() => {
          this.handlePageUpdate(pageIndex);
      }, 20);
  }

  /**
   * Manual Page Break (Ctrl+Enter)
   * Enforces Condition A.
   */
  insertPageBreak(pageIndex) {
      const currentQuill = this.editor.pageQuillInstances[pageIndex];
      if (!currentQuill) return;

      const selection = currentQuill.getSelection();
      if (!selection) return;

      // Force move everything after cursor to new page
      this.moveContentToNextPage(pageIndex, selection.index);
  }

  mergeWithPreviousPage(pageIndex) {
    if (pageIndex <= 0) return;
    // Standard backspace merge logic
    // We treat this as a manual "pull all"
    const nextQuill = this.editor.pageQuillInstances[pageIndex];
    if (nextQuill) {
        this.pullContentFromNextPage(pageIndex - 1, nextQuill.getLength());
    }
  }

  isCursorAtBottom(pageIndex, cursorIndex) {
    const currentQuill = this.editor.pageQuillInstances[pageIndex];
    if (!currentQuill) return false;
    const bounds = currentQuill.getBounds(cursorIndex);
    return bounds && bounds.bottom > (this.MAX_CONTENT_HEIGHT - 40);
  }
}
