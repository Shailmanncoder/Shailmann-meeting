const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
const path = require('path');
const fs = require('fs');

// --- PATH FINDING ---
let clientPath = path.join(__dirname, 'public');
if (!fs.existsSync(path.join(clientPath, 'index.html'))) {
    clientPath = __dirname;
}
app.use(express.static(clientPath));
app.get('/', (req, res) => res.sendFile(path.join(clientPath, 'index.html')));

// --- SOCKET LOGIC ---
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // --- NEW: VALIDATE ROOM EXISTENCE ---
    socket.on('check-room', (roomId, callback) => {
        // io.sockets.adapter.rooms is a Map of all active rooms
        const room = io.sockets.adapter.rooms.get(roomId);
        // If room exists and has at least 1 person (the host), return true
        if (room && room.size > 0) {
            callback(true);
        } else {
            callback(false);
        }
    });

    // Host Join
    socket.on('join-room', ({ roomId, userName }) => {
        socket.join(roomId);
        socket.isHost = true;
        socket.userName = userName;
        socket.roomId = roomId;
        console.log(`Host ${userName} created room ${roomId}`);
    });

    // Guest Request
    socket.on('request-entry', ({ roomId, userName }) => {
        console.log(`Guest ${userName} knocking on ${roomId}`);
        socket.to(roomId).emit('entry-requested', { socketId: socket.id, userName });
    });

    // Admin Action
    socket.on('admin-action', ({ action, targetId }) => {
        io.to(targetId).emit(action === 'approve' ? 'entry-approved' : 'entry-denied');
    });

    // Guest Final Join
    socket.on('join-room-final', ({ roomId, userName }) => {
        socket.join(roomId);
        socket.to(roomId).emit('user-connected', socket.id, userName);
    });

    // WebRTC & Utilities
    socket.on('offer', (p, t, n) => io.to(t).emit('offer', p, socket.id, n));
    socket.on('answer', (p, t) => io.to(t).emit('answer', p, socket.id));
    socket.on('candidate', (c, t) => io.to(t).emit('candidate', c, socket.id));
    socket.on('start-screen-share', (r) => socket.to(r).emit('screen-share-started', socket.id));
    socket.on('stop-screen-share', (r) => socket.to(r).emit('screen-share-stopped'));
    socket.on('chat-message', ({ roomId, msg, sender }) => socket.to(roomId).emit('chat-message', { msg, sender }));
    socket.on('reaction', ({ roomId, emoji }) => socket.to(roomId).emit('reaction', emoji));

    socket.on('disconnect', () => {
        if (socket.roomId) socket.to(socket.roomId).emit('user-disconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));