export const WIDTH = 256;
export const HEIGHT = 384;

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

    drawOceanBackground(scrollY) {
        this.clear('#0a2a4a');

        // Wave lines
        const waveSpacing = 32;
        const offset = scrollY % waveSpacing;
        this.offCtx.strokeStyle = '#0d3358';
        this.offCtx.lineWidth = 1;
        for (let y = -waveSpacing + offset; y < HEIGHT + waveSpacing; y += waveSpacing) {
            this.offCtx.beginPath();
            for (let x = 0; x < WIDTH; x += 4) {
                const wy = y + Math.sin((x + scrollY * 0.5) * 0.05) * 3;
                if (x === 0) this.offCtx.moveTo(x, wy);
                else this.offCtx.lineTo(x, wy);
            }
            this.offCtx.stroke();
        }

        // Lighter wave layer
        const offset2 = (scrollY * 0.7) % (waveSpacing * 1.5);
        this.offCtx.strokeStyle = '#0f3d6b';
        for (let y = -waveSpacing + offset2; y < HEIGHT + waveSpacing; y += waveSpacing * 1.5) {
            this.offCtx.beginPath();
            for (let x = 0; x < WIDTH; x += 4) {
                const wy = y + Math.sin((x + scrollY * 0.3) * 0.08) * 2;
                if (x === 0) this.offCtx.moveTo(x, wy);
                else this.offCtx.lineTo(x, wy);
            }
            this.offCtx.stroke();
        }
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
