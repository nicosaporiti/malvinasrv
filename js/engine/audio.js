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

// Browsers keep an AudioContext suspended until a user gesture. Resume it
// (and play a silent buffer, which older iOS needs) on the first gesture of
// any kind. Native music playback is unlocked in the same gesture.
const UNLOCK_EVENTS = ['keydown', 'pointerdown', 'pointerup', 'touchend', 'click'];

function unlock() {
    // This call must stay synchronous with the gesture on iOS.
    startMusic();
    const ctx = getCtx();
    if (ctx.state === 'running') return;
    const silent = ctx.createBufferSource();
    silent.buffer = ctx.createBuffer(1, 1, 22050);
    silent.connect(ctx.destination);
    silent.start(0);
    ctx.resume().catch(() => {});
}

export function installAudioUnlock() {
    UNLOCK_EVENTS.forEach((ev) => window.addEventListener(ev, unlock, true));
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

// Oscillator with a pitch sweep — the core of every 80s laser/zap sound
function playSweep(startFreq, endFreq, duration, type = 'square', volume = 0.15, delay = 0) {
    const ctx = getCtx();
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), t + duration);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration);
}

// Noise through a swept filter — raw white noise sounds like static;
// a closing lowpass turns it into a boom, a bandpass into a metallic clank
function playNoise(duration, volume = 0.1, startCutoff = 20000, endCutoff = 20000, filterType = 'lowpass', delay = 0) {
    const ctx = getCtx();
    const t = ctx.currentTime + delay;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(startCutoff, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(endCutoff, 20), t + duration);
    filter.Q.value = 1;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(t);
}

let muted = false;

// --- Music system ---
let musicElement = null;
let currentMusicKey = null;
const MUSIC_VOLUME = 0.35;
const MUSIC_SRC = {
    title: 'assets/music_title.mp3',
    stage: 'assets/music_stage.mp3',
    boss: 'assets/music_boss.mp3',
    gameover: 'assets/music_gameover.mp3',
    victory: 'assets/music_victory.mp3',
};

function getMusicElement() {
    if (!musicElement) {
        musicElement = document.createElement('audio');
        musicElement.preload = 'auto';
        musicElement.volume = MUSIC_VOLUME;
        document.body.appendChild(musicElement);
    }
    return musicElement;
}

// Reuse the same element across tracks to preserve iOS gesture authorization.
// Native media playback can start before the complete MP3 has downloaded.
function startMusic() {
    if (!currentMusicKey || !musicElement.paused || musicElement.ended) return;
    musicElement.play().catch((err) => {
        if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
            console.warn('Music playback failed:', err);
        }
    });
}

export function preloadMusic() {
    const music = getMusicElement();
    if (!music.getAttribute('src')) {
        music.src = MUSIC_SRC.title;
        music.load();
    }
}

function _playMusic(key, loop = true) {
    const src = MUSIC_SRC[key];
    if (!src) return;
    const music = getMusicElement();
    if (currentMusicKey === key) return;
    music.pause();
    music.loop = loop;
    if (music.getAttribute('src') !== src) music.src = src;
    else music.currentTime = 0;
    music.muted = muted;
    currentMusicKey = key;
    startMusic();
}

function _stopMusic() {
    if (musicElement) musicElement.pause();
    currentMusicKey = null;
}

export const Audio = {
    toggle() {
        muted = !muted;
        if (musicElement) musicElement.muted = muted;
        return !muted;
    },

    isMuted() {
        return muted;
    },

    isUnlocked() {
        return audioCtx !== null && audioCtx.state === 'running';
    },

    playMusic(key, loop = true) {
        _playMusic(key, loop);
    },

    stopMusic() {
        _stopMusic();
    },

    shoot() {
        if (muted) return;
        // Classic descending "pew": fast square sweep + thin bright top layer.
        // Random detune so rapid fire doesn't sound like a stuck note.
        const detune = 1 + (Math.random() * 0.16 - 0.08);
        playSweep(1300 * detune, 220, 0.09, 'square', 0.07);
        playSweep(2400 * detune, 500, 0.06, 'sawtooth', 0.025);
    },

    enemyShoot() {
        if (muted) return;
        // Heavier, slower "thoom" — clearly lower than the player's shot
        const detune = 1 + (Math.random() * 0.1 - 0.05);
        playSweep(460 * detune, 80, 0.13, 'sawtooth', 0.045);
        playNoise(0.05, 0.02, 1800, 400);
    },

    hit() {
        if (muted) return;
        // Metallic impact: bandpass noise clank + short pitch drop
        playNoise(0.07, 0.09, 3200, 700, 'bandpass');
        playSweep(620, 140, 0.08, 'square', 0.07);
    },

    explosion() {
        if (muted) return;
        // Sharp crack, then a boom: closing lowpass noise + sub-bass pitch drop
        playNoise(0.04, 0.12, 9000, 2500, 'highpass');
        playNoise(0.35, 0.16, 2600, 90);
        playSweep(170, 38, 0.35, 'sawtooth', 0.13);
        playSweep(90, 30, 0.4, 'triangle', 0.15);
    },

    bigExplosion() {
        if (muted) return;
        // Boss-scale blast: crack, deep layered boom, then trailing rumbles
        playNoise(0.06, 0.16, 10000, 2000, 'highpass');
        playNoise(0.8, 0.2, 3200, 50);
        playSweep(140, 28, 0.7, 'sawtooth', 0.15);
        playSweep(70, 24, 0.9, 'triangle', 0.18);
        playNoise(0.45, 0.13, 900, 60, 'lowpass', 0.18);
        playNoise(0.5, 0.09, 500, 45, 'lowpass', 0.4);
    },

    powerup() {
        if (muted) return;
        playTone(523, 0.08, 'square', 0.1);
        setTimeout(() => playTone(659, 0.08, 'square', 0.1), 80);
        setTimeout(() => playTone(784, 0.12, 'square', 0.1), 160);
    },

    playerDeath() {
        if (muted) return;
        // Falling wail into a full explosion
        playSweep(840, 60, 0.65, 'sawtooth', 0.13);
        playSweep(620, 45, 0.7, 'square', 0.08, 0.05);
        playNoise(0.05, 0.14, 9000, 2000, 'highpass', 0.25);
        playNoise(0.6, 0.18, 2800, 70, 'lowpass', 0.25);
        playSweep(110, 26, 0.6, 'triangle', 0.16, 0.25);
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
        // Screen-clearing shockwave: deep double boom with long rumble tail
        playNoise(0.07, 0.18, 11000, 1500, 'highpass');
        playNoise(0.7, 0.22, 3500, 60);
        playSweep(150, 26, 0.8, 'sawtooth', 0.18);
        playSweep(80, 22, 1.0, 'triangle', 0.2);
        playNoise(0.6, 0.16, 1200, 50, 'lowpass', 0.2);
        playSweep(60, 20, 0.7, 'sawtooth', 0.12, 0.2);
    },
};
