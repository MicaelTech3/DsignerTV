const authModule = window.authModule;

let categories = JSON.parse(localStorage.getItem('dsigner_categories')) || [];
let tvs = JSON.parse(localStorage.getItem('dsigner_tvs')) || [];
let selectedCategoryId = null;
let currentMediaTv = null;

const isOnline = () => navigator.onLine;

const saveLocalData = () => {
    localStorage.setItem('dsigner_categories', JSON.stringify(categories));
    localStorage.setItem('dsigner_tvs', JSON.stringify(tvs));
    console.log('Dados salvos localmente:', { categories, tvs });
};

const showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 2700);
};

const updateConnectionStatus = () => {
    let statusElement = document.getElementById('connection-status');
    if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.id = 'connection-status';
        document.body.appendChild(statusElement);
    }
    statusElement.textContent = isOnline() ? '✔ Online' : '⚡ Offline - Modo Local';
    statusElement.style.backgroundColor = isOnline() ? '#4CAF50' : '#FF9800';
    statusElement.style.color = 'white';
};

const syncWithFirebase = async () => {
    if (!isOnline()) return;

    try {
        console.log('Iniciando sincronização...');
        const categoriesSnapshot = await authModule.database.ref('categories').once('value');
        const tvsSnapshot = await authModule.database.ref('tvs').once('value');

        const remoteCategories = categoriesSnapshot.val() ? Object.entries(categoriesSnapshot.val()).map(([id, data]) => ({ id, ...data })) : [];
        const remoteTvs = tvsSnapshot.val() ? Object.entries(tvsSnapshot.val()).map(([id, data]) => ({ id, ...data })) : [];

        categories = [...new Set([...remoteCategories, ...categories].map(c => JSON.stringify(c)))].map(c => JSON.parse(c));
        for (const cat of categories) {
            if (!remoteCategories.some(rc => rc.id === cat.id)) {
                await authModule.database.ref(`categories/${cat.id}`).set(cat);
                console.log(`Categoria ${cat.id} criada no Realtime Database`);
            }
        }

        tvs = [...new Set([...remoteTvs, ...tvs].map(t => JSON.stringify(t)))].map(t => JSON.parse(t));
        for (const tv of tvs) {
            if (!remoteTvs.some(rt => rt.id === tv.id)) {
                await authModule.database.ref(`tvs/${tv.id}`).set(tv);
                console.log(`TV ${tv.id} criada no Realtime Database`);
            }
        }

        saveLocalData();
        updateCategoryList();
        updateTvGrid();
        showToast('Sincronização concluída', 'success');
    } catch (error) {
        console.error('Erro na sincronização:', error);
        showToast('Erro na sincronização. Usando dados locais.', 'error');
    }
};

const updateCategoryList = () => {
    const floorList = document.querySelector('.floor-list');
    if (!floorList) {
        console.error('Elemento .floor-list não encontrado na página');
        return;
    }

    const button = floorList.querySelector('.select-categories-btn');
    floorList.innerHTML = '';
    if (button) floorList.appendChild(button);

    categories.forEach(category => {
        const floorItem = document.createElement('div');
        floorItem.className = 'floor-item';
        floorItem.dataset.categoryId = category.id;
        floorItem.innerHTML = `
            <button class="floor-btn ${selectedCategoryId === category.id ? 'active' : ''}" data-id="${category.id}">
                <span>${category.name}</span>
                <div class="floor-actions">
                    <button class="action-btn edit-floor-btn" data-id="${category.id}" title="Editar">
                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTMgMTcuMjVWMjFiMy43NUwxNy44MSA5Ljk0bC0zLjc1LTMuNzVMMyAxNy4yNXpNMjAuNzEgNy4wNGMuMzktLjM5LjM5LTEuMDIgMC0xLjQxbC0yLjM0LTIuMzRjLS4zOS0uMzktMS4wMi0uMzktMS40MSAwbC0xLjgzIDEuODMgMy43NSAzLjc1IDEuODMtMS44M3oiLz48L3N2Zz4=" width="14" height="14" alt="Editar">
                    </button>
                    <button class="action-btn delete-btn delete-floor-btn" data-id="${category.id}" title="Excluir">
                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTYgMTlhMiAyIDAgMCAwIDIgMmg4YTIgMiAwIDAgMCAyLTJWN0g2djEyTTE5IDRIMTUuNWwtMS0xaC05bC0xIDFINHYyaDE2VjR6Ii8+PC9zdmc+" width="14" height="14" alt="Excluir">
                    </button>
                </div>
            </button>
        `;
        floorList.insertBefore(floorItem, button);
    });

    const tvCategorySelect = document.getElementById('tv-category');
    if (tvCategorySelect) {
        tvCategorySelect.innerHTML = categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
    }
    console.log('Lista de categorias atualizada:', categories);
};

const updateTvGrid = () => {
    const tvGrid = document.getElementById('tv-grid');
    if (!tvGrid) {
        console.error('Elemento #tv-grid não encontrado na página');
        return;
    }

    tvGrid.innerHTML = '';
    const filteredTvs = selectedCategoryId ? tvs.filter(tv => tv.categoryId === selectedCategoryId) : tvs;

    if (filteredTvs.length === 0) {
        tvGrid.innerHTML = '<div class="no-items">Nenhuma TV encontrada</div>';
        return;
    }

    filteredTvs.forEach(tv => {
        const category = categories.find(c => c.id === tv.categoryId);
        const gridItem = document.createElement('div');
        gridItem.className = `grid-item ${tv.status === 'off' ? 'offline' : ''}`;
        gridItem.dataset.tvId = tv.id;
        gridItem.innerHTML = `
            <div class="tv-status">${tv.status === 'off' ? 'OFF' : 'ON'}</div>
            <span>${tv.name}</span>
            <small>${category?.name || 'Sem categoria'}</small>
            ${tv.activationKey ? '<div class="activation-badge">Ativada</div>' : ''}
            <div class="tv-actions">
                <button class="tv-action-btn toggle-tv-btn" data-id="${tv.id}" title="${tv.status === 'off' ? 'Ligar' : 'Desligar'}">
                    <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEzIDNoLTJ2MTBoMlYzem03IDhoLTRjLTEuMS0yLjQtMi41LTQuOC00LTYgMS4zLTEuMyAyLjYtMi4yIDQtMyAyLjIgMS4zIDMuNSAzIDQgNXoiLz48L3N2Zz4=" width="14" height="14">
                </button>
                <button class="tv-action-btn view-tv-btn" data-id="${tv.id}" title="Ver Mídia">
                    <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDQuNUM2LjUgNC41IDIgNy41IDIgMTJzNC41IDcuNSAxMCA3LjVjNS41IDAgMTAtMyAxMC03LjUtNC41LTcuNS0xMC03LjUtMTAuNXptMCAxMi41Yy0zLjggMC03LjItMi42LTguOS01LjUgMS43LTIuOSA1LjEtNS41IDguOS01LjVzNy4yIDIuNiA4LjkgNS41LTEuNyAyLjktNS4xIDUuNS04LjkuNXptMC0xMC41YzIuNSAwIDQuNSAyIDQuNSA0LjVzLTIgNC41LTQuNSA0LjUtNC41LTItNC51LTQuNSAyLTQuNSA0LjUtNC41eiIvPjwvc3ZnPg==" width="14" height="14">
                </button>
                <button class="tv-action-btn upload-tv-btn" data-id="${tv.id}" title="Enviar mídia">
                    <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTkgMTZoNnYtNmg0bC03LTctNyA3aDR6bS00IDJoMTR2Mkg1eiIvPjwvc3ZnPg==" width="14" height="14">
                </button>
                <button class="tv-action-btn info-tv-btn" data-id="${tv.id}" title="Informações">
                    <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTExIDE3aDJ2LTZoLTJ2NnptMS0xNUM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC00LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnptMCAxOGMtNC40MSAwLTgtMy41OS04LThzMy41OS04IDgtOCA4IDMuNTkgOCA4LTMuNTkgOC04IDh6bTAtMTRjLTIuMjEgMC00IDEuNzktNCA0aDJjMC0xLjEuOS0yIDItMnMyIC45IDIgMmMwIDItMyAxLjc1LTMgNWgyYzAtMi4yNSAzLTIuNSAzLTUgMC0yLjIxLTEuNzktNC00LTR6Ii8+PC9zdmc+" width="14" height="14">
                </button>
                <button class="tv-action-btn delete-tv-btn" data-id="${tv.id}" title="Excluir">
                    <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTYgMTlhMiAyIDAgMCAwIDIgMmg4YTIgMiAwIDAgMCAyLTJWN0g2djEyTTE5IDRIMTUuNWwtMS0xaC05bC0xIDFINHYyaDE2VjR6Ii8+PC9zdmc+" width="14" height="14">
                </button>
            </div>
        `;
        tvGrid.appendChild(gridItem);
    });
};

const uploadMediaToStorage = async (file, tvId) => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const storageRef = authModule.storage.ref(`tv_media/${tvId}/${fileName}`);

        const progressBar = document.querySelector('.progress-bar');
        if (progressBar) progressBar.style.width = '0%';
        showToast(`Enviando: 0%`, 'info');

        if (file.size > 190 * 1024 * 1024) {
            showToast('Arquivo muito grande (máx. 190MB)', 'error');
            throw new Error('Arquivo excede o limite de 190MB');
        }

        const uploadTask = storageRef.put(file);

        return new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    if (progressBar) progressBar.style.width = `${progress}%`;
                    showToast(`Enviando: ${Math.round(progress)}%`, 'info');
                },
                (error) => {
                    console.error("Erro no upload:", error);
                    showToast('Falha no upload', 'error');
                    reject(error);
                },
                async () => {
                    const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                    console.log('Upload concluído, URL:', downloadURL);
                    resolve(downloadURL);
                }
            );
        });
    } catch (error) {
        console.error("Erro no upload:", error);
        showToast('Falha no upload', 'error');
        throw error;
    }
};

async function sendTextMessage(tvId, messageData) {
    const tv = tvs.find(t => t.id === tvId);
    if (!tv) return false;

    const mediaData = {
        type: 'text',
        content: messageData.text,
        color: messageData.color,
        bgColor: messageData.bgColor,
        fontSize: messageData.fontSize,
        timestamp: Date.now()
    };

    tv.media = mediaData;
    saveLocalData();

    if (isOnline()) {
        try {
            await authModule.database.ref(`tvs/${tvId}`).update({
                media: mediaData,
                lastUpdate: Date.now()
            });

            if (tv.activationKey) {
                await authModule.database.ref('midia/' + tv.activationKey).set({
                    tipo: 'text',
                    content: mediaData.content,
                    color: mediaData.color,
                    bgColor: mediaData.bgColor,
                    fontSize: mediaData.fontSize,
                    timestamp: Date.now()
                });
            }

            showToast('Mensagem enviada com sucesso!', 'success');
            return true;
        } catch (error) {
            console.error("Erro ao enviar mensagem:", error);
            showToast('Erro ao enviar. Mensagem salva localmente.', 'error');
            return false;
        }
    } else {
        showToast('Mensagem salva localmente (offline)', 'info');
        return false;
    }
}

function displayTextMessage(content, color, bgColor, fontSize) {
    const modal = document.getElementById('view-media-modal');
    const container = document.getElementById('media-container');
    if (!modal || !container) {
        console.error('Elementos do modal de mídia não encontrados');
        return;
    }

    container.innerHTML = `
        <div class="text-message" style="
            padding: 20px;
            background: ${bgColor || '#2a2f5b'};
            border-radius: 10px;
            color: ${color || 'white'};
            font-size: ${fontSize || 24}px;
            max-width: 80%;
            margin: 0 auto;
            text-align: center;
        ">
            ${content}
        </div>
    `;

    modal.style.display = 'block';
}

function showTvMedia(tvId) {
    const tv = tvs.find(t => t.id === tvId);
    if (!tv) {
        showToast('TV não encontrada', 'error');
        return;
    }

    const modal = document.getElementById('view-media-modal');
    const container = document.getElementById('media-container');
    if (!modal || !container) return;

    container.innerHTML = '';

    if (tv.playlist && tv.playlist.length > 0) {
        container.innerHTML = `
            <h3>Playlist de ${tv.name}</h3>
            <div id="playlist-view"></div>
            <button id="add-to-playlist-btn" class="btn" data-tv-id="${tvId}">Adicionar Mídia</button>
            <button id="update-playlist-btn" class="btn" data-tv-id="${tvId}">Atualizar Playlist</button>
        `;
        const playlistView = container.querySelector('#playlist-view');
        let playlistItems = tv.playlist.slice().sort((a, b) => (a.order || 0) - (b.order || 0));

        const renderPlaylistView = () => {
            playlistView.innerHTML = '';
            playlistItems.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'playlist-item';
                itemDiv.dataset.index = index;
                itemDiv.innerHTML = `
                    <img src="${item.type === 'video' ? 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTE3IDMuNUgxMHYzLjVIMTdWMy41ek0xMiAxM3Y3LjVoNS41aDEuNWExLjUgMS41IDAgMCAxIDEuNSAxLjV2MS41YzAgLjgzLS42NyAxLjUtMS41IDEuNWgtMy41di0zLjVIMTdWMjEuNWgtM3YxLjVoLTN2LTEuNWgtM3YtMS41YzAtLjgzLjY3LTEuNSAxLjUtMS41aDEuNWgtMS41djcuNUg3di03LjVIM3YxLjVoLTEuNWMtLjgzIDAtMS41LS42Ny0xLjUtMS41di0xLjVjMC0uODMuNjctMS41IDEuNS0xLjVoMS41djcuNUgxMHYtNy41SDd2My41SDMuNWMtLjgzIDAtMS41LS42Ny0xLjUtMS41di0zLjVhMS41IDEuNSAwIDAgMSAxLjUtMS41aDMuNXYzLjVIMTB2LTMuNWgtM3YtMS41YzAtLjgzLjY3LTEuNSAxLjUtMS41aDEuNWgtMS41djMuNUgxN3YtMy41aC0zdi0xLjVjMC0uODMuNjctMS41IDEuNS0xLjVoMS41YzAgMCAzLjUgMCAzLjUgMHYzLjV6Ii8+PC9zdmc+' : item.url}" alt="${item.type}" style="width: 100px; height: 100px; object-fit: cover;">
                    <div>
                        <p>Tipo: ${item.type}</p>
                        <p>Duração: <input type="number" class="playlist-duration" value="${item.duration || 10}" min="1" ${item.type === 'video' ? 'disabled' : ''}> seg</p>
                        <button class="move-up-btn" ${index === 0 ? 'disabled' : ''} title="Mover para cima">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="#00d4ff"><path d="M12 8l-6 6h12l-6-6z"/></svg>
                        </button>
                        <button class="move-down-btn" ${index === playlistItems.length - 1 ? 'disabled' : ''} title="Mover para baixo">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="#00d4ff"><path d="M12 16l6-6H6l6 6z"/></svg>
                        </button>
                        <button class="remove-item-btn" title="Remover item">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="#ff5252"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                    </div>
                `;
                playlistView.appendChild(itemDiv);
            });
        };

        renderPlaylistView();

        playlistView.addEventListener('click', (e) => {
            const index = parseInt(e.target.closest('.playlist-item')?.dataset.index);
            if (isNaN(index)) return;

            if (e.target.classList.contains('move-up-btn') && index > 0) {
                [playlistItems[index], playlistItems[index - 1]] = [playlistItems[index - 1], playlistItems[index]];
                playlistItems.forEach((item, i) => item.order = i);
                renderPlaylistView();
            } else if (e.target.classList.contains('move-down-btn') && index < playlistItems.length - 1) {
                [playlistItems[index], playlistItems[index + 1]] = [playlistItems[index + 1], playlistItems[index]];
                playlistItems.forEach((item, i) => item.order = i);
                renderPlaylistView();
            } else if (e.target.classList.contains('remove-item-btn')) {
                playlistItems.splice(index, 1);
                playlistItems.forEach((item, i) => item.order = i);
                renderPlaylistView();
            }
        });

        playlistView.addEventListener('input', (e) => {
            const index = parseInt(e.target.closest('.playlist-item')?.dataset.index);
            if (e.target.classList.contains('playlist-duration')) {
                const duration = parseInt(e.target.value);
                if (duration >= 1) {
                    playlistItems[index].duration = duration;
                }
            }
        });

        document.getElementById('add-to-playlist-btn').addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*,video/mp4,.gif';
            input.multiple = true;
            input.onchange = async (e) => {
                const files = Array.from(e.target.files);
                for (const file of files) {
                    if (file.size > 190 * 1024 * 1024) {
                        showToast(`Arquivo ${file.name} excede 190MB`, 'error');
                        continue;
                    }
                    const url = await uploadMediaToStorage(file, tvId);
                    const type = file.type.startsWith('video/') ? 'video' : file.type === 'image/gif' ? 'gif' : 'image';
                    playlistItems.push({
                        url,
                        type,
                        duration: type === 'video' ? null : 10,
                        order: playlistItems.length
                    });
                }
                renderPlaylistView();
            };
            input.click();
        });

        document.getElementById('update-playlist-btn').addEventListener('click', async () => {
            tv.playlist = playlistItems;
            saveLocalData();

            if (isOnline()) {
                try {
                    await authModule.database.ref(`tvs/${tvId}`).update({
                        playlist: playlistItems,
                        lastUpdate: Date.now()
                    });

                    if (tv.activationKey) {
                        await authModule.database.ref('midia/' + tv.activationKey).set({
                            tipo: 'playlist',
                            items: playlistItems,
                            timestamp: Date.now()
                        });
                    }

                    showToast('Playlist atualizada com sucesso!', 'success');
                    modal.style.display = 'none';
                } catch (error) {
                    console.error('Erro ao atualizar playlist:', error);
                    showToast('Erro ao atualizar playlist', 'error');
                }
            } else {
                showToast('Playlist atualizada localmente (offline)', 'info');
            }
        });
    } else if (tv.media) {
        if (tv.media.type === 'text') {
            displayTextMessage(
                tv.media.content,
                tv.media.color,
                tv.media.bgColor,
                tv.media.fontSize
            );
        } else if (tv.media.type === 'image') {
            const img = document.createElement('img');
            img.src = tv.media.url;
            img.style.maxWidth = '100%';
            img.onerror = () => showToast('Erro ao carregar a imagem', 'error');
            container.appendChild(img);
        } else if (tv.media.type === 'video') {
            if (tv.media.url.includes('youtube.com') || tv.media.url.includes('youtu.be')) {
                const videoId = tv.media.url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1];
                if (videoId) {
                    const iframe = document.createElement('iframe');
                    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=${tv.media.loop ? 1 : 0}${tv.media.loop ? '&playlist=' + videoId : ''}`;
                    iframe.style.width = '100%';
                    iframe.style.height = '400px';
                    iframe.frameBorder = '0';
                    iframe.allow = 'autoplay; encrypted-media';
                    container.appendChild(iframe);
                } else {
                    showToast('URL do YouTube inválida', 'error');
                }
            } else {
                const video = document.createElement('video');
                video.src = tv.media.url;
                video.controls = true;
                video.loop = tv.media.loop || false;
                video.style.maxWidth = '100%';
                video.autoplay = true;
                video.onerror = () => showToast('Erro ao carregar o vídeo', 'error');
                video.oncanplay = () => video.play().catch(e => console.error('Erro ao reproduzir:', e));
                container.appendChild(video);
            }
        }
    } else {
        showToast('Nenhuma mídia ou playlist enviada para esta TV', 'info');
    }

    modal.style.display = 'block';
}

window.uploadMidia = async function() {
    try {
        const tvId = document.getElementById('upload-media-btn')?.dataset.tvId;
        const mediaType = document.getElementById('media-type')?.value;
        const tv = tvs.find(t => t.id === tvId);

        if (!tv || !mediaType) {
            showToast('TV ou tipo de mídia inválidos', 'error');
            return;
        }

        let mediaData = {};

        if (mediaType === 'text') {
            const content = document.getElementById('text-content')?.value.trim();
            if (!content) {
                showToast('Digite o conteúdo do texto!', 'error');
                return;
            }

            mediaData = {
                type: 'text',
                content: content,
                color: document.getElementById('text-color')?.value || '#ffffff',
                bgColor: document.getElementById('text-bg-color')?.value || '#1a1f3b',
                fontSize: document.getElementById('text-size')?.value || '24',
                timestamp: Date.now()
            };
        } else if (mediaType === 'image' || mediaType === 'video') {
            const fileInput = document.getElementById('media-file');
            const file = fileInput?.files[0];

            if (!file) {
                showToast('Selecione um arquivo', 'error');
                return;
            }

            if (file.size > 190 * 1024 * 1024) {
                showToast('Arquivo muito grande (máx. 190MB)', 'error');
                return;
            }

            showToast('Iniciando upload...', 'info');
            const mediaUrl = await uploadMediaToStorage(file, tvId);

            mediaData = {
                type: mediaType,
                url: mediaUrl,
                timestamp: Date.now()
            };

            if (mediaType === 'image') {
                mediaData.duration = parseInt(document.getElementById('image-duration')?.value) || 10;
            } else if (mediaType === 'video') {
                mediaData.loop = document.getElementById('video-loop')?.checked || false;
                const validVideoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi'];
                const fileExtension = file.name.split('.').pop().toLowerCase();
                if (!file.type.startsWith('video/') && !validVideoExtensions.includes(fileExtension)) {
                    showToast('Arquivo não é um vídeo válido', 'error');
                    return;
                }
            }
        } else if (mediaType === 'link') {
            const mediaUrl = document.getElementById('media-link')?.value.trim();
            if (!mediaUrl) {
                showToast('Digite uma URL válida', 'error');
                return;
            }

            const isVideo = mediaUrl.match(/\.(mp4|webm|ogg|mov|avi)$/i) ||
                          mediaUrl.includes('youtube.com') ||
                          mediaUrl.includes('vimeo.com');

            mediaData = {
                type: isVideo ? 'video' : 'image',
                url: mediaUrl,
                timestamp: Date.now()
            };

            if (isVideo) {
                mediaData.loop = document.getElementById('video-loop')?.checked || false;
            }
        } else if (mediaType === 'playlist') {
            const fileInput = document.getElementById('playlist-files');
            const files = fileInput?.files;

            if (!files || files.length === 0) {
                showToast('Selecione pelo menos um arquivo para a playlist', 'error');
                return;
            }

            const playlistItems = [];
            for (const file of Array.from(files)) {
                if (file.size > 190 * 1024 * 1024) {
                    showToast(`Arquivo ${file.name} excede 190MB`, 'error');
                    continue;
                }
                const url = await uploadMediaToStorage(file, tvId);
                const type = file.type.startsWith('video/') ? 'video' : file.type === 'image/gif' ? 'gif' : 'image';
                playlistItems.push({
                    url,
                    type,
                    duration: type === 'video' ? null : 10,
                    order: playlistItems.length
                });
            }

            if (playlistItems.length === 0) {
                showToast('Nenhum arquivo válido para a playlist', 'error');
                return;
            }

            tv.playlist = playlistItems;
            saveLocalData();

            if (isOnline()) {
                await authModule.database.ref(`tvs/${tvId}`).update({
                    playlist: playlistItems,
                    lastUpdate: Date.now()
                });

                if (tv.activationKey) {
                    await authModule.database.ref('midia/' + tv.activationKey).set({
                        tipo: 'playlist',
                        items: playlistItems,
                        timestamp: Date.now()
                    });
                }
            }

            showToast('Playlist enviada com sucesso! Veja em "Ver Mídia" para ajustar.', 'success');
            const modal = document.getElementById('upload-media-modal');
            if (modal) modal.style.display = 'none';
            return;
        }

        tv.media = mediaData;
        saveLocalData();

        if (isOnline()) {
            await authModule.database.ref(`tvs/${tvId}`).update({
                media: mediaData,
                lastUpdate: Date.now()
            });

            if (tv.activationKey) {
                await authModule.database.ref('midia/' + tv.activationKey).set({
                    tipo: mediaData.type,
                    url: mediaData.url,
                    content: mediaData.content || null,
                    color: mediaData.color || null,
                    bgColor: mediaData.bgColor || null,
                    fontSize: mediaData.fontSize || null,
                    duration: mediaData.duration || null,
                    loop: mediaData.loop || false,
                    timestamp: Date.now()
                });
            }
        }

        showToast('Conteúdo enviado com sucesso!', 'success');

        const modal = document.getElementById('upload-media-modal');
        if (modal) modal.style.display = 'none';

        const fileInput = document.getElementById('media-file');
        if (fileInput) fileInput.value = '';

    } catch (error) {
        console.error("Erro no envio:", error);
        showToast('Falha no envio: ' + error.message, 'error');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, iniciando configuração...');
    updateConnectionStatus();
    window.addEventListener('online', () => {
        updateConnectionStatus();
        syncWithFirebase();
    });
    window.addEventListener('offline', updateConnectionStatus);

    authModule.onAuthStateChanged(user => {
        if (!user) {
            console.log('Nenhum usuário autenticado, redirecionando para login...');
            window.location.href = 'iindex.html';
            return;
        }
        console.log('Usuário autenticado:', user.uid);
        const userEmail = document.getElementById('user-email');
        if (userEmail) userEmail.textContent = user.email;
        const supportEmail = document.getElementById('support-email');
        if (supportEmail) supportEmail.value = user.email;
        if (isOnline()) syncWithFirebase();
        else showToast('Modo offline ativado', 'info');
        updateCategoryList();
        updateTvGrid();
    });

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(nav => nav.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
            const section = document.getElementById(link.dataset.section);
            if (section) section.classList.add('active');
        });
    });

    const dskeyBtn = document.getElementById('dskey-btn-header');
    if (dskeyBtn) {
        dskeyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'https://tvdsigner.com.br/';
        });
    }

    const categoryModal = document.getElementById('category-modal');
    const selectCategoriesBtn = document.querySelector('.select-categories-btn');
    if (selectCategoriesBtn) {
        selectCategoriesBtn.addEventListener('click', () => {
            console.log('Abrindo modal de categorias');
            if (categoryModal) categoryModal.style.display = 'block';
            updateCategoryList();
        });
    }
    const categoryModalClose = document.querySelector('#category-modal .close-btn');
    if (categoryModalClose) {
        categoryModalClose.addEventListener('click', () => {
            if (categoryModal) categoryModal.style.display = 'none';
        });
    }

    const addCategoryBtn = document.getElementById('add-category-btn');
    if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', async () => {
            const nameInput = document.getElementById('new-category-name');
            const name = nameInput ? nameInput.value.trim() : '';
            if (!name) {
                showToast('Digite um nome para o andar', 'error');
                return;
            }

            const newId = (categories.length ? Math.max(...categories.map(c => parseInt(c.id))) + 1 : 1).toString();
            const newCategory = { id: newId, name, status: 'active' };
            console.log('Adicionando categoria:', newCategory);

            categories.push(newCategory);
            saveLocalData();

            if (isOnline()) {
                try {
                    await authModule.database.ref(`categories/${newId}`).set(newCategory);
                    showToast('Andar adicionado!', 'success');
                } catch (err) {
                    console.error('Erro ao adicionar categoria no Firebase:', err);
                    showToast('Salvo localmente', 'info');
                }
            } else {
                showToast('Salvo localmente', 'info');
            }

            if (nameInput) nameInput.value = '';
            updateCategoryList();
            if (categoryModal) categoryModal.style.display = 'none';
        });
    }

    document.addEventListener('click', e => {
        const editBtn = e.target.closest('.edit-floor-btn');
        if (editBtn) {
            const catId = editBtn.dataset.id;
            const category = categories.find(c => c.id === catId);
            const modal = document.getElementById('edit-floor-modal');
            const nameInput = document.getElementById('edit-floor-name');
            if (modal && nameInput && category) {
                nameInput.value = category.name;
                document.getElementById('save-floor-btn').dataset.id = catId;
                modal.style.display = 'block';
                console.log('Abrindo modal de edição para categoria:', catId);
            }
        }
    });
    const editFloorModalClose = document.querySelector('#edit-floor-modal .close-btn');
    if (editFloorModalClose) {
        editFloorModalClose.addEventListener('click', () => {
            const modal = document.getElementById('edit-floor-modal');
            if (modal) modal.style.display = 'none';
        });
    }
    const saveFloorBtn = document.getElementById('save-floor-btn');
    if (saveFloorBtn) {
        saveFloorBtn.addEventListener('click', async () => {
            const catId = saveFloorBtn.dataset.id;
            const nameInput = document.getElementById('edit-floor-name');
            const newName = nameInput ? nameInput.value.trim() : '';
            if (!newName) {
                showToast('Digite um nome válido', 'error');
                return;
            }

            const categoryIndex = categories.findIndex(c => c.id === catId);
            if (categoryIndex !== -1) {
                categories[categoryIndex].name = newName;
                saveLocalData();

                if (isOnline()) {
                    try {
                        await authModule.database.ref(`categories/${catId}`).update({ name: newName });
                        showToast('Andar atualizado', 'success');
                    } catch (err) {
                        console.error('Erro ao atualizar categoria:', err);
                        showToast('Atualizado localmente', 'info');
                    }
                } else {
                    showToast('Atualizado localmente', 'info');
                }

                updateCategoryList();
                const modal = document.getElementById('edit-floor-modal');
                if (modal) modal.style.display = 'none';
            }
        });
    }

    document.addEventListener('click', async e => {
        const deleteBtn = e.target.closest('.delete-floor-btn');
        if (deleteBtn) {
            if (!confirm('Tem certeza que deseja excluir este andar? Todas as TVs serão removidas.')) return;
            const catId = deleteBtn.dataset.id;
            console.log('Deletando categoria:', catId);

            categories = categories.filter(c => c.id !== catId);
            tvs = tvs.filter(tv => tv.categoryId !== catId);
            saveLocalData();

            if (isOnline()) {
                try {
                    await authModule.database.ref(`categories/${catId}`).remove();
                    const tvsToDelete = tvs.filter(tv => tv.categoryId === catId);
                    for (const tv of tvsToDelete) {
                        await authModule.database.ref(`tvs/${tv.id}`).remove();
                    }
                    showToast('Andar e TVs removidos', 'success');
                } catch (err) {
                    console.error('Erro ao remover no Firebase:', err);
                    showToast('Removido localmente', 'info');
                }
            } else {
                showToast('Removido localmente', 'info');
            }

            updateCategoryList();
            updateTvGrid();
        }
    });

    const addTvModal = document.getElementById('add-tv-modal');
    const addTvBtn = document.querySelector('.add-tv-btn');
    if (addTvBtn) {
        addTvBtn.addEventListener('click', () => {
            console.log('Abrindo modal de adicionar TV');
            if (addTvModal) addTvModal.style.display = 'block';
            updateCategoryList();
        });
    }
    const addTvModalClose = document.querySelector('#add-tv-modal .close-btn');
    if (addTvModalClose) {
        addTvModalClose.addEventListener('click', () => {
            if (addTvModal) addTvModal.style.display = 'none';
        });
    }
    const addTvSubmitBtn = document.getElementById('add-tv-submit-btn');
    if (addTvSubmitBtn) {
        addTvSubmitBtn.addEventListener('click', async () => {
            const nameInput = document.getElementById('tv-name');
            const categorySelect = document.getElementById('tv-category');
            const keyInput = document.getElementById('tv-activation-key');
            const name = nameInput ? nameInput.value.trim() : '';
            const categoryId = categorySelect ? categorySelect.value : '';
            const activationKey = keyInput ? keyInput.value.trim() : '';

            if (!name || !categoryId) {
                showToast('Preencha todos os campos obrigatórios', 'error');
                return;
            }

            const newId = (tvs.length ? Math.max(...tvs.map(t => parseInt(t.id))) + 1 : 1).toString();
            const newTv = {
                id: newId,
                name,
                categoryId,
                status: 'on',
                activationKey: activationKey || null,
                deviceName: activationKey ? `Dispositivo ${newId}` : null,
                lastActivation: activationKey ? Date.now() : null
            };
            console.log('Adicionando TV:', newTv);

            tvs.push(newTv);
            saveLocalData();

            if (isOnline()) {
                try {
                    await authModule.database.ref(`tvs/${newId}`).set(newTv);
                    showToast('TV adicionada!', 'success');

                    if (activationKey) {
                        await authModule.database.ref('midia/' + activationKey).set({
                            tipo: 'activation',
                            tvData: newTv,
                            timestamp: Date.now()
                        });
                    }
                } catch (err) {
                    console.error('Erro ao adicionar TV no Firebase:', err);
                    showToast('Salva localmente', 'info');
                }
            } else {
                showToast('Salva localmente', 'info');
            }

            if (nameInput) nameInput.value = '';
            if (keyInput) keyInput.value = '';
            if (addTvModal) addTvModal.style.display = 'none';
            updateTvGrid();
        });
    }

    document.addEventListener('click', async e => {
        const toggleBtn = e.target.closest('.toggle-tv-btn');
        if (toggleBtn) {
            const tvId = toggleBtn.dataset.id;
            const tv = tvs.find(t => t.id === tvId);
            if (tv) {
                tv.status = tv.status === 'off' ? 'on' : 'off';
                saveLocalData();

                if (isOnline()) {
                    try {
                        await authModule.database.ref(`tvs/${tvId}`).update({ status: tv.status });
                        showToast(`TV ${tv.status === 'off' ? 'desligada' : 'ligada'}`, 'success');

                        if (tv.activationKey) {
                            await authModule.database.ref('midia/' + tv.activationKey).set({
                                tipo: 'status',
                                value: tv.status,
                                timestamp: Date.now()
                            });
                        }
                    } catch (err) {
                        console.error('Erro ao atualizar status:', err);
                        showToast('Alteração salva localmente', 'info');
                    }
                }

                updateTvGrid();
            }
        }
    });

    document.addEventListener('click', e => {
        const uploadBtn = e.target.closest('.upload-tv-btn');
        if (uploadBtn) {
            const tvId = uploadBtn.dataset.id;
            currentMediaTv = tvs.find(t => t.id === tvId);
            const modal = document.getElementById('upload-media-modal');
            if (modal && currentMediaTv) {
                modal.style.display = 'block';
                document.getElementById('upload-media-btn').dataset.tvId = tvId;

                document.getElementById('media-file').value = '';
                document.getElementById('media-link').value = '';
                document.getElementById('text-content').value = '';
                document.getElementById('image-duration').value = '10';
                document.getElementById('video-loop').checked = false;
                document.getElementById('text-color').value = '#ffffff';
                document.getElementById('text-bg-color').value = '#1a1f3b';
                document.getElementById('text-size').value = '24';
                const progressBar = document.querySelector('.progress-bar');
                if (progressBar) progressBar.style.width = '0%';
                const preview = document.getElementById('media-preview');
                if (preview) preview.style.display = 'none';

                const mediaTypeSelect = document.getElementById('media-type');
                const fileGroup = document.getElementById('file-upload-group');
                const linkGroup = document.getElementById('link-upload-group');
                const textGroup = document.getElementById('text-options');
                const imageOptions = document.getElementById('image-options');
                const videoOptions = document.getElementById('video-options');
                const playlistGroup = document.getElementById('playlist-group');

                if (mediaTypeSelect && fileGroup && linkGroup && textGroup && imageOptions && videoOptions && playlistGroup) {
                    mediaTypeSelect.innerHTML = `
                        <option value="text">Texto</option>
                        <option value="image">Imagem</option>
                        <option value="video">Vídeo</option>
                        <option value="link">Link</option>
                        <option value="playlist">Playlist</option>
                    `;

                    mediaTypeSelect.addEventListener('change', () => {
                        const type = mediaTypeSelect.value;
                        fileGroup.style.display = type === 'image' || type === 'video' ? 'block' : 'none';
                        linkGroup.style.display = type === 'link' ? 'block' : 'none';
                        textGroup.style.display = type === 'text' ? 'block' : 'none';
                        imageOptions.style.display = type === 'image' ? 'block' : 'none';
                        videoOptions.style.display = type === 'video' ? 'block' : 'none';
                        playlistGroup.style.display = type === 'playlist' ? 'block' : 'none';
                    });

                    document.getElementById('media-file').addEventListener('change', function(e) {
                        const file = e.target.files[0];
                        const preview = document.getElementById('media-preview');
                        if (file && file.type.startsWith('image/') && preview) {
                            const reader = new FileReader();
                            reader.onload = function(event) {
                                preview.src = event.target.result;
                                preview.style.display = 'block';
                            };
                            reader.readAsDataURL(file);
                        } else if (preview) {
                            preview.style.display = 'none';
                        }
                    });

                    const playlistFilesInput = document.getElementById('playlist-files');
                    if (playlistFilesInput) {
                        playlistFilesInput.addEventListener('change', function(e) {
                            const files = Array.from(e.target.files);
                            const preview = document.getElementById('media-preview');
                            if (preview) {
                                preview.innerHTML = '';
                                files.forEach(file => {
                                    if (file.type.startsWith('image/')) {
                                        const reader = new FileReader();
                                        reader.onload = function(event) {
                                            const img = document.createElement('img');
                                            img.src = event.target.result;
                                            img.style.maxWidth = '100px';
                                            img.style.margin = '5px';
                                            preview.appendChild(img);
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                });
                                preview.style.display = 'block';
                            }
                        });
                    }
                }
            }
        }
    });

    const uploadMediaModalClose = document.querySelector('#upload-media-modal .close-btn');
    if (uploadMediaModalClose) {
        uploadMediaModalClose.addEventListener('click', () => {
            const modal = document.getElementById('upload-media-modal');
            if (modal) modal.style.display = 'none';
        });
    }

    document.addEventListener('click', e => {
        const viewBtn = e.target.closest('.view-tv-btn');
        if (viewBtn) {
            const tvId = viewBtn.dataset.id;
            showTvMedia(tvId);
        }
    });
    const viewMediaModalClose = document.querySelector('#view-media-modal .close-btn');
    if (viewMediaModalClose) {
        viewMediaModalClose.addEventListener('click', () => {
            const modal = document.getElementById('view-media-modal');
            if (modal) modal.style.display = 'none';
        });
    }

    document.addEventListener('click', e => {
        const infoBtn = e.target.closest('.info-tv-btn');
        if (infoBtn) {
            console.log('Botão de informações clicado');
            const tvId = infoBtn.dataset.id;
            const tv = tvs.find(t => t.id === tvId);

            if (!tv) {
                showToast('TV não encontrada', 'error');
                return;
            }

            const modal = document.getElementById('activation-info-modal');
            if (!modal) return;

            const keyInfo = document.getElementById('activation-key-info');
            const deviceInfo = document.getElementById('activation-device-info');
            const lastInfo = document.getElementById('activation-last-info');
            if (keyInfo && deviceInfo && lastInfo) {
                keyInfo.textContent = tv.activationKey || 'Não ativada';
                deviceInfo.textContent = tv.deviceName || 'Desconhecido';
                lastInfo.textContent = tv.lastActivation ? new Date(tv.lastActivation).toLocaleString() : 'Nunca';
            }

            const keyContainer = document.getElementById('activation-key-container');
            if (keyContainer) {
                keyContainer.innerHTML = '';

                const keyInput = document.createElement('input');
                keyInput.type = 'text';
                keyInput.id = 'activation-key-input';
                keyInput.value = tv.activationKey || '';
                keyInput.placeholder = 'Cole a nova chave aqui';
                keyInput.className = 'key-input';

                const saveKeyBtn = document.createElement('button');
                saveKeyBtn.className = 'btn save-key-btn';
                saveKeyBtn.textContent = 'Salvar Chave';

                saveKeyBtn.onclick = async () => {
                    const newKey = keyInput.value.trim();

                    if (!newKey) {
                        showToast('Digite ou cole uma chave válida', 'error');
                        return;
                    }

                    if (!confirm('Tem certeza que deseja atualizar a chave de ativação?')) return;

                    tv.activationKey = newKey;
                    tv.lastActivation = Date.now();
                    tv.deviceName = `Dispositivo ${tv.id}`;

                    saveLocalData();

                    if (isOnline()) {
                        try {
                            await authModule.database.ref(`tvs/${tvId}`).update({
                                activationKey: newKey,
                                lastActivation: Date.now(),
                                deviceName: `Dispositivo ${tv.id}`
                            });

                            if (newKey) {
                                await authModule.database.ref('midia/' + newKey).set({
                                    tipo: 'activation',
                                    tvData: tv,
                                    timestamp: Date.now()
                                });
                            }

                            showToast('Chave atualizada com sucesso!', 'success');
                            if (keyInfo) keyInfo.textContent = newKey;
                            if (deviceInfo) deviceInfo.textContent = `Dispositivo ${tv.id}`;
                            if (lastInfo) lastInfo.textContent = new Date().toLocaleString();
                        } catch (error) {
                            console.error("Erro ao atualizar chave:", error);
                            showToast('Chave atualizada localmente', 'info');
                        }
                    } else {
                        showToast('Chave atualizada localmente (offline)', 'info');
                    }
                };

                keyContainer.appendChild(keyInput);
                keyContainer.appendChild(saveKeyBtn);
            }

            modal.style.display = 'block';
        }
    });

    const activationInfoModalClose = document.querySelector('#activation-info-modal .close-btn');
    if (activationInfoModalClose) {
        activationInfoModalClose.addEventListener('click', () => {
            const modal = document.getElementById('activation-info-modal');
            if (modal) modal.style.display = 'none';
        });
    }

    document.addEventListener('click', async e => {
        const deleteBtn = e.target.closest('.delete-tv-btn');
        if (deleteBtn) {
            if (!confirm('Tem certeza que deseja excluir esta TV?')) return;
            const tvId = deleteBtn.dataset.id;
            console.log('Deletando TV:', tvId);

            tvs = tvs.filter(t => t.id !== tvId);
            saveLocalData();

            if (isOnline()) {
                try {
                    await authModule.database.ref(`tvs/${tvId}`).remove();
                    showToast('TV removida', 'success');
                } catch (err) {
                    console.error('Erro ao remover TV no Firebase:', err);
                    showToast('Removida localmente', 'info');
                }
            } else {
                showToast('Removida localmente', 'info');
            }

            updateTvGrid();
        }
    });

    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', e => {
            e.preventDefault();
            authModule.signOut().then(() => window.location.href = 'index.html');
        });
    }

    const supportForm = document.getElementById('support-form');
    if (supportForm) {
        supportForm.addEventListener('submit', async e => {
            e.preventDefault();
            if (!isOnline()) {
                showToast('Conecte-se para enviar o chamado', 'error');
                return;
            }

            const btn = e.target.querySelector('button[type="submit"]');
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Enviando...';
            }

            const formData = new FormData(e.target);
            try {
                const response = await fetch('https://formspree.io/f/xyzedylg', {
                    method: 'POST',
                    body: formData,
                    headers: { 'Accept': 'application/json' }
                });
                if (!response.ok) throw new Error('Erro no servidor');
                const supportMessage = document.getElementById('support-message');
                if (supportMessage) {
                    supportMessage.textContent = 'Chamado enviado com sucesso!';
                    supportMessage.className = 'message success';
                }
                e.target.reset();
                showToast('Chamado enviado!', 'success');
            } catch (error) {
                const supportMessage = document.getElementById('support-message');
                if (supportMessage) {
                    supportMessage.textContent = `Erro ao enviar: ${error.message}`;
                    supportMessage.className = 'message error';
                }
                showToast('Falha ao enviar chamado', 'error');
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Enviar Chamado';
                }
            }
        });
    }

    document.addEventListener('click', e => {
        const floorBtn = e.target.closest('.floor-btn');
        if (floorBtn && !e.target.closest('.action-btn')) {
            selectedCategoryId = floorBtn.dataset.id;
            console.log('Categoria selecionada:', selectedCategoryId);
            updateCategoryList();
            updateTvGrid();
        }
    });

    const sendTextBtn = document.getElementById('send-text-btn');
    if (sendTextBtn) {
        sendTextBtn.addEventListener('click', async function() {
            const tvId = this.dataset.tvId;
            const contentInput = document.getElementById('text-message-content');
            const message = contentInput ? contentInput.value.trim() : '';

            if (!message) {
                showToast('Digite uma mensagem!', 'error');
                return;
            }

            const messageData = {
                text: message,
                color: document.getElementById('text-color')?.value || '#ffffff',
                bgColor: document.getElementById('bg-color')?.value || '#1a1f3b',
                fontSize: document.getElementById('text-size')?.value || '24'
            };

            await sendTextMessage(tvId, messageData);
            const modal = document.getElementById('text-message-modal');
            if (modal) modal.style.display = 'none';
        });
    }

    const textMessageModalClose = document.querySelector('#text-message-modal .close-btn');
    if (textMessageModalClose) {
        textMessageModalClose.addEventListener('click', () => {
            const modal = document.getElementById('text-message-modal');
            if (modal) modal.style.display = 'none';
        });
    }
});