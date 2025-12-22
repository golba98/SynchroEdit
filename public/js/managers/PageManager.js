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
            const pageHeight = pageContainer.clientHeight;
            const paddingTop = parseFloat(window.getComputedStyle(pageContainer).paddingTop);
            const paddingBottom = parseFloat(window.getComputedStyle(pageContainer).paddingBottom);
            const availableHeight = pageHeight - paddingTop - paddingBottom;
            const contentHeight = qlEditor.scrollHeight;
            
            if (contentHeight > availableHeight) {
                this.isSplitting = true;
                const currentQuill = this.editor.pageQuillInstances[pageIndex];
                
                let splitIndex = currentQuill.getLength() - 1;
                while (splitIndex > 0) {
                    const bounds = currentQuill.getBounds(splitIndex);
                    if (bounds && bounds.bottom <= availableHeight - 20) break;
                    splitIndex--;
                }

                const overflowDelta = currentQuill.getContents(splitIndex);
                currentQuill.deleteText(splitIndex, currentQuill.getLength() - splitIndex, 'silent');
                
                let nextPageIndex = pageIndex + 1;
                
                // Optimistic UI: Update local state immediately
                if (nextPageIndex >= this.editor.pages.length) {
                    this.editor.pages.push({ content: { ops: [{ insert: '\n' }] } });
                    this.editor.onContentChange('new-page', {});
                    this.editor.createPageEditor(nextPageIndex);
                }
                
                const nextQuill = this.editor.pageQuillInstances[nextPageIndex];
                if (nextQuill) {
                    const nextContent = nextQuill.getContents();
                    if (nextContent.length() <= 1) nextQuill.setContents(overflowDelta, 'user');
                    else nextQuill.updateContents({ ops: overflowDelta.ops }, 'user');
                    
                    this.editor.switchToPage(nextPageIndex);
                    setTimeout(() => {
                        nextQuill.setSelection(Math.max(0, overflowDelta.length() - 1), 0);
                        this.isSplitting = false;
                    }, 10);
                } else {
                    this.isSplitting = false;
                }
            }
        });
    }

    mergeWithPreviousPage(pageIndex) {
        if (pageIndex <= 0 || pageIndex >= this.editor.pages.length) return;
        
        const currentQuill = this.editor.pageQuillInstances[pageIndex];
        const prevQuill = this.editor.pageQuillInstances[pageIndex - 1];
        
        const currentContent = currentQuill.getContents();
        const prevContent = prevQuill.getContents();
        const prevLength = prevQuill.getLength();
        const mergedDelta = prevContent.concat(currentContent);
        
        // Optimistic UI updates
        this.editor.pages[pageIndex - 1].content = mergedDelta;
        this.editor.pages.splice(pageIndex, 1);
        
        this.editor.onContentChange('delete-page', { pageIndex });
        this.editor.onContentChange('update-page', { pageIndex: pageIndex - 1, content: mergedDelta });
        
        this.editor.currentPageIndex = pageIndex - 1;
        this.editor.renderAllPages();
        
        setTimeout(() => {
            const newQuill = this.editor.pageQuillInstances[this.editor.currentPageIndex];
            if (newQuill) {
                newQuill.focus();
                newQuill.setSelection(Math.max(0, prevLength - 1), 0);
                this.checkAndCreateNewPage(this.editor.currentPageIndex);
            }
        }, 150);
    }
}
