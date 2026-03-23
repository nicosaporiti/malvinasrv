import { WIDTH, HEIGHT } from '../engine/renderer.js';
import { AIRCRAFT_LIST } from '../data/aircraft.js';
import { getImage } from '../engine/assets.js';
import { Audio } from '../engine/audio.js';

export class SelectScene {
    constructor() {
        this.selected = 0;
        this.age = 0;
        this.scrollY = 0;
    }

    enter() {
        this.selected = 0;
        this.age = 0;
        this.scrollY = 0;
    }

    update(dt, input) {
        this.age += dt;
        this.scrollY += 20 * dt;

        if (input.justPressed('ArrowLeft') || input.justPressed('KeyA')) {
            this.selected = (this.selected - 1 + AIRCRAFT_LIST.length) % AIRCRAFT_LIST.length;
            Audio.select();
        }
        if (input.justPressed('ArrowRight') || input.justPressed('KeyD')) {
            this.selected = (this.selected + 1) % AIRCRAFT_LIST.length;
            Audio.select();
        }
        if (input.enter()) {
            Audio.confirm();
            return { scene: 'game', aircraft: AIRCRAFT_LIST[this.selected] };
        }

        return null;
    }

    render(renderer) {
        renderer.drawOceanBackground(this.scrollY);

        renderer.drawTextCentered('SELECCIONA TU AVION', 20, '#fff', 1);

        const cardW = 70;
        const startX = (WIDTH - cardW * 3 - 10) / 2;

        for (let i = 0; i < AIRCRAFT_LIST.length; i++) {
            const ac = AIRCRAFT_LIST[i];
            const cx = startX + i * (cardW + 5);
            const cy = 50;
            const isSelected = i === this.selected;

            // Card background
            const bgColor = isSelected ? '#1a3a5c' : '#0d1f33';
            renderer.drawRect(cx, cy, cardW, 200, bgColor);

            // Border
            if (isSelected) {
                const borderColor = Math.floor(this.age * 4) % 2 === 0 ? '#88ccff' : '#4488aa';
                // Top & bottom
                renderer.drawRect(cx, cy, cardW, 1, borderColor);
                renderer.drawRect(cx, cy + 199, cardW, 1, borderColor);
                // Left & right
                renderer.drawRect(cx, cy, 1, 200, borderColor);
                renderer.drawRect(cx + cardW - 1, cy, 1, 200, borderColor);
            }

            // Aircraft sprite (centered)
            const acImg = getImage(ac.id);
            const spriteW = 30;
            const spriteH = 38;
            const spriteX = cx + (cardW - spriteW) / 2;
            if (acImg) {
                renderer.drawImage(acImg, spriteX, cy + 6, spriteW, spriteH);
            }

            // Name
            const name = ac.name.split(' ');
            renderer.drawText(name[0], cx + 3, cy + 48, ac.color);
            if (name[1]) renderer.drawText(name[1], cx + 3, cy + 60, ac.color);

            // Stats bars
            const stats = ac.stats;
            const barX = cx + 4;
            let barY = cy + 76;

            renderer.drawText('VEL', barX, barY, '#889');
            renderer.drawBar(barX + 24, barY + 2, 40, 5, stats.velocidad / 10, '#44aa44');
            barY += 14;

            renderer.drawText('FUE', barX, barY, '#889');
            renderer.drawBar(barX + 24, barY + 2, 40, 5, stats.fuego / 10, '#dd6644');
            barY += 14;

            renderer.drawText('BLI', barX, barY, '#889');
            renderer.drawBar(barX + 24, barY + 2, 40, 5, stats.blindaje / 10, '#4488dd');
            barY += 20;

            // Description
            const desc = ac.description;
            const words = desc.split(' ');
            let line = '';
            let ly = barY;
            for (const word of words) {
                if ((line + word).length > 10) {
                    renderer.drawText(line.trim(), cx + 4, ly, '#8899aa');
                    ly += 10;
                    line = word + ' ';
                } else {
                    line += word + ' ';
                }
            }
            if (line.trim()) {
                renderer.drawText(line.trim(), cx + 4, ly, '#8899aa');
            }

            // Special
            let specialName = '';
            switch (ac.special) {
                case 'bomb_run': specialName = 'BOMBARDEO'; break;
                case 'afterburner': specialName = 'TURBO'; break;
                case 'missile_salvo': specialName = 'MISILES'; break;
            }
            renderer.drawText('ESP:', cx + 4, cy + 170, '#889');
            renderer.drawText(specialName, cx + 4, cy + 182, '#ccaa44');
        }

        // Navigation hint
        renderer.drawTextCentered('<- A/D ELEGIR  ENTER CONFIRMAR ->', 270, '#6688aa', 1);

        // Arrows
        const arrowY = 145;
        if (Math.floor(this.age * 3) % 2 === 0) {
            renderer.drawText('<', startX - 10, arrowY, '#88ccff');
            renderer.drawText('>', startX + cardW * 3 + 12, arrowY, '#88ccff');
        }
    }

    exit() {}
}
