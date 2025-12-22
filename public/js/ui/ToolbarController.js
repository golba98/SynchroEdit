export class ToolbarController {
    constructor(editor) {
        this.editor = editor;
        this.setupToolbar();
    }

    setupToolbar() {
        const buttons = {
            'ql-bold': 'bold',
            'ql-italic': 'italic',
            'ql-underline': 'underline',
            'ql-strike': 'strike',
            'ql-list': 'list',
            'ql-blockquote': 'blockquote',
            'ql-code-block': 'code-block',
            'ql-clean': 'clean'
        };

        // Standard formatting buttons
        Object.entries(buttons).forEach(([cls, fmt]) => {
            document.querySelectorAll(`.${cls}`).forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (!this.editor.quill) return;
                    
                    if (fmt === 'list') {
                        const val = btn.getAttribute('value') || 'bullet';
                        const currentFormat = this.editor.quill.getFormat();
                        this.editor.quill.format('list', currentFormat.list === val ? false : val);
                    } else if (fmt === 'clean') {
                        const range = this.editor.quill.getSelection();
                        if (range) this.editor.quill.removeFormat(range.index, range.length);
                    } else {
                        const format = this.editor.quill.getFormat();
                        this.editor.quill.format(fmt, !format[fmt]);
                    }
                });
            });
        });

        // Font and Size selects
        document.querySelectorAll('.ql-font').forEach(sel => {
            sel.addEventListener('change', (e) => {
                if (this.editor.quill) this.editor.quill.format('font', e.target.value);
            });
        });

        document.querySelectorAll('.ql-size').forEach(sel => {
            sel.addEventListener('change', (e) => {
                if (this.editor.quill) this.editor.quill.format('size', e.target.value);
            });
        });

        // Alignment
        document.querySelectorAll('.ql-align').forEach(sel => {
            sel.addEventListener('change', (e) => {
                if (this.editor.quill) this.editor.quill.format('align', e.target.value);
            });
        });

        // Color Pickers
        this.setupColorPicker('textColorBtn', 'textColorPicker', 'textColorIndicator', 'color');
        this.setupColorPicker('highlightColorBtn', 'highlightColorPicker', 'highlightColorIndicator', 'background');
        
        // Image & Video
        document.querySelectorAll('.ql-image').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = document.getElementById('imageInput');
                if (input) input.click();
            });
        });

        const imageInput = document.getElementById('imageInput');
        if (imageInput) {
            imageInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file && this.editor.quill) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const range = this.editor.quill.getSelection(true);
                        this.editor.quill.insertEmbed(range.index, 'image', e.target.result);
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    }

    setupColorPicker(btnId, pickerId, indicatorId, format) {
        const btn = document.getElementById(btnId);
        const picker = document.getElementById(pickerId);
        const indicator = document.getElementById(indicatorId);

        if (btn && picker) {
            btn.addEventListener('click', () => picker.click());
            picker.addEventListener('input', (e) => {
                const color = e.target.value;
                if (indicator) indicator.style.background = color;
                if (this.editor.quill) this.editor.quill.format(format, color);
            });
        }
    }
}
