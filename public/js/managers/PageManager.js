import * as Y from 'yjs';

export class PageManager {
  constructor(editor) {
    this.editor = editor;
    this.isSplitting = false;
  }

  isCursorAtBottom(pageIndex, cursorIndex) {
    const currentQuill = this.editor.pageQuillInstances[pageIndex];
    if (!currentQuill) return false;
    
    const bounds = currentQuill.getBounds(cursorIndex);
    if (!bounds) return false;

    const pageHeight = 1056; 
    const availableHeight = pageHeight - 60; // 996
    const editorPaddingBottom = 20;
    
    // The visual bottom limit for text
    const maxTextBottom = availableHeight - editorPaddingBottom; // 976
    
    // Check if we are within a line-height (approx 24px) of the bottom
    const threshold = 30; 
    
    return bounds.bottom > maxTextBottom - threshold;
  }

  moveToNextPage(pageIndex) {
    const nextPageExists = this.editor.pageQuillInstances[pageIndex + 1];
    
    if (nextPageExists) {
        this.editor.switchToPage(pageIndex + 1, 'start');
    } else {
        this.editor.addNewPage();
        // Wait for Yjs observation -> render cycle
        setTimeout(() => {
           this.editor.switchToPage(pageIndex + 1, 'start');
        }, 50);
    }
  }

  checkAndCreateNewPage(pageIndex) {
    if (this.isSplitting) return;

    const pageContainer = document.querySelector(`#page-container-${pageIndex}`);
    const editorContainer = document.querySelector(`#editor-${pageIndex}`);
    if (!pageContainer || !editorContainer) return;

    const qlEditor = editorContainer.querySelector('.ql-editor');
    if (!qlEditor) return;

    // Use requestAnimationFrame to ensure we have latest layout
    requestAnimationFrame(() => {
      const pageHeight = 1056; // Fixed page height in CSS (US Letter)
      const availableHeight = pageHeight - 60; // 30px padding top/bottom
      const contentHeight = qlEditor.scrollHeight;
      
      const currentQuill = this.editor.pageQuillInstances[pageIndex];
      let isCursorOverflowing = false;
      const MAX_TEXT_BOTTOM = 976; // 1056 - 60 - 20

      const selection = currentQuill.getSelection();
      if (selection) {
          const bounds = currentQuill.getBounds(selection.index);
          if (bounds && bounds.bottom > MAX_TEXT_BOTTOM) {
              isCursorOverflowing = true;
          }
      }

      if (contentHeight > availableHeight || isCursorOverflowing) {
        this.isSplitting = true;
        // const currentQuill is already defined above
        const editorPaddingBottom = 20; // ql-editor padding

        // Find exactly where the text overflows
        // We start from the end and work backwards until we find a line that fits
        let splitIndex = currentQuill.getLength() - 1;
        
        // Safety: Limit the backward search to avoid freezing on massive pages
        // though pages should be reasonable size.
        let safeGuard = 0;
        
        while (splitIndex > 0 && safeGuard < 5000) {
          const bounds = currentQuill.getBounds(splitIndex);
          if (bounds && bounds.bottom <= availableHeight - editorPaddingBottom) break;
          splitIndex--;
          safeGuard++;
        }

        // splitIndex is the index of the character that FITS. 
        // We move everything AFTER it.
        let moveStartIndex = splitIndex + 1;

        // If we didn't find a split point (everything "fits" according to bounds),
        // BUT we are still overflowing (scrollHeight > available),
        // we must Force Split the last character (likely a trailing newline).
        if (moveStartIndex >= currentQuill.getLength()) {
             // Force move the last character
             moveStartIndex = Math.max(0, currentQuill.getLength() - 1);
             
             // If document is empty or single char that fits, really abort
             if (moveStartIndex >= currentQuill.getLength()) {
                 this.isSplitting = false;
                 return;
             }
        }

        const overflowDelta = currentQuill.getContents(moveStartIndex);
        const selection = currentQuill.getSelection();
        const shouldMoveCursor = selection && selection.index >= moveStartIndex;
        const relativeCursorIndex = shouldMoveCursor ? selection.index - moveStartIndex : 0;
        
        // Use Yjs transaction for atomic page split
        this.editor.doc.transact(() => {
            // Delete overflow from current page
            currentQuill.deleteText(moveStartIndex, currentQuill.getLength() - moveStartIndex, 'user');

            const nextPageExists = this.editor.pageQuillInstances[pageIndex + 1];
            
            if (nextPageExists) {
                 // Prepend to next page
                 // We use the quill instance directly which syncs to Yjs
                 nextPageExists.updateContents([{ insert: '' }, ...overflowDelta.ops], 'user');
            } else {
                // Create new page
                const newPageMap = new Y.Map();
                const yText = new Y.Text();
                
                // Apply the overflow content directly to the new Y.Text
                yText.applyDelta(overflowDelta.ops);
                
                newPageMap.set('content', yText);
                this.editor.yPages.insert(pageIndex + 1, [newPageMap]);
            }
        });

        // Handle Cursor and Ripple Effect
        setTimeout(() => {
            const nextQuill = this.editor.pageQuillInstances[pageIndex + 1];
            
            if (shouldMoveCursor && nextQuill) {
                this.editor.switchToPage(pageIndex + 1);
                // Ensure index is within bounds of the new page
                const safeIndex = Math.min(relativeCursorIndex, nextQuill.getLength() - 1);
                nextQuill.setSelection(Math.max(0, safeIndex), 0);
            }

            // Ripple: Check if the next page now overflows
            if (nextQuill) {
                this.checkAndCreateNewPage(pageIndex + 1);
            }
            
            this.isSplitting = false;
        }, 50);
      }
    });
  }

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

    setTimeout(() => {
        prevQuill.focus();
        prevQuill.setSelection(prevLength - 1, 0);
        this.checkAndCreateNewPage(pageIndex - 1);
    }, 100);
  }
}
