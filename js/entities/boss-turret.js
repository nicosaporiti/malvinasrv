import { getImage } from '../engine/assets.js';
import { HEIGHT } from '../engine/renderer.js';

const TURRET_SIZE = 24;

export class BossTurret {
    constructor({ offsetX, offsetY, type, hp, cooldown }) {
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.w = TURRET_SIZE;
        this.h = TURRET_SIZE;
        this.type = type;          // 'single', 'spread', 'circular'
        this.hp = hp;
        this.maxHp = hp;
        this.alive = true;
        this.cooldown = cooldown;
        this.fireTimer = 1.0 + Math.random() * 0.5;  // stagger initial shots
        this.angle = Math.PI / 2;  // default pointing down
        this.age = 0;
        this.fireCount = 0;        // for circular rotation offset
        this.fireFlash = 0;        // timer for firing animation
    }

    worldX(bossX) { return bossX + this.offsetX; }
    worldY(bossY) { return bossY + this.offsetY; }
    centerX(bossX) { return this.worldX(bossX) + this.w / 2; }
    centerY(bossY) { return this.worldY(bossY) + this.h / 2; }

    update(dt, playerX, playerY, bossX, bossY) {
        this.age += dt;
        if (this.fireFlash > 0) this.fireFlash -= dt;

        if (!this.alive) return;
        this.fireTimer -= dt;

        // Aim at player
        const cx = this.centerX(bossX);
        const cy = this.centerY(bossY);
        const dx = playerX - cx;
        const dy = playerY - cy;
        this.angle = Math.atan2(dy, dx);
    }

    canFire(bossY) {
        if (!this.alive) return false;
        // Only fire when on screen (top and bottom)
        const wy = this.worldY(bossY);
        if (wy < 0 || wy > HEIGHT) return false;
        if (this.fireTimer <= 0) {
            this.fireTimer = this.cooldown;
            this.fireCount++;
            this.fireFlash = 0.15;  // show fire sprite for 150ms
            return true;
        }
        return false;
    }

    getFirePattern(playerX, playerY, bossX, bossY) {
        const cx = this.centerX(bossX);
        const cy = this.centerY(bossY);
        const dx = playerX - cx;
        const dy = playerY - cy;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const bullets = [];

        switch (this.type) {
            case 'single': {
                bullets.push({
                    x: cx, y: cy,
                    vx: (dx / len) * 120,
                    vy: (dy / len) * 120,
                });
                break;
            }
            case 'spread': {
                const baseAngle = Math.atan2(dy, dx);
                const spreadRad = 20 * Math.PI / 180;  // 20° each side = 40° total
                for (let i = -1; i <= 1; i++) {
                    const a = baseAngle + i * spreadRad;
                    bullets.push({
                        x: cx, y: cy,
                        vx: Math.cos(a) * 100,
                        vy: Math.sin(a) * 100,
                    });
                }
                break;
            }
            case 'circular': {
                const numBullets = 6;
                const rotOffset = this.fireCount * 0.5;  // rotate each burst
                for (let i = 0; i < numBullets; i++) {
                    const a = (i / numBullets) * Math.PI * 2 + rotOffset;
                    bullets.push({
                        x: cx, y: cy,
                        vx: Math.cos(a) * 90,
                        vy: Math.sin(a) * 90,
                    });
                }
                break;
            }
        }

        return bullets;
    }

    takeDamage(amount) {
        if (!this.alive) return;
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            this.alive = false;
        }
    }

    render(renderer, bossX, bossY) {
        const wx = this.worldX(bossX);
        const wy = this.worldY(bossY);
        const ctx = renderer.offCtx;

        if (this.alive) {
            // Pick sprite based on state
            let spriteKey;
            const hpRatio = this.hp / this.maxHp;

            if (this.fireFlash > 0) {
                // Firing animation - alternate between fire1 and fire2
                spriteKey = this.fireFlash > 0.07 ? 'turret_fire2' : 'turret_fire1';
            } else if (hpRatio <= 0.4) {
                spriteKey = 'turret_damaged';
            } else {
                spriteKey = 'turret_idle';
            }

            const img = getImage(spriteKey);
            if (img) {
                // Draw rotated turret sprite
                const cx = wx + this.w / 2;
                const cy = wy + this.h / 2;
                ctx.save();
                ctx.translate(Math.round(cx), Math.round(cy));
                // Sprite points up by default, rotate to face player
                // angle 0 = right, sprite default = up (-PI/2)
                ctx.rotate(this.angle + Math.PI / 2);
                ctx.drawImage(img, -this.w / 2, -this.h / 2, this.w, this.h);
                ctx.restore();
            }

            // Mini HP bar
            if (hpRatio < 1) {
                renderer.drawBar(wx, wy - 3, this.w, 2, hpRatio, '#ff4444', '#331111');
            }
        } else {
            // Destroyed turret sprite
            const img = getImage('turret_destroyed');
            if (img) {
                ctx.drawImage(img, Math.round(wx), Math.round(wy), this.w, this.h);
            }
        }
    }
}
