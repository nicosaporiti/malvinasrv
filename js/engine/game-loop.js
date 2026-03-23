const TICK_RATE = 1000 / 60;

export class GameLoop {
    constructor(updateFn, renderFn) {
        this.updateFn = updateFn;
        this.renderFn = renderFn;
        this.accumulator = 0;
        this.lastTime = 0;
        this.running = false;
        this._frame = null;
    }

    start() {
        this.running = true;
        this.lastTime = performance.now();
        this._frame = requestAnimationFrame((t) => this._loop(t));
    }

    stop() {
        this.running = false;
        if (this._frame) {
            cancelAnimationFrame(this._frame);
            this._frame = null;
        }
    }

    _loop(timestamp) {
        if (!this.running) return;

        const delta = Math.min(timestamp - this.lastTime, 100);
        this.lastTime = timestamp;
        this.accumulator += delta;

        while (this.accumulator >= TICK_RATE) {
            this.updateFn(TICK_RATE / 1000);
            this.accumulator -= TICK_RATE;
        }

        this.renderFn();
        this._frame = requestAnimationFrame((t) => this._loop(t));
    }
}
