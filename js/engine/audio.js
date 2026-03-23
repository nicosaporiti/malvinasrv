let audioCtx = null;

function getCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function playTone(freq, duration, type = 'square', volume = 0.15) {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
}

function playNoise(duration, volume = 0.1) {
    const ctx = getCtx();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(ctx.currentTime);
}

let muted = false;

// --- Music system ---
const musicCache = {};
let currentMusic = null;
let currentMusicKey = null;
let musicGain = null;
const MUSIC_VOLUME = 0.35;

const musicRawBuffers = {};

async function fetchMusic(key, src) {
    if (musicRawBuffers[key]) return;
    const resp = await fetch(src);
    musicRawBuffers[key] = await resp.arrayBuffer();
}

async function decodeMusic(key) {
    if (musicCache[key] || !musicRawBuffers[key]) return;
    const ctx = getCtx();
    musicCache[key] = await ctx.decodeAudioData(musicRawBuffers[key]);
    delete musicRawBuffers[key];
}

export async function preloadMusic() {
    await Promise.all([
        fetchMusic('title', 'assets/music_title.mp3'),
        fetchMusic('stage', 'assets/music_stage.mp3'),
        fetchMusic('boss', 'assets/music_boss.mp3'),
        fetchMusic('gameover', 'assets/music_gameover.mp3'),
        fetchMusic('victory', 'assets/music_victory.mp3'),
    ]);
}

let musicRequestId = 0;

async function _playMusic(key, loop = true) {
    if (currentMusicKey === key) return;
    _stopMusic();

    const requestId = ++musicRequestId;

    // Decode on first use (after user interaction, so AudioContext is allowed)
    if (!musicCache[key] && musicRawBuffers[key]) {
        await decodeMusic(key);
    }

    // Stale request check — another playMusic() call happened during decode
    if (requestId !== musicRequestId) return;

    const buf = musicCache[key];
    if (!buf) return;

    const ctx = getCtx();
    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.loop = loop;

    musicGain = ctx.createGain();
    musicGain.gain.setValueAtTime(muted ? 0 : MUSIC_VOLUME, ctx.currentTime);

    source.connect(musicGain);
    musicGain.connect(ctx.destination);
    source.start(0);

    currentMusic = source;
    currentMusicKey = key;
}

function _stopMusic() {
    if (currentMusic) {
        try { currentMusic.stop(); } catch (e) { /* already stopped */ }
        currentMusic = null;
        currentMusicKey = null;
        musicGain = null;
    }
}

export const Audio = {
    toggle() {
        muted = !muted;
        if (musicGain) {
            musicGain.gain.setValueAtTime(muted ? 0 : MUSIC_VOLUME, getCtx().currentTime);
        }
        return !muted;
    },

    isMuted() {
        return muted;
    },

    playMusic(key, loop = true) {
        _playMusic(key, loop);
    },

    stopMusic() {
        _stopMusic();
    },

    shoot() {
        if (muted) return;
        playTone(880, 0.06, 'square', 0.08);
    },

    enemyShoot() {
        if (muted) return;
        playTone(330, 0.08, 'square', 0.05);
    },

    hit() {
        if (muted) return;
        playTone(220, 0.1, 'sawtooth', 0.1);
    },

    explosion() {
        if (muted) return;
        playNoise(0.3, 0.15);
        playTone(80, 0.3, 'sawtooth', 0.12);
    },

    bigExplosion() {
        if (muted) return;
        playNoise(0.6, 0.2);
        playTone(60, 0.5, 'sawtooth', 0.15);
        setTimeout(() => playNoise(0.3, 0.12), 200);
    },

    powerup() {
        if (muted) return;
        playTone(523, 0.08, 'square', 0.1);
        setTimeout(() => playTone(659, 0.08, 'square', 0.1), 80);
        setTimeout(() => playTone(784, 0.12, 'square', 0.1), 160);
    },

    playerDeath() {
        if (muted) return;
        playTone(440, 0.15, 'sawtooth', 0.15);
        setTimeout(() => playTone(330, 0.15, 'sawtooth', 0.15), 150);
        setTimeout(() => playTone(220, 0.3, 'sawtooth', 0.15), 300);
        setTimeout(() => playNoise(0.4, 0.15), 300);
    },

    bossAlarm() {
        if (muted) return;
        playTone(440, 0.15, 'square', 0.12);
        setTimeout(() => playTone(440, 0.15, 'square', 0.12), 300);
        setTimeout(() => playTone(660, 0.25, 'square', 0.12), 600);
    },

    select() {
        if (muted) return;
        playTone(660, 0.08, 'square', 0.08);
    },

    confirm() {
        if (muted) return;
        playTone(523, 0.06, 'square', 0.1);
        setTimeout(() => playTone(784, 0.1, 'square', 0.1), 70);
    },

    bomb() {
        if (muted) return;
        playTone(120, 0.4, 'sawtooth', 0.2);
        playNoise(0.5, 0.2);
        setTimeout(() => {
            playTone(60, 0.6, 'sawtooth', 0.15);
            playNoise(0.4, 0.15);
        }, 200);
    },
};
