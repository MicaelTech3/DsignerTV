const firebaseConfig = {
    apiKey: "AIzaSyBhj6nv3QcIHyuznWPNM4t_0NjL0ghMwFw",
    authDomain: "dsignertv.firebaseapp.com",
    databaseURL: "https://dsignertv-default-rtdb.firebaseio.com",
    projectId: "dsignertv",
    storageBucket: "dsignertv.firebasestorage.app",
    messagingSenderId: "930311416952",
    appId: "1:930311416952:web:d0e7289f0688c46492d18d"
};

// Initialize Firebase sem autenticação
firebase.initializeApp(firebaseConfig);
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

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    startPublicListening(key);
}

function handleOnline() {
    updatePlayerStatus('✔ Online', 'online');
    if (!unsubscribe) startPublicListening(currentKey);
}

function handleOffline() {
    updatePlayerStatus('⚡ Offline', 'offline');
}

function startPublicListening(key) {
    console.log('Listening to:', 'midia/' + key);
    updatePlayerStatus('Connecting...', 'offline');
    stopListening();

    unsubscribe = db.ref('midia/' + key).on('value', 
        (snapshot) => {
            if (snapshot.exists()) {
                handleMediaUpdate(snapshot);
            } else {
                showError('Nenhum conteúdo encontrado para esta chave');
            }
        },
        (error) => {
            console.error('Erro ao acessar mídia:', error);
            updatePlayerStatus('Erro de conexão: ' + error.message, 'offline');
        }
    );
}

function handleMediaUpdate(snapshot) {
    const media = snapshot.val();
    currentMedia = media;
    console.log('Mídia recebida:', media);

    updatePlayerStatus('✔ Online - Conteúdo recebido', 'online');
    elements.mediaDisplay.innerHTML = '';

    if (media.tipo === 'text') {
        const textDiv = document.createElement('div');
        textDiv.className = 'text-message';
        textDiv.textContent = media.content;
        textDiv.style.background = media.bgColor || '#2a2f5b';
        textDiv.style.color = media.color || 'white';
        textDiv.style.fontSize = `${media.fontSize || 24}px`;
        elements.mediaDisplay.appendChild(textDiv);
    } else if (media.tipo === 'image') {
        const img = document.createElement('img');
        img.src = media.url;
        img.onerror = () => showError('Erro ao carregar a imagem');
        elements.mediaDisplay.appendChild(img);
        setTimeout(() => {
            if (currentMedia === media && media.duration) {
                clearMedia();
            }
        }, (media.duration || 10) * 1000);
    } else if (media.tipo === 'video') {
        const video = document.createElement('video');
        video.src = media.url;
        video.controls = false;
        video.autoplay = true;
        video.loop = media.loop || false;
        video.onerror = () => showError('Erro ao carregar o vídeo');
        video.onloadeddata = () => video.play().catch(e => console.error('Erro ao reproduzir vídeo:', e));
        elements.mediaDisplay.appendChild(video);
    } else if (media.tipo === 'activation' || media.tipo === 'status') {
        showError('Nenhum conteúdo para exibir (ativação ou status)');
    }
}

function showError(message) {
    elements.mediaDisplay.innerHTML = `<div class="error-message">${message}</div>`;
}

function handleKeyboardShortcuts(e) {
    if (e.key === 'Escape') exitPlayerMode();
}

function showExitButton() {
    elements.exitBtn.style.opacity = '1';
    setTimeout(() => {
        elements.exitBtn.style.opacity = '0';
    }, 2000);
}

// CSS
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
    .connection-status {
        padding: 5px 10px;
        border-radius: 5px;
        color: white;
    }
    .connection-status.online {
        background-color: #4CAF50;
    }
    .connection-status.offline {
        background-color: #FF9800;
    }
    #exit-btn {
        position: absolute;
        top: 10px;
        right: 10px;
        opacity: 0;
        transition: opacity 0.3s;
    }
`;
document.head.appendChild(style);