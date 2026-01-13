const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// 1. Serve the HTML file
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 2. WebSocket Logic (The Brain)
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // --- HOST JOINS ---
    socket.on('join-room', ({ roomId, userName, isHost }) => {
        socket.join(roomId);
        // Identify this socket as a host
        socket.isHost = true;
        socket.userName = userName;
        socket.roomId = roomId;
        
        // Tell others in room (if any) that user connected
        socket.to(roomId).emit('user-connected', socket.id, userName);
    });

    // --- GUEST REQUESTS ENTRY (Knocking) ---
    socket.on('request-entry', ({ roomId, userName }) => {
        // We store these details on the socket temporarily
        socket.userName = userName;
        socket.roomId = roomId;

        // Send the request ONLY to people already in the room (The Host)
        socket.to(roomId).emit('entry-requested', {
            socketId: socket.id,
            userName: userName
        });
    });

    // --- HOST APPROVES/DENIES ---
    socket.on('admin-action', ({ action, targetId }) => {
        if (action === 'approve') {
            io.to(targetId).emit('entry-approved');
        } else {
            io.to(targetId).emit('entry-denied');
        }
    });

    // --- GUEST FINALLY JOINS (After Approval) ---
    socket.on('join-room-final', ({ roomId, userName }) => {
        socket.join(roomId);
        socket.to(roomId).emit('user-connected', socket.id, userName);
    });

    // --- SIGNALING (WebRTC - Video/Audio exchange) ---
    socket.on('offer', (payload, targetId, name) => {
        io.to(targetId).emit('offer', payload, socket.id, name);
    });

    socket.on('answer', (payload, targetId) => {
        io.to(targetId).emit('answer', payload, socket.id);
    });

    socket.on('candidate', (candidate, targetId) => {
        io.to(targetId).emit('candidate', candidate, socket.id);
    });

    // --- SCREEN SHARING STATUS ---
    socket.on('start-screen-share', (roomId) => {
        socket.to(roomId).emit('screen-share-started', socket.id);
    });

    socket.on('stop-screen-share', (roomId) => {
        socket.to(roomId).emit('screen-share-stopped');
    });

    // --- DISCONNECT ---
    socket.on('disconnect', () => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('user-disconnected', socket.id);
        }
    });
});

// 3. Start Server on Port 3000
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});