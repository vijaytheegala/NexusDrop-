const PREFIX = 'nexus-drop-room-';

// UI Elements
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
const btnCloseSidebar = document.getElementById('btn-close-sidebar');
const storedRoomsList = document.getElementById('stored-rooms-list');
const btnNewLocal = document.getElementById('btn-new-local');

const unsecuredBanner = document.getElementById('unsecured-banner');
const btnBannerSecure = document.getElementById('btn-banner-secure');

const modalHost = document.getElementById('modal-host');
const modalJoin = document.getElementById('modal-join');
const btnShowHostModal = document.getElementById('btn-show-host-modal');
const btnShowJoinModal = document.getElementById('btn-show-join-modal');
const closeModals = document.querySelectorAll('.btn-close-modal');

const hostNameInput = document.getElementById('host-name-input');
const hostPinInput = document.getElementById('host-pin-input');
const btnExecuteHost = document.getElementById('btn-execute-host');
const hostStatus = document.getElementById('host-status');

const joinPinInput = document.getElementById('join-pin-input');
const btnExecuteJoin = document.getElementById('btn-execute-join');
const joinStatus = document.getElementById('join-status');

const chatRoomName = document.getElementById('chat-room-name');
const chatRoomPin = document.getElementById('chat-room-pin');
const pinBadgeContainer = document.getElementById('pin-badge-container');
const peerStatus = document.getElementById('peer-status');
const statusDot = document.querySelector('.status-dot');
const btnShareLink = document.getElementById('btn-share-link');
const btnDeleteRoom = document.getElementById('btn-delete-room');

const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const btnSend = document.getElementById('btn-send');
const btnAttach = document.getElementById('btn-attach');
const fileInput = document.getElementById('file-input');

// Reply UI Elements
const replyPreview = document.getElementById('reply-preview');
const replyPreviewSender = document.getElementById('reply-preview-sender');
const replyPreviewText = document.getElementById('reply-preview-text');
const btnCancelReply = document.getElementById('btn-cancel-reply');

// Lightbox Elements
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const btnCloseLightbox = document.getElementById('btn-close-lightbox');

// State
let peer = null;
let connections = []; // Array of active connections (for host)
let hostConn = null; // Connection to host (for guest)
let activeReply = null;

// The currently open room. Format: { id: 'local' | '1234', name: 'string', isHost: boolean }
let currentRoom = null; 

// --- Initialization ---
async function init() {
    await refreshSidebar();
    
    // Auto-join via URL
    const urlParams = new URLSearchParams(window.location.search);
    const sharedPin = urlParams.get('pin');
    
    if (sharedPin && sharedPin.length === 4 && /^\d+$/.test(sharedPin)) {
        openJoinModal();
        joinPinInput.value = sharedPin;
        btnExecuteJoin.click();
    } else {
        // Open Local Scratchpad by default
        openRoom({ id: 'local', name: 'Local Scratchpad', isHost: false });
    }
}

// --- Sidebar & Navigation ---
function toggleSidebar() {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('hidden');
}

btnToggleSidebar.addEventListener('click', toggleSidebar);
btnCloseSidebar.addEventListener('click', toggleSidebar);
sidebarOverlay.addEventListener('click', toggleSidebar);

async function refreshSidebar() {
    storedRoomsList.innerHTML = '';
    const keys = await localforage.keys();
    let roomsFound = 0;
    
    for (const key of keys) {
        if (key.startsWith('room_meta_')) {
            const meta = await localforage.getItem(key);
            if (meta && meta.id !== 'local') {
                roomsFound++;
                const div = document.createElement('div');
                div.className = `room-item ${currentRoom && currentRoom.id === meta.id ? 'active' : ''}`;
                div.innerHTML = `
                    <div class="room-item-name">${meta.name}</div>
                    <div class="room-item-meta">PIN: ${meta.id} | ${meta.isHost ? 'Host' : 'Guest'}</div>
                `;
                div.addEventListener('click', () => {
                    openRoom(meta);
                    if (window.innerWidth < 768) toggleSidebar();
                });
                storedRoomsList.appendChild(div);
            }
        }
    }
    
    if (roomsFound === 0) {
        storedRoomsList.innerHTML = '<div style="font-size:0.8rem; color:var(--text-muted); text-align:center; padding:10px;">No secured rooms yet.</div>';
    }
}

btnNewLocal.addEventListener('click', () => {
    openRoom({ id: 'local', name: 'Local Scratchpad', isHost: false });
    if (window.innerWidth < 768) toggleSidebar();
});

// --- Room Logic ---
async function openRoom(roomMeta) {
    // Disconnect existing
    cleanupConnections();
    
    currentRoom = roomMeta;
    chatMessages.innerHTML = '';
    cancelReply();
    
    // Update Header UI
    chatRoomName.textContent = roomMeta.name;
    if (roomMeta.id === 'local') {
        pinBadgeContainer.classList.add('hidden');
        unsecuredBanner.classList.remove('hidden');
        btnShareLink.classList.add('hidden');
        btnDeleteRoom.classList.add('hidden'); // Optional: prevent deleting local
        updateStatus('local', 'LOCAL SCRATCHPAD');
    } else {
        pinBadgeContainer.classList.remove('hidden');
        chatRoomPin.textContent = roomMeta.id;
        unsecuredBanner.classList.add('hidden');
        btnShareLink.classList.remove('hidden');
        btnDeleteRoom.classList.remove('hidden');
        
        // Save meta to ensure it appears in sidebar
        await localforage.setItem(`room_meta_${roomMeta.id}`, roomMeta);
        
        // Start WebRTC based on role
        if (roomMeta.isHost) {
            startHosting(roomMeta.id);
        } else {
            startJoining(roomMeta.id);
        }
    }
    
    // Load chat history
    const history = await localforage.getItem(`messages_${roomMeta.id}`) || [];
    history.forEach(msg => renderMessageObj(msg));
    scrollToBottom();
    refreshSidebar();
    
    // Remove URL pin if present
    if (window.history.replaceState) {
        const url = new URL(window.location);
        url.searchParams.delete('pin');
        window.history.replaceState({path: url.href}, '', url.href);
    }
}

function updateStatus(state, text) {
    peerStatus.textContent = text;
    statusDot.className = 'status-dot'; // Reset
    if (state === 'online') statusDot.classList.add('online');
    if (state === 'local') statusDot.classList.add('local');
}

function cleanupConnections() {
    if (connections.length > 0) { connections.forEach(c => c.close()); connections = []; }
    if (hostConn) { hostConn.close(); hostConn = null; }
    if (peer) { peer.destroy(); peer = null; }
}

// --- Modals ---
function openHostModal() {
    modalHost.classList.remove('hidden');
    hostNameInput.value = '';
    hostPinInput.value = '';
    hostStatus.textContent = '';
    if (window.innerWidth < 768 && sidebar.classList.contains('open')) toggleSidebar();
}

function openJoinModal() {
    modalJoin.classList.remove('hidden');
    joinPinInput.value = '';
    joinStatus.textContent = '';
    if (window.innerWidth < 768 && sidebar.classList.contains('open')) toggleSidebar();
}

btnShowHostModal.addEventListener('click', openHostModal);
btnBannerSecure.addEventListener('click', openHostModal);
btnShowJoinModal.addEventListener('click', openJoinModal);

closeModals.forEach(btn => {
    btn.addEventListener('click', () => {
        modalHost.classList.add('hidden');
        modalJoin.classList.add('hidden');
    });
});

// --- Hosting Logic ---
btnExecuteHost.addEventListener('click', async () => {
    const name = hostNameInput.value.trim() || 'Secure Room';
    const pin = hostPinInput.value.trim();
    
    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
        hostStatus.textContent = 'Please enter a 4-digit PIN.';
        return;
    }
    
    modalHost.classList.add('hidden');
    
    // If we are currently in 'local' scratchpad, we can optionally migrate those messages to the new room!
    let migrateHistory = [];
    if (currentRoom && currentRoom.id === 'local') {
        migrateHistory = await localforage.getItem(`messages_local`) || [];
    }
    
    const newRoom = { id: pin, name: name, isHost: true };
    await localforage.setItem(`room_meta_${pin}`, newRoom);
    
    if (migrateHistory.length > 0) {
        await localforage.setItem(`messages_${pin}`, migrateHistory);
        await localforage.removeItem(`messages_local`); // Clear local scratchpad
    }
    
    openRoom(newRoom);
});

function startHosting(pin) {
    updateStatus(false, 'INITIALIZING SERVER...');
    
    peer = new Peer(PREFIX + pin, { debug: 2 });
    
    peer.on('open', (id) => {
        updateStatus('online', 'HOST ONLINE - WAITING FOR PEERS');
    });
    
    peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
            updateStatus(false, 'ERROR: PIN IN USE BY ANOTHER HOST');
            addSystemMessage('This PIN is already being hosted securely by someone else right now.');
        } else {
            updateStatus(false, 'CONNECTION ERROR');
            addSystemMessage(`Network Error: ${err.type}`);
        }
    });

    peer.on('connection', (conn) => {
        connections.push(conn);
        
        conn.on('open', async () => {
            updateStatus('online', `${connections.length} PEER(S) CONNECTED`);
            addSystemMessage('A peer joined the secure enclave.');
            
            // Sync history to guest
            const history = await localforage.getItem(`messages_${pin}`) || [];
            if (history.length > 0) {
                conn.send({ type: 'sync', data: history });
            }
        });
        
        conn.on('data', async (data) => {
            if (data.type === 'text' || data.type === 'file') {
                const msgObj = { ...data, sender: 'other' };
                await saveMessageToDB(pin, msgObj);
                renderMessageObj(msgObj);
                
                // Broadcast to other guests
                connections.forEach(c => {
                    if (c !== conn && c.open) c.send(data);
                });
            }
        });
        
        conn.on('close', () => {
            connections = connections.filter(c => c !== conn);
            updateStatus('online', connections.length > 0 ? `${connections.length} PEER(S) CONNECTED` : 'HOST ONLINE - WAITING FOR PEERS');
            addSystemMessage('A peer disconnected.');
        });
    });
}

// --- Joining Logic ---
btnExecuteJoin.addEventListener('click', async () => {
    const pin = joinPinInput.value.trim();
    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
        joinStatus.textContent = 'Invalid PIN.';
        return;
    }
    modalJoin.classList.add('hidden');
    
    // Create guest room
    const newRoom = { id: pin, name: `Room ${pin}`, isHost: false };
    openRoom(newRoom);
});

function startJoining(pin) {
    updateStatus(false, 'CONNECTING TO HOST...');
    
    peer = new Peer({ debug: 2 });
    
    peer.on('open', (id) => {
        hostConn = peer.connect(PREFIX + pin, { reliable: true });
        
        hostConn.on('open', () => {
            updateStatus('online', 'CONNECTED TO SECURE HOST');
            addSystemMessage('Connection established. Syncing data...');
        });
        
        hostConn.on('data', async (data) => {
            if (data.type === 'sync') {
                await localforage.setItem(`messages_${pin}`, data.data);
                chatMessages.innerHTML = '';
                data.data.forEach(msg => renderMessageObj(msg));
                addSystemMessage('Data synchronized with host.');
            } else if (data.type === 'text' || data.type === 'file') {
                const msgObj = { ...data, sender: 'other' };
                await saveMessageToDB(pin, msgObj);
                renderMessageObj(msgObj);
            }
        });
        
        hostConn.on('close', () => {
            updateStatus(false, 'HOST DISCONNECTED');
            addSystemMessage('Host closed the connection. Chat is now offline.');
        });
        
        hostConn.on('error', (err) => {
            updateStatus(false, 'CONNECTION FAILED');
        });
    });
    
    peer.on('error', (err) => {
        if (err.type === 'peer-unavailable') {
            updateStatus(false, 'HOST OFFLINE');
            addSystemMessage('The host is not currently online. You can view offline history.');
        } else {
            updateStatus(false, 'NETWORK ERROR');
        }
    });
}

// --- Messaging & Local DB ---
async function saveMessageToDB(pin, messageObj) {
    if (!messageObj.timestamp) messageObj.timestamp = Date.now();
    if (!messageObj.id) messageObj.id = `msg-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    
    let messages = await localforage.getItem(`messages_${pin}`) || [];
    messages.push(messageObj);
    await localforage.setItem(`messages_${pin}`, messages);
}

function setReply(id, sender, text) {
    activeReply = { id, sender, text };
    replyPreviewSender.textContent = sender === 'self' ? 'You' : 'Peer';
    replyPreviewText.innerHTML = parseMarkdown(text);
    replyPreview.classList.remove('hidden');
    messageInput.focus();
}

function cancelReply() {
    activeReply = null;
    replyPreview.classList.add('hidden');
    replyPreviewSender.textContent = '';
    replyPreviewText.textContent = '';
}
btnCancelReply.addEventListener('click', cancelReply);

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentRoom) return;
    
    const msgObj = { 
        id: `msg-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        type: 'text', 
        content: text, 
        sender: 'self', 
        timestamp: Date.now(),
        replyTo: activeReply
    };
    
    await saveMessageToDB(currentRoom.id, msgObj);
    renderMessageObj(msgObj);
    messageInput.value = '';
    cancelReply();

    // Transmit
    if (currentRoom.id !== 'local') {
        if (currentRoom.isHost) {
            connections.forEach(c => { if (c.open) c.send(msgObj); });
        } else if (hostConn && hostConn.open) {
            hostConn.send(msgObj);
        } else {
            addSystemMessage('Host offline. Saved locally.');
        }
    }
}

async function sendFile(file) {
    if (!currentRoom) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const arrayBuffer = e.target.result;
        const msgObj = {
            id: `msg-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            type: 'file', file: arrayBuffer, filename: file.name, filetype: file.type, sender: 'self', timestamp: Date.now(), replyTo: activeReply
        };

        await saveMessageToDB(currentRoom.id, msgObj);
        renderMessageObj(msgObj);
        cancelReply();

        if (currentRoom.id !== 'local') {
            const payload = { ...msgObj, sender: 'other' };
            if (currentRoom.isHost) {
                connections.forEach(c => { if (c.open) c.send(payload); });
            } else if (hostConn && hostConn.open) {
                hostConn.send(payload);
            } else {
                addSystemMessage('Host offline. Saved locally.');
            }
        }
    };
    reader.readAsArrayBuffer(file);
}

btnSend.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
btnAttach.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) sendFile(e.target.files[0]);
});

// --- UI Rendering ---
function renderMessageObj(msg) {
    if (!msg.id) msg.id = `msg-${Math.floor(Math.random() * 1000000)}`;

    const div = document.createElement('div');
    div.className = `message ${msg.sender}`;
    div.id = msg.id;
    
    let html = '';
    
    // Reply block
    if (msg.replyTo) {
        const senderLabel = msg.replyTo.sender === 'self' ? 'You' : 'Peer';
        html += `
            <div class="quoted-message" onclick="document.getElementById('${msg.replyTo.id}')?.scrollIntoView({behavior: 'smooth', block: 'center'}); document.getElementById('${msg.replyTo.id}')?.classList.add('highlight-pulse'); setTimeout(() => document.getElementById('${msg.replyTo.id}')?.classList.remove('highlight-pulse'), 1500);">
                <span class="quoted-sender">${senderLabel}</span>
                <span class="quoted-text">${parseMarkdown(msg.replyTo.text)}</span>
            </div>
        `;
    }

    let summaryText = '';
    
    if (msg.type === 'text') {
        html += `${parseMarkdown(msg.content)}<div class="msg-timestamp">${formatTime(msg.timestamp)}</div>`;
        summaryText = msg.content;
    } else if (msg.type === 'file') {
        let url = '';
        try {
            const blob = new Blob([msg.file], { type: msg.filetype });
            url = URL.createObjectURL(blob);
        } catch(e) { console.error("Could not render file", e); }
        
        html += `
            <div class="file-message">
                <div class="file-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg></div>
                <div class="file-details"><span class="file-name" title="${msg.filename}">${msg.filename}</span></div>
            </div>
        `;
        if (msg.filetype && msg.filetype.startsWith('image/')) {
            html += `<img src="${url}" alt="${msg.filename}" class="img-preview" onclick="openLightbox('${url}')">`;
        }
        html += `<a href="${url}" download="${msg.filename}" class="file-download">Save to Device</a>`;
        html += `<div class="msg-timestamp">${formatTime(msg.timestamp)}</div>`;
        summaryText = `📄 ${msg.filename}`;
    }

    div.innerHTML = html;
    
    // Swipe & Double click
    div.addEventListener('dblclick', () => setReply(msg.id, msg.sender, summaryText));
    let touchStartX = 0;
    div.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
    div.addEventListener('touchend', e => {
        let touchEndX = e.changedTouches[0].screenX;
        if (Math.abs(touchEndX - touchStartX) > 60) setReply(msg.id, msg.sender, summaryText);
    }, {passive: true});
    
    chatMessages.appendChild(div);
    scrollToBottom();
}

function addSystemMessage(text) {
    const div = document.createElement('div');
    div.className = 'system-message';
    div.textContent = text;
    chatMessages.appendChild(div);
    scrollToBottom();
}

function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- Premium Features ---
function parseMarkdown(text) {
    let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;'); // Escape HTML
    html = html.replace(/\*\*([^\*]+)\*\*/g, '<span class="md-bold">$1</span>');
    html = html.replace(/\*([^\*]+)\*/g, '<span class="md-italic">$1</span>');
    html = html.replace(/_([^_]+)_/g, '<span class="md-italic">$1</span>');
    html = html.replace(/`([^`]+)`/g, '<span class="md-code">$1</span>');
    return html;
}

function openLightbox(src) {
    lightboxImg.src = src;
    lightbox.classList.remove('hidden');
}

function closeLightbox() {
    lightbox.classList.add('hidden');
    setTimeout(() => lightboxImg.src = '', 300);
}

btnCloseLightbox.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !lightbox.classList.contains('hidden')) closeLightbox();
});

// Action Buttons
if (btnShareLink) {
    btnShareLink.addEventListener('click', () => {
        if (!currentRoom || currentRoom.id === 'local') return;
        const shareUrl = new URL(window.location.href);
        shareUrl.searchParams.set('pin', currentRoom.id);
        navigator.clipboard.writeText(shareUrl.toString()).then(() => {
            alert('Room link copied to clipboard!');
        });
    });
}

btnDeleteRoom.addEventListener('click', async () => {
    if (!currentRoom || currentRoom.id === 'local') return;
    if (confirm('Are you sure you want to delete this room and all its messages? This cannot be undone.')) {
        await localforage.removeItem(`messages_${currentRoom.id}`);
        await localforage.removeItem(`room_meta_${currentRoom.id}`);
        openRoom({ id: 'local', name: 'Local Scratchpad', isHost: false });
    }
});

// Boot
init();
