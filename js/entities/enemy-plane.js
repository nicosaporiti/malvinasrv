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

        super.update(dt);

        // Fire timer
        this.fireTimer -= dt;

        // Off-screen cleanup
        if (this.y > HEIGHT + 20 || this.x < -30 || this.x > WIDTH + 30) {
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
            renderer.drawImage(img, this.x, this.y, SPRITE_W, SPRITE_H);
        } else {
            renderer.drawRect(this.x, this.y, this.w, this.h, '#8888aa');
        }
    }
}
