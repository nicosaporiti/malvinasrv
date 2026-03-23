import { WIDTH, HEIGHT } from '../engine/renderer.js';
import { Audio } from '../engine/audio.js';

export class GameOverScene {
    constructor() {
        this.score = 0;
        this.victory = false;
        this.stageIndex = 0;
        this.age = 0;
        this.scrollY = 0;
    }

    enter(data) {
        this.score = data.score || 0;
        this.victory = data.victory || false;
        this.stageIndex = data.stageIndex || 0;
        this.age = 0;
        this.scrollY = 0;
    }

    update(dt, input) {
        this.age += dt;
        this.scrollY += 15 * dt;

        if (this.age > 2 && (input.enter() || input.shoot())) {
            Audio.confirm();
            return 'title';
        }
        return null;
    }

    render(renderer) {
        renderer.drawOceanBackground(this.scrollY);
        renderer.drawRect(0, 0, WIDTH, HEIGHT, 'rgba(0,0,0,0.6)');

        if (this.victory) {
            renderer.drawTextCentered('MISION CUMPLIDA', 80, '#44ff44', 2);
            renderer.drawTextCentered('Las Islas Malvinas', 130, '#aabbcc', 1);
            renderer.drawTextCentered('han sido alcanzadas.', 145, '#aabbcc', 1);
            renderer.drawTextCentered('Nuestras tropas reciben', 170, '#aabbcc', 1);
            renderer.drawTextCentered('el apoyo que necesitaban.', 185, '#aabbcc', 1);
            renderer.drawTextCentered('GLORIA A LOS HEROES', 220, '#88ccff', 1);
        } else {
            renderer.drawTextCentered('FIN DE MISION', 80, '#ff4444', 2);
            renderer.drawTextCentered(`Etapa alcanzada: ${this.stageIndex + 1}`, 130, '#8899aa', 1);
        }

        renderer.drawTextCentered(`PUNTAJE FINAL: ${this.score}`, 260, '#ffdd44', 1);

        if (this.age > 2 && Math.floor(this.age * 2) % 2 === 0) {
            renderer.drawTextCentered('PRESIONA ENTER', 310, '#aaa', 1);
        }
    }

    exit() {}
}
