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
        this.inputArmed = false;
        this.isTouch = false;
        this.retryVideo = () => this.playVideo();
        for (const event of ['pointerup', 'touchend', 'keydown', 'click']) {
            window.addEventListener(event, this.retryVideo, true);
        }
        this.playVideo();
    }

    playVideo() {
        const video = getVideo('title_video');
        if (!video || !video.paused || this.playRequested) return;
        this.playRequested = true;
        // Retry only on a new gesture, not on every animation frame.
        video.play().catch(() => {}).finally(() => {
            this.playRequested = false;
        });
    }

    update(dt, input) {
        this.age += dt;
        this.scrollY += 30 * dt;

        this.isTouch = input.isTouch();

        // While audio is locked the first gesture only unlocks it (starting
        // the title music) instead of leaving the title. Input is then armed
        // once the keys are released, so that same press doesn't skip ahead.
        if (!Audio.isUnlocked()) {
            this.inputArmed = false;
            return null;
        }
        if (!this.inputArmed) {
            this.inputArmed = !input.enter() && !input.shoot();
            return null;
        }

        if (input.enter() || input.shoot()) {
            Audio.confirm();
            return 'select';
        }
        return null;
    }

    render(renderer) {
        // Full-screen title cinematic, with its first frame until it plays
        const video = getVideo('title_video');
        const poster = getImage('title_poster');
        if (video && !video.paused && video.readyState >= 2) {
            renderer.drawImage(video, 0, 0, WIDTH, HEIGHT);
        } else if (poster) {
            renderer.drawImage(poster, 0, 0, WIDTH, HEIGHT);
        } else {
            renderer.drawOceanBackground(this.scrollY);
        }

        // Darken the top and bottom so the text reads over the video
        const ctx = renderer.offCtx;
        const top = ctx.createLinearGradient(0, 0, 0, 120);
        top.addColorStop(0, 'rgba(0,0,0,0.6)');
        top.addColorStop(0.7, 'rgba(0,0,0,0.3)');
        top.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = top;
        ctx.fillRect(0, 0, WIDTH, 120);
        const bottom = ctx.createLinearGradient(0, 290, 0, HEIGHT);
        bottom.addColorStop(0, 'rgba(0,0,0,0)');
        bottom.addColorStop(1, 'rgba(0,0,0,0.7)');
        ctx.fillStyle = bottom;
        ctx.fillRect(0, 290, WIDTH, HEIGHT - 290);

        const text = (str, y, color, size = 1) => {
            renderer.drawTextCentered(str, y + 1, 'rgba(0,0,0,0.85)', size);
            renderer.drawTextCentered(str, y, color, size);
        };

        // Title
        const titleY = 30 + Math.sin(this.age * 2) * 3;
        text('MALVINAS', titleY, '#fff', 3);
        text('S.R.V.', titleY + 28, '#88bbdd', 2);

        // Subtitle
        text('Soberania, Resistencia, Victoria', 90, '#99bbcc');

        // Blinking prompt
        if (Math.floor(this.age * 2) % 2 === 0) {
            let prompt = 'PRESIONA ENTER';
            if (!Audio.isUnlocked()) {
                prompt = this.isTouch ? 'TOCA LA PANTALLA' : 'PRESIONA UNA TECLA';
            }
            text(prompt, 300, '#ddd');
        }

        // Credits
        text('Inspirado en nuestros heroes', 346, '#8899aa');

        // Sound indicator
        const soundTxt = Audio.isMuted() ? 'M: SONIDO OFF' : 'M: SONIDO ON';
        renderer.drawText(soundTxt, 4, HEIGHT - 12, '#778899');
    }

    exit() {
        for (const event of ['pointerup', 'touchend', 'keydown', 'click']) {
            window.removeEventListener(event, this.retryVideo, true);
        }
        const video = getVideo('title_video');
        if (video) video.pause();
    }
}
