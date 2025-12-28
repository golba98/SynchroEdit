export class NavigationManager {
  constructor(editor) {
    this.editor = editor;
    this.outlineContainer = document.getElementById('outlineContainer');
    this.minimapContainer = document.getElementById('minimap');
    this.isOutlineVisible = false;
    this.isMinimapVisible = false;
    this.collapsedSections = new Set(); // Stores heading node IDs or indices

    this.setupEventListeners();
  }

  setupEventListeners() {
    const addEvent = (id, event, handler) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(event, handler);
    };

    addEvent('toggleOutline', 'click', () => this.toggleOutline());
    addEvent('toggleMinimap', 'click', () => this.toggleMinimap());
    addEvent('closeOutline', 'click', () => this.toggleOutline());
    addEvent('closeMinimap', 'click', () => this.toggleMinimap());

    // Listen for editor changes to update navigation
    this.editor.doc.getArray('pages').observeDeep(() => {
        this.debounceUpdate();
    });

    // Intelligent Selection
    document.addEventListener('mousedown', (e) => this.handleTripleClick(e));
  }

  debounceUpdate() {
    if (this.updateTimeout) clearTimeout(this.updateTimeout);
    this.updateTimeout = setTimeout(() => {
      this.updateOutline();
      this.updateMinimap();
    }, 1000);
  }

  toggleOutline() {
    this.isOutlineVisible = !this.isOutlineVisible;
    const sidebar = document.getElementById('outlineSidebar');
    if (sidebar) {
        sidebar.style.display = this.isOutlineVisible ? 'flex' : 'none';
    }
    const btn = document.getElementById('toggleOutline');
    if (btn) btn.classList.toggle('active', this.isOutlineVisible);
  }

  toggleMinimap() {
    this.isMinimapVisible = !this.isMinimapVisible;
    const sidebar = document.getElementById('minimapSidebar');
    if (sidebar) {
        sidebar.style.display = this.isMinimapVisible ? 'flex' : 'none';
    }
    const btn = document.getElementById('toggleMinimap');
    if (btn) btn.classList.toggle('active', this.isMinimapVisible);
  }

  updateOutline() {
    if (!this.outlineContainer || !this.isOutlineVisible) return;

    const headings = [];
    const pagesArr = this.editor.yPages.toArray();
    
    pagesArr.forEach((pageMap, index) => {
      const pageId = pageMap.get('id');
      const quill = this.editor.pageQuillInstances.get(pageId);
      if (!quill) return;
      
      const lines = quill.getLines();
      lines.forEach(line => {
        const format = line.formats();
        if (format.header) {
          headings.push({
            level: format.header,
            text: line.domNode.textContent,
            pageIndex: index,
            node: line.domNode
          });
        }
      });
    });

    if (headings.length === 0) {
      this.outlineContainer.innerHTML = '<div style="padding: 20px; color: #666; font-size: 12px;">No headings found</div>';
      return;
    }

    this.outlineContainer.innerHTML = headings.map((h, i) => `
      <div class="outline-item outline-h${h.level} ${this.collapsedSections.has(i) ? 'collapsed' : ''}" data-index="${i}">
        <i class="fas ${this.collapsedSections.has(i) ? 'fa-chevron-right' : 'fa-chevron-down'} fold-toggle" style="margin-right: 8px; width: 12px;"></i>
        ${h.text || 'Untitled Section'}
      </div>
    `).join('');

    this.outlineContainer.querySelectorAll('.outline-item').forEach((el, i) => {
      const toggle = el.querySelector('.fold-toggle');
      toggle.onclick = (e) => {
          e.stopPropagation();
          this.toggleSection(i, headings);
      };

      el.onclick = () => {
        const h = headings[i];
        this.editor.switchToPage(parseInt(h.pageIndex));
        h.node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Highlight active
        this.outlineContainer.querySelectorAll('.outline-item').forEach(item => item.classList.remove('active'));
        el.classList.add('active');
      };
    });
  }

  updateMinimap() {
    if (!this.minimapContainer || !this.isMinimapVisible) return;

    // Simplified Minimap: Create a scaled down version of the pages
    this.minimapContainer.innerHTML = '';
    const pagesContainer = document.getElementById('pagesContainer');
    if (!pagesContainer) return;

    const clone = pagesContainer.cloneNode(true);
    clone.id = 'minimap-clone';
    clone.style.width = '1000px'; // Fixed width for scaling
    clone.style.transform = 'scale(0.12)';
    clone.style.transformOrigin = 'top left';
    clone.style.pointerEvents = 'none';
    clone.style.position = 'absolute';
    clone.style.top = '0';
    clone.style.left = '0';
    clone.style.padding = '0';
    clone.style.background = 'transparent';

    // Remove heavy elements from clone
    clone.querySelectorAll('.page-border-inner').forEach(el => el.remove());
    
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.width = '120px';
    const totalHeight = (pagesContainer.scrollHeight * 0.12);
    wrapper.style.height = `${totalHeight}px`;
    wrapper.appendChild(clone);

    this.minimapContainer.appendChild(wrapper);

    // Sync scroll
    this.minimapContainer.onclick = (e) => {
        const rect = wrapper.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const scrollTarget = (y / 0.12);
        pagesContainer.scrollTo({ top: scrollTarget, behavior: 'smooth' });
    };
  }

  handleTripleClick(e) {
    if (e.detail === 3) {
      const range = this.editor.quill?.getSelection();
      if (range) {
        const [line, offset] = this.editor.quill.getLine(range.index);
        const index = this.editor.quill.getIndex(line);
        const length = line.length();
        this.editor.quill.setSelection(index, length, 'user');
      }
    }
  }

  toggleSection(index, headings) {
    if (this.collapsedSections.has(index)) {
      this.collapsedSections.delete(index);
    } else {
      this.collapsedSections.add(index);
    }
    
    this.updateVisibility(index, headings);
    this.updateOutline(); // Refresh icons
  }

  updateVisibility(index, headings) {
    const currentHeading = headings[index];
    const isCollapsed = this.collapsedSections.has(index);
    
    // Find next heading of same or higher level (lower number)
    let nextHeading = headings.slice(index + 1).find(h => h.level <= currentHeading.level);
    
    // Iterate through DOM siblings
    let nextNode = currentHeading.node.nextElementSibling;
    const endNode = nextHeading ? nextHeading.node : null;

    while (nextNode && nextNode !== endNode) {
      nextNode.style.display = isCollapsed ? 'none' : '';
      nextNode = nextNode.nextElementSibling;
    }
  }
}