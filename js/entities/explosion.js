import { getImage } from '../engine/assets.js';

const FRAME_COUNT = 5;
const POOL_SIZE = 50;
const pool = [];

export class Explosion {
    constructor() {
        this.alive = false;
        this.x = 0;
        this.y = 0;
        this.age = 0;
        this.duration = 0.5;
        this.size = 24;
    }

    init(x, y, size = 24) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.age = 0;
        this.duration = 0.08 * FRAME_COUNT + size * 0.005;
        this.alive = true;
    }

    update(dt) {
        this.age += dt;
        if (this.age >= this.duration) {
            this.alive = false;
        }
    }

    render(renderer) {
        const progress = this.age / this.duration;
        const frameIdx = Math.min(Math.floor(progress * FRAME_COUNT), FRAME_COUNT - 1);
        const img = getImage(`explosion_${frameIdx}`);

        if (img) {
            const s = this.size;
            renderer.drawImage(img, this.x - s / 2, this.y - s / 2, s, s);
        }
    }
}

// Pool
for (let i = 0; i < POOL_SIZE; i++) {
    pool.push(new Explosion());
}

export function spawnExplosion(x, y, size = 24) {
    const e = pool.find(e => !e.alive);
    if (e) e.init(x, y, size);
    return e;
}

export function getExplosionPool() {
    return pool;
}
