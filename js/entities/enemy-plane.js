import { Entity } from './entity.js';
import { WIDTH, HEIGHT } from '../engine/renderer.js';
import { getImage } from '../engine/assets.js';

const SPRITE_W = 20;
const SPRITE_H = 22;

export class EnemyPlane extends Entity {
    constructor(x, y, pattern, hp = 1, points = 100) {
        super(x, y, SPRITE_W, SPRITE_H);
        this.pattern = pattern;
        this.hp = hp;
        this.points = points;
        this.type = 'enemy';
        this.fireTimer = 1 + Math.random() * 2;
        this.fireCooldown = 1.5 + Math.random();
        this.age = 0;
        this.startX = x;
        this.startY = y;
        this.canDrop = Math.random() < 0.15;
        this.flipped = false;

        this._applyPattern();
    }

    _applyPattern() {
        switch (this.pattern) {
            case 'straight':
                this.vy = 80;
                break;
            case 'fast':
                this.vy = 140;
                break;
            case 'sine':
                this.vy = 70;
                break;
            case 'dive':
                this.vy = 60;
                break;
            case 'strafe_left':
                this.vx = -50;
                this.vy = 60;
                break;
            case 'strafe_right':
                this.vx = 50;
                this.vy = 60;
                break;
            case 'ambush_bottom':
                this.vy = -100;
                this.flipped = true;
                break;
            case 'flank_left':
                this.vx = 90;
                this.vy = 30;
                break;
            case 'flank_right':
                this.vx = -90;
                this.vy = 30;
                break;
            case 'formation_v':
                this.vy = 65;
                break;
            case 'chase':
                this.vy = 50;
                break;
            case 'zigzag':
                this.vy = 75;
                break;
        }
    }

    update(dt, playerX, playerY) {
        this.age += dt;

        if (this.pattern === 'sine') {
            this.x = this.startX + Math.sin(this.age * 3) * 30;
        }

        if (this.pattern === 'dive' && this.age > 1.5) {
            this.vy = 160;
            const dx = playerX - this.centerX();
            this.vx = Math.sign(dx) * 40;
        }

        // Ambush: fly up, then loop around and dive toward player
        if (this.pattern === 'ambush_bottom') {
            if (this.age > 2.0 && this.vy < 0) {
                this.vy += 300 * dt;
                this.flipped = false;
            }
            if (this.age > 2.5) {
                this.vy = Math.min(this.vy + 200 * dt, 160);
                const dx = playerX - this.centerX();
                this.vx = Math.sign(dx) * 30;
            }
        }

        // Flank: after crossing center, curve downward
        if (this.pattern === 'flank_left' && this.age > 1.5) {
            this.vx *= 0.98;
            this.vy = 80;
        }
        if (this.pattern === 'flank_right' && this.age > 1.5) {
            this.vx *= 0.98;
            this.vy = 80;
        }

        // Formation V: wobble around start position
        if (this.pattern === 'formation_v') {
            this.x = this.startX + Math.sin(this.age * 1.5) * 8;
        }

        // Chase: steer toward player
        if (this.pattern === 'chase') {
            const dx = playerX - this.centerX();
            const dy = playerY - this.centerY();
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            this.vx += (dx / len) * 120 * dt;
            this.vy += (dy / len) * 80 * dt;
            const maxSpd = 130;
            const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (spd > maxSpd) {
                this.vx = (this.vx / spd) * maxSpd;
                this.vy = (this.vy / spd) * maxSpd;
            }
            // Lifespan limit
            if (this.age > 6) this.alive = false;
        }

        // Zigzag: quick lateral reversals
        if (this.pattern === 'zigzag') {
            const phase = Math.floor(this.age / 0.6);
            this.vx = (phase % 2 === 0 ? 1 : -1) * 70;
        }

        super.update(dt);

        // Fire timer
        this.fireTimer -= dt;

        // Off-screen cleanup
        if (this.y > HEIGHT + 20 || this.x < -30 || this.x > WIDTH + 30) {
            this.alive = false;
        }
        // Upward-flying planes that escaped off top
        if (this.y < -60 && this.age > 3) {
            this.alive = false;
        }
    }

    canFire() {
        if (this.fireTimer <= 0) {
            this.fireTimer = this.fireCooldown;
            return true;
        }
        return false;
    }

    getFireDir(playerX, playerY) {
        const dx = playerX - this.centerX();
        const dy = playerY - this.centerY();
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        return { vx: (dx / len) * 120, vy: (dy / len) * 120 };
    }

    render(renderer) {
        const img = getImage('enemy_harrier');
        if (img) {
            if (this.flipped) {
                renderer.offCtx.save();
                renderer.offCtx.translate(Math.round(this.x + this.w / 2), Math.round(this.y + this.h / 2));
                renderer.offCtx.scale(1, -1);
                renderer.offCtx.drawImage(img, -this.w / 2, -this.h / 2, this.w, this.h);
                renderer.offCtx.restore();
            } else {
                renderer.drawImage(img, this.x, this.y, SPRITE_W, SPRITE_H);
            }
        } else {
            renderer.drawRect(this.x, this.y, this.w, this.h, '#8888aa');
        }
    }
}
