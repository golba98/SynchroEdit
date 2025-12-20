// Auth Check
const token = localStorage.getItem('synchroEditToken');
if (!token) {
    const params = new URLSearchParams(window.location.search);
    const docId = params.get('doc');
    if (docId) {
        window.location.href = `login.html?doc=${docId}`;
    } else {
        window.location.href = 'login.html';
    }
}

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
                <td colspan="4" style="text-align: center; padding: 40px; color: #5f6368;">
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
        
        return `
            <tr class="doc-item" data-doc-id="${doc._id}" style="border-bottom: 1px solid #f1f3f4; cursor: pointer; transition: background 0.2s; ${isActive ? 'background: #e8f0fe;' : ''}">
                <td style="padding: 16px 24px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <i class="fas fa-file-alt" style="color: #4a90e2; font-size: 20px;"></i>
                        <div>
                            <div style="color: #202124; font-weight: 500; margin-bottom: 4px;">${doc.title}</div>
                            <div style="color: #5f6368; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 400px;">${previewText}</div>
                        </div>
                    </div>
                </td>
                <td style="padding: 16px 24px; color: #5f6368; font-size: 14px;">SynchroEdit</td>
                <td style="padding: 16px 24px; color: #5f6368; font-size: 14px;">${dateStr}</td>
                <td style="padding: 16px 24px; text-align: center;">
                    <button class="delete-doc-btn" data-doc-id="${doc._id}" style="background: none; border: none; color: #5f6368; cursor: pointer; padding: 8px; border-radius: 50%; transition: all 0.2s;" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    // Add click handlers
    document.querySelectorAll('.doc-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.delete-doc-btn')) {
                const docId = item.dataset.docId;
                if (docId !== documentId) {
                    openDocument(docId);
                }
            }
        });
    });
    
    // Add delete handlers
    document.querySelectorAll('.delete-doc-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const docId = btn.dataset.docId;
            if (confirm(`Are you sure you want to delete this document?`)) {
                try {
                    const response = await fetch(\`/api/documents/\${docId}\`, {
                        method: 'DELETE',
                        headers: { 'Authorization': \`Bearer \${token}\` }
                    });
                    if (response.ok) {
                        renderDocumentList();
                    }
                } catch (err) {
                    console.error('Error deleting document:', err);
                }
            }
        });
    });
}

// Initialize WebSocket Connection
function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('Connected to server');
        // Send document ID to join specific document room
        ws.send(JSON.stringify({ type: 'join-document', documentId: documentId }));
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
    }
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
    }
});

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
        
        zoomPercent.textContent = `${currentZoom}%`;
        localStorage.setItem('docZoom', currentZoom);
    }
}

if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
        if (currentZoom < 200) {
            currentZoom += 10;
            applyZoom();
        }
    });
}

if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
        if (currentZoom > 50) {
            currentZoom -= 10;
            applyZoom();
        }
    });
}

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
    
    console.log('Setting up ribbon tabs:', tabs.length, 'tabs found');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            console.log('Tab clicked:', tab.dataset.tab);
            
            // Remove active class from all tabs and ribbons
            tabs.forEach(t => t.classList.remove('active'));
            ribbons.forEach(r => r.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Show corresponding ribbon
            const tabName = tab.dataset.tab;
            const ribbon = document.getElementById(`${tabName}-ribbon`);
            console.log('Looking for ribbon:', `${tabName}-ribbon`, 'Found:', ribbon);
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
            document.body.style.backgroundColor = '#121212';
            
            // Editor container and content
            const editorContainer = document.querySelector('.editor-container');
            editorContainer.style.backgroundColor = '#1e1e1e';
            editorContainer.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.5)';
            document.querySelector('#editor').style.color = '#e8eaed';
            
            // Header
            const header = document.querySelector('.header');
            header.style.backgroundColor = '#202124';
            header.style.color = '#e8eaed';
            header.style.borderBottomColor = '#3c4043';
            const docTitle = document.querySelector('.doc-title');
            docTitle.style.color = '#e8eaed';
            docTitle.style.backgroundColor = '#292a2d';
            
            // Toolbar and ribbons
            const toolbar = document.querySelector('.toolbar');
            toolbar.style.backgroundColor = '#1a1a1a';
            toolbar.style.borderBottomColor = '#3c4043';
            const ribbonTabs = document.querySelector('.ribbon-tabs');
            ribbonTabs.style.backgroundColor = '#202124';
            ribbonTabs.style.borderBottomColor = '#3c4043';
            document.querySelectorAll('.ribbon-content').forEach(r => {
                r.style.backgroundColor = '#292a2d';
                r.style.color = '#e8eaed';
                r.style.borderBottomColor = '#3c4043';
            });
            document.querySelectorAll('.ribbon-tab').forEach(t => {
                t.style.color = '#9aa0a6';
            });
            document.querySelectorAll('.toolbar-btn').forEach(btn => {
                btn.style.color = '#e8eaed';
            });
            
            // Page navigator
            const pageNav = document.querySelector('.page-navigator');
            pageNav.style.backgroundColor = '#202124';
            pageNav.style.borderBottomColor = '#3c4043';
            
            // Status bar
            const statusBar = document.querySelector('.status-bar');
            statusBar.style.backgroundColor = '#1a1a1a';
            statusBar.style.color = '#9aa0a6';
            statusBar.style.borderTopColor = '#3c4043';
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
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const documentData = JSON.parse(event.target.result);
                    
                    // Load the document
                    isLoadingFromServer = true;
                    docTitle.value = documentData.title;
                    pages = documentData.pages || [{ content: '' }];
                    currentPageIndex = documentData.currentPageIndex || 0;
                    
                    // Load current page
                    loadPage(currentPageIndex);
                    renderPageTabs();
                    
                    // Sync to server
                    sendToServer({ type: 'update-title', title: documentData.title });
                    pages.forEach((page, index) => {
                        sendToServer({ type: 'update-page', pageIndex: index, content: page.content });
                    });
                    
                    isLoadingFromServer = false;
                    
                    alert('Document loaded successfully!');
                } catch (error) {
                    console.error('Error loading file:', error);
                    alert('Error loading file. Please make sure it\'s a valid SynchroEdit document.');
                }
            };
            reader.readAsText(file);
        }
        fileInput.value = ''; // Reset input
    });
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
