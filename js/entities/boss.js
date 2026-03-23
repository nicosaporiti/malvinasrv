import { Entity } from './entity.js';
import { WIDTH } from '../engine/renderer.js';
import { getImage } from '../engine/assets.js';

const BOSS_W = 30;
const BOSS_H = 90;

export class Boss extends Entity {
    constructor(bossType = 'frigate_group') {
        super(WIDTH / 2 - BOSS_W / 2, -BOSS_H, BOSS_W, BOSS_H);
        this.bossType = bossType;
        this.type = 'boss';
        this.age = 0;
        this.phase = 0;
        this.entering = true;
        this.targetY = 30;
        this.canDrop = false;

        switch (bossType) {
            case 'frigate_group':
                this.hp = 60;
                this.maxHp = 60;
                this.points = 10000;
                this.fireCooldown = 0.4;
                this.name = 'GRUPO DE FRAGATAS';
                break;
            case 'destroyer_escort':
                this.hp = 100;
                this.maxHp = 100;
                this.points = 20000;
                this.fireCooldown = 0.3;
                this.name = 'ESCOLTA DE DESTRUCTORES';
                break;
            case 'hms_invincible':
                this.hp = 150;
                this.maxHp = 150;
                this.points = 50000;
                this.fireCooldown = 0.25;
                this.name = 'HMS INVINCIBLE';
                break;
        }

        this.fireTimer = 2;
        this.moveDir = 1;
    }

    update(dt, playerX) {
        this.age += dt;

        if (this.entering) {
            this.y += 30 * dt;
            if (this.y >= this.targetY) {
                this.y = this.targetY;
                this.entering = false;
            }
            return;
        }

        // Side-to-side movement
        this.x += this.moveDir * 40 * dt;
        if (this.x > WIDTH - this.w - 10) this.moveDir = -1;
        if (this.x < 10) this.moveDir = 1;

        // Phase changes based on HP
        const hpRatio = this.hp / this.maxHp;
        if (hpRatio < 0.3) this.phase = 2;
        else if (hpRatio < 0.6) this.phase = 1;

        this.fireTimer -= dt;
    }

    canFire() {
        if (this.entering) return false;
        if (this.fireTimer <= 0) {
            this.fireTimer = this.fireCooldown - this.phase * 0.05;
            return true;
        }
        return false;
    }

    getFirePattern(playerX, playerY) {
        const cx = this.centerX();
        const cy = this.y + this.h;
        const bullets = [];

        if (this.phase === 0) {
            // Aimed shots
            const dx = playerX - cx;
            const dy = playerY - cy;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            bullets.push({ x: cx, y: cy, vx: (dx / len) * 130, vy: (dy / len) * 130 });
        } else if (this.phase === 1) {
            // Spread
            for (let a = -30; a <= 30; a += 15) {
                const rad = (a + 90) * Math.PI / 180;
                bullets.push({ x: cx, y: cy, vx: Math.cos(rad) * 110, vy: Math.sin(rad) * 110 });
            }
        } else {
            // Fury mode - circular burst
            const numBullets = 8;
            const offsetAngle = this.age * 2;
            for (let i = 0; i < numBullets; i++) {
                const rad = (i / numBullets) * Math.PI * 2 + offsetAngle;
                bullets.push({ x: cx, y: cy, vx: Math.cos(rad) * 100, vy: Math.sin(rad) * 100 });
            }
        }

        return bullets;
    }

    render(renderer) {
        const img = getImage('boss');
        if (img) {
            renderer.drawImage(img, this.x, this.y, this.w, this.h);
        } else {
            renderer.drawRect(this.x, this.y, this.w, this.h, '#556677');
        }

        // Flash on damage
        if (this.age % 0.1 < 0.02 && this.phase >= 1) {
            renderer.drawRect(this.x, this.y, this.w, this.h, 'rgba(255,100,100,0.3)');
        }
    }
}
