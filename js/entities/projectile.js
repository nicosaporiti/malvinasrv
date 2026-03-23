import { Entity } from './entity.js';
import { HEIGHT } from '../engine/renderer.js';
import { getImage } from '../engine/assets.js';

export class Projectile extends Entity {
    constructor(x, y, vx, vy, damage, isPlayer) {
        super(x, y, 2, 4);
        this.vx = vx;
        this.vy = vy;
        this.damage = damage;
        this.isPlayer = isPlayer;
        this.type = 'projectile';
        this.sprite = null; // 'missile', 'bomb', or null for default
        this.spriteW = 2;
        this.spriteH = 4;
    }

    update(dt) {
        super.update(dt);
        if (this.y < -10 || this.y > HEIGHT + 10 || this.x < -10 || this.x > 266) {
            this.alive = false;
        }
    }

    render(renderer) {
        if (this.sprite) {
            const img = getImage(this.sprite);
            if (img) {
                renderer.drawImage(img, this.x, this.y, this.spriteW, this.spriteH);
                return;
            }
        }
        const color = this.isPlayer ? '#aaddff' : '#ff6644';
        renderer.drawRect(this.x, this.y, this.w, this.h, color);
    }
}

// Object pool
const POOL_SIZE = 200;
const pool = [];
for (let i = 0; i < POOL_SIZE; i++) {
    const p = new Projectile(0, 0, 0, 0, 0, true);
    p.alive = false;
    pool.push(p);
}

export function spawnProjectile(x, y, vx, vy, damage, isPlayer, sprite = null, spriteW = 2, spriteH = 4) {
    const p = pool.find(p => !p.alive);
    if (!p) return null;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.damage = damage;
    p.isPlayer = isPlayer;
    p.alive = true;
    p.hp = 1;
    p.sprite = sprite;
    p.spriteW = spriteW;
    p.spriteH = spriteH;
    if (sprite) {
        p.w = spriteW;
        p.h = spriteH;
    } else {
        p.w = 2;
        p.h = 4;
    }
    return p;
}

export function getProjectilePool() {
    return pool;
}
