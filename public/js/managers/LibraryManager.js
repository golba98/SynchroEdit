import { Network } from '/js/core/network.js';
import { UI } from '/js/ui/ui.js';

export class LibraryManager {
  constructor(app) {
    this.app = app;
  }

  async showLibrary() {
    const library = document.getElementById('docLibrary');
    const overlay = document.getElementById('libraryOverlay');
    if (!library || !overlay) return;

    library.style.display = 'block';
    overlay.style.display = 'block';
    const closeBtn = document.getElementById('closeLibrary');
    if (closeBtn) closeBtn.style.display = this.app.documentId ? 'block' : 'none';

    const renderList = (docs) => {
      UI.renderDocumentList(
        document.getElementById('documentList'),
        docs,
        this.app.documentId,
        (id) => {
          this.app.showTransitionOverlay('Opening Document...');
          window.location.href = `?doc=${id}`;
        },
        async (id) => {
          if (confirm('Delete this document?')) {
            await Network.deleteDocument(id);
            // After deletion, clear cache to force fresh fetch or update it
            localStorage.removeItem('syncroedit_library_cache');
            this.showLibrary();
          }
        },
        this.app.user._id
      );
    };

    // 1. Instant Cache Render
    const cachedData = localStorage.getItem('syncroedit_library_cache');
    let hasRenderedCache = false;

    if (cachedData) {
      try {
        const docs = JSON.parse(cachedData);
        if (Array.isArray(docs)) {
          renderList(docs);
          hasRenderedCache = true;
        }
      } catch (e) {
        console.warn('Failed to parse library cache', e);
      }
    }

    // 2. Network Refresh (Stale-While-Revalidate)
    try {
      const data = await Network.getDocuments();
      const docs = data.documents || [];
      const newCacheString = JSON.stringify(docs);

      // Only re-render if data actually changed
      if (newCacheString !== cachedData) {
        localStorage.setItem('syncroedit_library_cache', newCacheString);
        renderList(docs);
      } else if (!hasRenderedCache) {
        // If we didn't have cache but network returned same (empty?) or cache was invalid
        renderList(docs);
      }
    } catch (err) {
      console.error('Error fetching documents from network:', err);

      // Handle Auth Error (Token expired/invalid)
      if (err.message && err.message.includes('401')) {
        window.location.href = '/pages/login.html';
        return;
      }

      // If network fails and we didn't render cache, show error
      if (!hasRenderedCache) {
        const listContainer = document.getElementById('documentList');
        if (listContainer) {
          listContainer.innerHTML =
            '<tr><td colspan="4" style="text-align: center; padding: 20px;">Failed to load documents (Offline).</td></tr>';
        }
      }
    }
  }

  async createNewDocument() {
    try {
      this.app.showTransitionOverlay('Creating Document...');
      const doc = await Network.createDocument();
      window.location.href = `?doc=${doc._id}`;
    } catch (err) {
      this.app.hideTransitionOverlay();
      alert('Failed to create document');
    }
  }
}
