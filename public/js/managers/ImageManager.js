export class ImageManager {
  constructor(editor) {
    this.editor = editor;
    this.overlay = null;
    this.currentImage = null;
    this.resizeStart = { x: 0, y: 0, w: 0, h: 0 };
    this.isResizing = false;

    this.setupOverlay();
    
    // Listen for image clicks on the document
    document.addEventListener('click', (e) => this.handleImageClick(e));
    
    // Listen for scroll/resize to update overlay
    window.addEventListener('scroll', () => this.updateOverlayPosition(), true);
    window.addEventListener('resize', () => this.updateOverlayPosition());

    this.setupDragAndDrop();
  }

  setupDragAndDrop() {
    const container = document.getElementById('pagesContainer');
    if (!container) return;

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      container.classList.add('drag-over');
    });

    container.addEventListener('dragleave', () => {
      container.classList.remove('drag-over');
    });

    container.addEventListener('drop', (e) => {
      e.preventDefault();
      container.classList.remove('drag-over');

      const files = e.dataTransfer.files;
      if (files && files[0] && files[0].type.startsWith('image/')) {
        this.handleFileUpload(files[0]);
      }
    });
  }

  handleFileUpload(file) {
    if (!this.editor.quill) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const range = this.editor.quill.getSelection(true);
      this.editor.quill.insertEmbed(range.index, 'image', e.target.result, 'user');
    };
    reader.readAsDataURL(file);
  }

  setupOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'image-resizer-overlay';
    this.overlay.style.display = 'none';
    this.overlay.style.position = 'absolute';
    this.overlay.style.border = '2px solid var(--accent-color)';
    this.overlay.style.pointerEvents = 'none'; // Allow clicks to pass through except handles
    this.overlay.style.zIndex = '100';
    
    // Handles
    const createHandle = (cursor, pos) => {
        const h = document.createElement('div');
        h.style.width = '12px';
        h.style.height = '12px';
        h.style.background = 'var(--accent-color)';
        h.style.border = '1px solid white';
        h.style.position = 'absolute';
        h.style.cursor = cursor;
        h.style.pointerEvents = 'auto';
        h.dataset.pos = pos;
        h.addEventListener('mousedown', (e) => this.startResize(e, pos));
        return h;
    };
    
    this.handles = {
        se: createHandle('nwse-resize', 'se'),
        sw: createHandle('nesw-resize', 'sw'),
        ne: createHandle('nesw-resize', 'ne'),
        nw: createHandle('nwse-resize', 'nw')
    };
    
    Object.values(this.handles).forEach(h => this.overlay.appendChild(h));
    
    // Toolbar for float
    this.toolbar = document.createElement('div');
    this.toolbar.style.position = 'absolute';
    this.toolbar.style.top = '-40px';
    this.toolbar.style.left = '50%';
    this.toolbar.style.transform = 'translateX(-50%)';
    this.toolbar.style.background = '#1a1a1a';
    this.toolbar.style.border = '1px solid #333';
    this.toolbar.style.padding = '4px';
    this.toolbar.style.borderRadius = '4px';
    this.toolbar.style.display = 'flex';
    this.toolbar.style.gap = '4px';
    this.toolbar.style.pointerEvents = 'auto';
    
    const createBtn = (icon, action, title) => {
        const btn = document.createElement('button');
        btn.innerHTML = `<i class="fas ${icon}"></i>`;
        btn.title = title;
        btn.style.background = 'transparent';
        btn.style.border = 'none';
        btn.style.color = '#e0e0e0';
        btn.style.cursor = 'pointer';
        btn.style.padding = '4px 8px';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            action();
        });
        btn.addEventListener('mouseenter', () => btn.style.color = 'var(--accent-color)');
        btn.addEventListener('mouseleave', () => btn.style.color = '#e0e0e0');
        return btn;
    };
    
    this.toolbar.appendChild(createBtn('fa-align-left', () => this.setFloat('left'), 'Float Left (Wrap)'));
    this.toolbar.appendChild(createBtn('fa-align-justify', () => this.setFloat('none'), 'Inline'));
    this.toolbar.appendChild(createBtn('fa-align-right', () => this.setFloat('right'), 'Float Right (Wrap)'));
    
    this.overlay.appendChild(this.toolbar);
    document.body.appendChild(this.overlay);
    
    // Global mouse events for resizing
    document.addEventListener('mousemove', (e) => this.handleResize(e));
    document.addEventListener('mouseup', () => this.stopResize());
  }

  handleImageClick(e) {
    if (e.target.tagName === 'IMG' && e.target.closest('.ql-editor')) {
        this.selectImage(e.target);
    } else if (!e.target.closest('.image-resizer-overlay')) {
        this.deselectImage();
    }
  }

  selectImage(img) {
    this.currentImage = img;
    this.updateOverlayPosition();
    this.overlay.style.display = 'block';
  }

  deselectImage() {
    this.currentImage = null;
    this.overlay.style.display = 'none';
  }

  updateOverlayPosition() {
    if (!this.currentImage) return;
    
    const rect = this.currentImage.getBoundingClientRect();
    const scrollTop = window.scrollY;
    const scrollLeft = window.scrollX;
    
    this.overlay.style.top = `${rect.top + scrollTop}px`;
    this.overlay.style.left = `${rect.left + scrollLeft}px`;
    this.overlay.style.width = `${rect.width}px`;
    this.overlay.style.height = `${rect.height}px`;
    
    // Position handles
    const size = 12;
    const offset = -6;
    
    this.handles.nw.style.top = `${offset}px`;
    this.handles.nw.style.left = `${offset}px`;
    
    this.handles.ne.style.top = `${offset}px`;
    this.handles.ne.style.right = `${offset}px`;
    
    this.handles.sw.style.bottom = `${offset}px`;
    this.handles.sw.style.left = `${offset}px`;
    
    this.handles.se.style.bottom = `${offset}px`;
    this.handles.se.style.right = `${offset}px`;
  }

  startResize(e, pos) {
    if (!this.currentImage) return;
    e.preventDefault();
    e.stopPropagation();
    
    this.isResizing = true;
    this.resizeStart = {
        x: e.clientX,
        y: e.clientY,
        w: this.currentImage.offsetWidth,
        h: this.currentImage.offsetHeight,
        pos
    };
  }

  handleResize(e) {
    if (!this.isResizing || !this.currentImage) return;
    
    const dx = e.clientX - this.resizeStart.x;
    const dy = e.clientY - this.resizeStart.y;
    
    let newW = this.resizeStart.w;
    let newH = this.resizeStart.h;
    
    // Simple aspect ratio locking could be added here
    if (this.resizeStart.pos.includes('e')) newW += dx;
    if (this.resizeStart.pos.includes('w')) newW -= dx; // Logic for left resize is complex due to position
    if (this.resizeStart.pos.includes('s')) newH += dy;
    
    // Apply to image
    // We update style directly for smooth preview, but should ideally use Quill format on mouseup
    this.currentImage.style.width = `${newW}px`;
    this.currentImage.style.height = `${newH}px`;
    
    this.updateOverlayPosition();
  }

  stopResize() {
    if (this.isResizing && this.currentImage) {
        this.isResizing = false;
        
        // Sync with Quill
        // Find the Blot
        if (this.editor.quill) {
             const blot = Quill.find(this.currentImage);
             if (blot) {
                 const index = this.editor.quill.getIndex(blot);
                 this.editor.quill.formatText(index, 1, {
                     'width': `${this.currentImage.offsetWidth}px`,
                     'height': `${this.currentImage.offsetHeight}px`
                 }, 'user');
             }
        }
    }
  }

  setFloat(val) {
    if (!this.currentImage || !this.editor.quill) return;
    
    const blot = Quill.find(this.currentImage);
    if (blot) {
        const index = this.editor.quill.getIndex(blot);
        
        // Apply float
        this.editor.quill.formatText(index, 1, 'float', val, 'user');
        
        // If floating, we usually want display block or inline-block?
        // Quill image is inline-block by default.
        // Also add margin for spacing
        if (val !== 'none') {
             this.editor.quill.formatText(index, 1, 'margin', '10px', 'user');
        } else {
             this.editor.quill.formatText(index, 1, 'margin', false, 'user');
        }
        
        // Force update overlay
        setTimeout(() => this.updateOverlayPosition(), 100);
    }
  }
}
