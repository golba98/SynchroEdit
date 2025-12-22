import { Auth } from './auth.js';
import { Network } from './network.js';
import { UI } from './ui.js';
import { Editor } from './editor.js';
import { Theme } from './theme.js';
import { Profile } from './profile.js';

class App {
    constructor() {
        this.documentId = new URLSearchParams(window.location.search).get('doc');
        this.user = null;
        this.ws = null;
        this.editor = null;
        this.theme = new Theme();
        this.profile = new Profile();
        
        this.init();
    }

    async init() {
        this.user = await this.profile.loadProfile();
        if (!this.user) {
            const params = new URLSearchParams(window.location.search).get('doc');
            window.location.href = params ? `login.html?doc=${params}` : 'login.html';
            return;
        }

        this.setupEventListeners();
        
        if (this.documentId) {
            await this.loadDocument();
        } else {
            this.showLibrary();
        }

        this.setupRibbonTabs();
    }

    async loadDocument() {
        try {
            await Network.addToRecent(this.documentId);
            this.editor = new Editor('pagesContainer', {
                onContentChange: (type, data) => this.handleContentChange(type, data),
                onPageChange: (index) => this.updateStatus(index)
            });

            this.ws = Network.initWebSocket(
                this.documentId,
                (data) => this.handleWSMessage(data),
                () => this.handleWSClose()
            );

            document.getElementById('docLibrary').style.display = 'none';
            document.getElementById('libraryOverlay').style.display = 'none';
        } catch (err) {
            console.error('Failed to load document:', err);
            this.showLibrary();
        }
    }

    handleContentChange(type, data) {
        if (type === 'update-page') {
            Network.sendWS(this.ws, {
                type: 'update-page',
                pageIndex: data.pageIndex,
                content: data.content
            });
        } else if (type === 'new-page') {
            Network.sendWS(this.ws, { type: 'new-page' });
        } else if (type === 'delete-page') {
            Network.sendWS(this.ws, { type: 'delete-page', pageIndex: data.pageIndex });
        }
    }

    handleWSMessage(data) {
        switch (data.type) {
            case 'sync':
                document.getElementById('docTitle').value = data.data.title;
                this.editor.updateFromSync(data.data);
                break;
            case 'update-title':
                document.getElementById('docTitle').value = data.title;
                break;
            case 'update-page':
                this.editor.updatePageContent(data.pageIndex, data.content);
                break;
            case 'collaborators':
                UI.updateCollaboratorsUI(
                    document.getElementById('activeCollaborators'),
                    data.users,
                    this.user.username
                );
                break;
            case 'document-deleted':
                alert('This document has been deleted by the owner.');
                window.location.href = 'index.html';
                break;
        }
    }

    handleWSClose() {
        const offlineOverlay = document.getElementById('serverOfflineOverlay');
        if (offlineOverlay) offlineOverlay.style.display = 'flex';
        setTimeout(() => window.location.reload(), 3000);
    }

    setupEventListeners() {
        // Document Title
        document.getElementById('docTitle').addEventListener('input', (e) => {
            Network.sendWS(this.ws, { type: 'update-title', title: e.target.value });
        });

        // Navigation/Library
        document.getElementById('menuBtn').addEventListener('click', () => this.showLibrary());
        document.getElementById('createNewDoc').addEventListener('click', () => this.createNewDocument());
        document.getElementById('closeLibrary').addEventListener('click', () => {
            if (this.documentId) {
                document.getElementById('docLibrary').style.display = 'none';
                document.getElementById('libraryOverlay').style.display = 'none';
            }
        });

        // Profile
        document.getElementById('userProfileTrigger').addEventListener('click', () => {
            document.getElementById('profileModal').style.display = 'flex';
        });
        document.getElementById('libraryUserProfileTrigger').addEventListener('click', () => {
            document.getElementById('profileModal').style.display = 'flex';
        });
        document.getElementById('closeProfileModal').addEventListener('click', () => {
            document.getElementById('profileModal').style.display = 'none';
        });
        document.getElementById('logoutBtnProfile').addEventListener('click', () => Auth.logout());

        // PFP Upload
        document.getElementById('pfpUpload').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onloadend = () => this.profile.updateProfilePicture(reader.result);
            reader.readAsDataURL(file);
        });

        // Password Update
        document.getElementById('updatePasswordBtn').addEventListener('click', () => {
            const current = document.getElementById('currentPassword').value;
            const next = document.getElementById('newPassword').value;
            if (current && next) {
                this.profile.updatePassword(current, next).then(success => {
                    if (success) {
                        document.getElementById('currentPassword').value = '';
                        document.getElementById('newPassword').value = '';
                    }
                });
            }
        });

        // Theme
        document.getElementById('darkThemeBtn').addEventListener('click', () => this.theme.applyTheme('dark'));
        document.getElementById('lightThemeBtn').addEventListener('click', () => this.theme.applyTheme('light'));

        // Accent Colors
        document.querySelectorAll('.accent-color-btn').forEach(btn => {
            btn.addEventListener('click', () => this.theme.applyAccentColor(btn.dataset.color));
        });

        // Zoom
        document.getElementById('zoomInBtn').addEventListener('click', () => {
            if (this.editor.currentZoom < 200) {
                this.editor.currentZoom += 10;
                this.editor.applyZoom();
                this.updateZoomDisplay();
            }
        });
        document.getElementById('zoomOutBtn').addEventListener('click', () => {
            if (this.editor.currentZoom > 50) {
                this.editor.currentZoom -= 10;
                this.editor.applyZoom();
                this.updateZoomDisplay();
            }
        });

        // History
        document.getElementById('showHistoryBtn').addEventListener('click', () => this.showHistory());
        document.getElementById('closeHistoryModal').addEventListener('click', () => {
            document.getElementById('historyModal').style.display = 'none';
        });

        // Toolbar formatting (Delegation could be better, but for now)
        this.setupToolbar();
    }

    setupToolbar() {
        const buttons = {
            'ql-bold': 'bold',
            'ql-italic': 'italic',
            'ql-underline': 'underline',
            'ql-strike': 'strike'
        };

        Object.entries(buttons).forEach(([cls, fmt]) => {
            document.querySelectorAll(`.${cls}`).forEach(btn => {
                btn.addEventListener('click', () => {
                    if (!this.editor.quill) return;
                    const format = this.editor.quill.getFormat();
                    this.editor.quill.format(fmt, !format[fmt]);
                });
            });
        });

        // Font and Size
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
    }

    async showLibrary() {
        const library = document.getElementById('docLibrary');
        const overlay = document.getElementById('libraryOverlay');
        library.style.display = 'block';
        overlay.style.display = 'block';
        document.getElementById('closeLibrary').style.display = this.documentId ? 'block' : 'none';

        try {
            const docs = await Network.getDocuments();
            UI.renderDocumentList(
                document.getElementById('documentList'),
                docs,
                this.documentId,
                (id) => window.location.href = `?doc=${id}`,
                async (id) => {
                    if (confirm('Delete this document?')) {
                        await Network.deleteDocument(id);
                        this.showLibrary();
                    }
                }
            );
        } catch (err) {
            console.error('Error showing library:', err);
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
            list.innerHTML = history.map(item => `
                <div style="padding: 10px; border-bottom: 1px solid #2a2a2a;">
                    <div style="display: flex; justify-content: space-between;">
                        <strong>${item.username}</strong>
                        <small>${new Date(item.timestamp).toLocaleString()}</small>
                    </div>
                    <div>${item.action}</div>
                    ${item.details ? `<div style="font-size: 11px; color: #666;">${item.details}</div>` : ''}
                </div>
            `).join('');
        } catch (err) {
            list.innerHTML = 'Failed to load history';
        }
    }

    updateStatus(pageIndex) {
        document.getElementById('pageIndicator').textContent = `Page ${pageIndex + 1}`;
        const totalPages = this.editor.pages.length;
        document.getElementById('pageIndicator').textContent += ` of ${totalPages}`;
        
        if (this.editor.quill) {
            const text = this.editor.quill.getText();
            const chars = text.replace(/\s/g, '').length;
            const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
            document.getElementById('charCount').textContent = `Characters: ${Math.max(0, chars)}`;
            document.getElementById('wordCount').textContent = `Words: ${words}`;
        }
    }

    updateZoomDisplay() {
        document.getElementById('zoomPercent').textContent = `${this.editor.currentZoom}%`;
    }

    setupRibbonTabs() {
        const tabs = document.querySelectorAll('.ribbon-tab');
        const ribbons = document.querySelectorAll('.ribbon-content');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                ribbons.forEach(r => r.classList.remove('active'));
                tab.classList.add('active');
                const ribbon = document.getElementById(`${tab.dataset.tab}-ribbon`);
                if (ribbon) ribbon.classList.add('active');
            });
        });
    }
}

new App();