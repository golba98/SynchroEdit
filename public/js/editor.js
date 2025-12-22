import { Network } from './network.js';
import { ptToPx } from './utils.js';

export class Editor {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.quill = null;
        this.pageQuillInstances = {};
        this.pages = options.pages || [{ content: '' }];
        this.currentPageIndex = 0;
        this.currentZoom = 100;
        this.isSplitting = false;
        this.isLoadingFromServer = false;
        this.onContentChange = options.onContentChange || (() => {});
        this.onPageChange = options.onPageChange || (() => {});
        
        this.currentBorderStyle = 'solid';
        this.currentBorderWidth = '1pt';
        this.currentBorderColor = '#333333';
        this.currentBorderType = 'box';

        this.initQuill();
    }

    initQuill() {
        const Size = Quill.import('attributors/style/size');
        Size.whitelist = ['8px', '9px', '10px', '11px', '12px', '14px', '16px', '18px', '20px', '22px', '24px', '26px', '28px', '36px', '48px', '72px'];
        Quill.register(Size, true);

        const Font = Quill.import('formats/font');
        Font.whitelist = ['roboto', 'open-sans', 'lato', 'montserrat', 'oswald', 'merriweather', 'arial', 'times-new-roman', 'courier-new', 'georgia', 'verdana'];
        Quill.register(Font, true);
    }

    renderAllPages() {
        if (!this.container) return;
        
        const wasLoading = this.isLoadingFromServer;
        this.isLoadingFromServer = true;
        
        this.container.innerHTML = '';
        this.pageQuillInstances = {};
        
        this.pages.forEach((page, index) => {
            this.createPageEditor(index);
        });
        
        this.isLoadingFromServer = wasLoading;
        this.switchToPage(this.currentPageIndex);
        this.applyZoom();
    }

    createPageEditor(pageIndex) {
        const newPageContainer = document.createElement('div');
        newPageContainer.className = 'editor-container';
        newPageContainer.id = `page-container-${pageIndex}`;
        newPageContainer.innerHTML = `
            <div class="page-border-inner" style="position: absolute; top: 20px; left: 20px; right: 20px; bottom: 20px; pointer-events: none; border: 1px solid transparent; z-index: 5;"></div>
            <div id="editor-${pageIndex}" class="page-editor" data-page-index="${pageIndex}" style="position: relative; z-index: 1;"></div>
        `;
        
        this.container.appendChild(newPageContainer);

        const borderElement = newPageContainer.querySelector('.page-border-inner');
        if (borderElement) {
            this.applyBorderToElement(borderElement);
        }
        
        const pageQuill = new Quill(`#editor-${pageIndex}`, {
            theme: 'snow',
            placeholder: 'Start typing...', 
            modules: { toolbar: false }
        });
        
        this.pageQuillInstances[pageIndex] = pageQuill;
        
        pageQuill.on('selection-change', (range) => {
            if (range) {
                if (pageIndex !== this.currentPageIndex) {
                    this.quill = pageQuill;
                    this.currentPageIndex = pageIndex;
                    this.onPageChange(pageIndex);
                }
            }
        });
        
        if (this.pages[pageIndex] && this.pages[pageIndex].content) {
            pageQuill.setContents(this.pages[pageIndex].content);
        }
        
        const qlEditor = newPageContainer.querySelector('.ql-editor');
        if (qlEditor) {
            qlEditor.addEventListener('keydown', (e) => this.handleKeyDown(e, pageIndex), true);
        }
        
        pageQuill.on('text-change', (delta, oldDelta, source) => {
            if (source === 'user' && !this.isLoadingFromServer) {
                const currentDelta = pageQuill.getContents();
                this.pages[pageIndex].content = currentDelta;
                this.onContentChange('update-page', { pageIndex, content: currentDelta });
                this.checkAndCreateNewPage(pageIndex);
            }
        });
    }

    handleKeyDown(e, pageIndex) {
        const pageQuill = this.pageQuillInstances[pageIndex];
        if (e.key === 'Backspace' && pageIndex > 0) {
            const range = pageQuill.getSelection();
            if ((range && range.index === 0 && range.length === 0) || pageQuill.getLength() <= 1) {
                e.preventDefault();
                this.mergeWithPreviousPage(pageIndex);
            }
        }
        
        if (e.key === 'ArrowLeft' && pageIndex > 0) {
            const range = pageQuill.getSelection();
            if (range && range.index === 0) {
                e.preventDefault();
                this.switchToPage(pageIndex - 1, 'end');
            }
        }
        
        if (e.key === 'ArrowRight' && pageIndex < this.pages.length - 1) {
            const range = pageQuill.getSelection();
            if (range && range.index >= pageQuill.getLength() - 1) {
                e.preventDefault();
                this.switchToPage(pageIndex + 1, 'start');
            }
        }
    }

    switchToPage(pageIndex, cursorPosition = null) {
        if (pageIndex < 0 || pageIndex >= this.pages.length) return;
        
        const activeFormats = this.quill ? this.quill.getFormat() : {};
        this.currentPageIndex = pageIndex;
        this.quill = this.pageQuillInstances[pageIndex];
        
        if (this.quill) {
            setTimeout(() => {
                this.quill.focus();
                if (cursorPosition === 'end') {
                    this.quill.setSelection(this.quill.getLength() - 1, 0);
                } else if (cursorPosition === 'start') {
                    this.quill.setSelection(0, 0);
                }

                if (Object.keys(activeFormats).length > 0) {
                    const range = this.quill.getSelection();
                    if (range && range.length === 0) {
                        for (let [name, value] of Object.entries(activeFormats)) {
                            if (Array.isArray(value)) value = value[0];
                            this.quill.format(name, value, 'user');
                        }
                    }
                }

                const container = document.getElementById(`page-container-${pageIndex}`);
                if (container) container.scrollIntoView({ behavior: 'smooth', block: 'start' });
                this.onPageChange(pageIndex);
            }, 10);
        }
    }

    mergeWithPreviousPage(pageIndex) {
        if (pageIndex <= 0 || pageIndex >= this.pages.length) return;
        
        const currentQuill = this.pageQuillInstances[pageIndex];
        const prevQuill = this.pageQuillInstances[pageIndex - 1];
        
        const currentContent = currentQuill.getContents();
        const prevContent = prevQuill.getContents();
        const prevLength = prevQuill.getLength();
        const mergedDelta = prevContent.concat(currentContent);
        
        this.pages[pageIndex - 1].content = mergedDelta;
        this.pages.splice(pageIndex, 1);
        
        this.onContentChange('delete-page', { pageIndex });
        this.onContentChange('update-page', { pageIndex: pageIndex - 1, content: mergedDelta });
        
        this.currentPageIndex = pageIndex - 1;
        this.renderAllPages();
        
        setTimeout(() => {
            const newQuill = this.pageQuillInstances[this.currentPageIndex];
            if (newQuill) {
                newQuill.focus();
                newQuill.setSelection(Math.max(0, prevLength - 1), 0);
                this.checkAndCreateNewPage(this.currentPageIndex);
            }
        }, 150);
    }

    checkAndCreateNewPage(pageIndex) {
        if (this.isSplitting) return;
        
        const pageContainer = document.querySelector(`#page-container-${pageIndex}`);
        const editorContainer = document.querySelector(`#editor-${pageIndex}`);
        if (!pageContainer || !editorContainer) return;
        
        const qlEditor = editorContainer.querySelector('.ql-editor');
        if (!qlEditor) return;
        
        setTimeout(() => {
            const pageHeight = pageContainer.clientHeight;
            const paddingTop = parseFloat(window.getComputedStyle(pageContainer).paddingTop);
            const paddingBottom = parseFloat(window.getComputedStyle(pageContainer).paddingBottom);
            const availableHeight = pageHeight - paddingTop - paddingBottom;
            const contentHeight = qlEditor.scrollHeight;
            
            if (contentHeight > availableHeight) {
                this.isSplitting = true;
                const currentQuill = this.pageQuillInstances[pageIndex];
                
                let splitIndex = currentQuill.getLength() - 1;
                while (splitIndex > 0) {
                    const bounds = currentQuill.getBounds(splitIndex);
                    if (bounds && bounds.bottom <= availableHeight - 20) break;
                    splitIndex--;
                }

                const overflowDelta = currentQuill.getContents(splitIndex);
                currentQuill.deleteText(splitIndex, currentQuill.getLength() - splitIndex, 'silent');
                
                let nextPageIndex = pageIndex + 1;
                if (nextPageIndex >= this.pages.length) {
                    this.pages.push({ content: { ops: [{ insert: '\n' }] } });
                    this.onContentChange('new-page', {});
                    this.createPageEditor(nextPageIndex);
                }
                
                const nextQuill = this.pageQuillInstances[nextPageIndex];
                if (nextQuill) {
                    const nextContent = nextQuill.getContents();
                    if (nextContent.length() <= 1) nextQuill.setContents(overflowDelta, 'user');
                    else nextQuill.updateContents({ ops: overflowDelta.ops }, 'user');
                    
                    this.switchToPage(nextPageIndex);
                    setTimeout(() => {
                        nextQuill.setSelection(Math.max(0, overflowDelta.length() - 1), 0);
                        this.isSplitting = false;
                    }, 10);
                } else {
                    this.isSplitting = false;
                }
            }
        }, 0);
    }

    applyZoom() {
        const containers = document.querySelectorAll('.editor-container');
        const scale = this.currentZoom / 100;
        const pageHeight = 950;
        
        containers.forEach(container => {
            container.style.transform = `scale(${scale})`;
            container.style.transformOrigin = 'top center';
            container.style.marginBottom = `${40 + pageHeight * (scale - 1)}px`;
        });
    }

    applyBorderToElement(element) {
        const widthPx = `${ptToPx(this.currentBorderWidth)}px`;
        const borderValue = `${widthPx} ${this.currentBorderStyle} ${this.currentBorderColor}`;

        element.style.border = 'none';
        element.style.boxShadow = 'none';

        if (this.currentBorderType === 'box') {
            element.style.border = borderValue;
        } else if (this.currentBorderType === 'shadow') {
            element.style.border = borderValue;
            element.style.boxShadow = `5px 5px 10px rgba(0, 0, 0, 0.5)`;
        } else if (this.currentBorderType === '3d') {
            element.style.border = borderValue;
            element.style.boxShadow = `inset -2px -2px 5px rgba(0, 0, 0, 0.4), inset 2px 2px 5px rgba(255, 255, 255, 0.1)`;
        }
    }

    updateFromSync(data) {
        this.isLoadingFromServer = true;
        this.pages = data.pages;
        this.currentPageIndex = data.currentPageIndex || 0;
        this.renderAllPages();
        this.isLoadingFromServer = false;
    }

    updatePageContent(pageIndex, content) {
        if (this.pages[pageIndex]) {
            this.pages[pageIndex].content = content;
        }
        const targetQuill = this.pageQuillInstances[pageIndex];
        if (targetQuill) {
            this.isLoadingFromServer = true;
            targetQuill.setContents(content);
            this.isLoadingFromServer = false;
        }
    }
}
