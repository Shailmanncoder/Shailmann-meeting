const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

// =========================================================
// 1. FILE PATHS (Matches your Screenshot)
// =========================================================

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html when opening the site
app.get('/', (req, res) => {
    // This looks inside the 'public' folder for your file
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =========================================================
// 2. ENTRY LOGIC (Fixes the "rtney is not working" issue)
// =========================================================

const rooms = {};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // --- HOST CREATES ROOM ---
    socket.on('join-room', ({ roomId, userName }) => {
        if (!rooms[roomId]) {
            rooms[roomId] = { host: socket.id, users: [] };
        }
        socket.join(roomId);
        console.log(`Host ${userName} created room ${roomId}`);
    });

    // --- GUEST CHECKS IF ROOM EXISTS ---
    socket.on('check-room', (roomId, callback) => {
        // Returns TRUE if room exists, FALSE if not
        const exists = rooms[roomId] ? true : false;
        callback(exists);
    });

    // --- GUEST KNOCKS (Request Entry) ---
    socket.on('request-entry', ({ roomId, userName }) => {
        const room = rooms[roomId];
        if (room && room.host) {
            // Tell the Host someone is knocking
            io.to(room.host).emit('entry-requested', { 
                userName: userName, 
                socketId: socket.id 
            });
        }
    });

    // --- HOST APPROVES/DENIES ---
    socket.on('admin-action', ({ action, targetId }) => {
        if (action === 'approve') {
            io.to(targetId).emit('entry-approved');
        } else {
            io.to(targetId).emit('entry-denied');
        }
    });

    // --- FINAL JOIN (After Approval) ---
    socket.on('join-room-final', ({ roomId, userName }) => {
        socket.join(roomId);
        socket.to(roomId).emit('user-connected', socket.id, userName);
    });

    // --- VIDEO & SCREEN SHARE SIGNALING ---
    socket.on('offer', (o, t, u) => io.to(t).emit('offer', o, socket.id, u));
    socket.on('answer', (a, t) => io.to(t).emit('answer', a, socket.id));
    socket.on('candidate', (c, t) => io.to(t).emit('candidate', c, socket.id));
    
    socket.on('start-screen-share', (roomId) => socket.to(roomId).emit('screen-share-started', socket.id));
    socket.on('stop-screen-share', (roomId) => socket.to(roomId).emit('screen-share-stopped'));

    socket.on('disconnect', () => {
        io.emit('user-disconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});