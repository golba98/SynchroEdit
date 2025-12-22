// Auth Check
let token = localStorage.getItem('synchroEditToken');
console.log('Script loaded. Token present:', !!token);

// Utility: Escape HTML
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Redirect if no token or if it's the old local preview token
if (!token || token === 'local-preview-token') {
    localStorage.removeItem('synchroEditToken');
    const params = new URLSearchParams(window.location.search);
    const docId = params.get('doc');
    window.location.href = docId ? `login.html?doc=${docId}` : 'login.html';
}

// Verify token validity with server
fetch('/api/user/profile', {
    headers: { 'Authorization': `Bearer ${token}` }
}).then(response => {
    if (response.status === 401 || response.status === 403 || response.status === 404) {
        localStorage.removeItem('synchroEditToken');
        window.location.href = 'login.html';
    }
}).catch(console.error);

// Wait for DOM to be ready before initializing
document.addEventListener('DOMContentLoaded', () => {
    // Register custom font sizes
    const Size = Quill.import('attributors/style/size');
    Size.whitelist = ['8px', '9px', '10px', '11px', '12px', '14px', '16px', '18px', '20px', '22px', '24px', '26px', '28px', '36px', '48px', '72px'];
    Quill.register(Size, true);

    // Register custom fonts
    const Font = Quill.import('attributors/style/font');
    Font.whitelist = ['roboto', 'open-sans', 'lato', 'montserrat', 'oswald', 'merriweather', 'arial', 'times-new-roman', 'courier-new', 'georgia', 'verdana'];
    Quill.register(Font, true);

    // Initialize Quill Editor variables
    let quill = null;
    let pageQuillInstances = {};

    // DOM Elements
    const docTitle = document.getElementById('docTitle');
    const imageInput = document.getElementById('imageInput');
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const zoomPercent = document.getElementById('zoomPercent');
    const newPageBtn = document.getElementById('newPageBtn');
    const pageTabsContainer = document.getElementById('pageTabsContainer');
    const pageInfo = document.getElementById('pageInfo');
    const charCountSpan = document.getElementById('charCount');
    const wordCountSpan = document.getElementById('wordCount');
    const shareBtn = document.getElementById('shareBtn');
    const newDocBtn = document.getElementById('newDocBtn');
    const saveFileBtn = document.getElementById('saveFileBtn');
    const loadFileBtn = document.getElementById('loadFileBtn');
    const fileInput = document.getElementById('fileInput');
    const shareModal = document.getElementById('shareModal');
    const shareLink = document.getElementById('shareLink');
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    const closeShareModal = document.getElementById('closeShareModal');
    const menuBtn = document.getElementById('menuBtn');
    const docLibrary = document.getElementById('docLibrary');
    const libraryOverlay = document.getElementById('libraryOverlay');
    const closeLibrary = document.getElementById('closeLibrary');
    const createNewDoc = document.getElementById('createNewDoc');
    const documentList = document.getElementById('documentList');
    const docSearch = document.getElementById('docSearch');
    const logoutBtn = document.getElementById('logoutBtn');

    // Profile Elements
    const userProfileTrigger = document.getElementById('userProfileTrigger');
    const profileModal = document.getElementById('profileModal');
    const closeProfileModal = document.getElementById('closeProfileModal');
    const profilePfp = document.getElementById('profilePfp');
    const profilePfpPlaceholder = document.getElementById('profilePfpPlaceholder');
    const headerPfp = document.getElementById('headerPfp');
    const headerUserIcon = document.getElementById('headerUserIcon');
    const pfpUpload = document.getElementById('pfpUpload');
    const profileUsername = document.getElementById('profileUsername');
    const currentPasswordInput = document.getElementById('currentPassword');
    const newPasswordInput = document.getElementById('newPassword');
    const updatePasswordBtn = document.getElementById('updatePasswordBtn');
    const darkThemeBtn = document.getElementById('darkThemeBtn');
    const lightThemeBtn = document.getElementById('lightThemeBtn');
    const libraryUserProfileTrigger = document.getElementById('libraryUserProfileTrigger');

    // State
    let currentZoom = 100;
    let pages = [
        {
            id: 'page-1',
            number: 1,
            content: { ops: [{ insert: '\n' }] }
        }
    ];
    let currentPageIndex = 0;
    let ws = null;
    let isLoadingFromServer = false;
    let documentId = getDocumentId();
    let autoSaveInterval = null;

    // Get or create document ID from URL
    function getDocumentId() {
        const params = new URLSearchParams(window.location.search);
        let docId = params.get('doc');
        
        if (!docId) {
            // Don't auto-load any document
            // Will be handled by showing document library on load
            return null;
        }
        
        // Remember this document
        localStorage.setItem('lastOpenedDoc', docId);
        
        return docId;
    }

    // Document Storage Management (Backend API)
    async function addToRecent(docId) {
        if (!docId) return;
        try {
            await fetch(`/api/documents/${docId}/recent`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (err) {
            console.error('Error adding to recent:', err);
        }
    }

    async function getAllDocuments() {
        try {
            const response = await fetch('/api/documents', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch');
            return await response.json();
        } catch (err) {
            console.error(err);
            return [];
        }
    }

    async function createNewDocument() {
        try {
            const response = await fetch('/api/documents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: 'Untitled document',
                    pages: [{ content: '' }]
                })
            });
            const doc = await response.json();
            window.location.href = `${window.location.pathname}?doc=${doc._id}`;
        } catch (err) {
            console.error(err);
        }
    }

    function openDocument(docId) {
        window.location.href = `${window.location.pathname}?doc=${docId}`;
    }

    async function renderDocumentList() {
        const docArray = await getAllDocuments();
        
        if (!docArray || docArray.length === 0) {
            documentList.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 40px; color: #b0b0b0;">
                        No documents yet. Create your first document!
                    </td>
                </tr>
            `;
            return;
        }
        
        documentList.innerHTML = docArray.map(doc => {
            const isActive = doc._id === documentId;
            const date = new Date(doc.lastModified);
            const today = new Date();
            const isToday = date.toDateString() === today.toDateString();
            
            let dateStr;
            if (isToday) {
                dateStr = `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            } else {
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                if (date.toDateString() === yesterday.toDateString()) {
                    dateStr = `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                } else {
                    dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                }
            }

            // Get a preview from the first page content
            const previewText = doc.pages && doc.pages[0] && doc.pages[0].content 
                ? escapeHTML(doc.pages[0].content.replace(/<[^>]*>/g, '').substring(0, 100)) + '...' 
                : 'Empty document';
            
            const lastModifiedBy = escapeHTML(doc.lastModifiedBy ? doc.lastModifiedBy.username : 'Unknown');
            const safeTitle = escapeHTML(doc.title);
            
            return `
                <tr class="doc-item" data-doc-id="${doc._id}" style="border-bottom: 1px solid #2a2a2a; cursor: pointer; transition: background 0.2s; ${isActive ? 'background: rgba(var(--accent-color-rgb), 0.15);' : ''}">
                    <td style="padding: 16px 24px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <i class="fas fa-file-alt" style="color: var(--accent-color-light); font-size: 20px;"></i>
                            <div>
                                <div style="color: #e0e0e0; font-weight: 500; margin-bottom: 4px;">${safeTitle}</div>
                                <div style="color: #b0b0b0; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 400px;">${previewText}</div>
                            </div>
                        </div>
                    </td>
                    <td style="padding: 16px 24px; color: #b0b0b0; font-size: 14px;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <i class="fas fa-user-edit" style="font-size: 12px;"></i>
                            ${lastModifiedBy}
                        </div>
                    </td>
                    <td style="padding: 16px 24px; color: #b0b0b0; font-size: 14px;">${dateStr}</td>
                    <td style="padding: 16px 24px; text-align: center;">
                        <button class="delete-doc-btn" data-doc-id="${doc._id}" style="background: none; border: none; color: #b0b0b0; cursor: pointer; padding: 8px; border-radius: 50%; transition: all 0.2s;" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Use event delegation for better performance and reliability
        documentList.onclick = async (e) => {
            const deleteBtn = e.target.closest('.delete-doc-btn');
            const docItem = e.target.closest('.doc-item');

            if (deleteBtn) {
                e.stopPropagation();
                const docIdToDelete = deleteBtn.dataset.docId;
                if (confirm('Are you sure you want to delete this document?')) {
                    try {
                        const response = await fetch(`/api/documents/${docIdToDelete}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (response.ok) {
                            await renderDocumentList();
                        }
                    } catch (err) {
                        console.error('Error deleting document:', err);
                    }
                }
                return;
            }

            if (docItem) {
                const clickedDocId = docItem.dataset.docId;
                if (clickedDocId === documentId) {
                    // Already open, just close library
                    docLibrary.style.display = 'none';
                    libraryOverlay.style.display = 'none';
                } else {
                    openDocument(clickedDocId);
                }
            }
        };
    }

    // Initialize WebSocket Connection
    function initWebSocket() {
        // If running locally as a file or in local preview mode, skip WebSocket
        if (window.location.protocol === 'file:' || localStorage.getItem('synchroEditToken') === 'local-preview-token') {
            console.warn('Running in local mode. WebSocket features disabled.');
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('Connected to server');
            // Hide offline overlay if it was shown
            const offlineOverlay = document.getElementById('serverOfflineOverlay');
            if (offlineOverlay) offlineOverlay.style.display = 'none';

            // Send document ID and token to join specific document room
            ws.send(JSON.stringify({
                type: 'join-document',
                documentId: documentId,
                token: token
            }));
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleServerMessage(data);
            } catch (error) {
                console.error('WebSocket message error:', error);
            }
        };

        ws.onclose = () => {
            console.log('Disconnected from server, attempting reconnect in 3s...');
            
            // Show overlay with "Waiting..." message first
            const offlineOverlay = document.getElementById('serverOfflineOverlay');
            const title = document.getElementById('overlayTitle');
            const desc = document.getElementById('overlayDesc');
            
            // Only update text if it's not already showing the specific maintenance message
            if (offlineOverlay && title && desc && title.textContent !== 'System Update') {
                title.textContent = 'Connection Lost';
                desc.textContent = 'Reconnecting... The server may be restarting for updates.';
                offlineOverlay.style.display = 'flex';
            }

            setTimeout(initWebSocket, 3000);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            // Optional: Don't show immediately on error, wait for close
        };
    }

    // Render all pages from the pages array
    function renderAllPages() {
        const pagesContainer = document.getElementById('pagesContainer');
        if (!pagesContainer) return;
        
        const wasLoading = isLoadingFromServer;
        isLoadingFromServer = true;
        
        pagesContainer.innerHTML = '';
        // Don't reset pageQuillInstances completely if we want to keep some state, 
        // but here we are rebuilding the DOM so we must.
        pageQuillInstances = {};
        
        pages.forEach((page, index) => {
            createPageEditor(index);
        });
        
        isLoadingFromServer = wasLoading;
        
        // Set the global 'quill' and handle focus/scrolling
        switchToPage(currentPageIndex);
        
        applyZoom();
    }

    // Handle incoming server messages
    function handleServerMessage(data) {
        switch (data.type) {
            case 'error':
                console.error('Server Error:', data.message);
                alert('Server Error: ' + data.message);
                break;

            case 'sync':
                // Initial sync from server
                isLoadingFromServer = true;
                docTitle.value = data.data.title;
                pages = data.data.pages;
                currentPageIndex = data.data.currentPageIndex || 0;
                renderAllPages();
                isLoadingFromServer = false;
                break;

            case 'update-title':
                if (!isLoadingFromServer) {
                    docTitle.value = data.title;
                }
                break;

            case 'update-page':
                if (!isLoadingFromServer) {
                    // Update the page content in our pages array
                    if (pages[data.pageIndex]) {
                        pages[data.pageIndex].content = data.content;
                    }
                    
                    // Update the specific page's editor
                    const targetQuill = pageQuillInstances[data.pageIndex];
                    if (targetQuill) {
                        isLoadingFromServer = true;
                        targetQuill.setContents(data.content);
                        isLoadingFromServer = false;
                    }
                }
                break;

            case 'new-page':
                if (!isLoadingFromServer) {
                    const newPageIndex = pages.length;
                    pages.push({
                        id: `page-${Date.now()}`,
                        number: newPageIndex + 1,
                        content: { ops: [{ insert: '\n' }] }
                    });
                    createPageEditor(newPageIndex);
                    renderPageTabs();
                }
                break;

            case 'delete-page':
                if (!isLoadingFromServer && pages.length > 1) {
                    if (data.pageIndex < pages.length) {
                        pages.splice(data.pageIndex, 1);
                        if (currentPageIndex >= pages.length) {
                            currentPageIndex = pages.length - 1;
                        }
                        renderAllPages();
                    }
                }
                break;

            case 'change-page':
                if (!isLoadingFromServer && data.pageIndex !== currentPageIndex) {
                    switchToPage(data.pageIndex);
                }
                break;

            case 'collaborators':
                updateCollaboratorsUI(data.users);
                break;

            case 'document-deleted':
                alert('This document has been deleted by the owner.');
                window.location.href = 'index.html';
                break;

            case 'server-maintenance':
                console.log('Server is entering maintenance mode');
                const offlineOverlay = document.getElementById('serverOfflineOverlay');
                const title = document.getElementById('overlayTitle');
                const desc = document.getElementById('overlayDesc');
                
                if (offlineOverlay && title && desc) {
                    title.textContent = 'System Update';
                    desc.textContent = data.message || 'Deploying new features. The system will restart momentarily.';
                    offlineOverlay.style.display = 'flex';
                }
                break;
        }
    }

    function updateCollaboratorsUI(users) {
        const container = document.getElementById('activeCollaborators');
        if (!container) return;

        // Get current username to filter it out
        const currentUsername = localStorage.getItem('synchroEditUser');
        
        // Filter out current user from the list
        const otherUsers = users.filter(user => user.username !== currentUsername);

        if (otherUsers.length > 0) {
            container.style.display = 'flex';
        } else {
            container.style.display = 'none';
        }

        container.innerHTML = otherUsers.map((user, index) => {
            const colors = ['#8b5cf6', '#a78bfa', '#c4b5fd', '#6366f1', '#818cf8', '#a5b4fc'];
            const color = colors[index % colors.length];
            const initial = escapeHTML(user.username.charAt(0).toUpperCase());
            const safeUsername = escapeHTML(user.username);
            
            if (user.profilePicture) {
                return `
                <div title="${safeUsername}" style="
                    width: 30px; 
                    height: 30px; 
                    border-radius: 50%; 
                    background: #ffffff; 
                    border: 2px solid var(--accent-color); 
                    margin-left: -8px;
                    cursor: default;
                    box-shadow: 0 0 15px rgba(var(--accent-color-rgb), 0.4);
                    overflow: hidden;
                    position: relative;
                ">
                    <img src="${user.profilePicture}" style="width: 100%; height: 100%; object-fit: cover;" alt="${initial}">
                </div>
                `;
            }

            return `
                <div title="${safeUsername}" style="
                    width: 30px; 
                    height: 30px; 
                    border-radius: 50%; 
                    background: ${color}; 
                    color: white; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    font-size: 14px; 
                    font-weight: bold; 
                    border: 2px solid #0a0a0a; 
                    margin-left: -8px;
                    cursor: default;
                    box-shadow: 0 0 15px rgba(var(--accent-color-rgb), 0.4);
                ">
                    ${initial}
                </div>
            `;
        }).join('');
    }

    // Send message to server
    function sendToServer(message) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    // Document Title
    if (docTitle) {
        docTitle.addEventListener('input', () => {
            sendToServer({
                type: 'update-title',
                title: docTitle.value
            });
            localStorage.setItem('docTitle', docTitle.value);
        });
    }

    // Quill Content Changes for the initial page
    // Create new page
    function createNewPage() {
        // Save current page content first
        if (currentPageIndex >= 0 && currentPageIndex < pages.length) {
            pages[currentPageIndex].content = quill.getContents();
        }
        
        const newPageIndex = pages.length;
        const newPage = {
            id: `page-${Date.now()}`,
            number: newPageIndex + 1,
            content: { ops: [{ insert: '\n' }] }
        };
        pages.push(newPage);
        
        sendToServer({
            type: 'new-page'
        });
        
        // Create a new editor div for this page
        createPageEditor(newPageIndex);
        
        // Switch to the new page
        switchToPage(newPageIndex);
        
        localStorage.setItem('docPages', JSON.stringify(pages));
    }

    // Merge current page with the previous one
    function mergeWithPreviousPage(pageIndex) {
        if (pageIndex <= 0 || pageIndex >= pages.length) return;
        
        const currentQuill = pageQuillInstances[pageIndex];
        const prevQuill = pageQuillInstances[pageIndex - 1];
        
        if (!currentQuill || !prevQuill) {
            console.error('Could not find quill instances for merging', pageIndex);
            return;
        }
        
        // Get contents as Deltas
        const currentContent = currentQuill.getContents();
        const prevContent = prevQuill.getContents();
        
        // Calculate split point (end of previous page)
        // getLength() includes the trailing newline
        const prevLength = prevQuill.getLength();
        
        // Merge contents
        // If prevContent ends with a newline (which it always does in Quill), 
        // concat will just append the new ops.
        const mergedDelta = prevContent.concat(currentContent);
        
        // Update the pages array
        pages[pageIndex - 1].content = mergedDelta;
        pages.splice(pageIndex, 1);
        
        // Notify server
        sendToServer({
            type: 'delete-page',
            pageIndex: pageIndex
        });
        
        sendToServer({
            type: 'update-page',
            pageIndex: pageIndex - 1,
            content: mergedDelta
        });
        
        // Update local state and re-render
        currentPageIndex = pageIndex - 1;
        renderAllPages();
        
        // Set selection to the merge point
        setTimeout(() => {
            const newQuill = pageQuillInstances[currentPageIndex];
            if (newQuill) {
                newQuill.focus();
                // Position cursor at the end of the original previous content
                // (Right before the newline that was at the end of prev page)
                const selectionIndex = Math.max(0, prevLength - 1);
                newQuill.setSelection(selectionIndex, 0);
                
                // Trigger a check for overflow in case the merged page is now too long
                checkAndCreateNewPage(currentPageIndex);
            }
        }, 150);
        
        localStorage.setItem('docPages', JSON.stringify(pages));
    }

    // Create an editor div for a page and initialize it with Quill
    function createPageEditor(pageIndex) {
        const pagesContainer = document.getElementById('pagesContainer');
        const newPageContainer = document.createElement('div');
        newPageContainer.className = 'editor-container';
        newPageContainer.id = `page-container-${pageIndex}`;
        newPageContainer.innerHTML = `
            <div class="page-border-inner" style="position: absolute; top: 10px; left: 10px; right: 10px; bottom: 10px; pointer-events: none; border: 1px solid transparent; z-index: 5;"></div>
            <div id="editor-${pageIndex}" class="page-editor" data-page-index="${pageIndex}" style="position: relative; z-index: 1;"></div>
        `;
        
        pagesContainer.appendChild(newPageContainer);
        
        // Initialize Quill for this page
        const pageQuill = new Quill(`#editor-${pageIndex}`, {
            theme: 'snow',
            placeholder: 'Start typing...',
            modules: {
                toolbar: false  // Reuse the same toolbar for all editors
            }
        });
        
        // Store reference to this page's quill instance
        pageQuillInstances[pageIndex] = pageQuill;
        
        // Load the page content
        if (pages[pageIndex] && pages[pageIndex].content) {
            pageQuill.setContents(pages[pageIndex].content);
        }
        
        // Add keyboard listener for backspace/navigation at the start of the page
        const qlEditor = newPageContainer.querySelector('.ql-editor');
        if (qlEditor) {
            qlEditor.addEventListener('keydown', (e) => {
                // Backspace Handling
                if (e.key === 'Backspace' && pageIndex > 0) {
                    const range = pageQuill.getSelection();
                    // If we are at the very beginning of the editor or it's empty
                    if ((range && range.index === 0 && range.length === 0) || pageQuill.getLength() <= 1) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        
                        // Check if previous page is full
                        const prevPageContainer = document.getElementById(`page-container-${pageIndex - 1}`);
                        const prevEditor = document.getElementById(`editor-${pageIndex - 1}`);
                        
                        if (prevPageContainer && prevEditor) {
                            const prevQlEditor = prevEditor.querySelector('.ql-editor');
                            const pageContainer_styles = window.getComputedStyle(prevPageContainer);
                            const pageHeight = prevPageContainer.clientHeight;
                            const paddingTop = parseFloat(pageContainer_styles.paddingTop);
                            const paddingBottom = parseFloat(pageContainer_styles.paddingBottom);
                            const availableHeight = pageHeight - paddingTop - paddingBottom;
                            const contentHeight = prevQlEditor.scrollHeight;
                            
                            // If previous page is full (with small buffer), just switch to it
                            if (contentHeight >= availableHeight - 10) {
                                switchToPage(pageIndex - 1);
                                setTimeout(() => {
                                    const prevQuill = pageQuillInstances[pageIndex - 1];
                                    if (prevQuill) {
                                        const len = prevQuill.getLength();
                                        prevQuill.setSelection(len - 1, 0);
                                    }
                                }, 100);
                            } else {
                                // Previous page has space, merge
                                setTimeout(() => {
                                    mergeWithPreviousPage(pageIndex);
                                }, 10);
                            }
                        } else {
                            mergeWithPreviousPage(pageIndex);
                        }
                    }
                }
                
                // Left Arrow Handling
                if (e.key === 'ArrowLeft' && pageIndex > 0) {
                    const range = pageQuill.getSelection();
                    if (range && range.index === 0) {
                        e.preventDefault();
                        switchToPage(pageIndex - 1);
                        setTimeout(() => {
                            const prevQuill = pageQuillInstances[pageIndex - 1];
                            if (prevQuill) {
                                const len = prevQuill.getLength();
                                prevQuill.setSelection(len - 1, 0);
                            }
                        }, 100);
                    }
                }
                
                // Right Arrow Handling (at end of page)
                if (e.key === 'ArrowRight' && pageIndex < pages.length - 1) {
                    const range = pageQuill.getSelection();
                    if (range && range.index >= pageQuill.getLength() - 1) {
                        e.preventDefault();
                        switchToPage(pageIndex + 1);
                        setTimeout(() => {
                            const nextQuill = pageQuillInstances[pageIndex + 1];
                            if (nextQuill) {
                                nextQuill.setSelection(0, 0);
                            }
                        }, 100);
                    }
                }
            }, true);
        }
        
        // Add text-change listener
        pageQuill.on('text-change', (delta, oldDelta, source) => {
            if (source === 'user' && !isLoadingFromServer) {
                const currentDelta = pageQuill.getContents();
                pages[pageIndex].content = currentDelta;
                
                sendToServer({
                    type: 'update-page',
                    pageIndex: pageIndex,
                    content: currentDelta
                });
                
                updateCounts();
                checkAndCreateNewPage(pageIndex);
            }
        });
        
        // Apply current zoom to the new page
        applyZoom();
    }

    // Switch to a specific page
    function switchToPage(pageIndex) {
        if (pageIndex < 0 || pageIndex >= pages.length) return;
        
        currentPageIndex = pageIndex;
        
        // Update quill reference to the current page's editor
        if (pageQuillInstances[pageIndex]) {
            quill = pageQuillInstances[pageIndex];
            
            // Use a small timeout to ensure the DOM is ready for focus
            setTimeout(() => {
                if (quill) {
                    quill.focus();
                    
                    // Scroll to the page
                    const container = document.getElementById(`page-container-${pageIndex}`);
                    if (container) {
                        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            }, 10);
        }
        
        updateCounts();
        renderPageTabs();
        localStorage.setItem('currentPageIndex', currentPageIndex);
    }

    let isSplitting = false;

    // Auto-page creation logic - creates new page when current page is full
    function checkAndCreateNewPage(pageIndex) {
        if (isSplitting) return;
        
        const pageContainer = document.querySelector(`#page-container-${pageIndex}`);
        const editorContainer = document.querySelector(`#editor-${pageIndex}`);
        
        if (!pageContainer || !editorContainer) return;
        
        const qlEditor = editorContainer.querySelector('.ql-editor');
        if (!qlEditor) return;
        
        // Use a small timeout to ensure Quill has updated the DOM
        setTimeout(() => {
            const pageContainer_styles = window.getComputedStyle(pageContainer);
            const pageHeight = pageContainer.clientHeight;
            const paddingTop = parseFloat(pageContainer_styles.paddingTop);
            const paddingBottom = parseFloat(pageContainer_styles.paddingBottom);
            const availableHeight = pageHeight - paddingTop - paddingBottom;
            
            const contentHeight = qlEditor.scrollHeight;
            
            // If content exceeds available height, move overflow to next page
            if (contentHeight > availableHeight) {
                isSplitting = true;
                
                const currentQuill = pageQuillInstances[pageIndex];
                if (!currentQuill) {
                    isSplitting = false;
                    return;
                }

                // Find the split point (where text starts to overflow)
                let splitIndex = currentQuill.getLength() - 1;
                while (splitIndex > 0) {
                    const bounds = currentQuill.getBounds(splitIndex);
                    if (bounds && bounds.bottom <= availableHeight - 20) { // 20px buffer for ql-editor padding
                        break;
                    }
                    splitIndex--;
                }

                // Get the content that overflows
                const overflowDelta = currentQuill.getContents(splitIndex);
                
                // Remove overflow from current page
                currentQuill.deleteText(splitIndex, currentQuill.getLength() - splitIndex, 'silent');
                
                // Ensure next page exists
                let nextPageIndex = pageIndex + 1;
                if (nextPageIndex >= pages.length) {
                    // Create new page data
                    const newPage = {
                        id: `page-${Date.now()}`,
                        number: nextPageIndex + 1,
                        content: { ops: [{ insert: '\n' }] }
                    };
                    pages.push(newPage);
                    
                    sendToServer({ type: 'new-page' });
                    
                    // Create the editor for the new page
                    createPageEditor(nextPageIndex);
                }
                
                // Add overflow to the beginning of the next page
                const nextQuill = pageQuillInstances[nextPageIndex];
                if (nextQuill) {
                    const nextContent = nextQuill.getContents();
                    if (nextContent.length() <= 1) {
                        nextQuill.setContents(overflowDelta, 'user');
                    } else {
                        // Prepend by inserting at index 0
                        nextQuill.updateContents({ ops: overflowDelta.ops }, 'user');
                    }
                    
                    switchToPage(nextPageIndex);
                    // Set selection to the end of the moved content (before the trailing newline)
                    const newPos = Math.max(0, overflowDelta.length() - 1);
                    setTimeout(() => {
                        nextQuill.setSelection(newPos, 0);
                        isSplitting = false;
                    }, 10);
                } else {
                    isSplitting = false;
                }
            }
        }, 0);
    }

    // Switch page and load its content into Quill
    function switchPageDOM(pageIndex) {
        if (pageIndex < 0 || pageIndex >= pages.length) return;
        
        // Save current page if exists
        if (currentPageIndex >= 0 && currentPageIndex < pages.length && quill) {
            pages[currentPageIndex].content = quill.getContents();
        }
        
        currentPageIndex = pageIndex;
        
        // Load page content into the single Quill instance
        isLoadingFromServer = true;
        if (quill) {
            quill.setContents(pages[pageIndex].content || { ops: [{ insert: '\n' }] });
            quill.setSelection(0, 0);
        }
        isLoadingFromServer = false;
        
        // Update counts
        updateCounts();
    }

    // Switch to a different page (legacy)
    function switchPage(pageIndex) {
        switchPageDOM(pageIndex);
    }

    // Image Insertion - Quill's built-in image button handles this now
    // But you can use the insertEmbed function to programmatically add images
    function insertImage(imageUrl) {
        const index = quill.getLength();
        quill.insertEmbed(index, 'image', imageUrl);
        quill.setSelection(index + 1);
    }

    // Update character and word count
    function updateCounts() {
        if (!quill) return;
        const text = quill.getText();
        // Exclude spaces, tabs, newlines from character count
        const chars = text.replace(/\s/g, '').length;
        const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
        if (charCountSpan) charCountSpan.textContent = `Characters: ${Math.max(0, chars)}`;
        if (wordCountSpan) wordCountSpan.textContent = `Words: ${words}`;
        
        // Update page indicator
        const pageIndicator = document.getElementById('pageIndicator');
        if (pageIndicator) {
            pageIndicator.textContent = `Page ${currentPageIndex + 1} of ${pages.length}`;
        }
    }

    // Zoom functionality
    function applyZoom() {
        const containers = document.querySelectorAll('.editor-container');
        const scale = currentZoom / 100;
        const baseMargin = 40;
        const pageHeight = 950; // Fixed height from CSS
        
        containers.forEach(container => {
            container.style.transform = `scale(${scale})`;
            container.style.transformOrigin = 'top center';
            
            // Calculate the visual height change
            const visualOffset = pageHeight * (scale - 1);
            const finalMarginBottom = baseMargin + visualOffset;
            
            container.style.marginBottom = `${finalMarginBottom}px`;
        });
        
        // Update all zoom percentage displays
        const zoomPercentElements = document.querySelectorAll('#zoomPercent');
        zoomPercentElements.forEach(el => {
            el.textContent = `${currentZoom}%`;
        });
        
        localStorage.setItem('docZoom', currentZoom);
    }

    // Get all zoom buttons (status bar versions)
    const allZoomInBtns = document.querySelectorAll('#zoomInBtn');
    const allZoomOutBtns = document.querySelectorAll('#zoomOutBtn');

    // Attach click listeners to all zoom buttons
    allZoomInBtns.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                if (currentZoom < 200) {
                    currentZoom += 10;
                    applyZoom();
                }
            });
        }
    });

    allZoomOutBtns.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                if (currentZoom > 50) {
                    currentZoom -= 10;
                    applyZoom();
                }
            });
        }
    });

    // Keyboard shortcuts for zoom
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === '+') {
            e.preventDefault();
            if (currentZoom < 200) {
                currentZoom += 10;
                applyZoom();
            }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === '-') {
            e.preventDefault();
            if (currentZoom > 50) {
                currentZoom -= 10;
                applyZoom();
            }
        }
    });

    // Page Management Functions
    function deletePage(index) {
        if (pages.length > 1) {
            pages.splice(index, 1);
            
            sendToServer({
                type: 'delete-page',
                pageIndex: index
            });
            
            if (currentPageIndex >= pages.length) {
                currentPageIndex = pages.length - 1;
            }
            
            renderAllPages();
            localStorage.setItem('docPages', JSON.stringify(pages));
        } else {
            alert('You must have at least one page!');
        }
    }

    function renderPageTabs() {
        if (!pageTabsContainer) return;
        pageTabsContainer.innerHTML = '';
        pages.forEach((page, index) => {
            const tab = document.createElement('div');
            tab.className = `page-tab ${index === currentPageIndex ? 'active' : ''}`;
            tab.innerHTML = `
                Page ${index + 1}
                ${pages.length > 1 ? '<span class="close-page">×</span>' : ''}
            `;
            
            tab.addEventListener('click', (e) => {
                if (!e.target.classList.contains('close-page')) {
                    sendToServer({
                        type: 'change-page',
                        pageIndex: index
                    });
                    switchToPage(index);
                }
            });
            
            const closeBtn = tab.querySelector('.close-page');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deletePage(index);
                });
            }
            
            pageTabsContainer.appendChild(tab);
        });
    }

    // New Page Button
    if (newPageBtn) {
        newPageBtn.addEventListener('click', () => {
            createNewPage();
        });
    }

    // Load saved content on page load
    async function init() {
        // Fetch user profile
        fetchUserProfile();

        // Check if we have a document ID in URL
        if (documentId) {
            // Add to user's recent documents
            addToRecent(documentId);
            // Initialize WebSocket to sync with server
            initWebSocket();
        } else {
            // No document ID - show document library
            if (docLibrary) docLibrary.style.display = 'block';
            if (libraryOverlay) libraryOverlay.style.display = 'block';
            if (closeLibrary) closeLibrary.style.display = 'none'; // Hide close button if no doc open
            await renderDocumentList();
        }
        
        // Try to get saved zoom level
        const savedZoom = localStorage.getItem('docZoom');
        if (savedZoom) {
            currentZoom = parseInt(savedZoom);
            applyZoom();
        }
        
        // Setup ribbon tabs
        setupRibbonTabs();
        
        // Setup additional features
        setupHomeFeatures();
        setupInsertFeatures();
        setupDesignFeatures();
        setupLayoutFeatures();
        setupViewFeatures();
        setupHistoryFeatures(); // New
        
        // Setup document library
        setupDocumentLibrary();
    }
    
    init();

    // History Features
    function setupHistoryFeatures() {
        const showHistoryBtn = document.getElementById('showHistoryBtn');
        const historyModal = document.getElementById('historyModal');
        const closeHistoryModal = document.getElementById('closeHistoryModal');
        const historyList = document.getElementById('historyList');

        if (showHistoryBtn) {
            showHistoryBtn.addEventListener('click', () => {
                historyModal.style.display = 'flex';
                fetchHistory();
            });
        }

        if (closeHistoryModal) {
            closeHistoryModal.addEventListener('click', () => {
                historyModal.style.display = 'none';
            });
        }
        
        // Close on outside click
        if (historyModal) {
            historyModal.addEventListener('click', (e) => {
                if (e.target === historyModal) {
                    historyModal.style.display = 'none';
                }
            });
        }

        async function fetchHistory() {
            if (!documentId) return;
            
            historyList.innerHTML = '<div style="text-align: center; color: #b0b0b0; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
            
            try {
                const response = await fetch(`/api/documents/${documentId}/history`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (!response.ok) throw new Error('Failed to fetch history');
                
                const history = await response.json();
                renderHistory(history);
            } catch (err) {
                console.error('Error fetching history:', err);
                historyList.innerHTML = '<div style="text-align: center; color: #ff6b6b; padding: 20px;">Failed to load history</div>';
            }
        }
        
        function renderHistory(items) {
            if (!items || items.length === 0) {
                historyList.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No history available yet.</div>';
                return;
            }
            
            historyList.innerHTML = items.map(item => {
                const date = new Date(item.timestamp);
                const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const safeUsername = escapeHTML(item.username);
                const safeAction = escapeHTML(item.action);
                const safeDetails = escapeHTML(item.details);
                
                // Icon based on action
                let icon = 'fa-pen';
                if (item.action.includes('Created')) icon = 'fa-plus-circle';
                else if (item.action.includes('Renamed')) icon = 'fa-i-cursor';
                else if (item.action.includes('Deleted')) icon = 'fa-trash';
                else if (item.action.includes('Added')) icon = 'fa-file-medical';
                
                return `
                    <div style="display: flex; gap: 16px; padding: 12px; border-bottom: 1px solid #2a2a2a; align-items: flex-start;">
                        <div style="background: rgba(var(--accent-color-rgb), 0.1); width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--accent-color-light);">
                            <i class="fas ${icon}"></i>
                        </div>
                        <div style="flex: 1;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                <span style="color: #e0e0e0; font-weight: 500;">${safeUsername}</span>
                                <span style="color: #666; font-size: 12px;">${dateStr}</span>
                            </div>
                            <div style="color: #b0b0b0; font-size: 14px;">${safeAction}</div>
                            ${item.details ? `<div style="color: #666; font-size: 12px; margin-top: 2px;">${safeDetails}</div>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Ribbon Tab Management
    function setupRibbonTabs() {
        const tabs = document.querySelectorAll('.ribbon-tab');
        const ribbons = document.querySelectorAll('.ribbon-content');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active class from all tabs and ribbons
                tabs.forEach(t => t.classList.remove('active'));
                ribbons.forEach(r => r.classList.remove('active'));
                
                // Add active class to clicked tab
                tab.classList.add('active');
                
                // Show corresponding ribbon
                const tabName = tab.dataset.tab;
                const ribbon = document.getElementById(`${tabName}-ribbon`);
                if (ribbon) {
                    ribbon.classList.add('active');
                }
            });
        });
        
        // Insert Page button
        const insertPageBtn = document.getElementById('insertPageBtn');
        if (insertPageBtn) {
            insertPageBtn.addEventListener('click', () => {
                createNewPage();
            });
        }
    }

    // Home Tab Features
    function setupHomeFeatures() {
        if (!quill) return;
        // Get all Quill format buttons
        const boldBtn = document.querySelector('.ql-bold');
        const italicBtn = document.querySelector('.ql-italic');
        const underlineBtn = document.querySelector('.ql-underline');
        const strikeBtn = document.querySelector('.ql-strike');
        const alignSelect = document.querySelector('.ql-align');
        const sizeSelect = document.querySelector('.ql-size');
        const fontSelect = document.querySelector('.ql-font');
        const orderedListBtn = document.querySelector('.ql-list[value="ordered"]');
        const bulletListBtn = document.querySelector('.ql-list[value="bullet"]');
        const cleanBtn = document.querySelector('.ql-clean');
        
        // Wire up the buttons manually
        if (boldBtn) boldBtn.addEventListener('click', () => { 
            const format = quill.getFormat();
            quill.format('bold', !format.bold);
        });
        
        if (italicBtn) italicBtn.addEventListener('click', () => { 
            const format = quill.getFormat();
            quill.format('italic', !format.italic);
        });
        
        if (underlineBtn) underlineBtn.addEventListener('click', () => { 
            const format = quill.getFormat();
            quill.format('underline', !format.underline);
        });
        
        if (strikeBtn) strikeBtn.addEventListener('click', () => { 
            const format = quill.getFormat();
            quill.format('strike', !format.strike);
        });
        
        if (alignSelect) alignSelect.addEventListener('change', (e) => {
            const value = e.target.value || false;
            quill.format('align', value);
        });

        if (sizeSelect) sizeSelect.addEventListener('change', (e) => {
            const value = e.target.value;
            quill.format('size', value);
        });

        if (fontSelect) fontSelect.addEventListener('change', (e) => {
            const value = e.target.value;
            quill.format('font', value);
        });
        
        if (orderedListBtn) orderedListBtn.addEventListener('click', () => {
            const format = quill.getFormat();
            quill.format('list', format.list === 'ordered' ? false : 'ordered');
        });
        
        if (bulletListBtn) bulletListBtn.addEventListener('click', () => {
            const format = quill.getFormat();
            quill.format('list', format.list === 'bullet' ? false : 'bullet');
        });
        
        if (cleanBtn) cleanBtn.addEventListener('click', () => {
            const range = quill.getSelection();
            if (range) {
                quill.removeFormat(range.index, range.length);
            }
        });
    }

    // Insert Tab Features
    function setupInsertFeatures() {
        const imageBtn = document.querySelector('#insert-ribbon .ql-image');
        const videoBtn = document.querySelector('#insert-ribbon .ql-video');
        const linkBtn = document.querySelector('#insert-ribbon .ql-link');
        const blockquoteBtn = document.querySelector('#insert-ribbon .ql-blockquote');
        const codeBlockBtn = document.querySelector('#insert-ribbon .ql-code-block');
        
        // Create hidden file input for images
        const imageFileInput = document.createElement('input');
        imageFileInput.type = 'file';
        imageFileInput.accept = 'image/*';
        imageFileInput.style.display = 'none';
        document.body.appendChild(imageFileInput);
        
        // Create hidden file input for videos
        const videoFileInput = document.createElement('input');
        videoFileInput.type = 'file';
        videoFileInput.accept = 'video/*';
        videoFileInput.style.display = 'none';
        document.body.appendChild(videoFileInput);
        
        if (imageBtn) imageBtn.addEventListener('click', () => {
            imageFileInput.click();
        });
        
        imageFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (quill) {
                        const range = quill.getSelection(true);
                        quill.insertEmbed(range.index, 'image', event.target.result);
                        quill.setSelection(range.index + 1);
                    }
                };
                reader.readAsDataURL(file);
            }
            imageFileInput.value = ''; // Reset input
        });
        
        if (videoBtn) videoBtn.addEventListener('click', () => {
            videoFileInput.click();
        });
        
        videoFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (quill) {
                        const range = quill.getSelection(true);
                        // Create a video element instead of using Quill's video embed
                        const videoHtml = `<video controls width="400" src="${event.target.result}"></video>`;
                        quill.clipboard.dangerouslyPasteHTML(range.index, videoHtml);
                        quill.setSelection(range.index + 1);
                    }
                };
                reader.readAsDataURL(file);
            }
            videoFileInput.value = ''; // Reset input
        });
        
        if (linkBtn) linkBtn.addEventListener('click', () => {
            if (!quill) return;
            const range = quill.getSelection();
            if (range) {
                if (range.length > 0) {
                    // Text is selected - add link to selected text
                    const url = prompt('Enter URL:', 'https://');
                    if (url) {
                        quill.format('link', url);
                    }
                } else {
                    // No text selected - insert new link
                    const url = prompt('Enter URL:', 'https://');
                    if (url) {
                        const displayText = prompt('Enter link text:', url);
                        if (displayText) {
                            quill.insertText(range.index, displayText, 'link', url);
                            quill.setSelection(range.index + displayText.length);
                        }
                    }
                }
            }
        });
        
        if (blockquoteBtn) blockquoteBtn.addEventListener('click', () => {
            if (!quill) return;
            const format = quill.getFormat();
            quill.format('blockquote', !format.blockquote);
        });
        
        if (codeBlockBtn) codeBlockBtn.addEventListener('click', () => {
            if (!quill) return;
            const format = quill.getFormat();
            quill.format('code-block', !format['code-block']);
        });
    }

    // Design Features
    function setupDesignFeatures() {
        const colorBtn = document.querySelector('#design-ribbon .ql-color');
        const backgroundBtn = document.querySelector('#design-ribbon .ql-background');
        
        // Color buttons
        if (colorBtn) colorBtn.addEventListener('click', () => {
            if (!quill) return;
            const color = prompt('Enter text color (e.g., #ff0000, red, rgb(255,0,0)):');
            if (color) {
                quill.format('color', color);
            }
        });
        
        if (backgroundBtn) backgroundBtn.addEventListener('click', () => {
            if (!quill) return;
            const color = prompt('Enter highlight color (e.g., #ffff00, yellow):');
            if (color) {
                quill.format('background', color);
            }
        });
    }

    // Layout Features
    function setupLayoutFeatures() {
        const pageSizeSelect = document.getElementById('pageSizeSelect');
        const lineSpacingSelect = document.getElementById('lineSpacingSelect');
        
        // Indent buttons
        const indentDecreaseBtn = document.querySelector('.ql-indent[value="-1"]');
        const indentIncreaseBtn = document.querySelector('.ql-indent[value="+1"]');
        
        // Border setting buttons
        const borderNone = document.getElementById('borderNone');
        const borderBox = document.getElementById('borderBox');
        const borderShadow = document.getElementById('borderShadow');
        const border3D = document.getElementById('border3D');
        
        // Border customization
        const borderStyleSelect = document.getElementById('borderStyleSelect');
        const borderWidthSelect = document.getElementById('borderWidthSelect');
        const borderColorPicker = document.getElementById('borderColorPicker');
        
        // Border position buttons
        const borderAll = document.getElementById('borderAll');
        const borderTop = document.getElementById('borderTop');
        const borderBottom = document.getElementById('borderBottom');
        const borderLeft = document.getElementById('borderLeft');
        const borderRight = document.getElementById('borderRight');
        
        // Border state tracking
        let currentBorderStyle = 'solid';
        let currentBorderWidth = '1pt';
        let currentBorderColor = '#333333';
        let currentBorderType = 'box'; // none, box, shadow, 3d
        
        // Indent functionality
        if (indentDecreaseBtn) indentDecreaseBtn.addEventListener('click', () => {
            if (quill) quill.format('indent', '-1');
        });
        
        if (indentIncreaseBtn) indentIncreaseBtn.addEventListener('click', () => {
            if (quill) quill.format('indent', '+1');
        });
        
        // Helper function to convert pt to px (1pt = 1.333px)
        function ptToPx(pt) {
            return parseFloat(pt) * 1.333;
        }
        
        // Helper function to apply border
        function applyBorder() {
            const borders = document.querySelectorAll('.page-border-inner');
            const widthPx = `${ptToPx(currentBorderWidth)}px`;
            const borderValue = `${widthPx} ${currentBorderStyle} ${currentBorderColor}`;
            
            borders.forEach(border => {
                // Reset all sides first
                border.style.border = 'none';
                border.style.boxShadow = 'none';
                
                if (currentBorderType === 'none') {
                    // Already reset
                } else if (currentBorderType === 'box') {
                    border.style.border = borderValue;
                } else if (currentBorderType === 'shadow') {
                    border.style.border = borderValue;
                    border.style.boxShadow = `5px 5px 10px rgba(0, 0, 0, 0.5)`;
                } else if (currentBorderType === '3d') {
                    border.style.border = borderValue;
                    // For 3D we simulate with multiple shadows
                    border.style.boxShadow = `inset -2px -2px 5px rgba(0, 0, 0, 0.4), inset 2px 2px 5px rgba(255, 255, 255, 0.1)`;
                }
            });
        }
        
        // Border setting controls
        if (borderNone) {
            borderNone.addEventListener('click', () => {
                currentBorderType = 'none';
                applyBorder();
            });
        }
        
        if (borderBox) {
            borderBox.addEventListener('click', () => {
                currentBorderType = 'box';
                applyBorder();
            });
        }
        
        if (borderShadow) {
            borderShadow.addEventListener('click', () => {
                currentBorderType = 'shadow';
                applyBorder();
            });
        }
        
        if (border3D) {
            border3D.addEventListener('click', () => {
                currentBorderType = '3d';
                applyBorder();
            });
        }
        
        // Border style dropdown
        if (borderStyleSelect) {
            borderStyleSelect.addEventListener('change', (e) => {
                currentBorderStyle = e.target.value;
                if (currentBorderType !== 'none') {
                    applyBorder();
                }
            });
        }
        
        // Border width dropdown
        if (borderWidthSelect) {
            borderWidthSelect.addEventListener('change', (e) => {
                currentBorderWidth = e.target.value;
                if (currentBorderType !== 'none') {
                    applyBorder();
                }
            });
        }
        
        // Border color picker
        if (borderColorPicker) {
            borderColorPicker.addEventListener('input', (e) => {
                currentBorderColor = e.target.value;
                if (currentBorderType !== 'none') {
                    applyBorder();
                }
            });
        }
        
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', (e) => {
                const container = document.querySelector('.editor-container');
                if (!container) return;
                switch(e.target.value) {
                    case 'a4':
                        container.style.width = '850px';
                        container.style.aspectRatio = '8.5 / 11';
                        break;
                    case 'letter':
                        container.style.width = '816px';
                        container.style.aspectRatio = '8.5 / 11';
                        break;
                    case 'legal':
                        container.style.width = '816px';
                        container.style.aspectRatio = '8.5 / 14';
                        break;
                }
            });
        }
        
        if (lineSpacingSelect) {
            lineSpacingSelect.addEventListener('change', (e) => {
                const editor = document.querySelector('#editor');
                if (editor) editor.style.lineHeight = e.target.value;
            });
        }
        
        // Border position controls
        if (borderAll) {
            borderAll.addEventListener('click', () => {
                currentBorderType = 'box';
                applyBorder();
            });
        }
        
        if (borderTop) {
            borderTop.addEventListener('click', () => {
                const borders = document.querySelectorAll('.page-border-inner');
                const widthPx = `${ptToPx(currentBorderWidth)}px`;
                const borderValue = `${widthPx} ${currentBorderStyle} ${currentBorderColor}`;
                
                borders.forEach(border => {
                    border.style.border = 'none';
                    border.style.borderTop = borderValue;
                });
            });
        }
        
        if (borderBottom) {
            borderBottom.addEventListener('click', () => {
                const borders = document.querySelectorAll('.page-border-inner');
                const widthPx = `${ptToPx(currentBorderWidth)}px`;
                const borderValue = `${widthPx} ${currentBorderStyle} ${currentBorderColor}`;
                
                borders.forEach(border => {
                    border.style.border = 'none';
                    border.style.borderBottom = borderValue;
                });
            });
        }
        
        if (borderLeft) {
            borderLeft.addEventListener('click', () => {
                const borders = document.querySelectorAll('.page-border-inner');
                const widthPx = `${ptToPx(currentBorderWidth)}px`;
                const borderValue = `${widthPx} ${currentBorderStyle} ${currentBorderColor}`;
                
                borders.forEach(border => {
                    border.style.border = 'none';
                    border.style.borderLeft = borderValue;
                });
            });
        }
        
        if (borderRight) {
            borderRight.addEventListener('click', () => {
                const borders = document.querySelectorAll('.page-border-inner');
                const widthPx = `${ptToPx(currentBorderWidth)}px`;
                const borderValue = `${widthPx} ${currentBorderStyle} ${currentBorderColor}`;
                
                borders.forEach(border => {
                    border.style.border = 'none';
                    border.style.borderRight = borderValue;
                });
            });
        }
    }

    // View Features
    function setupViewFeatures() {
        const zoom50 = document.getElementById('zoom50');
        const zoom75 = document.getElementById('zoom75');
        const zoom100 = document.getElementById('zoom100');
        const zoom150 = document.getElementById('zoom150');
        const toggleWordCount = document.getElementById('toggleWordCount');
        
        if (zoom50) zoom50.addEventListener('click', () => { currentZoom = 50; applyZoom(); });
        if (zoom75) zoom75.addEventListener('click', () => { currentZoom = 75; applyZoom(); });
        if (zoom100) zoom100.addEventListener('click', () => { currentZoom = 100; applyZoom(); });
        if (zoom150) zoom150.addEventListener('click', () => { currentZoom = 150; applyZoom(); });
        
        if (toggleWordCount) {
            toggleWordCount.addEventListener('click', () => {
                const statusBar = document.querySelector('.status-bar');
                if (statusBar) {
                    if (statusBar.style.display === 'none') {
                        statusBar.style.display = 'block';
                    } else {
                        statusBar.style.display = 'none';
                    }
                }
            });
        }
    }

    // File Management Functions
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const shareUrl = `${window.location.origin}${window.location.pathname}?doc=${documentId}`;
            shareLink.value = shareUrl;
            shareModal.style.display = 'flex';
        });
    }

    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', () => {
            shareLink.select();
            navigator.clipboard.writeText(shareLink.value);
            copyLinkBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => {
                copyLinkBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            }, 2000);
        });
    }

    if (closeShareModal) {
        closeShareModal.addEventListener('click', () => {
            shareModal.style.display = 'none';
        });
    }

    // Click outside modal to close
    if (shareModal) {
        shareModal.addEventListener('click', (e) => {
            if (e.target === shareModal) {
                shareModal.style.display = 'none';
            }
        });
    }

    // Save document to file
    if (saveFileBtn) {
        saveFileBtn.addEventListener('click', () => {
            const documentData = {
                title: docTitle.value || 'Untitled document',
                pages: pages,
                currentPageIndex: currentPageIndex,
                documentId: documentId,
                savedAt: new Date().toISOString()
            };
            
            const blob = new Blob([JSON.stringify(documentData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${documentData.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    // Load document from file
    if (loadFileBtn) {
        loadFileBtn.addEventListener('click', () => {
            fileInput.click();
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const fileName = file.name;
            const fileExtension = fileName.split('.').pop().toLowerCase();

            try {
                if (fileExtension === 'json') {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        try {
                            const documentData = JSON.parse(event.target.result);
                            loadDocumentData(documentData);
                            alert('Document loaded successfully!');
                        } catch (error) {
                            console.error('Error parsing JSON:', error);
                            alert('Invalid JSON file.');
                        }
                    };
                    reader.readAsText(file);
                } 
                else if (fileExtension === 'txt') {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const text = event.target.result;
                        importTextToDocument(fileName.replace('.txt', ''), text);
                    };
                    reader.readAsText(file);
                }
                else if (fileExtension === 'docx') {
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        const arrayBuffer = event.target.result;
                        const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
                        importTextToDocument(fileName.replace('.docx', ''), result.value, true);
                    };
                    reader.readAsArrayBuffer(file);
                }
                else if (fileExtension === 'pdf') {
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        const arrayBuffer = event.target.result;
                        const typedarray = new Uint8Array(arrayBuffer);
                        
                        // Initialize PDF.js
                        if (window.pdfjsLib) {
                            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                            
                            const pdf = await pdfjsLib.getDocument(typedarray).promise;
                            let fullText = '';
                            
                            for (let i = 1; i <= pdf.numPages; i++) {
                                const page = await pdf.getPage(i);
                                const textContent = await page.getTextContent();
                                const pageText = textContent.items.map(item => item.str).join(' ');
                                fullText += `<p>${pageText}</p>`;
                            }
                            
                            importTextToDocument(fileName.replace('.pdf', ''), fullText, true);
                        } else {
                            alert('PDF library not loaded.');
                        }
                    };
                    reader.readAsArrayBuffer(file);
                }
                else {
                    alert('Unsupported file type.');
                }
            } catch (error) {
                console.error('Error loading file:', error);
                alert('Error loading file: ' + error.message);
            }
            
            fileInput.value = ''; // Reset input
        });
    }

    function loadDocumentData(documentData) {
        isLoadingFromServer = true;
        docTitle.value = documentData.title || 'Untitled document';
        pages = documentData.pages || [{ content: '' }];
        currentPageIndex = documentData.currentPageIndex || 0;
        
        // Render all pages
        renderAllPages();
        
        // Sync to server
        sendToServer({ type: 'update-title', title: docTitle.value });
        pages.forEach((page, index) => {
            sendToServer({ type: 'update-page', pageIndex: index, content: page.content });
        });
        
        isLoadingFromServer = false;
    }

    function importTextToDocument(title, content, isHtml = false) {
        isLoadingFromServer = true;
        docTitle.value = title;
        
        // If it's plain text, wrap in paragraphs or just set it
        if (!isHtml) {
            // Convert plain text to simple HTML for Quill
            content = content.split('\n').map(line => `<p>${line}</p>`).join('');
        }
        
        pages = [{ content: content }];
        currentPageIndex = 0;
        
        renderAllPages();
        
        // Sync to server
        sendToServer({ type: 'update-title', title: docTitle.value });
        sendToServer({ type: 'update-page', pageIndex: 0, content: content });
        
        isLoadingFromServer = false;
        alert(`Imported content from ${title}`);
    }

    // Document Library Management
    function setupDocumentLibrary() {
        // Menu button to open library
        if (menuBtn) {
            menuBtn.addEventListener('click', async () => {
                docLibrary.style.display = 'block';
                // Show close button only if we have a document open
                if (closeLibrary) {
                    closeLibrary.style.display = documentId ? 'block' : 'none';
                }
                
                // Update URL to remove doc ID while in library
                const url = new URL(window.location);
                url.searchParams.delete('doc');
                window.history.pushState({}, '', url);
                
                await renderDocumentList();
            });
        }

        // Close library button
        if (closeLibrary) {
            closeLibrary.addEventListener('click', () => {
                if (documentId) {
                    docLibrary.style.display = 'none';
                    if (libraryOverlay) libraryOverlay.style.display = 'none';
                    
                    // Restore doc ID to URL
                    const url = new URL(window.location);
                    url.searchParams.set('doc', documentId);
                    window.history.pushState({}, '', url);
                }
            });
        }
        
        // Create new document
        if (createNewDoc) {
            createNewDoc.addEventListener('click', () => {
                createNewDocument();
            });
        }
        
        // New document button in header
        if (newDocBtn) {
            newDocBtn.addEventListener('click', () => {
                createNewDocument();
            });
        }
        
        // Search documents
        const docSearch = document.getElementById('docSearch');
        if (docSearch) {
            docSearch.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const rows = document.querySelectorAll('.doc-item');
                
                rows.forEach(row => {
                    const title = row.querySelector('div[style*="font-weight: 500"]').textContent.toLowerCase();
                    const preview = row.querySelector('div[style*="font-size: 12px"]').textContent.toLowerCase();
                    
                    if (title.includes(searchTerm) || preview.includes(searchTerm)) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                });
            });
        }
    }

    // --- Profile Management ---

    async function fetchUserProfile() {
        console.log('Fetching user profile...');
        try {
            const response = await fetch('/api/user/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('Profile response status:', response.status);
            
            if (response.ok) {
                const user = await response.json();
                console.log('User profile loaded for:', user.username);
                
                if (profileUsername) profileUsername.textContent = user.username;
                if (user.profilePicture) {
                    if (profilePfp) {
                        profilePfp.src = user.profilePicture;
                        profilePfp.style.display = 'block';
                    }
                    if (profilePfpPlaceholder) profilePfpPlaceholder.style.display = 'none';
                    
                    if (headerPfp) {
                        headerPfp.src = user.profilePicture;
                        headerPfp.style.display = 'block';
                    }
                    if (headerUserIcon) headerUserIcon.style.display = 'none';
                    
                    // Update library icons too
                    const libPfp = document.getElementById('libraryHeaderPfp');
                    const libIcon = document.getElementById('libraryHeaderUserIcon');
                    if (libPfp && libIcon) {
                        libPfp.src = user.profilePicture;
                        libPfp.style.display = 'block';
                        libIcon.style.display = 'none';
                    }
                } else {
                    // No PFP
                    if (profilePfp) profilePfp.style.display = 'none';
                    if (profilePfpPlaceholder) profilePfpPlaceholder.style.display = 'flex';
                    
                    if (headerPfp) headerPfp.style.display = 'none';
                    if (headerUserIcon) headerUserIcon.style.display = 'block';
                }
            } else {
                console.warn('Failed to load profile. Status:', response.status);
            }
        } catch (err) {
            console.error('Error fetching profile:', err);
        }
    }

    if (pfpUpload) {
        pfpUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64String = reader.result;
                try {
                    const response = await fetch('/api/user/profile', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ profilePicture: base64String })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (profilePfp) {
                            profilePfp.src = data.profilePicture;
                            profilePfp.style.display = 'block';
                        }
                        if (profilePfpPlaceholder) profilePfpPlaceholder.style.display = 'none';
                        
                        if (headerPfp) {
                            headerPfp.src = data.profilePicture;
                            headerPfp.style.display = 'block';
                        }
                        if (headerUserIcon) headerUserIcon.style.display = 'none';
                        alert('Profile picture updated!');
                    } else {
                        alert('Failed to update profile picture. Server returned ' + response.status);
                    }
                } catch (err) {
                    console.error('Error updating PFP:', err);
                    alert('Failed to update profile picture');
                }
            };
            reader.readAsDataURL(file);
        });
    }

    if (updatePasswordBtn) {
        updatePasswordBtn.addEventListener('click', async () => {
            const currentPassword = currentPasswordInput.value;
            const newPassword = newPasswordInput.value;

            if (!currentPassword || !newPassword) {
                alert('Please fill in both password fields');
                return;
            }

            try {
                const response = await fetch('/api/user/password', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ currentPassword, newPassword })
                });

                const data = await response.json();
                if (response.ok) {
                    alert('Password updated successfully!');
                    currentPasswordInput.value = '';
                    newPasswordInput.value = '';
                } else {
                    alert(data.message || 'Failed to update password');
                }
            } catch (err) {
                console.error('Error updating password:', err);
                alert('Error updating password');
            }
        });
    }

    // Profile Tab Switching
    function setupProfileTabs() {
        const profileTabs = document.querySelectorAll('.profile-tab');
        const profileTabContents = document.querySelectorAll('.profile-tab-content');
        
        profileTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                
                // Remove active class from all tabs and contents
                profileTabs.forEach(t => {
                    t.classList.remove('active');
                    t.style.opacity = '0.7';
                });
                
                profileTabContents.forEach(content => {
                    content.classList.remove('active');
                    content.style.display = 'none';
                });
                
                // Add active class to clicked tab
                tab.classList.add('active');
                tab.style.opacity = '1';
                
                // Show corresponding content
                const content = document.getElementById(tabName + '-content');
                if (content) {
                    content.classList.add('active');
                    content.style.display = 'block';
                }
            });
        });
    }

    // Call setup when profile modal opens
    if (userProfileTrigger) {
        userProfileTrigger.addEventListener('click', () => {
            profileModal.style.display = 'flex';
            setupProfileTabs();
            setupAccentColorSelector();
        });
    }

    if (libraryUserProfileTrigger) {
        libraryUserProfileTrigger.addEventListener('click', () => {
            profileModal.style.display = 'flex';
            setupProfileTabs();
        });
    }

    // Theme Toggle
    function loadTheme() {
        const savedTheme = localStorage.getItem('synchroEditTheme') || 'dark';
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            if (lightThemeBtn) {
                lightThemeBtn.style.background = 'var(--accent-color)';
                lightThemeBtn.style.color = 'white';
            }
            if (darkThemeBtn) {
                darkThemeBtn.style.background = '#f0f0f0';
                darkThemeBtn.style.color = '#1a1a1a';
            }
        }
    }

    if (darkThemeBtn) {
        darkThemeBtn.addEventListener('click', () => {
            document.body.classList.remove('light-theme');
            localStorage.setItem('synchroEditTheme', 'dark');
            darkThemeBtn.style.background = 'var(--accent-color)';
            darkThemeBtn.style.color = 'white';
            if (lightThemeBtn) {
                lightThemeBtn.style.background = '#f0f0f0';
                lightThemeBtn.style.color = '#1a1a1a';
            }
        });
    }

    if (lightThemeBtn) {
        lightThemeBtn.addEventListener('click', () => {
            document.body.classList.add('light-theme');
            localStorage.setItem('synchroEditTheme', 'light');
            lightThemeBtn.style.background = 'var(--accent-color)';
            lightThemeBtn.style.color = 'white';
            if (darkThemeBtn) {
                darkThemeBtn.style.background = '#f0f0f0';
                darkThemeBtn.style.color = '#1a1a1a';
            }
        });
    }

    if (profileModal) {
        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) profileModal.style.display = 'none';
        });
    }

    // Setup accent color selector
    function setupAccentColorSelector() {
        const accentColorBtns = document.querySelectorAll('.accent-color-btn');
        const savedAccentColor = localStorage.getItem('synchroEditAccentColor') || '#8b5cf6';
        
        // Apply saved accent color on load
        applyAccentColor(savedAccentColor);
        
        // Update button to show active color
        accentColorBtns.forEach(btn => {
            if (btn.dataset.color === savedAccentColor) {
                btn.style.border = '3px solid #fff';
            }
            
            btn.addEventListener('click', () => {
                const color = btn.dataset.color;
                
                // Update all buttons' border styles
                accentColorBtns.forEach(b => {
                    b.style.border = '2px solid transparent';
                });
                btn.style.border = '3px solid #fff';
                
                // Apply the new color
                applyAccentColor(color);
                
                // Save to localStorage
                localStorage.setItem('synchroEditAccentColor', color);
            });
        });
    }

    // Apply accent color to the entire page
    function applyAccentColor(color) {
        // Convert hex to RGB for rgba values
        const rgb = hexToRgb(color);
        if (!rgb) return;
        const rgbString = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
        
        // Calculate lighter versions
        const lightColor = lightenColor(color, 20);
        const lighterColor = lightenColor(color, 40);
        
        // Update CSS variables
        document.documentElement.style.setProperty('--accent-color', color);
        document.documentElement.style.setProperty('--accent-color-rgb', rgbString);
        document.documentElement.style.setProperty('--accent-color-light', lightColor);
        document.documentElement.style.setProperty('--accent-color-lighter', lighterColor);

        // Create a style element if it doesn't exist
        let styleEl = document.getElementById('accentColorStyle');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'accentColorStyle';
            document.head.appendChild(styleEl);
        }
        
        // Comprehensive CSS override for all purple accents
        styleEl.innerHTML = `
            /* Override body background with accent color gradients */
            body {
                background: linear-gradient(135deg, #0a0a0a 0%, ${color}22 15%, #0d0d0d 30%, ${color}15 50%, #0d0d0d 70%, #0a0a0f 100%) !important;
            }
            
            /* Light theme background */
            body.light-theme {
                background: linear-gradient(135deg, #f5f5f5 0%, #ffffff 15%, #f8f8f8 30%, #ffffff 50%, #f8f8f8 70%, #f5f5f5 100%) !important;
            }
            
            /* Header styling */
            .header {
                background: linear-gradient(90deg, #0a0a0a 0%, ${color}15 25%, #0d0d0d 50%, ${color}15 75%, #0a0a0a 100%) !important;
                border-bottom: 1px solid ${color} !important;
                box-shadow: 0 4px 12px rgba(${rgbString}, 0.25) !important;
            }
            
            body.light-theme .header {
                background: linear-gradient(90deg, #ffffff 0%, #f8f8f8 25%, #ffffff 50%, #f8f8f8 75%, #ffffff 100%) !important;
                border-bottom: 2px solid ${color} !important;
                box-shadow: 0 4px 12px rgba(${rgbString}, 0.25) !important;
            }
            
            /* Logo styling */
            .logo {
                color: ${color} !important;
                text-shadow: 0 0 30px rgba(${rgbString}, 0.8), 0 0 60px rgba(${rgbString}, 0.4) !important;
            }
            
            body.light-theme .logo {
                color: ${color} !important;
                text-shadow: 0 0 20px rgba(${rgbString}, 0.4) !important;
            }
            
            /* Document title */
            .doc-title {
                color: ${color} !important;
                text-shadow: 0 0 15px rgba(${rgbString}, 0.3) !important;
            }
            
            .doc-title:hover,
            .doc-title:focus {
                color: ${color} !important;
                background: rgba(${rgbString}, 0.1) !important;
                box-shadow: 0 0 20px rgba(${rgbString}, 0.3), inset 0 0 10px rgba(${rgbString}, 0.1) !important;
                text-shadow: 0 0 25px rgba(${rgbString}, 0.6) !important;
            }
            
            /* Toolbar styling */
            .toolbar {
                background-color: #0a0a0a !important;
                border-bottom: 1px solid ${color} !important;
            }
            
            body.light-theme .toolbar {
                background-color: #faf8ff !important;
                border-bottom: 1px solid ${color} !important;
            }
            
            .toolbar-group {
                border-right: 1px solid ${color} !important;
            }
            
            body.light-theme .toolbar-group {
                border-right: 1px solid ${color} !important;
            }
            
            .toolbar-btn:hover {
                background: rgba(${rgbString}, 0.15) !important;
                color: ${color} !important;
                box-shadow: 0 0 15px rgba(${rgbString}, 0.3) !important;
            }
            
            body.light-theme .toolbar-btn:hover {
                background: #f3e8ff !important;
                color: ${color} !important;
            }
            
            /* Ribbon styling */
            .ribbon {
                background: #0a0a0a !important;
                border-bottom: 1px solid ${color} !important;
                box-shadow: 0 0 20px rgba(${rgbString}, 0.2) !important;
            }
            
            body.light-theme .ribbon {
                background: #faf8ff !important;
                border-bottom: 1px solid ${color} !important;
                box-shadow: 0 0 15px rgba(${rgbString}, 0.15) !important;
            }
            
            .ribbon-section-title {
                color: ${color} !important;
                border-bottom: 1px solid rgba(${rgbString}, 0.3) !important;
            }
            
            body.light-theme .ribbon-section-title {
                color: ${color} !important;
                border-bottom: 1px solid rgba(${rgbString}, 0.3) !important;
            }
            
            .ribbon-btn:hover {
                background: rgba(${rgbString}, 0.15) !important;
                color: ${color} !important;
            }
            
            body.light-theme .ribbon-btn:hover {
                background: #f3e8ff !important;
                color: ${color} !important;
            }
            
            /* Buttons and interactive elements */
            .toolbar-btn:hover {
                color: ${color} !important;
                box-shadow: 0 0 15px rgba(${rgbString}, 0.3) !important;
            }
            
            .ribbon-tabs {
                box-shadow: 0 0 20px rgba(${rgbString}, 0.2) !important;
            }
            
            .ribbon-tab {
                color: #9ca3af;
            }
            
            .ribbon-tab:hover {
                background-color: rgba(${rgbString}, 0.1) !important;
                color: ${color} !important;
                box-shadow: 0 0 15px rgba(${rgbString}, 0.2) inset !important;
            }
            
            .ribbon-tab.active {
                color: ${color} !important;
                border-bottom-color: ${color} !important;
                text-shadow: 0 0 15px rgba(${rgbString}, 0.6) !important;
                background: linear-gradient(180deg, rgba(${rgbString}, 0.1) 0%, transparent 100%) !important;
                box-shadow: 0 0 20px rgba(${rgbString}, 0.3) !important;
            }
            
            .ribbon-content {
                box-shadow: 0 0 20px rgba(${rgbString}, 0.15), inset 0 0 10px rgba(${rgbString}, 0.05) !important;
            }
            
            /* Editor containers */
            .editor-container {
                border-color: ${color} !important;
                box-shadow: 
                    0 0 40px rgba(${rgbString}, 0.4),
                    0 0 80px rgba(${rgbString}, 0.2),
                    0 0 120px rgba(${rgbString}, 0.1),
                    inset 0 0 30px rgba(${rgbString}, 0.05),
                    inset 0 0 60px rgba(${rgbString}, 0.02) !important;
            }
            
            .editor-container::before {
                background: linear-gradient(90deg, transparent 0%, rgba(${rgbString}, 0.6) 50%, transparent 100%) !important;
            }
            
            .editor-container:hover {
                border-color: ${color} !important;
                box-shadow: 
                    0 0 60px rgba(${rgbString}, 0.6),
                    0 0 120px rgba(${rgbString}, 0.3),
                    0 0 180px rgba(${rgbString}, 0.15),
                    inset 0 0 30px rgba(${rgbString}, 0.1),
                    inset 0 0 60px rgba(${rgbString}, 0.05) !important;
            }
            
            .editor-container::after {
                background: radial-gradient(ellipse at center, rgba(${rgbString}, 0.3) 0%, rgba(${rgbString}, 0.1) 40%, transparent 70%) !important;
            }
            
            /* Page background glow */
            .pages-container {
                background: linear-gradient(135deg, #0a0a0a 0%, ${color}22 15%, #0d0d0d 30%, ${color}15 50%, #0d0d0d 70%, #0a0a0f 100%) !important;
            }
            
            .pages-container::before {
                background: radial-gradient(circle at 50% 30%, rgba(${rgbString}, 0.15) 0%, rgba(${rgbString}, 0.05) 30%, transparent 70%) !important;
            }
            
            body.light-theme .pages-container {
                background: linear-gradient(135deg, #f5f5f5 0%, #ffffff 15%, #f8f8f8 30%, #ffffff 50%, #f8f8f8 70%, #f5f5f5 100%) !important;
            }
            
            /* Status bar */
            .status-bar {
                background: #0a0a0a !important;
                border-top: 1px solid ${color} !important;
            }
            
            body.light-theme .status-bar {
                background: #faf8ff !important;
                border-top: 1px solid ${color} !important;
            }
            
            /* Profile modal */
            #profileModal > div {
                border-color: ${color} !important;
                box-shadow: 0 0 50px rgba(${rgbString}, 0.5), inset 0 0 20px rgba(${rgbString}, 0.1) !important;
            }
            
            #profileModal h2 {
                color: ${color} !important;
                text-shadow: 0 0 10px rgba(${rgbString}, 0.5) !important;
            }
            
            #profileModal h3 {
                color: ${lightColor} !important;
            }
            
            #profileModal h4 {
                color: ${lighterColor} !important;
            }
            
            #profileModal p {
                color: ${lightColor} !important;
            }
            
            #profileModal .profile-tab {
                color: ${lighterColor} !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
            }

            #profileModal .profile-tab i {
                color: inherit !important;
            }
            
            #profileModal .profile-tab.active {
                background: ${color} !important;
                color: white !important;
            }
            
            #profileModal .profile-tab:hover {
                background: rgba(${rgbString}, 0.3) !important;
                color: ${lightColor} !important;
                border-color: ${color} !important;
            }

            /* All text that uses accent colors */
            .accent-text, 
            #profileModal h3 i, 
            #profileModal p i,
            #profileModal label[for="pfpUpload"],
            #updatePasswordBtn,
            #darkThemeBtn {
                color: white !important;
                background-color: ${color} !important;
            }

            #profileModal h3 i, 
            #profileModal p i {
                background-color: transparent !important;
                color: ${color} !important;
            }

            #updatePasswordBtn:hover,
            #darkThemeBtn:hover {
                background-color: ${lightColor} !important;
                box-shadow: 0 0 15px rgba(${rgbString}, 0.5) !important;
            }

            /* Input focus borders */
            input:focus, select:focus, textarea:focus {
                border-color: ${color} !important;
                box-shadow: 0 0 10px rgba(${rgbString}, 0.3) !important;
            }
            
            #profileModal i {
                color: ${color} !important;
            }
            
            #profileModal .accent-color-btn {
                box-shadow: 0 0 6px rgba(${rgbString}, 0.4) !important;
            }
            
            #profilePfp {
                border-color: ${color} !important;
                box-shadow: 0 0 25px rgba(${rgbString}, 0.5) !important;
                width: 80px !important;
                height: 80px !important;
                object-fit: cover !important;
                border-radius: 50% !important;
            }
            
            #profilePfp ~ label {
                background: ${color} !important;
                box-shadow: 0 0 8px rgba(${rgbString}, 0.4) !important;
            }
            
            /* Profile modal buttons */
            #profileModal button:not(.accent-color-btn) {
                background: ${color} !important;
                color: white !important;
                border-color: ${color} !important;
            }
            
            #profileModal button:not(.accent-color-btn):hover {
                background: ${color} !important;
                color: white !important;
            }
            
            /* Color buttons keep their own colors */
            .accent-color-btn[data-color="#8b5cf6"] {
                background: #8b5cf6 !important;
            }
            
            .accent-color-btn[data-color="#ec4899"] {
                background: #ec4899 !important;
            }
            
            .accent-color-btn[data-color="#3b82f6"] {
                background: #3b82f6 !important;
            }
            
            .accent-color-btn[data-color="#10b981"] {
                background: #10b981 !important;
            }
            
            .accent-color-btn[data-color="#f59e0b"] {
                background: #f59e0b !important;
            }
            
            .accent-color-btn[data-color="#ef4444"] {
                background: #ef4444 !important;
            }
            
            .accent-color-btn[data-color="#06b6d4"] {
                background: #06b6d4 !important;
            }
            
            /* Profile modal tab buttons */
            #profileModal .profile-tab.active {
                background: ${color} !important;
                border-color: ${color} !important;
                color: white !important;
            }
            
            #profileModal .profile-tab.active:hover {
                background: ${color} !important;
                color: white !important;
            }
            
            /* All icons in profile modal */
            #profileModal i[style*="color"] {
                color: ${color} !important;
            }
            
            /* Theme buttons styling */
            #darkThemeBtn {
                background: ${color} !important;
                color: white !important;
            }
            
            #darkThemeBtn:hover {
                background: ${color} !important;
                color: white !important;
            }
            
            /* Light theme buttons */
            #lightThemeBtn {
                border-color: ${color} !important;
                color: ${color} !important;
            }
            
            #lightThemeBtn:hover {
                color: ${color} !important;
                border-color: ${color} !important;
            }
            
            body.light-theme #profileModal > div {
                background: #ffffff !important;
                border: 2px solid ${color} !important;
                box-shadow: 0 0 40px rgba(${rgbString}, 0.25) !important;
            }
            
            body.light-theme #profileModal h2,
            body.light-theme #profileModal h3,
            body.light-theme #profileModal h4 {
                color: ${color} !important;
            }
            
            body.light-theme hr {
                border-color: ${color} !important;
            }
            
            /* Input styling */
            input[type="text"],
            input[type="password"],
            textarea {
                border-color: #2a2a2a !important;
                background: #1a1a1a !important;
                color: #e0e0e0 !important;
            }
            
            input:focus,
            textarea:focus {
                border-color: ${color} !important;
                box-shadow: 0 0 15px rgba(${rgbString}, 0.2) !important;
            }
            
            body.light-theme input[type="text"],
            body.light-theme input[type="password"],
            body.light-theme textarea {
                background: #faf8ff !important;
                color: #1a1a1a !important;
                border: 1px solid ${color} !important;
            }
            
            body.light-theme input:focus,
            body.light-theme textarea:focus {
                box-shadow: 0 0 15px rgba(${rgbString}, 0.4) !important;
            }
            
            /* Select dropdown styling */
            select {
                border-color: ${color} !important;
                color: ${lightenColor(color, 40)} !important;
                box-shadow: 0 0 10px rgba(${rgbString}, 0.2) !important;
            }
            
            select:hover {
                box-shadow: 0 0 15px rgba(${rgbString}, 0.4) !important;
                background-color: rgba(${rgbString}, 0.05) !important;
            }
            
            select:focus {
                box-shadow: 0 0 20px rgba(${rgbString}, 0.5), inset 0 0 5px rgba(${rgbString}, 0.1) !important;
            }
            
            .ql-align, .ql-picker {
                border-color: ${color} !important;
                color: ${lightenColor(color, 40)} !important;
                box-shadow: 0 0 10px rgba(${rgbString}, 0.2) !important;
            }
            
            .ql-align:hover, .ql-picker:hover {
                box-shadow: 0 0 15px rgba(${rgbString}, 0.4) !important;
                background-color: rgba(${rgbString}, 0.05) !important;
            }
            
            .ql-align:focus, .ql-picker:focus {
                box-shadow: 0 0 20px rgba(${rgbString}, 0.5), inset 0 0 5px rgba(${rgbString}, 0.1) !important;
            }
            
            body.light-theme select,
            body.light-theme .ql-align,
            body.light-theme .ql-picker {
                border-color: ${color} !important;
                background-color: #f3e8ff !important;
                color: ${color} !important;
                box-shadow: 0 0 10px rgba(${rgbString}, 0.2) !important;
            }
            
            body.light-theme select:hover,
            body.light-theme .ql-align:hover,
            body.light-theme .ql-picker:hover {
                box-shadow: 0 0 15px rgba(${rgbString}, 0.4) !important;
            }

            .ql-picker-options {
                border-color: ${color} !important;
            }

            .ql-picker-item:hover {
                background-color: rgba(${rgbString}, 0.2) !important;
            }

            body.light-theme .ql-picker-options {
                border-color: ${color} !important;
                box-shadow: 0 4px 12px rgba(${rgbString}, 0.2) !important;
            }

            body.light-theme .ql-picker-item:hover {
                background-color: #f3e8ff !important;
                color: ${color} !important;
            }
        `;
        
        // Update inline styles on specific elements
        updateElementColors(color);
    }

    // Helper function to convert hex to RGB
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 139, g: 92, b: 246 };
    }

    function lightenColor(hex, percent) {
        const rgb = hexToRgb(hex);
        if (!rgb) return hex;
        
        const r = Math.min(255, Math.floor(rgb.r + (255 - rgb.r) * (percent / 100)));
        const g = Math.min(255, Math.floor(rgb.g + (255 - rgb.g) * (percent / 100)));
        const b = Math.min(255, Math.floor(rgb.b + (255 - rgb.b) * (percent / 100)));
        
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    // Update inline element colors
    function updateElementColors(color) {
        // Update theme buttons
        if (darkThemeBtn && document.body.classList.contains('light-theme')) {
            darkThemeBtn.style.background = '#f0f0f0';
            darkThemeBtn.style.color = '#1a1a1a';
            if (lightThemeBtn) {
                lightThemeBtn.style.background = color;
                lightThemeBtn.style.color = 'white';
            }
        } else if (darkThemeBtn) {
            darkThemeBtn.style.background = color;
            darkThemeBtn.style.color = 'white';
            if (lightThemeBtn) {
                lightThemeBtn.style.background = '#f0f0f0';
                lightThemeBtn.style.color = '#1a1a1a';
            }
        }
        
        // Update all buttons with the accent color
        document.querySelectorAll('button').forEach(btn => {
            if (btn.style.background === '#8b5cf6' || btn.style.background === 'rgb(139, 92, 246)') {
                btn.style.background = color;
            }
            if (btn.style.borderColor === '#8b5cf6' || btn.style.borderColor === 'rgb(139, 92, 246)') {
                btn.style.borderColor = color;
            }
            if (btn.style.color === '#8b5cf6' || btn.style.color === 'rgb(139, 92, 246)') {
                btn.style.color = color;
            }
        });
    }

    // Logout handler
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to logout?')) {
                localStorage.removeItem('synchroEditToken');
                localStorage.removeItem('synchroEditUser');
                window.location.href = 'login.html';
            }
        });
    }

    // Display logged-in user
    const username = localStorage.getItem('synchroEditUser');
    if (username && logoutBtn) {
        logoutBtn.innerHTML = `<i class="fas fa-user"></i> ${username} <i class="fas fa-sign-out-alt"></i>`;
    }

    // Load saved theme preference
    loadTheme();

    // Setup accent color buttons
    setupAccentColorSelector();

    // ============================================ 
    // QUALITY OF LIFE IMPROVEMENTS
    // ============================================ 

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + S: Save document
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            // Assuming saveFileBtn click handler saves the file, but we might want
            // to just trigger the sync/save to server if that's the intention.
            // But here it mimics the save button which exports.
            // If you want server save, that's automatic.
            console.log('Document saved via keyboard shortcut (auto-save is active)');
        }
        
        // Ctrl/Cmd + K: Open document library
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (docLibrary) {
                docLibrary.style.display = 'flex';
                if (libraryOverlay) libraryOverlay.style.display = 'flex';
                if (docSearch) docSearch.focus();
            }
        }
        
        // Ctrl/Cmd + N: Create new document
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            createNewDocument();
        }
        
        // Escape: Close all modals
        if (e.key === 'Escape') {
            if (profileModal && profileModal.style.display === 'flex') {
                profileModal.style.display = 'none';
            }
            if (shareModal && shareModal.style.display === 'flex') {
                shareModal.style.display = 'none';
            }
            if (docLibrary && docLibrary.style.display === 'flex') {
                docLibrary.style.display = 'none';
                if (libraryOverlay) libraryOverlay.style.display = 'none';
            }
        }
        
        // Ctrl/Cmd + ,: Open user profile (settings)
        if ((e.ctrlKey || e.metaKey) && e.key === ',') {
            e.preventDefault();
            if (profileModal) {
                profileModal.style.display = 'flex';
                setupProfileTabs();
            }
        }
    });

    // Auto-focus document search when library opens
    const observerConfig = { attributes: true, attributeFilter: ['style'] };
    if (docLibrary) {
        const libraryObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target.style.display === 'block' && docSearch) { // Changed check to 'block' as per previous code
                    setTimeout(() => docSearch.focus(), 100);
                }
            });
        });
        libraryObserver.observe(docLibrary, observerConfig);
    }

    // Enhanced document search with case-insensitive filtering
    // Debounce utility function
    function debounce(func, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // Auto-save indicator
    let lastSaveTime = Date.now();
    if (quill) {
        quill.on('text-change', debounce(() => {
            lastSaveTime = Date.now();
            const indicator = document.getElementById('autoSaveIndicator');
            if (indicator) {
                indicator.style.display = 'inline';
                setTimeout(() => {
                    indicator.style.display = 'none';
                }, 2000);
            }
        }, 1000));
    }

    // Tooltip on hover for buttons (improve UX)
    document.querySelectorAll('[title]').forEach(el => {
        el.addEventListener('mouseenter', function() {
            if (this.title && !this.hasAttribute('aria-label')) {
                this.setAttribute('aria-label', this.title);
            }
        });
    });

    // Save before page unload
    window.addEventListener('beforeunload', () => {
        if (autoSaveInterval) {
            clearInterval(autoSaveInterval);
        }
    });

}); // Close DOMContentLoaded