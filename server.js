const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

app.use(express.static('public'));

// Store room details
const rooms = {};

io.on('connection', (socket) => {
    
    // 1. Host creates a room
    socket.on('create-room', (roomId, hostName) => {
        if (rooms[roomId]) {
            socket.emit('error', 'Room already exists');
            return;
        }
        rooms[roomId] = { host: socket.id, users: [], name: roomId };
        socket.join(roomId);
        socket.emit('room-created', roomId);
        console.log(`Room created: ${roomId} by ${hostName}`);
    });

    // 2. Guest knocks to join
    socket.on('knock-room', (roomId, guestName) => {
        const room = rooms[roomId];
        if (room) {
            // Notify the host that someone is knocking
            io.to(room.host).emit('knocking', { socketId: socket.id, name: guestName });
        } else {
            socket.emit('error', 'Room not found');
        }
    });

    // 3. Host responds to knock
    socket.on('respond-knock', ({ socketId, action }) => {
        if (action === 'accept') {
            io.to(socketId).emit('access-granted');
        } else {
            io.to(socketId).emit('access-denied');
        }
    });

    // 4. Guest officially joins after approval
    socket.on('join-room', (roomId, userId) => {
        socket.join(roomId);
        socket.to(roomId).emit('user-connected', userId);
        
        socket.on('disconnect', () => {
            socket.to(roomId).emit('user-disconnected', userId);
        });
    });
});

server.listen(3000, () => {
    console.log('Meeting server running on port 3000');
});