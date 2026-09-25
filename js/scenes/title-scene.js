import { WIDTH, HEIGHT } from '../engine/renderer.js';
import { Audio } from '../engine/audio.js';
import { getImage, getVideo } from '../engine/assets.js';

export class TitleScene {
    constructor() {
        this.age = 0;
        this.scrollY = 0;
    }

    enter() {
        this.age = 0;
        this.scrollY = 0;
        this.playRequested = false;
    }

    update(dt, input) {
        this.age += dt;
        this.scrollY += 30 * dt;

        // The video may finish loading after the scene is entered.
        const video = getVideo('title_video');
        if (video && !this.playRequested) {
            this.playRequested = true;
            video.currentTime = 0;
            video.play().catch(() => {});
        }

        if (input.enter() || input.shoot()) {
            Audio.confirm();
            return 'select';
        }
        return null;
    }

    render(renderer) {
        renderer.drawOceanBackground(this.scrollY);

        // Title
        const titleY = 30 + Math.sin(this.age * 2) * 3;
        renderer.drawTextCentered('MALVINAS', titleY, '#fff', 3);
        renderer.drawTextCentered('S.R.V.', titleY + 28, '#88bbdd', 2);

        // Subtitle
        renderer.drawTextCentered('Soberania, Resistencia, Victoria', 90, '#6699aa', 1);

        // Title cinematic, with the static art until the video has frames
        const video = getVideo('title_video');
        if (video && !video.paused && video.readyState >= 2) {
            renderer.drawImage(video, 0, 110, 256, 142);
        } else {
            renderer.drawImage(getImage('title_art'), 0, 110, 256, 142);
        }
        renderer.drawRect(0, 109, 256, 1, '#88bbdd');
        renderer.drawRect(0, 252, 256, 1, '#88bbdd');

        // Blinking prompt
        if (Math.floor(this.age * 2) % 2 === 0) {
            renderer.drawTextCentered('PRESIONA ENTER', 280, '#aaa', 1);
        }

        // Credits
        renderer.drawTextCentered('Inspirado en nuestros heroes', 340, '#556677', 1);

        // Sound indicator
        const soundTxt = Audio.isMuted() ? 'M: SONIDO OFF' : 'M: SONIDO ON';
        renderer.drawText(soundTxt, 4, HEIGHT - 12, '#445566');
    }

    exit() {
        const video = getVideo('title_video');
        if (video) video.pause();
    }
}
