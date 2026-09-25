import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const pending = () => new Promise(() => {});
const flush = () => new Promise(setImmediate);
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

async function worker(fetch, cached) {
    const listeners = {};
    const timers = new Map();
    const writes = [];
    const context = vm.createContext({
        URL, fetch,
        setTimeout(fn, ms) { timers.set(fn, ms); return fn; },
        clearTimeout(id) { timers.delete(id); },
        caches: {
            match: async () => cached,
            open: async () => ({ put: async (key, value) => writes.push([key, value]) }),
        },
        self: {
            location: { origin: 'https://game.test' },
            addEventListener: (name, fn) => { listeners[name] = fn; },
        },
    });
    vm.runInContext(await read('sw.js'), context);
    return {
        timers, writes,
        request(mode = 'cors', headers = new Headers()) {
            let response;
            const background = [];
            listeners.fetch({
                request: { method: 'GET', url: 'https://game.test/js/main.js', mode, headers },
                respondWith(promise) { response = promise; },
                waitUntil(promise) { background.push(promise); },
            });
            return { response, background };
        },
    };
}

for (const mode of ['navigate', 'cors']) {
    test(`cached ${mode} responds when the network hangs`, async () => {
        const cached = { cached: true };
        const sw = await worker(pending, cached);
        const { response } = sw.request(mode);
        await flush();
        assert.equal(sw.timers.size, 1, 'cached requests need a bounded network wait');
        for (const [timer, ms] of sw.timers) {
            assert.ok(ms <= 3000);
            timer();
        }
        assert.equal(await response, cached);
    });
}

test('fast network wins and refreshes cache', async () => {
    const fresh = { status: 200, clone() { return this; } };
    const sw = await worker(async () => fresh, { cached: true });
    const { response, background } = sw.request();
    assert.equal(await response, fresh);
    await Promise.all(background);
    assert.equal(sw.writes[0][1], fresh);
    assert.equal(sw.timers.size, 0);
});

test('a late network response still refreshes the cache', async () => {
    let finish;
    const fresh = { status: 200, clone() { return this; } };
    const cached = { cached: true };
    const sw = await worker(() => new Promise(resolve => { finish = resolve; }), cached);
    const { response, background } = sw.request();
    await flush();
    assert.equal(sw.timers.size, 1);
    for (const timer of sw.timers.keys()) timer();
    assert.equal(await response, cached);
    finish(fresh);
    await Promise.all(background);
    assert.equal(sw.writes[0][1], fresh);
});

test('first visit waits for network when there is no cached copy', async () => {
    const fresh = { status: 200, clone() { return this; } };
    const sw = await worker(async () => fresh, undefined);
    assert.equal(await sw.request().response, fresh);
});

test('offline requests use the cached copy', async () => {
    const cached = { cached: true };
    const sw = await worker(async () => { throw new Error('offline'); }, cached);
    assert.equal(await sw.request().response, cached);
});

test('stage art and video cannot hold the sprite loader', async () => {
    const images = [];
    const context = vm.createContext({
        console,
        Image: class {
            set src(value) {
                images.push(value);
                if (!value.includes('stage_')) queueMicrotask(() => this.onload());
            }
        },
        fetch: pending,
        document: {
            createElement: () => ({ style: {}, setAttribute() {}, load() {} }),
            body: { appendChild() {} },
        },
    });
    const module = new vm.SourceTextModule(await read('js/engine/assets.js'), { context });
    await module.link(() => {});
    await module.evaluate();
    let loaded = false;
    module.namespace.loadAllAssets().then(() => { loaded = true; });
    await flush();
    assert.equal(loaded, true);
    assert.ok(images.includes('assets/stage_1.png'));
});

test('title and game loop start while music remains pending', async () => {
    let entered = false;
    let started = false;
    const context = vm.createContext({
        console, navigator: {}, document: { getElementById() {} },
    });
    class Scene { enter() { entered = true; } }
    const exports = {
        GameLoop: class { start() { started = true; } },
        Input: class {},
        Renderer: class { clear() {} drawTextCentered() {} flush() {} },
        Audio: { playMusic() {} }, preloadMusic: pending, installAudioUnlock() {},
        loadAllAssets: async () => {},
        TitleScene: Scene, SelectScene: Scene, GameScene: Scene, GameOverScene: Scene,
    };
    const module = new vm.SourceTextModule(await read('js/main.js'), { context });
    await module.link(() => new vm.SyntheticModule(Object.keys(exports), function () {
        for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    }, { context }));
    await module.evaluate();
    await flush();
    assert.equal(entered, true);
    assert.equal(started, true);
});


test('media range requests are handled natively without a full-file cache response', async () => {
    let fetched = false;
    const sw = await worker(async () => { fetched = true; }, { cached: true });
    const { response, background } = sw.request('cors', new Headers({ Range: 'bytes=0-1' }));
    assert.equal(response, undefined, 'the browser should handle the range request');
    assert.equal(fetched, false);
    assert.equal(background.length, 0);
});
