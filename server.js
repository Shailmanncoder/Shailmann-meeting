const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

// Serve the static HTML file
app.use(express.static(path.join(__dirname, 'public')));

// If user goes to "/", send the index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- SOCKET.IO SIGNALING LOGIC ---
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // 1. HOST JOINING
    socket.on('join-room', (data) => {
        const { roomId, userName, isHost } = data;
        socket.join(roomId);
        
        // Notify others in room that a user connected
        socket.to(roomId).emit('user-connected', socket.id, userName);
        
        // Tag this socket as host for security (optional enhancement)
        socket.isHost = isHost;
    });

    // 2. GUEST REQUESTING ENTRY
    socket.on('request-entry', (data) => {
        const { roomId, userName } = data;
        // Broadcast this request to everyone in the room (The Host will pick it up)
        socket.to(roomId).emit('entry-requested', { 
            socketId: socket.id, 
            userName: userName 
        });
    });

    // 3. ADMIN (HOST) ACTIONS
    socket.on('admin-action', (data) => {
        const { action, targetId } = data;
        if (action === 'approve') {
            io.to(targetId).emit('entry-approved');
        } else if (action === 'deny') {
            io.to(targetId).emit('entry-denied');
        }
    });

    // 4. GUEST FINAL JOIN (After Approval)
    socket.on('join-room-final', (data) => {
        const { roomId, userName } = data;
        socket.join(roomId);
        socket.to(roomId).emit('user-connected', socket.id, userName);
    });

    // 5. WEBRTC SIGNALING (Offer, Answer, ICE Candidates)
    socket.on('offer', (offer, targetId, userName) => {
        io.to(targetId).emit('offer', offer, socket.id, userName);
    });

    socket.on('answer', (answer, targetId) => {
        io.to(targetId).emit('answer', answer, socket.id);
    });

    socket.on('candidate', (candidate, targetId) => {
        io.to(targetId).emit('candidate', candidate, socket.id);
    });

    // 6. SCREEN SHARE STATE
    socket.on('start-screen-share', (roomId) => {
        socket.to(roomId).emit('screen-share-started', socket.id);
    });

    socket.on('stop-screen-share', (roomId) => {
        socket.to(roomId).emit('screen-share-stopped');
    });

    // 7. DISCONNECT
    socket.on('disconnect', () => {
        // Notify everyone this user left so they can remove the video
        io.emit('user-disconnected', socket.id);
    });
});

// Start Server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});