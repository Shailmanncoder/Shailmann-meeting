const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');

// --- PATH CONFIGURATION ---
// Point specifically to the 'public' folder based on your structure
const publicPath = path.join(__dirname, 'public');

// --- DEBUGGING (Check if file exists) ---
const indexPath = path.join(publicPath, 'index.html');

if (fs.existsSync(indexPath)) {
    console.log("✅ Success: Found index.html at " + indexPath);
} else {
    console.error("❌ ERROR: Could not find index.html!");
    console.error("Looking in: " + publicPath);
    console.error("Current directory files: ", fs.readdirSync(__dirname));
    // If public folder exists, show its content to help debug
    if (fs.existsSync(publicPath)) {
        console.error("Public folder contents: ", fs.readdirSync(publicPath));
    }
}

// 1. Serve static files from the 'public' folder
app.use(express.static(publicPath));

// 2. Send index.html when user visits the homepage
app.get('/', (req, res) => {
    res.sendFile(indexPath);
});

// --- SOCKET.IO LOGIC (The Brain) ---
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Host Join
    socket.on('join-room', ({ roomId, userName }) => {
        socket.join(roomId);
        socket.isHost = true;
        socket.userName = userName;
        socket.roomId = roomId;
        socket.to(roomId).emit('user-connected', socket.id, userName);
    });

    // Guest Request
    socket.on('request-entry', ({ roomId, userName }) => {
        socket.userName = userName;
        socket.roomId = roomId;
        socket.to(roomId).emit('entry-requested', { socketId: socket.id, userName });
    });

    // Admin Actions
    socket.on('admin-action', ({ action, targetId }) => {
        io.to(targetId).emit(action === 'approve' ? 'entry-approved' : 'entry-denied');
    });

    // Guest Join Final
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
    
    // Disconnect
    socket.on('disconnect', () => {
        if (socket.roomId) socket.to(socket.roomId).emit('user-disconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));