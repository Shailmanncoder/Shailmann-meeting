const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const path = require('path');
const fs = require('fs');

// --- SMART PATH FINDING ---
// Checks if 'public' folder exists, otherwise uses root
let clientPath = path.join(__dirname, 'public');
if (!fs.existsSync(path.join(clientPath, 'index.html'))) {
    clientPath = __dirname;
}

app.use(express.static(clientPath));

app.get('/', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
});

// --- SOCKET LOGIC ---
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // --- CRITICAL FIX: ROOM CHECK ---
    socket.on('check-room', (roomId, callback) => {
        // Get all rooms from the adapter
        const rooms = io.sockets.adapter.rooms;
        // Check if the specific room exists
        const roomExists = rooms.has(roomId);
        callback(roomExists);
    });

    // Host Creates Room
    socket.on('join-room', ({ roomId, userName }) => {
        socket.join(roomId);
        socket.isHost = true;
        socket.userName = userName;
        socket.roomId = roomId;
        console.log(`HOST ${userName} created room: ${roomId}`);
    });

    // Guest Knocks
    socket.on('request-entry', ({ roomId, userName }) => {
        console.log(`GUEST ${userName} knocking on ${roomId}`);
        socket.to(roomId).emit('entry-requested', { socketId: socket.id, userName });
    });

    // Host Responds (Admit/Deny)
    socket.on('admin-action', ({ action, targetId }) => {
        io.to(targetId).emit(action === 'approve' ? 'entry-approved' : 'entry-denied');
    });

    // Guest Enters (After Approval)
    socket.on('join-room-final', ({ roomId, userName }) => {
        socket.join(roomId);
        socket.to(roomId).emit('user-connected', socket.id, userName);
    });

    // WebRTC Signaling
    socket.on('offer', (payload, target, name) => io.to(target).emit('offer', payload, socket.id, name));
    socket.on('answer', (payload, target) => io.to(target).emit('answer', payload, socket.id));
    socket.on('candidate', (cand, target) => io.to(target).emit('candidate', cand, socket.id));

    // Screen Share & Chat
    socket.on('start-screen-share', (roomId) => socket.to(roomId).emit('screen-share-started', socket.id));
    socket.on('stop-screen-share', (roomId) => socket.to(roomId).emit('screen-share-stopped'));
    socket.on('chat-message', ({ roomId, msg, sender }) => socket.to(roomId).emit('chat-message', { msg, sender }));
    socket.on('reaction', ({ roomId, emoji }) => socket.to(roomId).emit('reaction', emoji));

    socket.on('disconnect', () => {
        if (socket.roomId) socket.to(socket.roomId).emit('user-disconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));