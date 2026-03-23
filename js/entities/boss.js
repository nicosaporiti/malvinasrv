import { Entity } from './entity.js';
import { WIDTH, HEIGHT } from '../engine/renderer.js';
import { getImage } from '../engine/assets.js';
import { BossTurret } from './boss-turret.js';

const BOSS_CONFIGS = {
    frigate_group: {
        w: 122, h: 612,
        name: 'DESTRUCTOR TYPE 42',
        points: 10000,
        sprite: 'boss_frigate',
        turrets: [
            { offsetX: 35,  offsetY: 80,  type: 'single', hp: 15, cooldown: 1.0 },
            { offsetX: 63,  offsetY: 80,  type: 'single', hp: 15, cooldown: 1.0 },
            { offsetX: 30,  offsetY: 270, type: 'spread', hp: 15, cooldown: 1.2 },
            { offsetX: 68,  offsetY: 270, type: 'spread', hp: 15, cooldown: 1.2 },
        ],
    },
    destroyer_escort: {
        w: 128, h: 495,
        name: 'HMS SHEFFIELD',
        points: 20000,
        sprite: 'boss_destroyer',
        turrets: [
            { offsetX: 38,  offsetY: 50,  type: 'single',   hp: 15, cooldown: 0.9 },
            { offsetX: 66,  offsetY: 50,  type: 'single',   hp: 15, cooldown: 0.9 },
            { offsetX: 28,  offsetY: 180, type: 'spread',   hp: 18, cooldown: 1.0 },
            { offsetX: 76,  offsetY: 180, type: 'spread',   hp: 18, cooldown: 1.0 },
            { offsetX: 32,  offsetY: 340, type: 'circular', hp: 17, cooldown: 1.2 },
            { offsetX: 72,  offsetY: 340, type: 'circular', hp: 17, cooldown: 1.2 },
        ],
    },
    hms_invincible: {
        w: 160, h: 284,
        name: 'HMS INVINCIBLE',
        points: 50000,
        sprite: 'boss_carrier',
        turrets: [
            { offsetX: 8,   offsetY: 20,  type: 'single',   hp: 18, cooldown: 0.7 },
            { offsetX: 128, offsetY: 20,  type: 'single',   hp: 18, cooldown: 0.7 },
            { offsetX: 3,   offsetY: 90,  type: 'spread',   hp: 20, cooldown: 0.8 },
            { offsetX: 133, offsetY: 90,  type: 'spread',   hp: 20, cooldown: 0.8 },
            { offsetX: 6,   offsetY: 160, type: 'spread',   hp: 18, cooldown: 0.9 },
            { offsetX: 130, offsetY: 160, type: 'spread',   hp: 18, cooldown: 0.9 },
            { offsetX: 13,  offsetY: 225, type: 'circular', hp: 19, cooldown: 1.0 },
            { offsetX: 123, offsetY: 225, type: 'circular', hp: 19, cooldown: 1.0 },
        ],
    },
};

export class Boss extends Entity {
    constructor(bossType = 'frigate_group') {
        const config = BOSS_CONFIGS[bossType];
        super(WIDTH / 2 - config.w / 2, -config.h, config.w, config.h);

        this.bossType = bossType;
        this.type = 'boss';
        this.name = config.name;
        this.points = config.points;
        this.config = config;
        this.spriteKey = config.sprite;

        // Turrets
        this.turrets = config.turrets.map(t => new BossTurret(t));
        this.totalMaxHp = this.turrets.reduce((sum, t) => sum + t.maxHp, 0);

        // Movement — boss scrolls through, doesn't stop
        this.entering = true;
        this.scrollSpeed = 12;     // px/s — slow scroll down
        this.age = 0;
        this.canDrop = false;

        // Death sequence
        this.defeated = false;
        this.deathTimer = 0;
        this.deathExplosionTimer = 0;
        this.alive = true;
    }

    update(dt, playerX, playerY) {
        this.age += dt;

        // Boss scrolls down slowly, but clamp so lowest turret stays on screen
        if (!this.defeated) {
            this.y += this.scrollSpeed * dt;
            // Find the lowest turret and ensure it doesn't go below viewport
            const lowestTurretY = Math.max(...this.turrets.map(t => t.offsetY + t.h));
            const maxY = HEIGHT - lowestTurretY - 20;
            if (this.y > maxY) this.y = maxY;
        }

        // Entering flag: false once the full ship is visible
        if (this.entering && this.y >= 0) {
            this.entering = false;
        }

        // Update turrets
        for (const t of this.turrets) {
            t.update(dt, playerX, playerY, this.x, this.y);
        }

        // Death sequence
        if (this.defeated) {
            this.deathTimer += dt;
            if (this.deathTimer >= 2.5) {
                this.alive = false;
            }
        }
    }

    getTotalHp() {
        return this.turrets.reduce((sum, t) => sum + (t.alive ? t.hp : 0), 0);
    }

    isDefeated() {
        return this.turrets.every(t => !t.alive);
    }

    startDeathSequence() {
        this.defeated = true;
        this.deathTimer = 0;
        this.deathExplosionTimer = 0;
    }

    shouldChainExplode(dt) {
        if (!this.defeated) return false;
        this.deathExplosionTimer += dt;
        if (this.deathExplosionTimer >= 0.12) {
            this.deathExplosionTimer -= 0.12;
            return true;
        }
        return false;
    }

    getRandomHullPos() {
        const marginX = this.w * 0.2;
        const marginY = this.h * 0.05;
        return {
            x: this.x + marginX + Math.random() * (this.w - marginX * 2),
            y: Math.max(0, Math.min(HEIGHT, this.y + marginY + Math.random() * (this.h - marginY * 2))),
        };
    }

    getStrongestTurret() {
        let best = null;
        let bestHp = 0;
        for (const t of this.turrets) {
            if (t.alive && t.hp > bestHp) {
                best = t;
                bestHp = t.hp;
            }
        }
        return best;
    }

    render(renderer) {
        // Draw ship sprite scaled to boss size
        const img = getImage(this.spriteKey);
        if (img) {
            renderer.drawImage(img, this.x, this.y, this.w, this.h);
        } else {
            renderer.drawRect(this.x, this.y, this.w, this.h, '#556677');
        }

        // Damage flash when defeated
        if (this.defeated && Math.floor(this.age * 10) % 2 === 0) {
            renderer.drawRect(this.x, this.y, this.w, this.h, 'rgba(255,100,50,0.15)');
        }

        // Draw turrets
        for (const t of this.turrets) {
            const wy = t.worldY(this.y);
            if (wy > -20 && wy < HEIGHT + 20) {
                t.render(renderer, this.x, this.y);
            }
        }
    }
}
