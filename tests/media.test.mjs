import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const flush = () => new Promise(setImmediate);

async function loadModule(path, globals, imports = {}) {
    const context = vm.createContext({ console, ...globals });
    const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
    const module = new vm.SourceTextModule(source, { context });
    await module.link(() => new vm.SyntheticModule(Object.keys(imports), function () {
        for (const [name, value] of Object.entries(imports)) this.setExport(name, value);
    }, { context }));
    await module.evaluate();
    return module.namespace;
}

function mediaEnvironment() {
    const elements = [];
    const listeners = new Map();
    const window = {
        addEventListener(name, listener) { listeners.set(name, listener); },
        removeEventListener(name, listener) {
            if (listeners.get(name) === listener) listeners.delete(name);
        },
        AudioContext: class { state = 'running'; },
    };
    const document = {
        body: { appendChild() {} },
        createElement(tag) {
            const media = {
                tag, style: {}, paused: true, ended: false, plays: 0,
                src: '', currentTime: 0, blocked: false,
                setAttribute() {}, getAttribute(name) { return this[name]; },
                load() {}, pause() { this.paused = true; },
                play() {
                    this.plays++;
                    if (this.blocked) return Promise.reject({ name: 'NotAllowedError' });
                    this.paused = false;
                    return Promise.resolve();
                },
            };
            elements.push(media);
            return media;
        },
    };
    return { window, document, elements, listeners };
}

test('music uses native buffering, reuses the unlocked element and switches immediately', async () => {
    const env = mediaEnvironment();
    const { Audio, preloadMusic, installAudioUnlock } = await loadModule('js/engine/audio.js', env);
    preloadMusic();
    const music = env.elements[0];
    assert.equal(music.src, 'assets/music_title.mp3');
    music.blocked = true;
    Audio.playMusic('title');
    await flush();
    assert.equal(music.paused, true);
    installAudioUnlock();
    music.blocked = false;
    env.listeners.get('touchend')();
    assert.equal(music.paused, false, 'play must run inside the gesture');
    Audio.playMusic('stage');
    assert.equal(music.src, 'assets/music_stage.mp3');
    assert.equal(music.paused, false);
    assert.equal(env.elements.length, 1);
    assert.equal(music.loop, true);
    Audio.toggle();
    assert.equal(music.muted, true);
    Audio.playMusic('gameover', false);
    assert.equal(music.loop, false);
    assert.equal(music.muted, true);
    music.ended = true;
    music.paused = true;
    const plays = music.plays;
    env.listeners.get('touchend')();
    assert.equal(music.plays, plays, 'a gesture must not restart a finished one-shot track');
    Audio.stopMusic();
    env.listeners.get('touchend')();
    assert.equal(music.plays, plays, 'a gesture must not restart stopped music');
});

test('video is available for playback before loadeddata and retries after autoplay rejection', async () => {
    const env = mediaEnvironment();
    const assets = await loadModule('js/engine/assets.js', env);
    const video = assets.loadVideo('title_video', 'assets/title_video.mp4');
    assert.equal(assets.getVideo('title_video'), video);
    assert.equal(video.src, 'assets/title_video.mp4');
    assert.equal(video.playsInline, true);
    assert.equal(video.muted, true);
    const { TitleScene } = await loadModule('js/scenes/title-scene.js', env, {
        WIDTH: 256, HEIGHT: 384, Audio: {}, ...assets,
    });
    const scene = new TitleScene();
    video.blocked = true;
    scene.enter();
    await flush();
    assert.equal(video.paused, true);
    video.blocked = false;
    env.listeners.get('touchend')();
    assert.equal(video.paused, false);
    scene.exit();
    assert.equal(video.paused, true);
    assert.equal(env.listeners.size, 0);
});
