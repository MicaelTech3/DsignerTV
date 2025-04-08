// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBhj6nv3QcIHyuznWPNM4t_0NjL0ghMwFw",
    authDomain: "dsignertv.firebaseapp.com",
    databaseURL: "https://dsignertv-default-rtdb.firebaseio.com",
    projectId: "dsignertv",
    storageBucket: "dsignertv.firebasestorage.app",
    messagingSenderId: "930311416952",
    appId: "1:930311416952:web:d0e7289f0688c46492d18d"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Anonymous Authentication

    // Se você usa Firebase Auth:
firebase.auth().onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = "/index.html"; // Redireciona se não estiver logado
    }
  });

// Database Reference
const db = firebase.database();

// DOM Elements
const elements = {
    generatorMode: document.getElementById('generator-mode'),
    playerMode: document.getElementById('player-mode'),
    activationKey: document.getElementById('activation-key'),
    viewBtn: document.getElementById('view-btn'),
    generateNewKeyBtn: document.getElementById('generate-new-key'),
    exitBtn: document.getElementById('exit-btn'),
    mediaInfo: document.getElementById('media-info'),
    playerStatus: document.getElementById('player-status'),
    mediaDisplay: document.getElementById('media-display')
};

// State Variables
let currentKey = loadKey();
let unsubscribe = null;
let showInfo = false;
let currentMedia = null;

// Initial Setup
elements.activationKey.textContent = currentKey;
updateGenStatus('Ready to use', 'online');

// Event Listeners
elements.viewBtn.addEventListener('click', toggleViewMode);
elements.generateNewKeyBtn.addEventListener('click', generateNewKey);
document.addEventListener('keydown', handleKeyboardShortcuts);
elements.playerMode.addEventListener('mousemove', showExitButton);
elements.exitBtn.addEventListener('click', exitPlayerMode);

// Utility Functions
function loadKey() {
    let key = localStorage.getItem('deviceKey');
    if (!key) {
        key = generateKey();
        localStorage.setItem('deviceKey', key);
    }
    return key;
}

function generateKey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let key = '';
    for (let i = 0; i < 8; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
}

function generateNewKey() {
    currentKey = generateKey();
    localStorage.setItem('deviceKey', currentKey);
    elements.activationKey.textContent = currentKey;
    stopListening();
}

function toggleViewMode() {
    if (elements.playerMode.style.display === 'none') {
        enterPlayerMode();
    } else {
        exitPlayerMode();
    }
}

function enterPlayerMode() {
    elements.generatorMode.style.display = 'none';
    elements.playerMode.style.display = 'block';
    elements.viewBtn.textContent = 'Return to Generator';
    initPlayerMode(currentKey);
    enterFullscreen();
}

function exitPlayerMode() {
    exitFullscreen();
    elements.playerMode.style.display = 'none';
    elements.generatorMode.style.display = 'flex';
    elements.viewBtn.textContent = 'View Content';
    stopListening();
}

function enterFullscreen() {
    const element = document.documentElement;
    if (element.requestFullscreen) element.requestFullscreen();
    else if (element.mozRequestFullScreen) element.mozRequestFullScreen();
    else if (element.webkitRequestFullscreen) element.webkitRequestFullscreen();
    else if (element.msRequestFullscreen) element.msRequestFullscreen();

    document.body.classList.add('fullscreen-mode');
    showInfo = false;
    updateInfoVisibility();
}

function exitFullscreen() {
    if (document.fullscreenElement || document.mozFullScreenElement || 
        document.webkitFullscreenElement || document.msFullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
    }

    document.body.classList.remove('fullscreen-mode');
    showInfo = true;
    updateInfoVisibility();
}

function updateInfoVisibility() {
    elements.mediaInfo.style.display = showInfo ? 'block' : 'none';
    elements.playerStatus.style.display = showInfo ? 'block' : 'none';
}

function updateGenStatus(message, status) {
    const el = document.getElementById('gen-status');
    el.textContent = message;
    el.className = `connection-status ${status}`;
}

function updatePlayerStatus(message, status) {
    const el = document.getElementById('player-status');
    el.textContent = message;
    el.className = `connection-status ${status}`;
}

function stopListening() {
    if (unsubscribe) {
        db.ref('midia/' + currentKey).off('value', unsubscribe);
        unsubscribe = null;
    }
    clearMedia();
}

function clearMedia() {
    elements.mediaDisplay.innerHTML = '';
    currentMedia = null;
}

// Player Mode Functions
function initPlayerMode(key) {
    updatePlayerStatus('Connecting...', 'offline');
    showInfo = false;
    updateInfoVisibility();

    // Setup network event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Start listening for media updates
    startListening(key);
}

function handleOnline() {
    updatePlayerStatus('✔ Online', 'online');
    if (!unsubscribe) startListening(currentKey);
}

function handleOffline() {
    updatePlayerStatus('⚡ Offline', 'offline');
}

function startListening(key) {
    console.log('Starting to listen for activationKey:', key);
    updatePlayerStatus('Connecting...', 'offline');

    // Stop any previous listener
    stopListening();

    unsubscribe = db.ref('midia/' + key).on('value', handleMediaUpdate, handleConnectionError);
}

function handleMediaUpdate(snapshot) {
    const data = snapshot.val();
    if (data) {
        console.log('Data received from Realtime Database:', data);
        
        const mediaData = {
            type: data.tipo,
            url: data.url,
            content: data.content,
            loop: data.loop || false,
            duration: data.duration || 10,
            color: data.color || '#ffffff',
            bgColor: data.bgColor || '#000000',
            fontSize: data.fontSize || '24px'
        };

        updateDisplay({
            name: currentKey,
            media: mediaData
        });
        
        updatePlayerStatus('✔ Synchronized', 'online');
    } else {
        showError('No media found for this key');
    }
}

function handleConnectionError(error) {
    console.error('Connection error:', error);
    updatePlayerStatus('Connection error', 'offline');
}

function updateDisplay(tvData) {
    clearMedia();
    
    if (!tvData.media) {
        showError('Waiting for content...');
        return;
    }

    elements.mediaInfo.textContent = `TV ${tvData.name || 'No name'} • ${new Date().toLocaleTimeString()}`;

    console.log('Displaying media:', tvData.media);

    try {
        if (tvData.media.type === 'text') {
            displayText(tvData.media);
        } 
        else if (tvData.media.type === 'image') {
            displayImage(tvData.media);
        } 
        else if (tvData.media.type === 'video') {
            displayVideo(tvData.media);
        }
    } catch (error) {
        console.error('Error displaying media:', error);
        showError('Error displaying content');
    }
}

function displayText(media) {
    const textEl = document.createElement('div');
    textEl.className = 'text-message';
    textEl.style.color = media.color;
    textEl.style.backgroundColor = media.bgColor;
    textEl.style.fontSize = media.fontSize;
    textEl.textContent = media.content;
    
    elements.mediaDisplay.appendChild(textEl);
    currentMedia = textEl;
}

function displayImage(media) {
    const imgEl = document.createElement('img');
    imgEl.src = media.url;
    imgEl.style.maxWidth = '100%';
    imgEl.style.maxHeight = '100%';
    imgEl.style.objectFit = 'contain';
    
    imgEl.onerror = () => {
        console.error('Error loading image:', media.url);
        showError('Error loading the image');
    };
    
    imgEl.onload = () => {
        console.log('Image loaded successfully');
        // Set timeout for image duration if specified
        if (media.duration) {
            setTimeout(() => {
                if (currentMedia === imgEl) {
                    elements.mediaDisplay.innerHTML = '';
                }
            }, media.duration * 1000);
        }
    };
    
    elements.mediaDisplay.appendChild(imgEl);
    currentMedia = imgEl;
}

function displayVideo(media) {
    // Check if it's a YouTube URL
    if (media.url.includes('youtube.com') || media.url.includes('youtu.be')) {
        displayYouTubeVideo(media);
    } else {
        displayHTML5Video(media);
    }
}

function displayYouTubeVideo(media) {
    const videoId = media.url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1];
    if (!videoId) {
        showError('Invalid YouTube URL');
        return;
    }

    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&loop=${media.loop ? 1 : 0}&playlist=${videoId}`;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.frameBorder = '0';
    iframe.allow = 'autoplay; encrypted-media';
    iframe.allowfullscreen = true;
    
    elements.mediaDisplay.appendChild(iframe);
    currentMedia = iframe;
}

function displayHTML5Video(media) {
    const videoEl = document.createElement('video');
    videoEl.src = media.url;
    videoEl.controls = false;
    videoEl.autoplay = true;
    videoEl.loop = media.loop;
    videoEl.style.width = '100%';
    videoEl.style.height = '100%';
    videoEl.style.objectFit = 'contain';
    
    // Add event listeners for better error handling
    videoEl.addEventListener('error', (e) => {
        console.error('Video error:', videoEl.error);
        showError('Error loading the video');
    });
    
    videoEl.addEventListener('canplay', () => {
        console.log('Video can play');
        videoEl.play().catch(e => console.error('Playback error:', e));
    });
    
    videoEl.addEventListener('playing', () => {
        console.log('Video is playing');
    });
    
    elements.mediaDisplay.appendChild(videoEl);
    currentMedia = videoEl;
}

function showError(message) {
    elements.mediaDisplay.innerHTML = `<div class="error-message">${message}</div>`;
}

function handleKeyboardShortcuts(e) {
    if (e.key === 'i' || e.key === 'I') {
        showInfo = !showInfo;
        updateInfoVisibility();
    } else if (e.key === 'Escape' && elements.playerMode.style.display !== 'none') {
        exitPlayerMode();
    }
}

function showExitButton() {
    if (document.body.classList.contains('fullscreen-mode')) {
        elements.exitBtn.style.display = 'block';
        setTimeout(() => elements.exitBtn.style.display = 'none', 2000);
    }
}

// CSS for error messages
const style = document.createElement('style');
style.textContent = `
    .error-message {
        color: #ff5555;
        font-size: 24px;
        text-align: center;
        padding: 20px;
    }
    .text-message {
        padding: 20px;
        border-radius: 10px;
        max-width: 80%;
        margin: 0 auto;
        text-align: center;
        word-break: break-word;
    }
    #media-display {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    video, img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
    }
`;
document.head.appendChild(style);