import { initControls } from './controls.js';
import { AudioEngine } from './audio-eng.js';

const audioEngine = new AudioEngine();
let audioMosaicEnabled = false;

//fixed race condition
audioEngine.init();

// start vars

// VIDEO
let COLS = 64;
let ROWS = 48;
let CELL_SIZE = 16;
let lastRenderTime = 0;
const fpsInterval = 1000 / 30;
// Lol const

let currentGridFaces = [];
let frameCounter = 0;

// TIME SEEK BAR THING
let isSeeking = false; // not hide and seek
let queuedSeek = null;
let lastSeekTarget = null;

// CANVAS
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// CANVAS (B)
const offscreen = document.getElementById('offscreen-canvas');
const offCtx = offscreen.getContext('2d', { willReadFrequently: true });

// OTHER ESSENTIAL UI
const video = document.getElementById('badapple-video');
const playBtn = document.getElementById('play-btn');
const togglePreviewBtn = document.getElementById('toggle-preview-btn');
const previewContainer = document.getElementById('preview-container');
const resetZoomBtn = document.getElementById('reset-zoom-btn');
const toggleAudioMosaicBtn = document.getElementById('toggle-audio-mosaic-btn');
const seekBar = document.getElementById('seek-bar');
const currentTimeLabel = document.getElementById('current-time-label');
const durationLabel = document.getElementById('duration-label');
const faviconLink = document.getElementById('favicon');
const faviconCanvas = document.getElementById('favicon-canvas');
const faviconCtx = faviconCanvas.getContext('2d');

const snapshotBtn = document.getElementById('snapshot-btn');
const inspectModal = document.getElementById('inspect-modal');
const closeModal = document.getElementById('close-modal');
const modalImg = document.getElementById('modal-img');
const modalFile = document.getElementById('modal-file');
const modalBrightness = document.getElementById('modal-brightness');
const modalPos = document.getElementById('modal-pos');

const logStatus = document.getElementById('log-status');
const logTime = document.getElementById('log-time');
const logGrid = document.getElementById('log-grid');
const logFace = document.getElementById('log-face');
const frameFacesList = document.getElementById('frame-faces-list');
const container = document.getElementById('canvas-container');

// ETC
let manifest = [];
let faceImages = [];
let isLoaded = false;

let scale = 1, panX = 0, panY = 0; 
let isDragging = false;
let hasDragged = false;
let startX = 0;
let startY = 0;
let pointerDownX = 0;
let pointerDownY = 0;

function updateDimensions() {
    canvas.width = COLS * CELL_SIZE;
    canvas.height = ROWS * CELL_SIZE;
    offscreen.width = COLS;
    offscreen.height = ROWS;
    container.style.width = (COLS * CELL_SIZE) + 'px';
    container.style.height = (ROWS * CELL_SIZE) + 'px';
    document.getElementById('frame-console').style.width = (COLS * CELL_SIZE) + 'px';
}

updateDimensions();

// load faces and fix race condition where autoplay misses render initialization
async function init() {
    try {
        const res = await fetch('manifest.json');
        manifest = await res.json();
        logStatus.textContent = `Loaded ${manifest.length} faces`;

        let loadedCount = 0;
        faceImages = manifest.map(item => {
            const img = new Image();
            img.src = `faces/${item.file}`;
            img.onload = () => {
                loadedCount++;
                checkLoaded();
            };
            img.onerror = () => {
                loadedCount++;
                checkLoaded();
            };
            return img;
        });

        function checkLoaded() {
            if (loadedCount === manifest.length) {
                isLoaded = true;
                logStatus.textContent = "Ready!";
                console.log("OK WE ARE GOOD TO GO!!!!!!!!!!")
                // if video started playing before assets finished loading, kick off render loop now!
                if (!video.paused) {
                    requestAnimationFrame(render);
                }
            }
        }
    } catch (err) {
        logStatus.textContent = "Error loading manifest.json";
        console.error("Failed to load manifest.json", err);
    }
}

init();

async function loadVideo() {
    try {
        logStatus.textContent = "Loading video...";
        console.log("MIC CHECK MIC CHECK")
        const res = await fetch('badapple.mp4');
        if (!res.ok) throw new Error(res.status);
        const blob = await res.blob();
        video.src = URL.createObjectURL(blob);
        video.play().catch(() => {});
    } catch (err) {
        console.error("Failed to load! Is using video.src now!", err);
        video.src = 'badapple.mp4';
    }
}
loadVideo();

function formatTime(seconds) {
    let m = Math.floor(seconds / 60);
    let s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

video.addEventListener('loadedmetadata', () => {
    seekBar.max = video.duration;
});

function render(timestamp = 0) {
    if (!isLoaded) return;

    if (!video.paused && !video.ended) {
        requestAnimationFrame(render);
    }

    const elapsed = timestamp - lastRenderTime;
    if (elapsed < fpsInterval && !video.paused) {
        return;
    }
    lastRenderTime = timestamp - (elapsed % fpsInterval);

    logTime.textContent = video.currentTime.toFixed(2) + 's';
    logGrid.textContent = `${COLS}x${ROWS}`;
    
    if (!video.paused && !isSeeking && !video.seeking) {
        seekBar.value = video.currentTime;
        currentTimeLabel.textContent = formatTime(video.currentTime);
    }

    offCtx.drawImage(video, 0, 0, COLS, ROWS);
    const frameData = offCtx.getImageData(0, 0, COLS, ROWS).data;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    currentGridFaces = [];
    const activeFacesSet = new Set();

    for (let y = 0; y < ROWS; y++) {
        let rowFaces = [];
        for (let x = 0; x < COLS; x++) {
            const idx = (y * COLS + x) * 4;
            const r = frameData[idx];
            const g = frameData[idx + 1];
            const b = frameData[idx + 2];

            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
            const faceIndex = Math.floor((brightness / 255) * (manifest.length - 1));
            const item = manifest[faceIndex];
            const img = faceImages[faceIndex];

            if (img) {
                ctx.drawImage(img, x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            }
            const filename = item ? item.file : 'unknown';
            rowFaces.push(filename);
            activeFacesSet.add(filename);
        }
        currentGridFaces.push(rowFaces);
    }

    frameCounter++;
    if (frameCounter % 3 === 0) {
        let htmlContent = '';
        activeFacesSet.forEach(file => {
            htmlContent += `<span>[${file}]</span>`;
        });
        frameFacesList.innerHTML = htmlContent;

        let activeFacesArray = Array.from(activeFacesSet).filter(file => {
            return !file.includes('black') && !file.includes('white'); 
        });

        if (activeFacesArray.length === 0) {
            activeFacesArray = Array.from(activeFacesSet);
        }

        let randomVariantFace = activeFacesArray[Math.floor(Math.random() * activeFacesArray.length)];
        let variantIndex = manifest.findIndex(m => m.file === randomVariantFace);
        if (variantIndex !== -1 && faceImages[variantIndex]) {
            faviconCtx.clearRect(0, 0, 32, 32);
            faviconCtx.drawImage(faceImages[variantIndex], 0, 0, 32, 32);
            faviconLink.href = faviconCanvas.toDataURL('image/png');
        }
    }

    if (audioMosaicEnabled && !video.paused) {
        if (frameCounter % 6 === 0) {
            const cat = Math.random() > 0.75 ? 'ME' : 'SE';
            audioEngine.playRand(cat, 0.35);
        }
    }
}

function takeSnapshot() {
    const link = document.createElement('a');
    link.download = `oneapple-frame-${video.currentTime.toFixed(2)}s.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

snapshotBtn.addEventListener('click', takeSnapshot);

video.addEventListener('play', () => {
    logStatus.textContent = "Playing";
    requestAnimationFrame(render);
});

video.addEventListener('timeupdate', () => {
    if (video.paused) {
        render(); 
    }
});

video.addEventListener('ended', () => {
    logStatus.textContent = "Ended";
});

// SEEK BAR SHIT START
function updSkBarMax() {
    if (!isNaN(video.duration) && video.duration > 0) {
        seekBar.max = video.duration;
    }
}
if (video.readyState >= 1) updSkBarMax();
video.addEventListener('loadedmetadata', updSkBarMax);
video.addEventListener('durationchange', updSkBarMax);

function seekTo(t) {
    if (isNaN(t)) return;
    if (t === lastSeekTarget) return;
    lastSeekTarget = t;
    if (video.seeking) {
        queuedSeek = t;
    } else {
        video.currentTime = t;
    }
}

video.addEventListener('seeked', () => {
    if (queuedSeek !== null) {
        const t = queuedSeek;
        queuedSeek = null;
        video.currentTime = t;
        return;
    }
    if (video.paused) render();
});

seekBar.addEventListener('pointerdown', () => { isSeeking = true; });

seekBar.addEventListener('input', () => {
    isSeeking = true;
    const t = parseFloat(seekBar.value);
    currentTimeLabel.textContent = formatTime(t);
    seekTo(t);
});

function endScrub() {
    if (!isSeeking) return;
    isSeeking = false;
    seekTo(parseFloat(seekBar.value));
    lastSeekTarget = null;
}

seekBar.addEventListener('change', endScrub);
window.addEventListener('pointerup', endScrub);
window.addEventListener('pointercancel', endScrub);

seekBar.addEventListener('input', () => {
    isSeeking = true;
    const targetTime = parseFloat(seekBar.value);
    currentTimeLabel.textContent = formatTime(targetTime);
});
//revamped seekbar a bit
// thank YOU to my friend who helped debug this
// god it shouldnt have been this hard to update this.

function updateTf() {
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
} 

initControls({
    video,
    playBtn,
    renderSingleFrame: () => render(),
    takeSnapshot,
    changeResolution: (newCols, newRows) => {
        COLS = newCols;
        ROWS = newRows;
        scale = 1;
        panX = 0;
        panY = 0;
        updateTf();
        updateDimensions();
        render();
    }
});

container.addEventListener('mousedown', (e) => {
    isDragging = true;
    hasDragged = false;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    pointerDownX = e.clientX;
    pointerDownY = e.clientY;
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const moveDist = Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY);
    if (moveDist > 4) {
        hasDragged = true;
    }
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    updateTf();
});

window.addEventListener('mouseup', () => {
    isDragging = false;
});

container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomIntensity = 0.1;
    if (e.deltaY < 0) {
        scale *= (1 + zoomIntensity);
    } else {
        scale /= (1 + zoomIntensity);
    }
    scale = Math.max(0.5, Math.min(scale, 10));
    updateTf();
}, { passive: false });

canvas.addEventListener('click', (e) => {
    if (!video.paused || hasDragged) return; 

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const cellPixelSize = CELL_SIZE * scale;
    const gridX = Math.floor(clickX / cellPixelSize);
    const gridY = Math.floor(clickY / cellPixelSize);

    if (currentGridFaces[gridY] && currentGridFaces[gridY][gridX]) {
        const filename = currentGridFaces[gridY][gridX];
        const manifestItem = manifest.find(m => m.file === filename);

        modalFile.textContent = filename;
        modalBrightness.textContent = manifestItem ? manifestItem.brightness.toFixed(1) : 'unknown';
        modalPos.textContent = `X: ${gridX}, Y: ${gridY}`;
        modalImg.src = `faces/${filename}`;
        
        inspectModal.classList.remove('hidden');
    }
});

closeModal.addEventListener('click', () => {
    inspectModal.classList.add('hidden');
});

window.addEventListener('click', (e) => {
    if (e.target === inspectModal) {
        inspectModal.classList.add('hidden');
    }
});

resetZoomBtn.addEventListener('click', () => {
    scale = 1; panX = 0; panY = 0;
    updateTf();
});

playBtn.addEventListener('click', () => {
    if (video.paused) {
        video.play();
    } else {
        video.pause();
        logStatus.textContent = "Paused";
    }
});

let previewShown = true;
togglePreviewBtn.addEventListener('click', () => {
    previewShown = !previewShown;
    if (previewShown) {
        previewContainer.classList.remove('hidden');
        togglePreviewBtn.textContent = 'Toggle preview: shown';
    } else {
        previewContainer.classList.add('hidden');
        togglePreviewBtn.textContent = 'Toggle preview: hidden';
    }
});

if (toggleAudioMosaicBtn) {
    toggleAudioMosaicBtn.addEventListener('click', () => {
        if (!audioMosaicEnabled) {
            
            const confirmed = window.confirm("Warning: This is an experimental feature. May just be bs stitched together. Do still want to PROCEED?");

            if (confirmed) {
                audioMosaicEnabled = true;
                video.muted = true;
                toggleAudioMosaicBtn.textContent = 'OneShot audio: on';
                toggleAudioMosaicBtn.style.background = '#a00808';
                alert("Basically, this just tries to replicate Bad Apple's audio using OneShot's audio files (with the exclusion of BGM as its too long & resource heavy). Hope you have fun!")
            }
            
        } else {
            audioMosaicEnabled = false;
            video.muted = false;
            audioEngine.stopAll();
            toggleAudioMosaicBtn.textContent = 'OneShot audio: off';
            toggleAudioMosaicBtn.style.background = '#222';
        }
    });
}

// :D