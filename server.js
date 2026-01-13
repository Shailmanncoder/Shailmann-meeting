const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve the HTML file from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// STATE MANAGEMENT
// In a real enterprise app, use a database (Redis/MongoDB).
// For this standalone version, we use memory.
const rooms = {}; // { roomId: { hostId: 'socket-id', users: [] } }

io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    // --- 1. HOSTING LOGIC ---
    socket.on('join-room', ({ roomId, userName }) => {
        // Create the room if it doesn't exist
        if (!rooms[roomId]) {
            rooms[roomId] = { hostId: socket.id, users: [] };
            console.log(`Room Created: ${roomId} by Host: ${userName}`);
        }
        
        // Host joins immediately
        socket.join(roomId);
        rooms[roomId].users.push(socket.id);
        
        // Notify others
        socket.to(roomId).emit('user-connected', socket.id, userName);
    });

    // --- 2. GUEST / WAITING ROOM LOGIC ---
    
    // Check if room exists before letting guest knock
    socket.on('check-room', (roomId, callback) => {
        const exists = !!rooms[roomId];
        callback(exists);
    });

    // Guest "Knocks" on the door
    socket.on('request-entry', ({ roomId, userName }) => {
        const room = rooms[roomId];
        if (room && room.hostId) {
            // Tell the Host (and only the Host) that someone is waiting
            io.to(room.hostId).emit('entry-requested', { 
                socketId: socket.id, 
                userName: userName 
            });
        }
    });

    // Host Approves or Denies
    socket.on('admin-action', ({ action, targetId }) => {
        if (action === 'approve') {
            io.to(targetId).emit('entry-approved');
        } else {
            io.to(targetId).emit('entry-denied');
        }
    });

    // Guest actually joins after approval
    socket.on('join-room-final', ({ roomId, userName }) => {
        socket.join(roomId);
        if (rooms[roomId]) rooms[roomId].users.push(socket.id);
        
        // Notify everyone else in the room
        socket.to(roomId).emit('user-connected', socket.id, userName);
    });

    // --- 3. WEBRTC SIGNALING (The Video Connection) ---
    // These events simply relay data between Peer A and Peer B
    
    socket.on('offer', (offer, targetId, userName) => {
        io.to(targetId).emit('offer', offer, socket.id, userName);
    });

    socket.on('answer', (answer, targetId) => {
        io.to(targetId).emit('answer', answer, socket.id);
    });

    socket.on('candidate', (candidate, targetId) => {
        io.to(targetId).emit('candidate', candidate, socket.id);
    });

    // --- 4. SCREEN SHARING NOTIFICATIONS ---
    socket.on('start-screen-share', (roomId) => {
        socket.to(roomId).emit('screen-share-started', socket.id);
    });

    socket.on('stop-screen-share', (roomId) => {
        socket.to(roomId).emit('screen-share-stopped');
    });

    // --- 5. DISCONNECT CLEANUP ---
    socket.on('disconnect', () => {
        // Remove user from all rooms they were in
        for (const roomId in rooms) {
            const room = rooms[roomId];
            if (room.users.includes(socket.id)) {
                // Remove from user list
                room.users = room.users.filter(id => id !== socket.id);
                
                // Notify others they left
                socket.to(roomId).emit('user-disconnected', socket.id);
                
                // If Host left, maybe close room? (Optional)
                if (socket.id === room.hostId) {
                    // For now, we just keep the room open or logic could be added to close it
                    console.log(`Host left room ${roomId}`);
                }
            }
            // Cleanup empty rooms
            if (room.users.length === 0) {
                delete rooms[roomId];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n🚀 Shailmann Connect Server running on http://localhost:${PORT}`);
});