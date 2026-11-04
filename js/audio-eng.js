export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.manifest = [];
        this.buffers = new Map();
        this.activeSources = new Set();
        this.isLoaded = false;
    }

    async init() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        try {
            const res = await fetch('audio_manifest.json');
            const rawManifest = await res.json();
            
            this.manifest = rawManifest.filter(item => item.category === 'SE' || item.category === 'ME');
            
            const loadPromises = this.manifest.map(item => this.loadBuffer(item));
            await Promise.all(loadPromises);
            
            this.isLoaded = true;
            console.log(`AENG cached ${this.buffers.size} into RAM`);
        } catch (err) {
            console.error("Failed to load audio engine!", err);
        }
    }

    async loadBuffer(item) {
        try {
            const res = await fetch(item.path);
            const arrayBuffer = await res.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.buffers.set(item.id, audioBuffer);
        } catch (e) {
            console.warn(`Could not decode audio: ${item.path}`, e);
        }
    }

    stopAll() {
        this.activeSources.forEach(source => {
            try {
                source.stop(0);
                source.disconnect();
            } catch (e) {}
        });
        this.activeSources.clear();
    }

    play(id, volume = 0.6, truncatePrevious = true) {
        if (!this.isLoaded || !this.buffers.has(id)) return;
        
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        if (truncatePrevious) {
            this.stopAll();
        }

        const source = this.ctx.createBufferSource();
        source.buffer = this.buffers.get(id);

        const gainNode = this.ctx.createGain();
        gainNode.gain.value = volume;

        source.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        
        source.start(0);

        this.activeSources.add(source);
        source.onended = () => {
            this.activeSources.delete(source);
        };

        return source;
    }

    playRand(category, volume = 0.5) {
        const filtered = this.manifest.filter(m => m.category === 'SE' || m.category === 'ME');
        if (filtered.length === 0) return;
        
        const randomItem = filtered[Math.floor(Math.random() * filtered.length)];
        this.play(randomItem.id, volume, true);
    }
}