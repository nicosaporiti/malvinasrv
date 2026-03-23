import { Entity } from './entity.js';
import { WIDTH, HEIGHT } from '../engine/renderer.js';
import { getImage } from '../engine/assets.js';

const SHIP_SIZES = {
    frigate:   { w: 14, h: 44 },
    destroyer: { w: 16, h: 50 },
    carrier:   { w: 20, h: 60 },
};

export class EnemyShip extends Entity {
    constructor(x, y, shipType = 'frigate') {
        const size = SHIP_SIZES[shipType];
        super(x, y, size.w, size.h);
        this.shipType = shipType;
        this.type = 'enemy';
        this.vy = 25;
        this.age = 0;
        this.canDrop = true;
        this.maxHp = 10;

        switch (shipType) {
            case 'frigate':
                this.hp = 10;
                this.maxHp = 10;
                this.points = 1000;
                this.fireCooldown = 1.2;
                break;
            case 'destroyer':
                this.hp = 20;
                this.maxHp = 20;
                this.points = 2000;
                this.fireCooldown = 0.8;
                break;
            case 'carrier':
                this.hp = 40;
                this.maxHp = 40;
                this.points = 5000;
                this.fireCooldown = 0.6;
                break;
        }

        this.fireTimer = 0.5 + Math.random();
    }

    update(dt, playerX, playerY) {
        this.age += dt;

        // Lateral drift for larger ships
        if (this.shipType === 'destroyer' || this.shipType === 'carrier') {
            this.vx = Math.sin(this.age * 0.8) * 12;
        }

        // Evasive movement when player is directly above
        if (playerX !== undefined) {
            const dx = playerX - this.centerX();
            if (Math.abs(dx) < 30 && this.y > 40) {
                this.vx += (dx > 0 ? -40 : 40) * dt;
            }
        }

        super.update(dt);
        this.fireTimer -= dt;

        // Clamp horizontal
        if (this.x < 2) this.x = 2;
        if (this.x + this.w > WIDTH - 2) this.x = WIDTH - this.w - 2;

        if (this.y > HEIGHT + 30) {
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

    getFireBurst(playerX, playerY) {
        const cx = this.centerX();
        const cy = this.centerY();
        const dx = playerX - cx;
        const dy = playerY - cy;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const baseVx = (dx / len) * 100;
        const baseVy = (dy / len) * 100;

        const bullets = [
            { vx: baseVx, vy: baseVy },
        ];

        if (this.shipType !== 'frigate') {
            bullets.push({ vx: baseVx - 20, vy: baseVy });
            bullets.push({ vx: baseVx + 20, vy: baseVy });
        }

        return bullets;
    }

    render(renderer) {
        const spriteKey = this.shipType === 'destroyer' ? 'enemy_destroyer'
                        : this.shipType === 'carrier'   ? 'enemy_carrier'
                        : 'enemy_ship';
        const img = getImage(spriteKey);
        if (img) {
            renderer.drawImage(img, this.x, this.y, this.w, this.h);
        } else {
            renderer.drawRect(this.x, this.y, this.w, this.h, '#667788');
        }

        // Health bar
        const ratio = this.hp / this.maxHp;
        if (ratio < 1) {
            renderer.drawBar(this.x, this.y - 4, this.w, 3, ratio, '#ff4444');
        }
    }
}
