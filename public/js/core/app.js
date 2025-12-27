import { Auth } from '/js/ui/auth.js';
import { Network } from '/js/core/network.js';
import { UI } from '/js/ui/ui.js';
import { Editor } from '/js/editor/editor.js';
import { Theme } from '/js/ui/theme.js';
import { Profile } from '/js/ui/profile.js';
import { DynamicBackground } from '/js/ui/background.js';
import { navigateTo } from '/js/core/utils.js';
import { LibraryManager } from '/js/managers/LibraryManager.js';
import { UIManager } from '/js/ui/UIManager.js';

export class App {
  constructor() {
    this.documentId = new URLSearchParams(window.location.search).get('doc');
    this.user = null;
    this.editor = null;
    this.theme = new Theme();
    this.profile = new Profile();
    this.background = new DynamicBackground();
    this.libraryManager = new LibraryManager(this);
    this.uiManager = new UIManager(this);
    this.connectionTimer = null;

    window.app = this; // Expose app instance
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
    this.user = await this.profile.loadProfile();

    if (!this.user) {
      const params = new URLSearchParams(window.location.search).get('doc');
      navigateTo(params ? `pages/login.html?doc=${params}` : 'pages/login.html');
      return;
    }

    // Remove Auth Guard
    const authGuard = document.getElementById('authGuard');
    if (authGuard) {
        authGuard.style.opacity = '0';
        setTimeout(() => authGuard.remove(), 500);
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

    this.uiManager.setupEventListeners();
    this.uiManager.setupRibbonTabs();
    this.setupVisibilityListener();

    if (this.documentId) {
        await this.loadDocument();
    } else {
        await this.libraryManager.showLibrary();
    }
  }

  setupVisibilityListener() {
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab visible, checking session and connection...');
        
        // 1. Re-validate session (triggers refresh if needed)
        const user = await this.profile.loadProfile();
        if (!user) {
            Auth.logout();
            return;
        }

        // 2. Check connection
        if (this.editor && this.editor.provider) {
          if (!this.editor.provider.wsconnected) {
             console.log('WS disconnected on wake, forcing reconnection...');
             
             // Force reconnection with fresh ticket and updated user
             if (this.editor.reconnect) {
                 this.editor.reconnect(user);
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
        onPageChange: (index) => this.uiManager.updateStatus(index),
        onTitleChange: (title) => {
            // Title synced via Yjs, just update UI if needed
        },
        onStatusChange: (status) => this.uiManager.handleWSStatusChange(status),
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
      this.libraryManager.showLibrary();
    }
  }

  showTransitionOverlay(text = 'Loading...') {
    const authGuard = document.getElementById('authGuard');
    const authGuardText = document.getElementById('authGuardText');
    if (authGuard) {
      if (authGuardText) authGuardText.textContent = text;
      authGuard.style.display = 'flex';
      authGuard.style.opacity = '1';
    }
  }

  hideTransitionOverlay() {
    const authGuard = document.getElementById('authGuard');
    if (authGuard) {
      authGuard.style.opacity = '0';
      setTimeout(() => (authGuard.style.display = 'none'), 500);
    }
  }
}

if (typeof window !== 'undefined' && !window.testEnv) {
    new App();
}
