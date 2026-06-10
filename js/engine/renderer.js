export const WIDTH = 256;
export const HEIGHT = 384;

import { getOcean } from './background.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;

        this.offscreen = document.createElement('canvas');
        this.offscreen.width = WIDTH;
        this.offscreen.height = HEIGHT;
        this.offCtx = this.offscreen.getContext('2d');
        this.offCtx.imageSmoothingEnabled = false;

        this.ocean = getOcean();
    }

    clear(color = '#1a3a5c') {
        this.offCtx.fillStyle = color;
        this.offCtx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    drawRect(x, y, w, h, color) {
        this.offCtx.fillStyle = color;
        this.offCtx.fillRect(Math.round(x), Math.round(y), w, h);
    }

    drawSprite(spriteData, palette, x, y) {
        const px = Math.round(x);
        const py = Math.round(y);
        for (let row = 0; row < spriteData.length; row++) {
            for (let col = 0; col < spriteData[row].length; col++) {
                const colorIdx = spriteData[row][col];
                if (colorIdx === 0) continue;
                this.offCtx.fillStyle = palette[colorIdx];
                this.offCtx.fillRect(px + col, py + row, 1, 1);
            }
        }
    }

    drawText(text, x, y, color = '#fff', size = 1) {
        this.offCtx.fillStyle = color;
        this.offCtx.font = `${8 * size}px monospace`;
        this.offCtx.textBaseline = 'top';
        this.offCtx.fillText(text, Math.round(x), Math.round(y));
    }

    drawTextCentered(text, y, color = '#fff', size = 1) {
        this.offCtx.fillStyle = color;
        this.offCtx.font = `${8 * size}px monospace`;
        this.offCtx.textBaseline = 'top';
        this.offCtx.textAlign = 'center';
        this.offCtx.fillText(text, WIDTH / 2, Math.round(y));
        this.offCtx.textAlign = 'left';
    }

    drawOceanBackground(scrollY, theme = 'open', withClouds = true) {
        this.ocean.setTheme(theme);
        this.ocean.render(this.offCtx, scrollY, withClouds);
    }

    drawCloudLayer(scrollY) {
        this.ocean.renderCloudLayer(this.offCtx, scrollY);
    }

    drawImage(img, x, y, w, h) {
        if (!img) return;
        this.offCtx.drawImage(img, Math.round(x), Math.round(y), w, h);
    }

    drawImageCentered(img, cx, cy, w, h) {
        if (!img) return;
        this.offCtx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
    }

    drawBar(x, y, w, h, ratio, fgColor, bgColor = '#333') {
        this.drawRect(x, y, w, h, bgColor);
        this.drawRect(x, y, Math.round(w * ratio), h, fgColor);
    }

    flush() {
        this.ctx.drawImage(this.offscreen, 0, 0, this.canvas.width, this.canvas.height);
    }
}
