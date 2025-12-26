import { Auth } from '/js/ui/auth.js';
import { Network } from '/js/core/network.js';
import { UI } from '/js/ui/ui.js';
import { Editor } from '/js/editor/editor.js';
import { Theme } from '/js/ui/theme.js';
import { Profile } from '/js/ui/profile.js';
import { DynamicBackground } from '/js/ui/background.js';
import { navigateTo } from '/js/core/utils.js';

export class App {
  constructor() {
    this.documentId = new URLSearchParams(window.location.search).get('doc');
    this.user = null;
    this.editor = null;
    this.theme = new Theme();
    this.profile = new Profile();
    this.background = new DynamicBackground();

    this.init();
    this.registerServiceWorker();
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => console.log('Service Worker registered'))
          .catch((err) => console.log('Service Worker registration failed:', err));
      });
    }
  }

  async init() {
    const profilePromise = this.profile.loadProfile();

    let initialTask;
    if (this.documentId) {
      initialTask = Promise.resolve(); // Editor loads itself
    } else {
      initialTask = this.showLibrary();
    }

    this.user = await profilePromise;

    if (!this.user) {
      const params = new URLSearchParams(window.location.search).get('doc');
      navigateTo(params ? `pages/login.html?doc=${params}` : 'pages/login.html');
      return;
    }

    // Sync Theme from Profile
    if (this.user.accentColor) {
        this.theme.applyAccentColor(this.user.accentColor);
    }
    
    // Listen for Theme Changes to Sync Back
    window.addEventListener('theme-update', () => {
        if (this.user && this.theme.currentAccentColor) {
             if (this.user.accentColor !== this.theme.currentAccentColor) {
                 this.profile.updateAccentColor(this.theme.currentAccentColor);
             }
        }
    });

    this.setupEventListeners();
    this.setupRibbonTabs();
    this.setupVisibilityListener();

    if (this.documentId) {
        await this.loadDocument();
    } else {
        await initialTask;
    }
  }

  setupVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // When coming back, check if we need to refresh status
        if (this.editor && this.editor.provider) {
          if (this.editor.provider.wsconnected) {
             this.handleWSStatusChange('connected');
          } else {
             // Immediate feedback if we come back to a dead connection
             // Force the overlay to show immediately without the 5s patience timer
             const overlay = document.getElementById('serverOfflineOverlay');
             if (overlay) {
                 UI.updateConnectionStatus(overlay, 'disconnected');
                 overlay.style.display = 'flex';
             }
          }
        }
      }
    });
  }

  async loadDocument() {
    try {
      Network.addToRecent(this.documentId).catch((err) =>
        console.warn('Recent list update failed:', err)
      );

      this.editor = new Editor('pagesContainer', {
        user: this.user,
        onPageChange: (index) => this.updateStatus(index),
        onTitleChange: (title) => {
            // Title synced via Yjs, just update UI if needed
            // Editor updates the input value automatically
        },
        onStatusChange: (status) => this.handleWSStatusChange(status),
        onCollaboratorsChange: (users) => {
             UI.updateCollaboratorsUI(
              document.getElementById('activeCollaborators'),
              users,
              this.user.username
            );
        }
      });

      document.getElementById('docLibrary').style.display = 'none';
      document.getElementById('libraryOverlay').style.display = 'none';
    } catch (err) {
      console.error('Failed to load document:', err);
      this.showLibrary();
    }
  }

  handleWSStatusChange(status) {
    const overlay = document.getElementById('serverOfflineOverlay');
    if (!overlay) return;

    if (status === 'connected') {
      // 1. Immediate Flush
      if (this.connectionTimer) {
          clearTimeout(this.connectionTimer);
          this.connectionTimer = null;
      }
      overlay.style.display = 'none';
    } else {
      // 2. State Machine for Disconnect
      if (document.visibilityState === 'visible') {
          // If we are already waiting, don't restart the timer
          if (!this.connectionTimer) {
              this.connectionTimer = setTimeout(() => {
                  if (document.visibilityState === 'visible') {
                      UI.updateConnectionStatus(overlay, status);
                      overlay.style.display = 'flex';
                  }
                  this.connectionTimer = null;
              }, 5000); // 5-second patience
          }
      } else {
          // If hidden, do nothing. We will check status immediately upon visibility change.
      }
    }
  }

  setupEventListeners() {
    const addEvent = (id, event, handler) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(event, handler);
    };

    // Navigation/Library
    addEvent('menuBtn', 'click', () => this.showLibrary());
    addEvent('createNewDoc', 'click', () => this.createNewDocument());
    addEvent('closeLibrary', 'click', () => {
      if (this.documentId) {
        const docLibrary = document.getElementById('docLibrary');
        const libraryOverlay = document.getElementById('libraryOverlay');
        if (docLibrary) docLibrary.style.display = 'none';
        if (libraryOverlay) libraryOverlay.style.display = 'none';
      }
    });

    // Profile
    addEvent('userProfileTrigger', 'click', () => {
      const modal = document.getElementById('profileModal');
      if (modal) modal.style.display = 'flex';
    });
    addEvent('libraryUserProfileTrigger', 'click', () => {
      const modal = document.getElementById('profileModal');
      if (modal) modal.style.display = 'flex';
    });
    addEvent('closeProfileModal', 'click', () => {
      const modal = document.getElementById('profileModal');
      if (modal) modal.style.display = 'none';
    });
    addEvent('logoutBtnProfile', 'click', () => Auth.logout());

    // Profile Tabs
    const profileTabs = document.querySelectorAll('.profile-tab');
    const profileTabContents = document.querySelectorAll('.profile-tab-content');
    profileTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        profileTabs.forEach((t) => t.classList.remove('active'));
        profileTabContents.forEach((c) => (c.style.display = 'none'));
        tab.classList.add('active');
        const targetContent = document.getElementById(`${targetTab}-content`);
        if (targetContent) targetContent.style.display = 'block';
      });
    });

    // PFP Upload
    addEvent('pfpUpload', 'change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = () => this.profile.updateProfilePicture(reader.result);
      reader.readAsDataURL(file);
    });

    // Bio Update
    addEvent('saveGeneralBtn', 'click', () => {
        const bio = document.getElementById('profileBioInput')?.value;
        this.profile.updateBio(bio);
    });

    // Password Update
    addEvent('updatePasswordBtn', 'click', () => {
      const current = document.getElementById('currentPassword')?.value;
      const next = document.getElementById('newPassword')?.value;
      if (current && next) {
        this.profile.updatePassword(current, next).then((success) => {
          if (success) {
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
          }
        });
      }
    });

    // Theme
    addEvent('darkThemeBtn', 'click', () => this.theme.applyTheme('dark'));
    addEvent('lightThemeBtn', 'click', () => this.theme.applyTheme('light'));

    // Accent Colors
    document.querySelectorAll('.accent-color-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.theme.applyAccentColor(btn.dataset.color));
    });

    // Zoom
    addEvent('zoomInBtn', 'click', () => {
      if (this.editor && this.editor.currentZoom < 200) {
        this.editor.currentZoom += 10;
        this.editor.applyZoom();
        this.updateZoomDisplay();
      }
    });
    addEvent('zoomOutBtn', 'click', () => {
      if (this.editor && this.editor.currentZoom > 50) {
        this.editor.currentZoom -= 10;
        this.editor.applyZoom();
        this.updateZoomDisplay();
      }
    });

    // History
    addEvent('showHistoryBtn', 'click', () => this.showHistory());
    addEvent('closeHistoryModal', 'click', () => {
      const modal = document.getElementById('historyModal');
      if (modal) modal.style.display = 'none';
    });

    // Save and Save As
    addEvent('saveBtn', 'click', () => {
      const saveBtn = document.getElementById('saveBtn');
      const originalText = saveBtn.innerHTML;
      saveBtn.innerHTML = '<i class="fas fa-check"></i> Saved';
      saveBtn.style.background = '#10b981';

      // Yjs autosaves, so this is just visual feedback
      // We could force a save via API if we wanted to be sure
      
      setTimeout(() => {
        saveBtn.innerHTML = originalText;
        saveBtn.style.background = '';
      }, 2000);
    });

    addEvent('saveAsBtn', 'click', async () => {
        alert('Save As is currently disabled during migration to Real-time engine.');
        // Needs to be re-implemented to copy Yjs state
    });

    // Share
    addEvent('shareBtn', 'click', () => {
      const modal = document.getElementById('shareModal');
      const input = document.getElementById('shareLink');
      if (modal && input) {
        input.value = window.location.href;
        modal.style.display = 'flex';
      }
    });

    addEvent('closeShareModal', 'click', () => {
      const modal = document.getElementById('shareModal');
      if (modal) modal.style.display = 'none';
    });

    addEvent('copyLinkBtn', 'click', () => {
      const input = document.getElementById('shareLink');
      input.select();
      document.execCommand('copy');
      const btn = document.getElementById('copyLinkBtn');
      const original = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
      setTimeout(() => (btn.innerHTML = original), 2000);
    });
  }

  async showLibrary() {
    const library = document.getElementById('docLibrary');
    const overlay = document.getElementById('libraryOverlay');
    if (!library || !overlay) return;

    library.style.display = 'block';
    overlay.style.display = 'block';
    document.getElementById('closeLibrary').style.display = this.documentId ? 'block' : 'none';

    const renderList = (docs) => {
        UI.renderDocumentList(
            document.getElementById('documentList'),
            docs,
            this.documentId,
            (id) => (window.location.href = `?doc=${id}`),
            async (id) => {
              if (confirm('Delete this document?')) {
                await Network.deleteDocument(id);
                // After deletion, clear cache to force fresh fetch or update it
                localStorage.removeItem('syncroedit_library_cache');
                this.showLibrary();
              }
            },
            this.user._id
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
          document.getElementById('documentList').innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Failed to load documents (Offline).</td></tr>';
      }
    }
  }

  async createNewDocument() {
    try {
      const doc = await Network.createDocument();
      window.location.href = `?doc=${doc._id}`;
    } catch (err) {
      alert('Failed to create document');
    }
  }

  async showHistory() {
    if (!this.documentId) return;
    const modal = document.getElementById('historyModal');
    const list = document.getElementById('historyList');
    modal.style.display = 'flex';
    list.innerHTML = 'Loading history...';

    try {
      const history = await Network.getHistory(this.documentId);
      list.innerHTML = history
        .map(
          (item) => `
                <div style="padding: 10px; border-bottom: 1px solid #2a2a2a;">
                    <div style="display: flex; justify-content: space-between;">
                        <strong>${item.username}</strong>
                        <small>${new Date(item.timestamp).toLocaleString()}</small>
                    </div>
                    <div>${item.action}</div>
                    ${item.details ? `<div style="font-size: 11px; color: #666;">${item.details}</div>` : ''}
                </div>
            `
        )
        .join('');
    } catch (err) {
      list.innerHTML = 'Failed to load history';
    }
  }

  updateStatus(pageIndex) {
    document.getElementById('pageIndicator').textContent = `Page ${pageIndex + 1}`;
    const totalPages = this.editor ? this.editor.pages.length : 1;
    document.getElementById('pageIndicator').textContent += ` of ${totalPages}`;

    if (this.statusTimeout) clearTimeout(this.statusTimeout);
    this.statusTimeout = setTimeout(() => {
      if (this.editor && this.editor.quill) {
        const text = this.editor.quill.getText();
        const chars = text.replace(/\s/g, '').length;
        const words = text
          .trim()
          .split(/\s+/)
          .filter((word) => word.length > 0).length;
        const charEl = document.getElementById('charCount');
        const wordEl = document.getElementById('wordCount');
        if (charEl) charEl.textContent = `Characters: ${Math.max(0, chars)}`;
        if (wordEl) wordEl.textContent = `Words: ${words}`;
      }
    }, 500);
  }

  updateZoomDisplay() {
    document.getElementById('zoomPercent').textContent = `${this.editor.currentZoom}%`;
  }

  setupRibbonTabs() {
    const tabs = document.querySelectorAll('.ribbon-tab');
    const ribbons = document.querySelectorAll('.ribbon-content');

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('active'));
        ribbons.forEach((r) => r.classList.remove('active'));
        tab.classList.add('active');
        const ribbon = document.getElementById(`${tab.dataset.tab}-ribbon`);
        if (ribbon) ribbon.classList.add('active');
      });
    });
  }
}

if (typeof window !== 'undefined' && !window.testEnv) {
    new App();
}