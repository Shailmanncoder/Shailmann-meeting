const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

// =========================================================
// 1. FILE SYSTEM (Fixes "ENOENT" error)
// =========================================================
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =========================================================
// 2. ROOM & ENTRY LOGIC (Fixes "Not Joining" error)
// =========================================================
const rooms = {};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // --- HOST: Creates the Room ---
    socket.on('join-room', ({ roomId, userName }) => {
        // Force create the room structure in memory
        rooms[roomId] = { host: socket.id, users: [] };
        socket.join(roomId);
        console.log(`[CREATED] Host ${userName} opened room: ${roomId}`);
    });

    // --- GUEST: Step 1 - Check if Room Exists ---
    socket.on('check-room', (roomId, callback) => {
        const roomExists = !!rooms[roomId]; // Returns true or false
        console.log(`[CHECK] Room ${roomId} exists? ${roomExists}`);
        // Send answer back to the specific client button
        if (callback) callback(roomExists);
    });

    // --- GUEST: Step 2 - Knock on Door ---
    socket.on('request-entry', ({ roomId, userName }) => {
        const room = rooms[roomId];
        if (room && room.host) {
            console.log(`[KNOCK] ${userName} is waiting for ${roomId}`);
            // Alert ONLY the Host
            io.to(room.host).emit('entry-requested', { 
                userName: userName, 
                socketId: socket.id 
            });
        }
    });

    // --- HOST: Step 3 - Approve or Deny ---
    socket.on('admin-action', ({ action, targetId }) => {
        if (action === 'approve') {
            console.log(`[APPROVE] Admitting user ${targetId}`);
            io.to(targetId).emit('entry-approved');
        } else {
            console.log(`[DENY] User ${targetId} rejected`);
            io.to(targetId).emit('entry-denied');
        }
    });

    // --- GUEST: Step 4 - Enter Room (After Approval) ---
    socket.on('join-room-final', ({ roomId, userName }) => {
        socket.join(roomId);
        // Notify others for video connection
        socket.to(roomId).emit('user-connected', socket.id, userName);
        console.log(`[JOIN] ${userName} entered ${roomId}`);
    });

    // =========================================================
    // 3. WEBRTC SIGNALING (For Video/Audio)
    // =========================================================
    socket.on('offer', (payload, targetId, name) => {
        io.to(targetId).emit('offer', payload, socket.id, name);
    });

    socket.on('answer', (payload, targetId) => {
        io.to(targetId).emit('answer', payload, socket.id);
    });

    socket.on('candidate', (candidate, targetId) => {
        io.to(targetId).emit('candidate', candidate, socket.id);
    });

    socket.on('disconnect', () => {
        // Clean up rooms if needed (optional advanced logic)
        io.emit('user-disconnected', socket.id);
    });
});

// Start Server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});