const PREFIX = 'nexus-drop-room-';

// UI Elements
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
const btnCloseSidebar = document.getElementById('btn-close-sidebar');
const storedRoomsList = document.getElementById('stored-rooms-list');

const initialBootUi = null; // Removed
const bootBtnConnect = null; // Removed
const bootBtnInit = null; // Removed

const dbInitNameInput = document.getElementById('db-init-name-input');
const knownDbsSelect = document.getElementById('known-dbs-select');
const modalRoomPassword = document.getElementById('modal-room-password');
const roomPasswordInput = document.getElementById('room-password-input');
const btnExecuteRoomPassword = document.getElementById('btn-execute-room-password');
const roomPasswordStatus = document.getElementById('room-password-status');

const modalHost = document.getElementById('modal-host');
const modalJoin = document.getElementById('modal-join');
const modalDbInit = document.getElementById('modal-db-init');
const modalDbConnect = document.getElementById('modal-db-connect');

const btnShowHostModal = document.getElementById('btn-show-host-modal');
const btnShowJoinModal = document.getElementById('btn-show-join-modal');
const btnShowDbInit = document.getElementById('btn-show-db-init');
const btnShowDbConnect = document.getElementById('btn-show-db-connect');
const closeModals = document.querySelectorAll('.btn-close-modal');

const hostNameInput = document.getElementById('host-name-input');
const hostPinInput = document.getElementById('host-pin-input');
const btnExecuteHost = document.getElementById('btn-execute-host');
const hostStatus = document.getElementById('host-status');

const joinPinInput = document.getElementById('join-pin-input');
const btnExecuteJoin = document.getElementById('btn-execute-join');
const joinStatus = document.getElementById('join-status');

const dbInitPinInput = document.getElementById('db-init-pin-input');
const btnExecuteDbInit = document.getElementById('btn-execute-db-init');
const dbInitStatus = document.getElementById('db-init-status');

const dbConnectPinInput = document.getElementById('db-connect-pin-input');
const btnExecuteDbConnect = document.getElementById('btn-execute-db-connect');
const dbConnectStatus = document.getElementById('db-connect-status');

// DB Server Dashboard UI
const serverDashboard = document.getElementById('server-dashboard');
const mainChat = document.getElementById('main-chat');
const serverPinDisplay = document.getElementById('server-pin-display');
const serverPeersCount = document.getElementById('server-peers-count');
const serverRoomsCount = document.getElementById('server-rooms-count');
const serverLogs = document.getElementById('server-logs');
const btnShutdownServer = document.getElementById('btn-shutdown-server');

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

// Database Server State
const PREFIX_DB = 'nexus-db-';
let isDbServer = false;
let dbServerPeer = null;
let dbServerConnections = [];
let activeDbClientConn = null; // Used by clients to connect to DB Server
let wakeLock = null;

// The currently open room. Format: { id: 'local' | '1234', name: 'string', isHost: boolean }
let currentRoom = null; 

// --- Boot & Event Listeners ---

function populateKnownDbs() {
    const dbs = JSON.parse(localStorage.getItem('knownDatabases') || '[]');
    if(knownDbsSelect) {
        knownDbsSelect.innerHTML = '<option value="">-- Type New PIN Below --</option>';
        dbs.forEach(db => {
            const opt = document.createElement('option');
            opt.value = db.pin;
            opt.textContent = `${db.name} (${db.pin})`;
            knownDbsSelect.appendChild(opt);
        });
        knownDbsSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                document.getElementById('db-connect-pin-input').value = e.target.value;
            }
        });
    }
}

async function init() {
    if (localStorage.getItem('isDatabaseServer') === 'true') {
        const savedPin = localStorage.getItem('databaseServerPin');
        if (savedPin) {
            mainChat.classList.add('hidden');
            sidebar.classList.remove('open');
            if (sidebarOverlay) sidebarOverlay.classList.add('hidden');
            serverDashboard.classList.remove('hidden');
            serverPinDisplay.textContent = savedPin;
            isDbServer = true;
            requestWakeLock();
            startDbServer(savedPin);
            return; // Halt normal chat initialization
        }
    }
    
    // Boot into standard chat
    openRoom({ id: 'local', name: 'Local Scratchpad', isHost: false });
    refreshSidebar();
    
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
    let roomsFound = 0;

    if (activeDbClientConn && activeDbClientConn.open) {
        // Request rooms from DB server instead of local storage
        activeDbClientConn.send({ cmd: 'GET_ROOMS' });
        // The UI will update when the server responds via 'DB_ROOMS_LIST'
        return; 
    }

    // Local P2P rooms
    const keys = await localforage.keys();
    for (const key of keys) {
        if (key.startsWith('room_meta_')) {
            const meta = await localforage.getItem(key);
            if (meta && meta.id !== 'local') {
                roomsFound++;
                renderSidebarRoom(meta);
            }
        }
    }
    
    if (roomsFound === 0) {
        storedRoomsList.innerHTML = '<div style="font-size:0.8rem; color:var(--text-muted); text-align:center; padding:10px;">No secured rooms yet.</div>';
    }
}

function renderSidebarRoom(meta) {
    const div = document.createElement('div');
    div.className = `room-item ${currentRoom && currentRoom.id === meta.id ? 'active' : ''}`;
    div.innerHTML = `
        <div class="room-item-name">${meta.name}</div>
        <div class="room-item-meta">PIN: ${meta.id} | ${meta.isHost ? 'Host' : 'Guest'}</div>
    `;
    div.addEventListener('click', () => {
        if(modalRoomPassword) {
            modalRoomPassword.classList.remove('hidden');
            roomPasswordStatus.textContent = '';
            roomPasswordInput.value = '';
            roomPasswordInput.focus();
            
            // Handle unlock
            let newBtn = btnExecuteRoomPassword.cloneNode(true);
            btnExecuteRoomPassword.parentNode.replaceChild(newBtn, btnExecuteRoomPassword);
            btnExecuteRoomPassword = newBtn; // Update reference if needed, but safer to use newBtn directly
            
            newBtn.addEventListener('click', () => {
                if (roomPasswordInput.value === meta.id) {
                    modalRoomPassword.classList.add('hidden');
                    openRoom(meta);
                    if (window.innerWidth < 768) toggleSidebar();
                } else {
                    document.getElementById('room-password-status').textContent = 'Incorrect PIN.';
                }
            });
        } else {
            openRoom(meta);
            if (window.innerWidth < 768) toggleSidebar();
        }
    });
    storedRoomsList.appendChild(div);
}

    // Removed local scratchpad init, all logic runs through DB now.
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
        if (activeDbClientConn && activeDbClientConn.open) {
            // Tell DB Server we are entering this room to get sync
            activeDbClientConn.send({ cmd: 'JOIN_ROOM', roomId: roomMeta.id });
            updateStatus('online', 'CONNECTED TO DB SERVER');
        } else {
            // P2P Fallback
            if (roomMeta.isHost) {
                startHosting(roomMeta.id);
            } else {
                startJoining(roomMeta.id);
            }
        }
    }
    
    if (!activeDbClientConn || !activeDbClientConn.open) {
        // Load local chat history if not in DB mode
        const history = await localforage.getItem(`messages_${roomMeta.id}`) || [];
        history.forEach(msg => renderMessageObj(msg));
        scrollToBottom();
    }
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

btnShowDbInit.addEventListener('click', () => {
    modalDbInit.classList.remove('hidden');
    dbInitPinInput.value = '';
    if (window.innerWidth < 768 && sidebar.classList.contains('open')) toggleSidebar();
});

btnShowDbConnect.addEventListener('click', () => {
    modalDbConnect.classList.remove('hidden');
    dbConnectPinInput.value = '';
    populateKnownDbs();
    if (window.innerWidth < 768 && sidebar.classList.contains('open')) toggleSidebar();
});

closeModals.forEach(btn => {
    btn.addEventListener('click', () => {
        modalHost.classList.add('hidden');
        modalJoin.classList.add('hidden');
        modalDbInit.classList.add('hidden');
        modalDbConnect.classList.add('hidden');
        if(modalRoomPassword) modalRoomPassword.classList.add('hidden');
    });
});

// --- Hosting Logic ---
btnExecuteHost.addEventListener('click', () => {
    const name = hostNameInput.value.trim();
    const pin = hostPinInput.value.trim();
    if (!name || pin.length !== 4) return;
    
    const newRoom = { id: pin, name: name, isHost: true };
    modalHost.classList.add('hidden');
    
    if (activeDbClientConn && activeDbClientConn.open) {
        activeDbClientConn.send({ cmd: 'CREATE_ROOM', room: newRoom });
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
        if (activeDbClientConn && activeDbClientConn.open) {
            activeDbClientConn.send({ cmd: 'MSG', roomId: currentRoom.id, msg: msgObj });
        } else if (currentRoom.isHost) {
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
            if (activeDbClientConn && activeDbClientConn.open) {
                activeDbClientConn.send({ cmd: 'MSG', roomId: currentRoom.id, msg: payload });
            } else if (currentRoom.isHost) {
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

// --- DATABASE SERVER LOGIC ---
function logServer(msg) {
    const d = document.createElement('div');
    d.className = 'server-log';
    d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    serverLogs.appendChild(d);
    serverLogs.scrollTop = serverLogs.scrollHeight;
}

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            logServer('Wake Lock acquired. Screen will not sleep.');
            wakeLock.addEventListener('release', () => logServer('Wake Lock released.'));
        } else {
            logServer('Warning: Screen Wake Lock API not supported in this browser.');
        }
    } catch (err) {
        logServer(`Wake Lock Error: ${err.name}, ${err.message}`);
    }
}

btnExecuteDbInit.addEventListener('click', async () => {
    const pin = dbInitPinInput.value.trim();
    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
        dbInitStatus.textContent = 'Please enter a 4-digit Server PIN.';
        return;
    }
    modalDbInit.classList.add('hidden');
    
    // Switch UI to Server Dashboard
    mainChat.classList.add('hidden');
    sidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.add('hidden');
    serverDashboard.classList.remove('hidden');
    serverPinDisplay.textContent = pin;
    
    isDbServer = true;
    localStorage.setItem('isDatabaseServer', 'true');
    localStorage.setItem('databaseServerPin', pin);
    
    requestWakeLock();
    startDbServer(pin);
});

function startDbServer(pin) {
    dbServerPeer = new Peer(PREFIX_DB + pin, { debug: 2 });
    
    dbServerPeer.on('open', async () => {
        logServer(`DAEMON STARTED. Listening on ${PREFIX_DB}${pin}...`);
        // Count total rooms
        const keys = await localforage.keys();
        let rooms = 0;
        keys.forEach(k => { if (k.startsWith('room_meta_')) rooms++; });
        serverRoomsCount.textContent = rooms;
    });
    
    dbServerPeer.on('connection', (conn) => {
        dbServerConnections.push(conn);
        serverPeersCount.textContent = dbServerConnections.length;
        logServer(`Client connected: ${conn.peer}`);
        
        conn.on('data', async (data) => {
            if (data.cmd === 'GET_ROOMS') {
                const keys = await localforage.keys();
                let rooms = [];
                for (let k of keys) {
                    if (k.startsWith('room_meta_')) rooms.push(await localforage.getItem(k));
                }
                conn.send({ type: 'DB_ROOMS_LIST', rooms });
                logServer(`Served global room list to ${conn.peer}`);
            } 
            else if (data.cmd === 'CREATE_ROOM') {
                await localforage.setItem(`room_meta_${data.room.id}`, data.room);
                logServer(`Created new room: ${data.room.name}`);
                const keys = await localforage.keys();
                let count = 0;
                keys.forEach(k => { if (k.startsWith('room_meta_')) count++; });
                serverRoomsCount.textContent = count;
                
                // Broadcast updated room list
                let rooms = [];
                for (let k of keys) {
                    if (k.startsWith('room_meta_')) rooms.push(await localforage.getItem(k));
                }
                dbServerConnections.forEach(c => {
                    if (c.open) c.send({ type: 'DB_ROOMS_LIST', rooms });
                });
            }
            else if (data.cmd === 'JOIN_ROOM') {
                const history = await localforage.getItem(`messages_${data.roomId}`) || [];
                conn.send({ type: 'DB_ROOM_SYNC', roomId: data.roomId, history });
                logServer(`Synced room ${data.roomId} to ${conn.peer}`);
            }
            else if (data.cmd === 'MSG') {
                let messages = await localforage.getItem(`messages_${data.roomId}`) || [];
                messages.push(data.msg);
                await localforage.setItem(`messages_${data.roomId}`, messages);
                
                logServer(`Routed message in room ${data.roomId}`);
                // Broadcast to all
                dbServerConnections.forEach(c => {
                    if (c.open) c.send({ type: 'DB_MSG_BROADCAST', roomId: data.roomId, msg: data.msg });
                });
            }
        });
        
        conn.on('close', () => {
            dbServerConnections = dbServerConnections.filter(c => c !== conn);
            serverPeersCount.textContent = dbServerConnections.length;
            logServer(`Client disconnected: ${conn.peer}`);
        });
    });
}

btnShutdownServer.addEventListener('click', () => {
    if (confirm("Shut down the Database Server? All clients will disconnect.")) {
        localStorage.removeItem('isDatabaseServer');
        localStorage.removeItem('databaseServerPin');
        if (wakeLock !== null) wakeLock.release();
        if (dbServerPeer) dbServerPeer.destroy();
        window.location.reload();
    }
});

// --- DATABASE CLIENT LOGIC ---
btnExecuteDbConnect.addEventListener('click', () => {
    const pin = dbConnectPinInput.value.trim();
    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
        dbConnectStatus.textContent = 'Invalid Server PIN.';
        return;
    }
    
    dbConnectStatus.textContent = 'Connecting...';
    
    // Connect to DB Server
    const tempPeer = new Peer({ debug: 2 });
    
    tempPeer.on('open', () => {
        activeDbClientConn = tempPeer.connect(PREFIX_DB + pin, { reliable: true });
        
        activeDbClientConn.on('open', () => {
            modalDbConnect.classList.add('hidden');
            
            // Save to Known DBs
            const dbs = JSON.parse(localStorage.getItem('knownDatabases') || '[]');
            if(!dbs.some(d => d.pin === pin)) {
                dbs.push({ name: 'Cloud Server', pin: pin });
                localStorage.setItem('knownDatabases', JSON.stringify(dbs));
            }
            
            mainChat.classList.remove('hidden'); // Ensure chat is visible
            alert('Successfully connected to Central Database Server!');
            
            // Fetch Global Rooms
            activeDbClientConn.send({ cmd: 'GET_ROOMS' });
            
            if(btnShowDbConnect) {
                btnShowDbConnect.textContent = `Connected: ${pin}`;
                btnShowDbConnect.style.background = 'var(--primary)';
            }
        });
        
        activeDbClientConn.on('data', async (data) => {
            if (data.type === 'DB_ROOMS_LIST') {
                storedRoomsList.innerHTML = '';
                if (data.rooms.length === 0) {
                    storedRoomsList.innerHTML = '<div style="font-size:0.8rem; color:var(--text-muted); text-align:center; padding:10px;">Database empty.</div>';
                } else {
                    data.rooms.forEach(meta => renderSidebarRoom(meta));
                }
            }
            else if (data.type === 'DB_ROOM_SYNC') {
                if (currentRoom && currentRoom.id === data.roomId) {
                    chatMessages.innerHTML = '';
                    data.history.forEach(msg => {
                        // Ensure sender logic maps correctly if viewing from another client
                        renderMessageObj(msg);
                    });
                    scrollToBottom();
                }
            }
            else if (data.type === 'DB_MSG_BROADCAST') {
                if (currentRoom && currentRoom.id === data.roomId) {
                    if (!document.getElementById(data.msg.id)) {
                        // Force sender to 'other' if we didn't send it. 
                        // Wait, if we sent it, it's already rendered locally with sender='self'. 
                        // So any broadcast we don't have is from 'other'.
                        const incomingMsg = { ...data.msg, sender: 'other' };
                        renderMessageObj(incomingMsg);
                    }
                }
            }
        });
        
        activeDbClientConn.on('close', () => {
            alert("Connection to Database Server lost.");
            window.location.reload();
        });
        
        activeDbClientConn.on('error', () => {
            dbConnectStatus.textContent = 'Connection failed. Is the server online?';
        });
    });
});

// --- THEME CUSTOMIZATION LOGIC ---
const themeSelector = document.getElementById('theme-selector');
const savedTheme = localStorage.getItem('nexusTheme') || 'cyber';
document.documentElement.setAttribute('data-theme', savedTheme);
if (themeSelector) {
    themeSelector.value = savedTheme;
    themeSelector.addEventListener('change', (e) => {
        document.documentElement.setAttribute('data-theme', e.target.value);
        localStorage.setItem('nexusTheme', e.target.value);
    });
}

// Boot
init();
