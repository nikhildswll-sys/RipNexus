// RipNexus 3D — Full Three.js WebGL & Media Downloader Engine with In-Place Player

let inspectedMediaData = null;
let activeTaskId = null;
let progressPollInterval = null;
let isHyperspace = false;

// DOM Elements
const urlInput = document.getElementById('url-input');
const btnPaste = document.getElementById('btn-paste');
const btnInspect = document.getElementById('btn-inspect');
const inspectLoader = document.getElementById('inspect-loader');

const previewCard = document.getElementById('preview-card');
const mediaThumb = document.getElementById('media-thumb');
const thumbOverlay = document.getElementById('thumb-overlay');
const mediaDuration = document.getElementById('media-duration');
const mediaPlatform = document.getElementById('media-platform');
const mediaAuthor = document.getElementById('media-author');
const mediaViews = document.getElementById('media-views');
const mediaTitle = document.getElementById('media-title');
const opt4k = document.getElementById('opt-4k');
const btnStartDownload = document.getElementById('btn-start-download');

// Quick Thumbnail & Cover Art buttons
const btnDlThumb = document.getElementById('btn-dl-thumb');
const btnDlCover = document.getElementById('btn-dl-cover');

// In-Place Player Elements
const inlinePlayerBox = document.getElementById('inline-player-box');
const inlineVideo = document.getElementById('inline-video');
const inlineAudio = document.getElementById('inline-audio');
const audioPlayerWrap = document.getElementById('audio-player-wrap');
const playerBadgeText = document.getElementById('player-badge-text');

// Progress HUD Elements
const progressCard = document.getElementById('progress-card');
const progressIcon = document.getElementById('progress-icon');
const progressStatusText = document.getElementById('progress-status-text');
const progressSpeed = document.getElementById('progress-speed');
const progressEta = document.getElementById('progress-eta');
const progressFill = document.getElementById('progress-fill');
const progressFilename = document.getElementById('progress-filename');
const progressPercent = document.getElementById('progress-percent');
const completeActions = document.getElementById('complete-actions');
const btnPlayNow = document.getElementById('btn-play-now');
const btnDeviceSave = document.getElementById('btn-device-save');
const btnOpenCompletedFile = document.getElementById('btn-open-completed-file');

// Vault Library Elements
const historyGrid = document.getElementById('history-grid');
const btnOpenDownloadDir = document.getElementById('btn-open-download-dir');
const btnRefreshVault = document.getElementById('btn-refresh-vault');

// -------------------------------------------------------------
// 1. THREE.JS 3D WEBGL ENGINE
// -------------------------------------------------------------
let scene, camera, renderer, particles, torusMesh;
let mouseX = 0, mouseY = 0;
let targetX = 0, targetY = 0;

function init3D() {
    const canvas = document.getElementById('webgl-canvas');
    const width = window.innerWidth;
    const height = window.innerHeight;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050508, 0.0012);

    camera = new THREE.PerspectiveCamera(60, width / height, 1, 3000);
    camera.position.z = 1000;

    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 1. 3D PARTICLE FIELD (Cyber Space Dust)
    const particleCount = 2000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const color1 = new THREE.Color(0x00f2fe);
    const color2 = new THREE.Color(0x7928ca);

    for (let i = 0; i < particleCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 2400;
        positions[i + 1] = (Math.random() - 0.5) * 2400;
        positions[i + 2] = (Math.random() - 0.5) * 2400;

        const mixedColor = color1.clone().lerp(color2, Math.random());
        colors[i] = mixedColor.r;
        colors[i + 1] = mixedColor.g;
        colors[i + 2] = mixedColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 3.5,
        vertexColors: true,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // 2. 3D FLOATING TORUS KNOT (Holographic Cyber Ring)
    const torusGeo = new THREE.TorusKnotGeometry(160, 40, 100, 16);
    const torusMat = new THREE.MeshBasicMaterial({
        color: 0x00f2fe,
        wireframe: true,
        transparent: true,
        opacity: 0.12
    });
    torusMesh = new THREE.Mesh(torusGeo, torusMat);
    torusMesh.position.set(0, 50, 0);
    scene.add(torusMesh);

    // Mouse Move Parallax
    window.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX - width / 2) * 0.4;
        mouseY = (e.clientY - height / 2) * 0.4;
    });

    window.addEventListener('resize', onWindowResize);
    animate3D();
}

function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

function animate3D() {
    requestAnimationFrame(animate3D);

    targetX += (mouseX - targetX) * 0.05;
    targetY += (mouseY - targetY) * 0.05;

    camera.position.x = targetX * 0.5;
    camera.position.y = -targetY * 0.5;
    camera.lookAt(scene.position);

    // Normal Rotation vs Hyperspace Warp
    const speed = isHyperspace ? 0.03 : 0.002;
    particles.rotation.y += speed;
    particles.rotation.x += speed * 0.5;

    torusMesh.rotation.x += speed * 1.5;
    torusMesh.rotation.y += speed * 2;

    if (isHyperspace) {
        torusMesh.material.opacity = 0.4;
        torusMesh.material.color.setHex(0x00e676);
    } else {
        torusMesh.material.opacity = 0.12;
        torusMesh.material.color.setHex(0x00f2fe);
    }
}

// -------------------------------------------------------------
// 2. APP LOGIC & INTERACTION
// -------------------------------------------------------------
function initApp() {
    init3D();
    loadHistory();

    // Paste button
    btnPaste.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                urlInput.value = text.trim();
                triggerInspect();
            }
        } catch (e) {
            urlInput.focus();
        }
    });

    btnInspect.addEventListener('click', triggerInspect);

    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') triggerInspect();
    });

    // 3D Format Options Select
    document.querySelectorAll('.format-card-3d').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.format-card-3d').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            card.querySelector('input').checked = true;
        });
    });

    // Start Download
    btnStartDownload.addEventListener('click', () => startDownloadWithFormat());

    // Quick Thumbnail & Cover Art buttons
    if (btnDlThumb) {
        btnDlThumb.addEventListener('click', () => {
            if (!inspectedMediaData) {
                alert("Please paste a link and click Inspect Media first!");
                return;
            }
            triggerFormatAndDownload('thumbnail');
        });
    }

    if (btnDlCover) {
        btnDlCover.addEventListener('click', () => {
            if (!inspectedMediaData) {
                alert("Please paste a link and click Inspect Media first!");
                return;
            }
            triggerFormatAndDownload('cover');
        });
    }

    // Watch / Play Here Button
    btnPlayNow.addEventListener('click', () => {
        if (activeTaskId) {
            const selectedRadio = document.querySelector('input[name="formatOption"]:checked');
            const formatType = selectedRadio ? selectedRadio.value : '1080p';
            playMediaInPlace(activeTaskId, formatType, inspectedMediaData ? inspectedMediaData.title : 'Media');
        }
    });

    // Open Download Folder
    btnOpenDownloadDir.addEventListener('click', () => {
        fetch('/api/open_folder', { method: 'POST' });
    });

    btnRefreshVault.addEventListener('click', loadHistory);

    // Open Completed File in Explorer
    btnOpenCompletedFile.addEventListener('click', () => {
        if (inspectedMediaData && inspectedMediaData.lastCompletedPath) {
            fetch('/api/open_folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filepath: inspectedMediaData.lastCompletedPath })
            });
        } else {
            fetch('/api/open_folder', { method: 'POST' });
        }
    });
}

function triggerFormatAndDownload(formatType) {
    const card = document.querySelector(`.format-card-3d[data-fmt="${formatType}"]`);
    if (card) {
        document.querySelectorAll('.format-card-3d').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const r = card.querySelector('input');
        if (r) r.checked = true;
    }
    startDownloadWithFormat(formatType);
}

// RESET INLINE PLAYER
function resetInlinePlayer() {
    if (inlineVideo) {
        inlineVideo.pause();
        inlineVideo.removeAttribute('src');
        inlineVideo.load();
    }
    if (inlineAudio) {
        inlineAudio.pause();
        inlineAudio.removeAttribute('src');
        inlineAudio.load();
    }
    inlinePlayerBox.classList.add('hidden');
    mediaThumb.classList.remove('hidden');
    thumbOverlay.classList.remove('hidden');
}

// PLAY MEDIA IN PLACE (RIGHT WHERE DOWNLOAD HAPPENED)
function playMediaInPlace(taskId, format, title) {
    if (!taskId) return;
    const fmt = (format || '').toUpperCase();
    const streamUrl = `/api/stream/${taskId}`;

    if (title && mediaTitle) {
        mediaTitle.textContent = title;
    }

    // Image file (Cover Art or Thumbnail)
    if (fmt.includes('COVER') || fmt.includes('THUMBNAIL') || fmt.includes('IMAGE')) {
        inlineVideo.classList.add('hidden');
        inlineVideo.pause();
        audioPlayerWrap.classList.add('hidden');
        inlineAudio.pause();
        inlinePlayerBox.classList.add('hidden');
        mediaThumb.classList.remove('hidden');
        mediaThumb.src = streamUrl;
        thumbOverlay.classList.remove('hidden');
        previewCard.classList.remove('hidden');
        previewCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
    }

    // Hide static thumbnail and overlay
    mediaThumb.classList.add('hidden');
    thumbOverlay.classList.add('hidden');
    inlinePlayerBox.classList.remove('hidden');

    if (fmt.includes('MP3') || fmt.includes('AUDIO')) {
        inlineVideo.classList.add('hidden');
        inlineVideo.pause();
        audioPlayerWrap.classList.remove('hidden');
        inlineAudio.src = streamUrl;
        playerBadgeText.textContent = 'NOW PLAYING • 320KBPS MP3 (OFFLINE)';
        inlineAudio.play().catch(e => console.log("Audio play allowed on user action:", e));
    } else {
        audioPlayerWrap.classList.add('hidden');
        inlineAudio.pause();
        inlineVideo.classList.remove('hidden');
        inlineVideo.src = streamUrl;
        playerBadgeText.textContent = `NOW PLAYING • ${fmt || 'FULL HD'} (OFFLINE)`;
        inlineVideo.play().catch(e => console.log("Video play allowed on user action:", e));
    }

    // Scroll smoothly to the player deck so user sees it right in front of them
    previewCard.classList.remove('hidden');
    previewCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// INSPECT MEDIA URL
async function triggerInspect() {
    const url = urlInput.value.trim();
    if (!url) {
        alert("Please paste a media URL first!");
        urlInput.focus();
        return;
    }

    resetInlinePlayer();
    showLoader(true);
    previewCard.classList.add('hidden');
    progressCard.classList.add('hidden');

    try {
        const res = await fetch('/api/inspect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.error || "Unable to inspect media. Make sure link is public!");
            return;
        }

        renderPreview(data);
    } catch (err) {
        console.error("Inspect error:", err);
        alert("Network error inspecting media.");
    } finally {
        showLoader(false);
    }
}

function renderPreview(data) {
    inspectedMediaData = data;
    mediaThumb.src = data.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600';
    mediaDuration.textContent = data.duration;
    mediaPlatform.textContent = data.platform.toUpperCase();
    mediaAuthor.innerHTML = `<i class="fa-regular fa-user"></i> ${data.author}`;
    mediaViews.innerHTML = `<i class="fa-regular fa-eye"></i> ${data.views} views`;
    mediaTitle.textContent = data.title;

    if (data.has_4k || data.has_1440) {
        opt4k.classList.remove('hidden');
    } else {
        opt4k.classList.add('hidden');
    }

    previewCard.classList.remove('hidden');
    previewCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// START DOWNLOAD
async function startDownloadWithFormat(customFormat) {
    if (!inspectedMediaData) return;

    const selectedRadio = document.querySelector('input[name="formatOption"]:checked');
    const formatType = customFormat || (selectedRadio ? selectedRadio.value : '1080p');

    btnStartDownload.disabled = true;
    btnStartDownload.innerHTML = '<div class="radar-spinner"></div> INITIATING HIGH-SPEED RIP...';

    try {
        const res = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: inspectedMediaData.original_url,
                format: formatType
            })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            alert("Error: " + (errData.error || "Failed to start download."));
            return;
        }

        const data = await res.json();
        if (data.task_id) {
            activeTaskId = data.task_id;
            isHyperspace = true; // Trigger 3D hyperspace warp speed!
            startProgressTracking(activeTaskId, formatType);
        }
    } catch (e) {
        console.error("Download start failed:", e);
        alert("Connection error starting download.");
    } finally {
        btnStartDownload.disabled = false;
        btnStartDownload.innerHTML = '<i class="fa-solid fa-download"></i> INITIATE HIGH-SPEED RIP';
    }
}

// TRACK PROGRESS
function startProgressTracking(taskId, selectedFormat) {
    progressCard.classList.remove('hidden');
    completeActions.classList.add('hidden');
    progressFill.style.width = '0%';
    progressStatusText.textContent = 'Ripping media stream...';
    progressCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    if (progressPollInterval) clearInterval(progressPollInterval);

    progressPollInterval = setInterval(async () => {
        try {
            const res = await fetch(`/api/progress/${taskId}`);
            const data = await res.json();

            if (data.status === 'downloading') {
                progressFill.style.width = `${data.percent}%`;
                progressPercent.textContent = `${data.percent}%`;
                progressSpeed.textContent = data.speed;
                progressEta.textContent = `ETA: ${data.eta}`;
                progressStatusText.textContent = 'Downloading stream at full speed...';
            } else if (data.status === 'processing') {
                progressFill.style.width = '100%';
                progressPercent.textContent = '100%';
                progressStatusText.textContent = data.speed || 'Embedding album art & finalizing...';
                progressSpeed.textContent = 'Encoding';
                progressEta.textContent = 'Almost ready';
            } else if (data.status === 'finished') {
                clearInterval(progressPollInterval);
                isHyperspace = false; // Stop warp speed

                progressFill.style.width = '100%';
                progressPercent.textContent = '100%';
                progressStatusText.textContent = 'Download Complete & Ready!';
                progressFilename.textContent = `Saved: ${data.filename} (${data.filesize})`;
                progressSpeed.textContent = 'Completed';
                progressEta.textContent = '';

                // Setup Save to Device Link
                btnDeviceSave.href = `/api/get_file/${taskId}`;
                btnDeviceSave.setAttribute('download', data.filename);
                completeActions.classList.remove('hidden');

                if (inspectedMediaData) {
                    inspectedMediaData.lastCompletedPath = data.filepath;
                }

                // 🎬 AUTO-ACTIVATE PLAYER / VIEWER RIGHT HERE WHERE DOWNLOAD FINISHED!
                playMediaInPlace(taskId, selectedFormat || data.format, data.title);

                loadHistory();
            } else if (data.status === 'error') {
                clearInterval(progressPollInterval);
                isHyperspace = false;
                progressStatusText.textContent = 'Stream Rip Error';
                alert("Download failed: " + (data.error || "Unknown stream error"));
            }
        } catch (e) {
            console.error("Progress poll error:", e);
        }
    }, 400);
}

// LOAD MEDIA VAULT HISTORY
async function loadHistory() {
    try {
        const res = await fetch('/api/history');
        const data = await res.json();
        renderHistory(data.history || []);
    } catch (e) {
        console.error("Vault fetch error:", e);
    }
}

function renderHistory(items) {
    historyGrid.innerHTML = '';
    if (!items || items.length === 0) {
        historyGrid.innerHTML = `
            <div class="vault-empty">
                <i class="fa-solid fa-cloud-arrow-up"></i>
                <p>Your media vault is empty. Paste a link above to start downloading!</p>
            </div>
        `;
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'vault-card-3d';
        const isImg = (item.format || '').includes('COVER') || (item.format || '').includes('THUMB');
        const playIcon = isImg ? 'fa-image' : 'fa-play';
        const playText = isImg ? 'View' : 'Play';

        card.innerHTML = `
            <div class="vault-thumb-wrap">
                <img src="${item.thumbnail || '/api/stream/' + item.id}" alt="thumb" onerror="this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500'">
            </div>
            <div class="vault-body">
                <div class="vault-item-title" title="${item.title}">${item.title}</div>
                <div class="vault-meta-row">
                    <span><i class="fa-solid fa-tag"></i> ${item.format}</span>
                    <span><i class="fa-regular fa-file"></i> ${item.filesize}</span>
                    <span><i class="fa-regular fa-clock"></i> ${item.date}</span>
                </div>
                <div class="vault-btn-group">
                    <button class="btn-vault-play">
                        <i class="fa-solid ${playIcon}"></i> ${playText}
                    </button>
                    <button class="btn-vault-open">
                        <i class="fa-solid fa-folder-open"></i> Folder
                    </button>
                </div>
            </div>
        `;

        // Play/View in-place button
        card.querySelector('.btn-vault-play').addEventListener('click', (e) => {
            e.stopPropagation();
            activeTaskId = item.id;
            playMediaInPlace(item.id, item.format, item.title);
        });

        // Show in Explorer button
        card.querySelector('.btn-vault-open').addEventListener('click', (e) => {
            e.stopPropagation();
            fetch('/api/open_folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filepath: item.filepath })
            });
        });

        historyGrid.appendChild(card);
    });
}

function showLoader(show) {
    inspectLoader.classList.toggle('hidden', !show);
}

// Run App
window.addEventListener('DOMContentLoaded', initApp);
