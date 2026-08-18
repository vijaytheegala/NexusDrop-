document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Elements ---
    const landingScreen = document.getElementById('landing-screen');
    const waitingScreen = document.getElementById('waiting-screen');
    const chatScreen = document.getElementById('chat-screen');
    
    const btnHost = document.getElementById('btn-host');
    const roomNameInput = document.getElementById('room-name-input');
    const btnJoin = document.getElementById('btn-join');
    const pinInput = document.getElementById('pin-input');
    const connectionStatus = document.getElementById('connection-status');
    const existingRoomsContainer = document.getElementById('existing-rooms-container');
    const storedRoomsList = document.getElementById('stored-rooms-list');
    
    const displayRoomName = document.getElementById('display-room-name');
    const displayPin = document.getElementById('display-pin');
    const btnCancelWaiting = document.getElementById('btn-cancel-waiting');
    
    const chatRoomName = document.getElementById('chat-room-name');
    const chatRoomPin = document.getElementById('chat-room-pin');
    const peerStatus = document.getElementById('peer-status');
    const statusDot = document.querySelector('.status-dot');
    const btnDeleteRoom = document.getElementById('btn-delete-room');
    const btnLeave = document.getElementById('btn-leave');
    
    const chatMessages = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const btnSend = document.getElementById('btn-send');
    const btnAttach = document.getElementById('btn-attach');
    const fileInput = document.getElementById('file-input');

    // --- State Variables ---
    let peer = null;
    let connections = []; // Array of active connections (for host)
    let hostConn = null; // Connection to host (for guest)
    
    let isHost = false;
    let currentRoom = null; // { pin, name, isHost }
    
    const PREFIX = 'hacker-drop-v2-';

    // Initialize localforage
    localforage.config({
        name: 'SecureTerminalDB',
        storeName: 'rooms_and_messages'
    });

    // --- Boot & UI Navigation ---
    await loadStoredRooms();

    function showScreen(screen) {
        landingScreen.classList.remove('active');
        waitingScreen.classList.remove('active');
        chatScreen.classList.remove('active');
        screen.classList.add('active');
    }

    async function loadStoredRooms() {
        const rooms = await localforage.getItem('rooms') || [];
        if (rooms.length > 0) {
            existingRoomsContainer.classList.remove('hidden');
            storedRoomsList.innerHTML = '';
            rooms.forEach(room => {
                const div = document.createElement('div');
                div.className = 'room-item';
                div.innerHTML = `
                    <div><strong>${room.name}</strong> [${room.pin}]</div>
                    <div>${room.isHost ? '(Host)' : '(Guest)'}</div>
                `;
                div.addEventListener('click', () => {
                    resumeRoom(room);
                });
                storedRoomsList.appendChild(div);
            });
        } else {
            existingRoomsContainer.classList.add('hidden');
        }
    }

    function resetApp() {
        if (connections.length > 0) {
            connections.forEach(c => c.close());
            connections = [];
        }
        if (hostConn) {
            hostConn.close();
            hostConn = null;
        }
        if (peer) {
            peer.destroy();
            peer = null;
        }
        chatMessages.innerHTML = '';
        currentRoom = null;
        updateStatus(false, 'WAITING...');
        loadStoredRooms();
        showScreen(landingScreen);
    }

    function updateStatus(online, text) {
        peerStatus.textContent = text;
        if (online) {
            statusDot.classList.add('online');
        } else {
            statusDot.classList.remove('online');
        }
    }

    // --- DB Operations ---
    async function saveRoomToDB(room) {
        let rooms = await localforage.getItem('rooms') || [];
        // prevent duplicate
        if (!rooms.find(r => r.pin === room.pin)) {
            rooms.push(room);
            await localforage.setItem('rooms', rooms);
        }
    }

    async function saveMessageToDB(pin, messageObj) {
        // Ensure timestamp is set
        if (!messageObj.timestamp) messageObj.timestamp = Date.now();
        
        let messages = await localforage.getItem(`messages_${pin}`) || [];
        messages.push(messageObj);
        await localforage.setItem(`messages_${pin}`, messages);
    }

    async function getMessagesFromDB(pin) {
        return await localforage.getItem(`messages_${pin}`) || [];
    }

    async function deleteRoomFromDB(pin) {
        let rooms = await localforage.getItem('rooms') || [];
        rooms = rooms.filter(r => r.pin !== pin);
        await localforage.setItem('rooms', rooms);
        await localforage.removeItem(`messages_${pin}`);
    }

    // --- Core Logic: HOST ---
    async function startHost(roomName) {
        const pin = Math.floor(1000 + Math.random() * 9000).toString();
        currentRoom = { pin, name: roomName, isHost: true, createdAt: Date.now() };
        await saveRoomToDB(currentRoom);
        
        isHost = true;
        initPeerJS(pin);
    }

    async function resumeRoom(room) {
        currentRoom = room;
        isHost = room.isHost;
        
        // Render existing messages immediately
        chatRoomName.textContent = room.name;
        chatRoomPin.textContent = room.pin;
        btnDeleteRoom.classList.toggle('hidden', !isHost);
        chatMessages.innerHTML = '';
        
        const history = await getMessagesFromDB(room.pin);
        history.forEach(msg => renderMessageObj(msg));
        
        showScreen(chatScreen);
        updateStatus(false, isHost ? 'AWAITING_PEERS...' : 'CONNECTING_TO_HOST...');
        
        if (isHost) {
            initPeerJS(room.pin);
        } else {
            initPeerJS(null, room.pin); // random ID for guest
        }
    }

    function initPeerJS(hostPin, connectToPin = null) {
        const peerId = isHost ? `${PREFIX}${hostPin}` : null;
        
        peer = new Peer(peerId, { debug: 2 });

        peer.on('open', (id) => {
            console.log('> PEER_ID_ASSIGNED: ' + id);
            if (isHost && !connectToPin) {
                // Fresh host
                displayRoomName.textContent = currentRoom.name;
                displayPin.textContent = currentRoom.pin;
                if (chatScreen.classList.contains('active')) {
                    // Resuming
                    updateStatus(false, 'AWAITING_PEERS...');
                } else {
                    showScreen(waitingScreen);
                }
            } else if (!isHost) {
                // Guest connecting to host
                const targetId = `${PREFIX}${connectToPin || currentRoom.pin}`;
                hostConn = peer.connect(targetId, { reliable: true });
                setupGuestConnection(hostConn);
            }
        });

        peer.on('connection', (conn) => {
            if (isHost) {
                connections.push(conn);
                setupHostConnection(conn);
            }
        });

        peer.on('error', (err) => {
            console.error(err);
            if (err.type === 'peer-unavailable') {
                if (!isHost) {
                    addSystemMessage('Host is offline. Cannot sync new data.');
                    updateStatus(false, 'HOST_OFFLINE');
                }
            } else if (err.type === 'unavailable-id') {
                alert('PIN already in use globally. Try again.');
                resetApp();
            }
        });
    }

    function setupHostConnection(conn) {
        conn.on('open', async () => {
            updateStatus(true, `PEERS_CONNECTED: ${connections.length}`);
            if (waitingScreen.classList.contains('active')) {
                chatRoomName.textContent = currentRoom.name;
                chatRoomPin.textContent = currentRoom.pin;
                btnDeleteRoom.classList.remove('hidden');
                showScreen(chatScreen);
            }
            addSystemMessage('Guest connected. Syncing database...');
            
            // Sync history to guest
            const history = await getMessagesFromDB(currentRoom.pin);
            conn.send({
                type: 'sync',
                roomName: currentRoom.name,
                messages: history
            });
        });

        conn.on('data', async (data) => {
            if (data.type === 'text' || data.type === 'file') {
                // Guest sent a message. Save it and broadcast to OTHER guests.
                const msgObj = {
                    ...data,
                    sender: 'other',
                    timestamp: Date.now()
                };
                await saveMessageToDB(currentRoom.pin, msgObj);
                renderMessageObj(msgObj);
                
                // Broadcast to other guests
                connections.forEach(c => {
                    if (c !== conn && c.open) c.send(data);
                });
            }
        });

        conn.on('close', () => {
            connections = connections.filter(c => c !== conn);
            updateStatus(connections.length > 0, `PEERS_CONNECTED: ${connections.length}`);
            addSystemMessage('A guest disconnected.');
        });
    }

    function setupGuestConnection(conn) {
        conn.on('open', () => {
            updateStatus(true, 'CONNECTED_TO_HOST');
            if (!chatScreen.classList.contains('active')) {
                chatRoomPin.textContent = currentRoom.pin;
                btnDeleteRoom.classList.add('hidden');
                showScreen(chatScreen);
            }
        });

        conn.on('data', async (data) => {
            if (data.type === 'sync') {
                // Save room details if fresh join
                currentRoom.name = data.roomName;
                chatRoomName.textContent = data.roomName;
                await saveRoomToDB(currentRoom);
                
                // Overwrite local DB with host truth
                await localforage.setItem(`messages_${currentRoom.pin}`, data.messages);
                chatMessages.innerHTML = '';
                data.messages.forEach(msg => renderMessageObj(msg));
                addSystemMessage('Sync complete.');
            } else if (data.type === 'text' || data.type === 'file') {
                // Message from host or another guest
                const msgObj = { ...data, sender: 'other', timestamp: Date.now() };
                await saveMessageToDB(currentRoom.pin, msgObj);
                renderMessageObj(msgObj);
            }
        });

        conn.on('close', () => {
            updateStatus(false, 'HOST_DISCONNECTED');
            addSystemMessage('Host disconnected. You are viewing offline data.');
        });
    }

    // --- Message Handling & UI ---
    async function sendMessage() {
        const text = messageInput.value.trim();
        if (!text) return;
        
        const msgObj = { type: 'text', content: text, sender: 'self', timestamp: Date.now() };
        
        // Save and Render locally
        await saveMessageToDB(currentRoom.pin, msgObj);
        renderMessageObj(msgObj);
        messageInput.value = '';

        // Transmit
        if (isHost) {
            connections.forEach(c => {
                if (c.open) c.send({ type: 'text', content: text });
            });
        } else if (hostConn && hostConn.open) {
            hostConn.send({ type: 'text', content: text });
        } else {
            addSystemMessage('Warning: Host offline. Message saved locally but not transmitted.');
        }
    }

    async function sendFile(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const arrayBuffer = e.target.result;
            const msgObj = {
                type: 'file',
                file: arrayBuffer, // Warning: Storing large arraybuffers in indexeddb can take space
                filename: file.name,
                filetype: file.type,
                sender: 'self',
                timestamp: Date.now()
            };

            await saveMessageToDB(currentRoom.pin, msgObj);
            renderMessageObj(msgObj);

            const payload = {
                type: 'file',
                file: arrayBuffer,
                filename: file.name,
                filetype: file.type
            };

            if (isHost) {
                connections.forEach(c => {
                    if (c.open) c.send(payload);
                });
            } else if (hostConn && hostConn.open) {
                hostConn.send(payload);
            } else {
                addSystemMessage('Warning: Host offline. File saved locally but not transmitted.');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function renderMessageObj(msg) {
        if (msg.type === 'text') {
            renderHTML(msg.content, msg.sender, msg.timestamp);
        } else if (msg.type === 'file') {
            renderFileHTML(msg.file, msg.filename, msg.filetype, msg.sender, msg.timestamp);
        }
    }

    function addSystemMessage(text) {
        const div = document.createElement('div');
        div.className = 'system-message';
        div.textContent = `> ${text}`;
        chatMessages.appendChild(div);
        scrollToBottom();
    }

    function formatTime(ts) {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function renderHTML(text, sender, ts) {
        const div = document.createElement('div');
        div.className = `message ${sender}`;
        div.innerHTML = `
            ${text}
            <div class="msg-timestamp">${formatTime(ts)}</div>
        `;
        chatMessages.appendChild(div);
        scrollToBottom();
    }

    function renderFileHTML(arrayBuffer, filename, filetype, sender, ts) {
        const div = document.createElement('div');
        div.className = `message ${sender}`;
        
        let blob;
        try {
            blob = new Blob([arrayBuffer], { type: filetype });
        } catch (e) {
            // fallback if it somehow got corrupted
            blob = new Blob([], { type: filetype });
        }
        
        const url = URL.createObjectURL(blob);
        
        let contentHtml = `
            <div class="file-message">
                <div class="file-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                </div>
                <div class="file-details">
                    <span class="file-name" title="${filename}">${filename}</span>
                </div>
            </div>
        `;

        if (filetype && filetype.startsWith('image/')) {
            contentHtml += `<img src="${url}" alt="${filename}" class="img-preview">`;
        }

        contentHtml += `<a href="${url}" download="${filename}" class="file-download">[DOWNLOAD]</a>`;
        contentHtml += `<div class="msg-timestamp">${formatTime(ts)}</div>`;

        div.innerHTML = contentHtml;
        chatMessages.appendChild(div);
        scrollToBottom();
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // --- Event Listeners ---
    btnHost.addEventListener('click', () => {
        const name = roomNameInput.value.trim() || 'UNNAMED_ROOM';
        startHost(name);
    });

    btnJoin.addEventListener('click', () => {
        const pin = pinInput.value.trim();
        if (pin.length === 4 && /^\d+$/.test(pin)) {
            currentRoom = { pin, name: 'Joining...', isHost: false, createdAt: Date.now() };
            isHost = false;
            initPeerJS(null, pin);
        } else {
            connectionStatus.textContent = '> ERR: INVALID_PIN_FORMAT';
        }
    });

    btnCancelWaiting.addEventListener('click', () => {
        if (peer) {
            peer.destroy();
            peer = null;
        }
        showScreen(landingScreen);
    });

    btnLeave.addEventListener('click', resetApp);

    btnDeleteRoom.addEventListener('click', async () => {
        if (confirm('WARNING: This will permanently wipe the database for this room. Proceed?')) {
            await deleteRoomFromDB(currentRoom.pin);
            resetApp();
        }
    });

    btnSend.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    btnAttach.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            if (file.size > 20 * 1024 * 1024) {
                alert("> WARNING: FILE EXCEEDS 20MB. PEERJS TRANSFER MAY FAIL.");
            }
            sendFile(file);
            fileInput.value = '';
        }
    });
});
