const socket = io('/');
const peer = new Peer(undefined, { host: '/', port: 3001 }); // You'll need PeerJS server
const myVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');

let myStream;
let currentPendingSocketId = null;
let mediaRecorder;
let recordedChunks = [];

// --- 1. SETUP VIDEO ---
navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
    myStream = stream;
    addVideoStream(myVideo, stream);

    peer.on('call', call => {
        call.answer(stream);
        call.on('stream', userVideoStream => {
            addVideoStream(remoteVideo, userVideoStream);
        });
    });

    socket.on('user-connected', userId => {
        connectToNewUser(userId, stream);
    });
});

// --- 2. HOST & KNOCK LOGIC ---
function createRoom() {
    const name = document.getElementById('username').value;
    const roomId = document.getElementById('room-input').value;
    if(!name || !roomId) return alert("Enter name and Room ID");
    
    socket.emit('create-room', roomId, name);
}

socket.on('room-created', (roomId) => {
    enterMeetingRoom();
});

function knockRoom() {
    const name = document.getElementById('username').value;
    const roomId = document.getElementById('room-input').value;
    if(!name || !roomId) return alert("Enter name and Room ID");

    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('waiting-screen').classList.remove('hidden');
    
    socket.emit('knock-room', roomId, name);
}

// Host receives knock
socket.on('knocking', ({ socketId, name }) => {
    document.getElementById('knock-notification').classList.remove('hidden');
    document.getElementById('knocker-name').innerText = name;
    currentPendingSocketId = socketId;
});

function acceptKnock() {
    socket.emit('respond-knock', { socketId: currentPendingSocketId, action: 'accept' });
    document.getElementById('knock-notification').classList.add('hidden');
}

// Guest receives response
socket.on('access-granted', () => {
    const roomId = document.getElementById('room-input').value;
    enterMeetingRoom();
    socket.emit('join-room', roomId, peer.id);
});

socket.on('access-denied', () => {
    alert("Host denied your request.");
    location.reload();
});


// --- 3. MEETING FEATURES ---

function enterMeetingRoom() {
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('waiting-screen').classList.add('hidden');
    document.getElementById('meeting-screen').classList.remove('hidden');
}

function connectToNewUser(userId, stream) {
    const call = peer.call(userId, stream);
    call.on('stream', userVideoStream => {
        addVideoStream(remoteVideo, userVideoStream);
    });
}

function addVideoStream(video, stream) {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    });
}

// Screen Sharing (Disappears local video)
async function shareScreen() {
    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ cursor: true });
        // Replace video track in peer connection
        const screenTrack = screenStream.getVideoTracks()[0];
        
        // Logic to switch track for all peers would go here
        // For local view:
        addVideoStream(myVideo, screenStream);
        document.getElementById('local-video-wrapper').style.width = "50px"; // Make self very small
        
        screenTrack.onended = function() {
            addVideoStream(myVideo, myStream); // Switch back to camera
            document.getElementById('local-video-wrapper').style.width = "150px";
        };
    } catch (err) {
        console.error("Error sharing screen", err);
    }
}

// Recording
function startRecording() {
    recordedChunks = [];
    // Record the remote stream (or mixed stream)
    const stream = remoteVideo.srcObject || myStream; 
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) recordedChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'meeting-recording.webm';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
    };

    mediaRecorder.start();
    alert("Recording started...");
    
    // Stop recording after 10 seconds for testing (toggle logic needed for real app)
    setTimeout(() => { mediaRecorder.stop(); alert("Recording saved!"); }, 10000); 
}