export class Input {
    constructor() {
        this.keys = new Set();
        this.justPressedKeys = new Set();
        this._pressedBuffer = new Set();

        window.addEventListener('keydown', (e) => {
            e.preventDefault();
            this.keys.add(e.code);
            this._pressedBuffer.add(e.code);
        });

        window.addEventListener('keyup', (e) => {
            this.keys.delete(e.code);
        });
    }

    isDown(code) {
        return this.keys.has(code);
    }

    justPressed(code) {
        return this.justPressedKeys.has(code);
    }

    update() {
        this.justPressedKeys = new Set(this._pressedBuffer);
        this._pressedBuffer.clear();
    }

    left()  { return this.isDown('ArrowLeft')  || this.isDown('KeyA'); }
    right() { return this.isDown('ArrowRight') || this.isDown('KeyD'); }
    up()    { return this.isDown('ArrowUp')    || this.isDown('KeyW'); }
    down()  { return this.isDown('ArrowDown')  || this.isDown('KeyS'); }
    shoot() { return this.isDown('Space')      || this.isDown('KeyZ') || this.justPressed('Space') || this.justPressed('KeyZ'); }
    bomb()  { return this.justPressed('KeyX'); }
    enter() { return this.justPressed('Enter'); }
}
