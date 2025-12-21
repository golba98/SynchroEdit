// Auth Check
let token = localStorage.getItem('synchroEditToken');
// Set test credentials for development
if (!token) {
    localStorage.setItem('synchroEditToken', 'test-token-dev');
    localStorage.setItem('synchroEditUser', 'TestUser');
    token = 'test-token-dev';
}

/*
if (!token) {
    const params = new URLSearchParams(window.location.search);
    const docId = params.get('doc');
    if (docId) {
        window.location.href = `login.html?doc=${docId}`;
    } else {
        window.location.href = 'login.html';
    }
}
*/

// Wait for DOM to be ready before initializing
document.addEventListener('DOMContentLoaded', () => {
// Initialize Quill Editor with external toolbar
const quill = new Quill('#editor', {
    theme: 'snow',
    placeholder: 'Start typing...',
    modules: {
        toolbar: {
            container: [
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'align': [] }],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['clean'],
                ['image', 'video', 'link'],
                ['blockquote', 'code-block'],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'indent': '-1'}, { 'indent': '+1' }]
            ]
        }
    }
});

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
const createNewDoc = document.getElementById('createNewDoc');
const documentList = document.getElementById('documentList');
const logoutBtn = document.getElementById('logoutBtn');

// Profile Elements
const userProfileTrigger = document.getElementById('userProfileTrigger');
const profileModal = document.getElementById('profileModal');
const closeProfileModal = document.getElementById('closeProfileModal');
const profilePfp = document.getElementById('profilePfp');
const headerPfp = document.getElementById('headerPfp');
const headerUserIcon = document.getElementById('headerUserIcon');
const pfpUpload = document.getElementById('pfpUpload');
const profileUsername = document.getElementById('profileUsername');
const currentPasswordInput = document.getElementById('currentPassword');
const newPasswordInput = document.getElementById('newPassword');
const updatePasswordBtn = document.getElementById('updatePasswordBtn');

// State
let currentZoom = 100;
let pages = [];
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
            ? doc.pages[0].content.replace(/<[^>]*>/g, '').substring(0, 100) + '...'
            : 'Empty document';
        
        const lastModifiedBy = doc.lastModifiedBy ? doc.lastModifiedBy.username : 'Unknown';
        
        return `
            <tr class="doc-item" data-doc-id="${doc._id}" style="border-bottom: 1px solid #2a2a2a; cursor: pointer; transition: background 0.2s; ${isActive ? 'background: rgba(139, 92, 246, 0.15);' : ''}">
                <td style="padding: 16px 24px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <i class="fas fa-file-alt" style="color: #a78bfa; font-size: 20px;"></i>
                        <div>
                            <div style="color: #e0e0e0; font-weight: 500; margin-bottom: 4px;">${doc.title}</div>
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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('Connected to server');
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
        setTimeout(initWebSocket, 3000);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

// Handle incoming server messages
function handleServerMessage(data) {
    switch (data.type) {
        case 'sync':
            // Initial sync from server
            isLoadingFromServer = true;
            docTitle.value = data.data.title;
            pages = data.data.pages;
            currentPageIndex = data.data.currentPageIndex;
            loadPage(currentPageIndex);
            renderPageTabs();
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
                
                // If this is the current page, update the editor
                if (data.pageIndex === currentPageIndex) {
                    isLoadingFromServer = true;
                    quill.setContents(data.content);
                    isLoadingFromServer = false;
                }
            }
            break;

        case 'new-page':
            if (!isLoadingFromServer) {
                pages.push({ content: '' });
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
                    loadPage(currentPageIndex);
                    renderPageTabs();
                }
            }
            break;

        case 'change-page':
            if (!isLoadingFromServer && data.pageIndex !== currentPageIndex) {
                currentPageIndex = data.pageIndex;
                loadPage(currentPageIndex);
                renderPageTabs();
            }
            break;

        case 'collaborators':
            updateCollaboratorsUI(data.users);
            break;

        case 'document-deleted':
            alert('This document has been deleted by the owner.');
            window.location.href = 'index.html';
            break;
    }
}

function updateCollaboratorsUI(users) {
    const container = document.getElementById('activeCollaborators');
    if (!container) return;

    container.innerHTML = users.map((user, index) => {
        const colors = ['#8b5cf6', '#a78bfa', '#c4b5fd', '#6366f1', '#818cf8', '#a5b4fc'];
        const color = colors[index % colors.length];
        const initial = user.username.charAt(0).toUpperCase();
        
        return `
            <div title="${user.username}" style="
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
                box-shadow: 0 0 15px rgba(139, 92, 246, 0.4);
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
docTitle.addEventListener('input', () => {
    sendToServer({
        type: 'update-title',
        title: docTitle.value
    });
    localStorage.setItem('docTitle', docTitle.value);
});

// Quill Content Changes
quill.on('text-change', () => {
    if (!isLoadingFromServer && pages[currentPageIndex]) {
        const delta = quill.getContents();
        pages[currentPageIndex].content = delta;
        
        sendToServer({
            type: 'update-page',
            pageIndex: currentPageIndex,
            content: delta
        });
        
        updateCounts();
        
        // Auto-page creation when content gets near bottom
        checkAndCreateNewPage();
    }
});

// Auto-page creation logic - creates new page when current page is full
function checkAndCreateNewPage() {
    const editor = document.querySelector('.ql-editor');
    const editorContainer = document.querySelector('.editor-container');
    
    if (!editor || !editorContainer) return;
    
    // Get actual container height (the fixed page size)
    const containerHeight = editorContainer.clientHeight;
    const contentHeight = editor.scrollHeight;
    
    // If content exceeds container height, create new page automatically
    // This will prevent scrolling and force page breaks
    if (contentHeight > containerHeight) {
        const currentLength = quill.getLength();
        
        // Only auto-create if we have significant content (more than just newlines)
        if (currentLength > 10) {
            // Check if we don't already have an empty page at the end
            const lastPageEmpty = pages.length > 0 && 
                                 pages[pages.length - 1].content.ops && 
                                 pages[pages.length - 1].content.ops.filter(op => op.insert && op.insert.trim()).length === 0;
            
            if (!lastPageEmpty && pages.length < 50) { // Max 50 pages
                createNewPage();
            }
        }
    }
}

// Create new page
function createNewPage() {
    const newPage = {
        id: `page-${Date.now()}`,
        number: pages.length + 1,
        content: { ops: [{ insert: '\n' }] }
    };
    pages.push(newPage);
    switchPage(pages.length - 1);
}

// Switch to a different page
function switchPage(pageIndex) {
    if (pageIndex < 0 || pageIndex >= pages.length || pageIndex === currentPageIndex) return;
    
    // Save current page content
    if (currentPageIndex >= 0 && currentPageIndex < pages.length) {
        pages[currentPageIndex].content = quill.getContents();
    }
    
    // Switch to new page
    currentPageIndex = pageIndex;
    
    // Load new page content
    isLoadingFromServer = true;
    quill.setContents(pages[currentPageIndex].content || { ops: [{ insert: '\n' }] });
    quill.setSelection(0, 0);
    isLoadingFromServer = false;
    
    // Update counts
    updateCounts();
    
    // Scroll editor to top
    const editor = document.querySelector('.ql-editor');
    if (editor) {
        editor.scrollTop = 0;
    }
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
    const text = quill.getText();
    const chars = text.length - 1; // Exclude the trailing newline
    const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
    charCountSpan.textContent = `Characters: ${Math.max(0, chars)}`;
    wordCountSpan.textContent = `Words: ${words}`;
}

// Zoom functionality
function applyZoom() {
    const editorContainer = document.querySelector('.editor-container');
    if (editorContainer) {
        const scale = currentZoom / 100;
        editorContainer.style.transform = `scale(${scale})`;
        editorContainer.style.transformOrigin = 'top center';
        
        // Adjust margin to account for scale changes
        // At 50% zoom, we want the page to fit nicely
        const baseMargin = 40;
        const scaledHeight = 1100 * scale; // Approximate height
        const marginTop = scale < 1 ? baseMargin * scale : baseMargin;
        editorContainer.style.marginTop = `${marginTop}px`;
        editorContainer.style.marginBottom = `${marginTop}px`;
        
        // Update all zoom percentage displays
        const zoomPercentElements = document.querySelectorAll('#zoomPercent');
        zoomPercentElements.forEach(el => {
            el.textContent = `${currentZoom}%`;
        });
        
        localStorage.setItem('docZoom', currentZoom);
    }
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
function loadPage(index) {
    isLoadingFromServer = true;
    
    // Save current page content
    if (pages[currentPageIndex]) {
        pages[currentPageIndex].content = quill.getContents();
    }
    
    // Load new page
    currentPageIndex = index;
    if (pages[index]) {
        const content = pages[index].content;
        if (content && content.ops) {
            quill.setContents(content);
        } else {
            quill.setContents([]);
        }
    } else {
        quill.setContents([]);
    }
    
    pageInfo.textContent = `Page ${index + 1} of ${pages.length}`;
    updateCounts();
    renderPageTabs();
    localStorage.setItem('currentPageIndex', currentPageIndex);
    
    isLoadingFromServer = false;
}

function createNewPage() {
    pages.push({ content: { ops: [] } });
    
    sendToServer({
        type: 'new-page'
    });
    
    loadPage(pages.length - 1);
    localStorage.setItem('docPages', JSON.stringify(pages));
}

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
        
        loadPage(currentPageIndex);
        localStorage.setItem('docPages', JSON.stringify(pages));
    } else {
        alert('You must have at least one page!');
    }
}

function renderPageTabs() {
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
                loadPage(index);
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
window.addEventListener('load', async () => {
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
        const docArray = await getAllDocuments();
        
        if (docArray.length > 0) {
            // Show document library to choose from
            docLibrary.style.display = 'block';
            libraryOverlay.style.display = 'block';
            await renderDocumentList();
        } else {
            // No documents - create first one automatically
            createNewDocument();
            return; // Page will reload with new doc
        }
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
    
    // Setup document library
    setupDocumentLibrary();
});

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
    // Get all Quill format buttons
    const boldBtn = document.querySelector('.ql-bold');
    const italicBtn = document.querySelector('.ql-italic');
    const underlineBtn = document.querySelector('.ql-underline');
    const strikeBtn = document.querySelector('.ql-strike');
    const alignSelect = document.querySelector('.ql-align');
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
    
    // TEST: Log what we found
    if (!imageBtn) console.warn('Image button not found in Insert ribbon');
    if (!videoBtn) console.warn('Video button not found in Insert ribbon');
    if (!linkBtn) console.warn('Link button not found in Insert ribbon');
    
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
                const range = quill.getSelection(true);
                quill.insertEmbed(range.index, 'image', event.target.result);
                quill.setSelection(range.index + 1);
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
                const range = quill.getSelection(true);
                // Create a video element instead of using Quill's video embed
                const videoHtml = `<video controls width="400" src="${event.target.result}"></video>`;
                quill.clipboard.dangerouslyPasteHTML(range.index, videoHtml);
                quill.setSelection(range.index + 1);
            };
            reader.readAsDataURL(file);
        }
        videoFileInput.value = ''; // Reset input
    });
    
    if (linkBtn) linkBtn.addEventListener('click', () => {
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
        const format = quill.getFormat();
        quill.format('blockquote', !format.blockquote);
    });
    
    if (codeBlockBtn) codeBlockBtn.addEventListener('click', () => {
        const format = quill.getFormat();
        quill.format('code-block', !format['code-block']);
    });
}

// Design Features
function setupDesignFeatures() {
    const themeLight = document.getElementById('themeLight');
    const themeDark = document.getElementById('themeDark');
    const colorBtn = document.querySelector('#design-ribbon .ql-color');
    const backgroundBtn = document.querySelector('#design-ribbon .ql-background');
    
    // Color buttons
    if (colorBtn) colorBtn.addEventListener('click', () => {
        const color = prompt('Enter text color (e.g., #ff0000, red, rgb(255,0,0)):');
        if (color) {
            quill.format('color', color);
        }
    });
    
    if (backgroundBtn) backgroundBtn.addEventListener('click', () => {
        const color = prompt('Enter highlight color (e.g., #ffff00, yellow):');
        if (color) {
            quill.format('background', color);
        }
    });
    
    if (themeLight) {
        themeLight.addEventListener('click', () => {
            // Body and background
            document.body.style.backgroundColor = '#e8eaed';
            
            // Editor container and content
            const editorContainer = document.querySelector('.editor-container');
            editorContainer.style.backgroundColor = '#ffffff';
            editorContainer.style.boxShadow = '0 2px 8px rgba(60, 64, 67, 0.15)';
            document.querySelector('#editor').style.color = '#202124';
            
            // Header
            const header = document.querySelector('.header');
            header.style.backgroundColor = '#f8f9fa';
            header.style.color = '#202124';
            header.style.borderBottomColor = '#dadce0';
            const docTitle = document.querySelector('.doc-title');
            docTitle.style.color = '#202124';
            docTitle.style.backgroundColor = '#ffffff';
            
            // Toolbar and ribbons
            const toolbar = document.querySelector('.toolbar');
            toolbar.style.backgroundColor = '#f1f3f4';
            toolbar.style.borderBottomColor = '#dadce0';
            const ribbonTabs = document.querySelector('.ribbon-tabs');
            ribbonTabs.style.backgroundColor = '#f8f9fa';
            ribbonTabs.style.borderBottomColor = '#dadce0';
            document.querySelectorAll('.ribbon-content').forEach(r => {
                r.style.backgroundColor = '#ffffff';
                r.style.color = '#202124';
                r.style.borderBottomColor = '#dadce0';
            });
            document.querySelectorAll('.ribbon-tab').forEach(t => {
                t.style.color = '#5f6368';
            });
            document.querySelectorAll('.toolbar-btn').forEach(btn => {
                btn.style.color = '#3c4043';
            });
            
            // Page navigator
            const pageNav = document.querySelector('.page-navigator');
            pageNav.style.backgroundColor = '#f8f9fa';
            pageNav.style.borderBottomColor = '#dadce0';
            
            // Status bar
            const statusBar = document.querySelector('.status-bar');
            statusBar.style.backgroundColor = '#f1f3f4';
            statusBar.style.color = '#5f6368';
            statusBar.style.borderTopColor = '#dadce0';
        });
    }
    
    if (themeDark) {
        themeDark.addEventListener('click', () => {
            // Body and background
            document.body.style.backgroundColor = '#000000';
            
            // Editor container and content
            const editorContainer = document.querySelector('.editor-container');
            editorContainer.style.backgroundColor = '#0d0d0d';
            editorContainer.style.boxShadow = '0 0 40px rgba(139, 92, 246, 0.3)';
            document.querySelector('#editor').style.color = '#e0e0e0';
            
            // Header
            const header = document.querySelector('.header');
            header.style.backgroundColor = '#0a0a0a';
            header.style.color = '#e0e0e0';
            header.style.borderBottomColor = '#2a2a2a';
            const docTitle = document.querySelector('.doc-title');
            docTitle.style.color = '#e0e0e0';
            docTitle.style.backgroundColor = '#1a1a1a';
            
            // Toolbar and ribbons
            const toolbar = document.querySelector('.toolbar');
            toolbar.style.backgroundColor = '#0a0a0a';
            toolbar.style.borderBottomColor = '#2a2a2a';
            const ribbonTabs = document.querySelector('.ribbon-tabs');
            ribbonTabs.style.backgroundColor = '#0a0a0a';
            ribbonTabs.style.borderBottomColor = '#2a2a2a';
            document.querySelectorAll('.ribbon-content').forEach(r => {
                r.style.backgroundColor = '#0d0d0d';
                r.style.color = '#e0e0e0';
                r.style.borderBottomColor = '#2a2a2a';
            });
            document.querySelectorAll('.ribbon-tab').forEach(t => {
                t.style.color = '#b0b0b0';
            });
            document.querySelectorAll('.toolbar-btn').forEach(btn => {
                btn.style.color = '#e0e0e0';
            });
            
            // Page navigator
            const pageNav = document.querySelector('.page-navigator');
            pageNav.style.backgroundColor = '#0a0a0a';
            pageNav.style.borderBottomColor = '#2a2a2a';
            
            // Status bar
            const statusBar = document.querySelector('.status-bar');
            statusBar.style.backgroundColor = '#0a0a0a';
            statusBar.style.color = '#b0b0b0';
            statusBar.style.borderTopColor = '#2a2a2a';
        });
    }
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
        quill.format('indent', '-1');
    });
    
    if (indentIncreaseBtn) indentIncreaseBtn.addEventListener('click', () => {
        quill.format('indent', '+1');
    });
    
    // Helper function to convert pt to px (1pt = 1.333px)
    function ptToPx(pt) {
        return parseFloat(pt) * 1.333;
    }
    
    // Helper function to apply border
    function applyBorder() {
        const container = document.querySelector('.editor-container');
        const widthPx = `${ptToPx(currentBorderWidth)}px`;
        const borderValue = `${widthPx} ${currentBorderStyle} ${currentBorderColor}`;
        
        // Reset all special effects first
        container.style.boxShadow = 'none';
        
        if (currentBorderType === 'none') {
            container.style.border = 'none';
            container.style.borderTop = 'none';
            container.style.borderBottom = 'none';
            container.style.borderLeft = 'none';
            container.style.borderRight = 'none';
        } else if (currentBorderType === 'box') {
            container.style.border = borderValue;
        } else if (currentBorderType === 'shadow') {
            container.style.border = borderValue;
            container.style.boxShadow = `5px 5px 10px rgba(0, 0, 0, 0.3)`;
        } else if (currentBorderType === '3d') {
            container.style.border = borderValue;
            container.style.boxShadow = `inset -2px -2px 5px rgba(0, 0, 0, 0.2), inset 2px 2px 5px rgba(255, 255, 255, 0.5)`;
        }
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
            document.querySelector('#editor').style.lineHeight = e.target.value;
        });
    }
    
    // Border position controls
    if (borderAll) {
        borderAll.addEventListener('click', () => {
            if (currentBorderType === 'none') {
                currentBorderType = 'box';
            }
            applyBorder();
        });
    }
    
    if (borderTop) {
        borderTop.addEventListener('click', () => {
            const container = document.querySelector('.editor-container');
            const widthPx = `${ptToPx(currentBorderWidth)}px`;
            const borderValue = `${widthPx} ${currentBorderStyle} ${currentBorderColor}`;
            
            container.style.border = 'none';
            container.style.boxShadow = 'none';
            container.style.borderTop = borderValue;
            container.style.borderBottom = 'none';
            container.style.borderLeft = 'none';
            container.style.borderRight = 'none';
        });
    }
    
    if (borderBottom) {
        borderBottom.addEventListener('click', () => {
            const container = document.querySelector('.editor-container');
            const widthPx = `${ptToPx(currentBorderWidth)}px`;
            const borderValue = `${widthPx} ${currentBorderStyle} ${currentBorderColor}`;
            
            container.style.border = 'none';
            container.style.boxShadow = 'none';
            container.style.borderTop = 'none';
            container.style.borderBottom = borderValue;
            container.style.borderLeft = 'none';
            container.style.borderRight = 'none';
        });
    }
    
    if (borderLeft) {
        borderLeft.addEventListener('click', () => {
            const container = document.querySelector('.editor-container');
            const widthPx = `${ptToPx(currentBorderWidth)}px`;
            const borderValue = `${widthPx} ${currentBorderStyle} ${currentBorderColor}`;
            
            container.style.border = 'none';
            container.style.boxShadow = 'none';
            container.style.borderTop = 'none';
            container.style.borderBottom = 'none';
            container.style.borderLeft = borderValue;
            container.style.borderRight = 'none';
        });
    }
    
    if (borderRight) {
        borderRight.addEventListener('click', () => {
            const container = document.querySelector('.editor-container');
            const widthPx = `${ptToPx(currentBorderWidth)}px`;
            const borderValue = `${widthPx} ${currentBorderStyle} ${currentBorderColor}`;
            
            container.style.border = 'none';
            container.style.boxShadow = 'none';
            container.style.borderTop = 'none';
            container.style.borderBottom = 'none';
            container.style.borderLeft = 'none';
            container.style.borderRight = borderValue;
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
            if (statusBar.style.display === 'none') {
                statusBar.style.display = 'block';
            } else {
                statusBar.style.display = 'none';
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
shareModal.addEventListener('click', (e) => {
    if (e.target === shareModal) {
        shareModal.style.display = 'none';
    }
});

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
    
    // Load current page
    loadPage(currentPageIndex);
    renderPageTabs();
    
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
    
    loadPage(currentPageIndex);
    renderPageTabs();
    
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
            await renderDocumentList();
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
    try {
        const response = await fetch('/api/user/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const user = await response.json();
            profileUsername.textContent = user.username;
            if (user.profilePicture) {
                profilePfp.src = user.profilePicture;
                headerPfp.src = user.profilePicture;
                headerPfp.style.display = 'block';
                headerUserIcon.style.display = 'none';
                
                // Update library icons too
                const libPfp = document.getElementById('libraryHeaderPfp');
                const libIcon = document.getElementById('libraryHeaderUserIcon');
                if (libPfp && libIcon) {
                    libPfp.src = user.profilePicture;
                    libPfp.style.display = 'block';
                    libIcon.style.display = 'none';
                }
            }
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
                    profilePfp.src = data.profilePicture;
                    headerPfp.src = data.profilePicture;
                    headerPfp.style.display = 'block';
                    headerUserIcon.style.display = 'none';
                    alert('Profile picture updated!');
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

if (userProfileTrigger) {
    userProfileTrigger.addEventListener('click', () => {
        profileModal.style.display = 'flex';
    });
}

const libraryUserProfileTrigger = document.getElementById('libraryUserProfileTrigger');
if (libraryUserProfileTrigger) {
    libraryUserProfileTrigger.addEventListener('click', () => {
        profileModal.style.display = 'flex';
    });
}

if (closeProfileModal) {
    closeProfileModal.addEventListener('click', () => {
        profileModal.style.display = 'none';
    });
}

if (profileModal) {
    profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal) profileModal.style.display = 'none';
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

// Save before page unload
window.addEventListener('beforeunload', () => {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
    }
});

}); // Close DOMContentLoaded
