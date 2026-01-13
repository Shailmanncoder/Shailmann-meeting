const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

// Serve your HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Store room details: { "MEET-123": { host: "socketId", users: [] } }
const rooms = {};

io.on('connection', (socket) => {
    
    // 1. HOST CREATES ROOM
    socket.on('join-room', ({ roomId, userName }) => {
        // If room doesn't exist, create it and make this socket the HOST
        if (!rooms[roomId]) {
            rooms[roomId] = { host: socket.id, users: [] };
        }
        
        // Host joins immediately
        socket.join(roomId);
        console.log(`Host ${userName} created room ${roomId}`);
    });

    // 2. GUEST CHECKS IF ROOM EXISTS (The "rtney" / Entry check)
    socket.on('check-room', (roomId, callback) => {
        const exists = rooms[roomId] ? true : false;
        // Send true/false back to the frontend button
        callback(exists); 
    });

    // 3. GUEST KNOCKS (Request Entry)
    socket.on('request-entry', ({ roomId, userName }) => {
        const room = rooms[roomId];
        if (room && room.host) {
            // Send the knock request ONLY to the Host
            io.to(room.host).emit('entry-requested', { 
                userName: userName, 
                socketId: socket.id // Send guest's ID so host knows who to admit
            });
        }
    });

    // 4. HOST DECIDES (Admit or Deny)
    socket.on('admin-action', ({ action, targetId }) => {
        if (action === 'approve') {
            // Tell the specific guest they are approved
            io.to(targetId).emit('entry-approved');
        } else {
            // Tell the specific guest they are denied
            io.to(targetId).emit('entry-denied');
        }
    });

    // 5. GUEST FINALLY JOINS (After Approval)
    socket.on('join-room-final', ({ roomId, userName }) => {
        socket.join(roomId);
        // Tell everyone else in the room a new user arrived
        socket.to(roomId).emit('user-connected', socket.id, userName);
    });

    // --- STANDARD WEBRTC SIGNALING (Video/Audio) ---
    socket.on('offer', (offer, targetId, userName) => {
        io.to(targetId).emit('offer', offer, socket.id, userName);
    });
    
    socket.on('answer', (answer, targetId) => {
        io.to(targetId).emit('answer', answer, socket.id);
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
        // Clean up logic would go here
        io.emit('user-disconnected', socket.id);
    });
});

http.listen(3000, () => {
    console.log('Server running on port 3000');
});