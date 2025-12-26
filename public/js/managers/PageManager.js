import * as Y from 'yjs';

export class PageManager {
  constructor(editor) {
    this.editor = editor;
    this.isSplitting = false;
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

      if (contentHeight > availableHeight) {
        this.isSplitting = true;
        const currentQuill = this.editor.pageQuillInstances[pageIndex];

        // Find exactly where the text overflows
        // We start from the end and work backwards until we find a line that fits
        let splitIndex = currentQuill.getLength() - 1;
        
        // Safety: Limit the backward search to avoid freezing on massive pages
        // though pages should be reasonable size.
        let safeGuard = 0;
        
        while (splitIndex > 0 && safeGuard < 5000) {
          const bounds = currentQuill.getBounds(splitIndex);
          if (bounds && bounds.bottom <= availableHeight) break;
          splitIndex--;
          safeGuard++;
        }

        // Only split if we actually found an overflow point that isn't the very end
        if (splitIndex >= currentQuill.getLength() - 1) {
            this.isSplitting = false;
            return;
        }

        const overflowDelta = currentQuill.getContents(splitIndex);
        const selection = currentQuill.getSelection();
        const shouldMoveCursor = selection && selection.index >= splitIndex;
        const relativeCursorIndex = shouldMoveCursor ? selection.index - splitIndex : 0;
        
        // Use Yjs transaction for atomic page split
        this.editor.doc.transact(() => {
            // Delete overflow from current page
            currentQuill.deleteText(splitIndex, currentQuill.getLength() - splitIndex, 'user');

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
