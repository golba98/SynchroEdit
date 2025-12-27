import * as Y from 'yjs';

/**
 * PageManager
 * 
 * Implements the "Page Management and Page Forming Logic" as defined in the project architecture.
 * Responsible for the "Flow Algorithm": breaking continuous content into discrete pages based on:
 * 1. Content Overflow (Primary Trigger)
 * 2. Manual Page Breaks
 * 3. Dynamic Reflow (Ripple effects)
 */
export class PageManager {
  constructor(editor) {
    this.editor = editor;
    this.isReflowing = false; // Prevents recursive loops during reflow
    
    // Constants for page dimensions (assuming US Letter / A4-ish for now as per CSS)
    this.PAGE_HEIGHT = 1056; 
    this.PAGE_PADDING_Y = 60; // 30px top + 30px bottom
    this.EDITOR_PADDING_BOTTOM = 20; // Internal Quill padding
    // The absolute maximum visual bottom coordinate for text before it must split
    this.MAX_TEXT_BOTTOM = this.PAGE_HEIGHT - this.PAGE_PADDING_Y - this.EDITOR_PADDING_BOTTOM; 
  }

  /**
   * Triggers the Flow Algorithm for a specific page.
   * Should be called whenever content changes on a page.
   */
  handlePageUpdate(pageIndex) {
    if (this.isReflowing) return;
    
    // Use requestAnimationFrame to ensure the DOM has updated (rendered the new text)
    // before we measure heights.
    requestAnimationFrame(() => {
        this.checkPageOverflow(pageIndex);
        this.checkPageUnderflow(pageIndex);
    });
  }

  /**
   * TRIGGER 1: Content Overflow
   * Checks if content has exceeded the page boundaries and moves excess to the next page.
   */
  checkPageOverflow(pageIndex) {
    const currentQuill = this.editor.pageQuillInstances[pageIndex];
    if (!currentQuill) return;

    const editorEl = document.querySelector(`#editor-${pageIndex} .ql-editor`);
    if (!editorEl) return;

    // 1. Quick Check: Does the Scroll Height exceed the allowed height?
    // We allow a small tolerance (1px) for sub-pixel rendering differences.
    const availableHeight = this.PAGE_HEIGHT - this.PAGE_PADDING_Y;
    const contentHeight = editorEl.scrollHeight;

    // If content fits comfortably, we might not need to split. 
    // BUT we must also check for specific block elements that might be pushed down 
    // even if the total height seems okay (unlikely in standard flow, but possible with floats/images).
    if (contentHeight <= availableHeight) {
        // Double check the last element's bounds just to be safe
        const length = currentQuill.getLength();
        if (length > 0) {
            const bounds = currentQuill.getBounds(length - 1);
            if (bounds && bounds.bottom <= this.MAX_TEXT_BOTTOM) {
                return; // No overflow
            }
        } else {
            return; // Empty page
        }
    }

    this.isReflowing = true;

    try {
        // 2. Find the Split Point
        // We need to find the exact index where content crosses the MAX_TEXT_BOTTOM threshold.
        // We scan backwards from the end of the document.
        let splitIndex = currentQuill.getLength() - 1;
        let foundFit = false;
        let safeguard = 0;
        const maxIterations = 5000; // Prevent infinite loops

        while (splitIndex > 0 && safeguard < maxIterations) {
            const bounds = currentQuill.getBounds(splitIndex);
            if (bounds && bounds.bottom <= this.MAX_TEXT_BOTTOM) {
                foundFit = true;
                break;
            }
            splitIndex--;
            safeguard++;
        }

        // If we found a fit, split AFTER this character. 
        // If we didn't (e.g., one huge image or block), we might have to force split 
        // or just accept it (for now, we force split at 0 if nothing fits, pushing all to next page)
        let moveStartIndex = foundFit ? splitIndex + 1 : 0;
        
        // Edge Case: If the split point is at the very end, there's nothing to move.
        // This can happen if the overflow was just a trailing newline that *barely* didn't fit,
        // or if the logic was too aggressive.
        if (moveStartIndex >= currentQuill.getLength()) {
            this.isReflowing = false;
            return;
        }

        // 3. Move Content (The "Flow")
        this.moveContentToNextPage(pageIndex, moveStartIndex);

    } finally {
        this.isReflowing = false;
    }
  }

  /**
   * Moves content from a specific index on one page to the start of the next page.
   * This is the core "Block Splitting" and "Reflow" mechanism.
   */
  moveContentToNextPage(pageIndex, startIndex) {
    const currentQuill = this.editor.pageQuillInstances[pageIndex];
    const lengthToMove = currentQuill.getLength() - startIndex;
    
    if (lengthToMove <= 0) return;

    // Extract the content to move (Delta)
    const contentDelta = currentQuill.getContents(startIndex, lengthToMove);
    
    // Preserve selection if it was in the moved part
    const selection = currentQuill.getSelection();
    const shouldMoveCursor = selection && selection.index >= startIndex;
    const relativeCursorIndex = shouldMoveCursor ? selection.index - startIndex : 0;

    this.editor.doc.transact(() => {
        // A. Remove from current page
        currentQuill.deleteText(startIndex, lengthToMove, 'user');

        // B. Insert into next page
        const nextPageExists = this.editor.pageQuillInstances[pageIndex + 1];

        if (nextPageExists) {
            // Prepend to next page
            // We insert a newline if needed, but usually we just prepend the Ops
            nextPageExists.updateContents([{ insert: '' }, ...contentDelta.ops], 'user');
        } else {
            // Create new page with this content
            const newPageMap = new Y.Map();
            const yText = new Y.Text();
            yText.applyDelta(contentDelta.ops);
            newPageMap.set('content', yText);
            this.editor.yPages.insert(pageIndex + 1, [newPageMap]);
        }
    });

    // C. Handle Cursor Focus
    if (shouldMoveCursor) {
        // We need to wait for the DOM to update so the next page exists and has bounds
        setTimeout(() => {
            const nextQuill = this.editor.pageQuillInstances[pageIndex + 1];
            if (nextQuill) {
                this.editor.switchToPage(pageIndex + 1);
                nextQuill.setSelection(Math.max(0, Math.min(relativeCursorIndex, nextQuill.getLength())), 0);
            }
        }, 50); // Small delay for rendering
    }

    // D. Ripple Effect (Reflow Optimization)
    // Checking overflow on the NEXT page to see if it now needs to split too.
    setTimeout(() => {
        this.checkPageOverflow(pageIndex + 1);
    }, 50);
  }

  /**
   * TRIGGER 2: Manual Page Breaks
   * Splits the content at the current cursor position and forces the rest onto a new page.
   */
  insertPageBreak(pageIndex) {
      const currentQuill = this.editor.pageQuillInstances[pageIndex];
      if (!currentQuill) return;

      const selection = currentQuill.getSelection();
      if (!selection) return;

      const splitIndex = selection.index;

      // Force move everything from splitIndex to the next page
      this.moveContentToNextPage(pageIndex, splitIndex);
  }


  /**
   * MERGE LOGIC (Underflow)
   * If a page becomes empty or could fit entirely on the previous page, we merge them.
   * This is part of the "Dynamic Reflow" - content pulling back.
   */
  checkPageUnderflow(pageIndex) {
      // We generally only auto-merge if a page becomes EMPTY or user backspaces from start of page.
      // Full "pull back" reflow is expensive to calculate constantly. 
      // Current logic: Handle "Merge with Previous" usually triggered by Backspace at index 0.
  }

  /**
   * Merges the current page's content into the previous page.
   * Usually triggered by Backspace at the start of a page.
   */
  mergeWithPreviousPage(pageIndex) {
    if (pageIndex <= 0) return;

    const currentQuill = this.editor.pageQuillInstances[pageIndex];
    const prevQuill = this.editor.pageQuillInstances[pageIndex - 1];
    if (!currentQuill || !prevQuill) return;

    const currentContent = currentQuill.getContents();
    const prevLength = prevQuill.getLength();

    this.editor.doc.transact(() => {
        // Append content to previous page
        prevQuill.updateContents(currentContent, 'user');
        
        // Remove current page from Yjs
        this.editor.yPages.delete(pageIndex, 1);
    });

    // Restore cursor
    setTimeout(() => {
        prevQuill.focus();
        prevQuill.setSelection(prevLength - 1, 0); // Position at the join point
        
        // Check if the previous page now overflows due to the merge
        this.checkPageOverflow(pageIndex - 1);
    }, 50);
  }

  /**
   * Helper: Determines if we should jump to the next page due to cursor position
   * (e.g. hitting Enter at the very bottom of the page)
   */
  isCursorAtBottom(pageIndex, cursorIndex) {
    const currentQuill = this.editor.pageQuillInstances[pageIndex];
    if (!currentQuill) return false;
    
    const bounds = currentQuill.getBounds(cursorIndex);
    if (!bounds) return false;

    // Threshold: if cursor is within the last 40px of the text area
    return bounds.bottom > (this.MAX_TEXT_BOTTOM - 40);
  }
}