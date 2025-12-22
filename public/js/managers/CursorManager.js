export class CursorManager {
    constructor(editor) {
        this.editor = editor;
        this.currentRange = null;
    }

    setupPageListeners(pageQuill, pageIndex) {
        pageQuill.on('selection-change', (range) => {
            if (range) {
                this.currentRange = range;
                if (pageIndex !== this.editor.currentPageIndex) {
                    this.editor.quill = pageQuill;
                    this.editor.currentPageIndex = pageIndex;
                    this.editor.onPageChange(pageIndex);
                }
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
        const container = document.getElementById(`page-container-${pageIndex}`);
        if (container) {
            container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}
