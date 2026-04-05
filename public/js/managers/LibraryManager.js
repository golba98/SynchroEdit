import { Network } from '/js/core/network.js';
import { navigateTo } from '/js/core/utils.js';

export class LibraryManager {
  constructor(app) {
    this.app = app;
    this.documents = [];
    this.currentPage = 1;
    this.totalPages = 1;
    this.isLoading = false;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Create new document
    const createBtn = document.getElementById('createNewDoc');
    if (createBtn) {
      createBtn.addEventListener('click', () => this.createDocument());
    }

    const fabCreateBtn = document.getElementById('fabCreateDoc');
    if (fabCreateBtn) {
      fabCreateBtn.addEventListener('click', () => this.createDocument());
    }

    // Close library
    const closeBtn = document.getElementById('closeLibrary');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hideLibrary());
    }

    // Overlay click to close
    const overlay = document.getElementById('libraryOverlay');
    if (overlay) {
      overlay.addEventListener('click', () => this.hideLibrary());
    }
  }

  async showLibrary() {
    const library = document.getElementById('docLibrary');
    const overlay = document.getElementById('libraryOverlay');

    if (library) library.style.display = 'block';
    if (overlay) overlay.style.display = 'block';

    await this.loadDocuments();
  }

  hideLibrary() {
    const library = document.getElementById('docLibrary');
    const overlay = document.getElementById('libraryOverlay');

    if (library) library.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
  }

  async loadDocuments(page = 1) {
    if (this.isLoading) return;
    this.isLoading = true;

    const documentList = document.getElementById('documentList');
    if (!documentList) return;

    // Show skeleton loading
    this.showSkeleton(documentList);

    try {
      const data = await Network.fetchAPI(`/api/documents?page=${page}&limit=20`);
      this.documents = data.documents;
      this.currentPage = data.pagination.currentPage;
      this.totalPages = data.pagination.totalPages;

      this.renderDocuments();
    } catch (err) {
      console.error('Failed to load documents:', err);
      documentList.innerHTML =
        '<tr><td colspan="3" style="text-align: center; padding: 20px; color: #ef4444;">Failed to load documents</td></tr>';
    } finally {
      this.isLoading = false;
    }
  }

  showSkeleton(container) {
    container.innerHTML = Array.from(
      { length: 5 },
      () => `
      <tr class="document-row skeleton-row">
        <td style="padding: 16px 24px;">
          <div class="skeleton skeleton-text" style="width: 60%; height: 16px;"></div>
        </td>
        <td style="padding: 16px 24px;">
          <div class="skeleton skeleton-text" style="width: 40%; height: 14px;"></div>
        </td>
        <td style="padding: 16px 24px; width: 60px;">
          <div class="skeleton skeleton-circle" style="width: 24px; height: 24px;"></div>
        </td>
      </tr>
    `
    ).join('');
  }

  renderDocuments() {
    const documentList = document.getElementById('documentList');
    if (!documentList) return;

    if (this.documents.length === 0) {
      documentList.innerHTML =
        '<tr><td colspan="3" style="text-align: center; padding: 40px; color: #666;">No documents yet. Create your first document!</td></tr>';
      return;
    }

    documentList.innerHTML = this.documents
      .map((doc) => {
        const date = new Date(doc.lastModified);
        const dateStr = date.toLocaleDateString();
        const isOwner = doc.isOwner;
        const isShared = doc.isShared;

        const deleteIconTitle = isOwner ? 'Delete Document' : 'Remove from Drive';
        const deleteIconClass = isOwner ? 'fa-trash' : 'fa-folder-minus';

        return `
        <tr class="document-row" data-doc-id="${doc._id}">
          <td style="padding: 16px 24px; cursor: pointer;" class="doc-title-cell">
            <div style="display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-file-alt" style="color: #666; font-size: 14px;"></i>
              <span style="font-size: 14px; color: #e0e0e0;">${this.escapeHtml(doc.title)}</span>
              ${isShared && !isOwner ? '<i class="fas fa-user-friends" style="color: var(--accent-color); font-size: 11px;" title="Shared with you"></i>' : ''}
            </div>
          </td>
          <td style="padding: 16px 24px; color: #888; font-size: 13px;">${dateStr}</td>
          <td style="padding: 16px 24px; width: 60px; text-align: center;">
            <button class="delete-doc-btn" data-doc-id="${doc._id}" data-is-owner="${isOwner}" title="${deleteIconTitle}" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 16px; opacity: 0.7; transition: opacity 0.2s;">
              <i class="fas ${deleteIconClass}"></i>
            </button>
          </td>
        </tr>
      `;
      })
      .join('');

    // Add click listeners
    documentList.querySelectorAll('.doc-title-cell').forEach((cell) => {
      cell.addEventListener('click', (e) => {
        const row = e.target.closest('.document-row');
        if (row) {
          const docId = row.dataset.docId;
          this.openDocument(docId);
        }
      });
    });

    documentList.querySelectorAll('.delete-doc-btn').forEach((btn) => {
      btn.addEventListener('mouseenter', () => (btn.style.opacity = '1'));
      btn.addEventListener('mouseleave', () => (btn.style.opacity = '0.7'));
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const docId = btn.dataset.docId;
        const isOwner = btn.dataset.isOwner === 'true';
        this.deleteDocument(docId, isOwner);
      });
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async createDocument() {
    try {
      // Show optimistic loading overlay
      this.app.showTransitionOverlay('Creating document...');

      // Create document
      const doc = await Network.fetchAPI('/api/documents', {
        method: 'POST',
        body: JSON.stringify({ title: 'Untitled document' }),
      });

      // Navigate immediately without waiting
      navigateTo(`/?doc=${doc._id}`);

      // Reload will happen due to navigation
    } catch (err) {
      console.error('Failed to create document:', err);
      this.app.hideTransitionOverlay();
      alert('Failed to create document. Please try again.');
    }
  }

  async deleteDocument(docId, isOwner) {
    const confirmMsg = isOwner
      ? 'Are you sure you want to permanently delete this document? This action cannot be undone.'
      : 'Remove this document from your drive? The document will remain accessible to the owner and other collaborators.';

    if (!confirm(confirmMsg)) return;

    try {
      const response = await Network.fetchAPI(`/api/documents/${docId}`, {
        method: 'DELETE',
      });

      // Show success message
      const actionMsg = response.action === 'deleted' ? 'Document deleted' : 'Removed from drive';
      console.log(actionMsg);

      // Reload documents
      await this.loadDocuments(this.currentPage);
    } catch (err) {
      console.error('Failed to delete document:', err);
      alert('Failed to delete document. Please try again.');
    }
  }

  openDocument(docId) {
    navigateTo(`/?doc=${docId}`);
  }
}
