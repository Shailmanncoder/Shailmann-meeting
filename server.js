const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

// =========================================================
// 1. FILE SYSTEM
// =========================================================
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =========================================================
// 2. ROOM LOGIC (Direct Entry - No Permissions)
// =========================================================
const rooms = {};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // --- HOST: Create Room ---
    socket.on('join-room', ({ roomId, userName }) => {
        // Create room if not exists
        if (!rooms[roomId]) {
            rooms[roomId] = { users: [] };
        }
        socket.join(roomId);
        console.log(`[CREATED] Host ${userName} opened room: ${roomId}`);
    });

    // --- GUEST: Check Room ---
    socket.on('check-room', (roomId, callback) => {
        const roomExists = !!rooms[roomId];
        callback(roomExists);
    });

    // --- GUEST: Join Directly (No Approval Needed) ---
    socket.on('join-room-final', ({ roomId, userName }) => {
        socket.join(roomId);
        // Tell everyone else a new user arrived
        socket.to(roomId).emit('user-connected', socket.id, userName);
        console.log(`[JOIN] ${userName} entered ${roomId} directly`);
    });

    // =========================================================
    // 3. WEBRTC SIGNALING
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

    socket.on('start-screen-share', (roomId) => {
        socket.to(roomId).emit('screen-share-started', socket.id);
    });
    
    socket.on('stop-screen-share', (roomId) => {
        socket.to(roomId).emit('screen-share-stopped');
    });

    socket.on('disconnect', () => {
        io.emit('user-disconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});