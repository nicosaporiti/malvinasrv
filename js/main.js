import { GameLoop } from './engine/game-loop.js';
import { Input } from './engine/input.js';
import { Renderer } from './engine/renderer.js';
import { Audio, preloadMusic } from './engine/audio.js';
import { loadAllAssets } from './engine/assets.js';
import { TitleScene } from './scenes/title-scene.js';
import { SelectScene } from './scenes/select-scene.js';
import { GameScene } from './scenes/game-scene.js';
import { GameOverScene } from './scenes/gameover-scene.js';

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((err) => {
            console.error('Service worker registration failed:', err);
        });
    });
}

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const input = new Input();

const scenes = {
    title: new TitleScene(),
    select: new SelectScene(),
    game: new GameScene(),
    gameover: new GameOverScene(),
};

let currentScene = null;
let selectedAircraft = null;

function switchScene(name, data) {
    if (currentScene) currentScene.exit();

    if (typeof name === 'object') {
        data = name;
        name = data.scene;
    }

    currentScene = scenes[name];

    switch (name) {
        case 'title':
            Audio.playMusic('title');
            currentScene.enter();
            break;
        case 'select':
            currentScene.enter();
            break;
        case 'game':
            Audio.playMusic('stage');
            currentScene.enter(data.aircraft || selectedAircraft, data.stageIndex || 0);
            break;
        case 'gameover':
            Audio.playMusic('gameover', false);
            currentScene.enter(data);
            break;
        default:
            currentScene.enter();
    }
}

function update(dt) {
    input.update();

    // Mute toggle (global)
    if (input.justPressed('KeyM')) {
        Audio.toggle();
    }

    const result = currentScene.update(dt, input);

    if (result) {
        if (typeof result === 'string') {
            switchScene(result);
        } else if (result.scene === 'game') {
            if (result.aircraft) selectedAircraft = result.aircraft;
            switchScene('game', { aircraft: selectedAircraft });
        } else {
            switchScene(result);
        }
    }
}

function render() {
    renderer.clear();
    currentScene.render(renderer);
    renderer.flush();
}

// Start - load assets then launch
renderer.clear('#0a2a4a');
renderer.drawTextCentered('CARGANDO...', 190, '#88bbdd', 1);
renderer.flush();

Promise.all([loadAllAssets(), preloadMusic()]).then(() => {
    switchScene('title');
    const loop = new GameLoop(update, render);
    loop.start();
}).catch(err => {
    console.error('Error loading assets:', err);
    switchScene('title');
    const loop = new GameLoop(update, render);
    loop.start();
});
