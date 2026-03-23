export class Entity {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.vx = 0;
        this.vy = 0;
        this.hp = 1;
        this.alive = true;
        this.type = 'entity';
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    render(renderer) {
        renderer.drawRect(this.x, this.y, this.w, this.h, '#fff');
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.alive = false;
        }
    }

    destroy() {
        this.alive = false;
    }

    centerX() { return this.x + this.w / 2; }
    centerY() { return this.y + this.h / 2; }
}
