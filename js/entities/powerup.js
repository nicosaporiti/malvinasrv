import { Entity } from './entity.js';
import { HEIGHT } from '../engine/renderer.js';
import { POWERUP_SPRITE, PALETTES } from '../sprites/sprites.js';

const TYPES = {
    P: { label: 'P', palette: 'powerP', description: 'Power Up' },
    S: { label: 'S', palette: 'powerS', description: 'Speed Up' },
    B: { label: 'B', palette: 'powerB', description: 'Bomb +1' },
    L: { label: 'L', palette: 'powerL', description: 'Life +1' },
};

export class PowerUp extends Entity {
    constructor(x, y, type = 'P') {
        super(x, y, 5, 5);
        this.powerType = type;
        this.type = 'powerup';
        this.vy = 40;
        this.age = 0;
        this.info = TYPES[type];
    }

    update(dt) {
        this.age += dt;
        super.update(dt);
        // Slight horizontal wobble
        this.x += Math.sin(this.age * 5) * 0.3;

        if (this.y > HEIGHT + 10) {
            this.alive = false;
        }
    }

    apply(player) {
        switch (this.powerType) {
            case 'P':
                if (player.weaponLevel < 4) player.weaponLevel++;
                break;
            case 'S':
                player.speedBoost += 20;
                break;
            case 'B':
                player.specialCharges++;
                break;
            case 'L':
                player.lives++;
                break;
        }
    }

    render(renderer) {
        const palette = PALETTES[this.info.palette];
        renderer.drawSprite(POWERUP_SPRITE, palette, this.x, this.y);
        // Draw letter
        renderer.drawText(this.powerType, this.x + 1, this.y + 1, '#fff');
    }
}

export function randomPowerType() {
    const rand = Math.random();
    if (rand < 0.50) return 'P';
    if (rand < 0.75) return 'S';
    if (rand < 0.92) return 'B';
    return 'L';
}
