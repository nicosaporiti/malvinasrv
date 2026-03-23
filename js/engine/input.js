export class Input {
    constructor() {
        this.keys = new Set();
        this.justPressedKeys = new Set();
        this._pressedBuffer = new Set();

        // Keyboard
        window.addEventListener('keydown', (e) => {
            e.preventDefault();
            this.keys.add(e.code);
            this._pressedBuffer.add(e.code);
        });

        window.addEventListener('keyup', (e) => {
            this.keys.delete(e.code);
        });

        // Touch state
        this._touchDirX = 0;
        this._touchDirY = 0;
        this._touchFire = false;
        this._touchBomb = false;
        this._touchEnter = false;
        this._isMobile = false;
        this._prevTouchLeft = false;
        this._prevTouchRight = false;
        this._touchJustLeft = false;
        this._touchJustRight = false;

        this._initTouch();
    }

    _initTouch() {
        const joystickBase = document.getElementById('joystick-base');
        const joystickKnob = document.getElementById('joystick-knob');
        const btnFire = document.getElementById('btn-fire');
        const btnSpecial = document.getElementById('btn-special');

        if (!joystickBase) return;

        this._isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // --- Joystick ---
        let joystickActive = false;
        let joystickId = null;
        const baseRect = () => joystickBase.getBoundingClientRect();
        const RADIUS = 50;

        const moveKnob = (clientX, clientY) => {
            const rect = baseRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            let dx = clientX - cx;
            let dy = clientY - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > RADIUS) {
                dx = (dx / dist) * RADIUS;
                dy = (dy / dist) * RADIUS;
            }

            joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;

            // Dead zone 15%
            const deadZone = RADIUS * 0.15;
            this._touchDirX = Math.abs(dx) > deadZone ? dx / RADIUS : 0;
            this._touchDirY = Math.abs(dy) > deadZone ? dy / RADIUS : 0;
        };

        const resetKnob = () => {
            joystickKnob.style.transform = 'translate(0, 0)';
            this._touchDirX = 0;
            this._touchDirY = 0;
            joystickActive = false;
            joystickId = null;
        };

        joystickBase.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const t = e.changedTouches[0];
            joystickActive = true;
            joystickId = t.identifier;
            moveKnob(t.clientX, t.clientY);
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (!joystickActive) return;
            for (const t of e.changedTouches) {
                if (t.identifier === joystickId) {
                    moveKnob(t.clientX, t.clientY);
                    break;
                }
            }
        }, { passive: true });

        window.addEventListener('touchend', (e) => {
            for (const t of e.changedTouches) {
                if (t.identifier === joystickId) {
                    resetKnob();
                    break;
                }
            }
        });

        window.addEventListener('touchcancel', (e) => {
            for (const t of e.changedTouches) {
                if (t.identifier === joystickId) {
                    resetKnob();
                    break;
                }
            }
        });

        // --- Fire button (hold = continuous fire) ---
        btnFire.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this._touchFire = true;
            this._touchEnter = true;
            btnFire.classList.add('active');
        }, { passive: false });

        btnFire.addEventListener('touchend', (e) => {
            this._touchFire = false;
            btnFire.classList.remove('active');
        });

        btnFire.addEventListener('touchcancel', (e) => {
            this._touchFire = false;
            btnFire.classList.remove('active');
        });

        // --- Special button (single press) ---
        btnSpecial.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this._touchBomb = true;
            btnSpecial.classList.add('active');
        }, { passive: false });

        btnSpecial.addEventListener('touchend', (e) => {
            btnSpecial.classList.remove('active');
        });

        btnSpecial.addEventListener('touchcancel', (e) => {
            btnSpecial.classList.remove('active');
        });

        // Tap on canvas = enter (for menus)
        const canvas = document.getElementById('game');
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this._touchEnter = true;
        }, { passive: false });
    }

    isDown(code) {
        return this.keys.has(code);
    }

    justPressed(code) {
        if (this.justPressedKeys.has(code)) return true;
        if ((code === 'ArrowLeft' || code === 'KeyA') && this._touchJustLeft) return true;
        if ((code === 'ArrowRight' || code === 'KeyD') && this._touchJustRight) return true;
        return false;
    }

    update() {
        this.justPressedKeys = new Set(this._pressedBuffer);
        this._pressedBuffer.clear();

        // Consume single-press touch flags
        this._bombConsumed = this._touchBomb;
        this._touchBomb = false;
        this._enterConsumed = this._touchEnter;
        this._touchEnter = false;

        // Detect joystick edge transitions for justPressed
        const threshold = 0.5;
        const nowLeft = this._touchDirX < -threshold;
        const nowRight = this._touchDirX > threshold;
        this._touchJustLeft = nowLeft && !this._prevTouchLeft;
        this._touchJustRight = nowRight && !this._prevTouchRight;
        this._prevTouchLeft = nowLeft;
        this._prevTouchRight = nowRight;
    }

    left()  { return this.isDown('ArrowLeft')  || this.isDown('KeyA') || this._touchDirX < -0.2; }
    right() { return this.isDown('ArrowRight') || this.isDown('KeyD') || this._touchDirX > 0.2; }
    up()    { return this.isDown('ArrowUp')    || this.isDown('KeyW') || this._touchDirY < -0.2; }
    down()  { return this.isDown('ArrowDown')  || this.isDown('KeyS') || this._touchDirY > 0.2; }
    shoot() { return this.isDown('Space') || this.isDown('KeyZ') || this.justPressed('Space') || this.justPressed('KeyZ') || this._touchFire; }
    bomb()  { return this.justPressed('KeyX') || this._bombConsumed; }
    enter() { return this.justPressed('Enter') || this._enterConsumed; }
}
