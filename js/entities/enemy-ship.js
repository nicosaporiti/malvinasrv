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

    update(dt, playerX, playerY, islands) {
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

        this._avoidIslands(islands);

        super.update(dt);
        this.fireTimer -= dt;

        // Clamp horizontal
        if (this.x < 2) this.x = 2;
        if (this.x + this.w > WIDTH - 2) this.x = WIDTH - this.w - 2;

        if (this.y > HEIGHT + 30) {
            this.alive = false;
        }
    }

    // Ships are slower than the scroll, so islands overtake them from above:
    // steer sideways around the nearest island closing in on our column.
    _avoidIslands(islands) {
        if (!islands || !islands.length) {
            this._dodge = null;
            return;
        }
        let threat = null;
        let threatGap = Infinity;
        for (const r of islands) {
            if (r.x > this.x + this.w + 6 || r.x + r.w < this.x - 6) continue;
            if (r.y > this.y + this.h) continue;       // already passed us
            const gap = this.y - (r.y + r.h);           // island bottom -> ship top
            if (gap > 170) continue;                    // too far above to matter
            if (gap < threatGap) { threatGap = gap; threat = r; }
        }
        if (!threat) {
            this._dodge = null;
            return;
        }

        // Commit to one side per island so the ship never flip-flops under it.
        // Always escape toward the side that does not require crossing the
        // island; only cross when that side has no room on screen.
        const margin = 6;
        const key = threat.x * 1000 + threat.w;
        let goLeft;
        if (this._dodge && this._dodge.key === key) {
            goLeft = this._dodge.goLeft;
        } else {
            const leftTarget = threat.x - this.w - margin;
            const rightTarget = threat.x + threat.w + margin;
            goLeft = this.centerX() <= threat.x + threat.w / 2;
            if (goLeft && leftTarget < 2) goLeft = false;
            else if (!goLeft && rightTarget + this.w > WIDTH - 2) goLeft = true;
            this._dodge = { key, goLeft };
        }

        const target = goLeft ? threat.x - this.w - margin : threat.x + threat.w + margin;
        const delta = Math.max(2, Math.min(WIDTH - this.w - 2, target)) - this.x;
        this.vx = Math.max(-55, Math.min(55, delta * 1.8));
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
