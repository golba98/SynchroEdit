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
        let splitIndex = currentQuill.getLength() - 1;
        while (splitIndex > 0) {
          const bounds = currentQuill.getBounds(splitIndex);
          if (bounds && bounds.bottom <= availableHeight) break;
          splitIndex--;
        }

        // Only split if we actually found an overflow point
        if (splitIndex >= currentQuill.getLength() - 1) {
            this.isSplitting = false;
            return;
        }

        const overflowDelta = currentQuill.getContents(splitIndex);
        
        // Use Yjs transaction for atomic page split
        this.editor.doc.transact(() => {
            // Delete overflow from current page
            currentQuill.deleteText(splitIndex, currentQuill.getLength() - splitIndex, 'user');

            const nextPageExists = this.editor.pageQuillInstances[pageIndex + 1];
            
            if (nextPageExists) {
                 // Prepend to next page
                 nextPageExists.updateContents(overflowDelta, 'user');
            } else {
                // Create new page
                const newPageMap = new Y.Map();
                const yText = new Y.Text();
                
                // Apply the overflow content directly to the new Y.Text
                // This ensures it's there before the editor even renders
                yText.applyDelta(overflowDelta.ops);
                
                newPageMap.set('content', yText);
                this.editor.yPages.insert(pageIndex + 1, [newPageMap]);
            }
        });

        // If we pushed content to the next page, we must check IT for overflow too (Ripple Effect)
        // We use setTimeout to allow the DOM to update/render the changes (especially if new page created)
        setTimeout(() => {
            if (this.editor.pageQuillInstances[pageIndex + 1]) {
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
