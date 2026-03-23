import { Entity } from './entity.js';
import { WIDTH, HEIGHT } from '../engine/renderer.js';
import { getImage } from '../engine/assets.js';

const HUD_TOP = 20;
const HUD_BOTTOM = 16;
const SPRITE_W = 24;
const SPRITE_H = 30;

export class Player extends Entity {
    constructor(aircraftData) {
        super(WIDTH / 2 - SPRITE_W / 2, HEIGHT - 40, SPRITE_W, SPRITE_H);
        this.aircraft = aircraftData;
        this.speed = aircraftData.speed;
        this.fireRate = aircraftData.fireRate;
        this.bulletDamage = aircraftData.bulletDamage;
        this.hp = aircraftData.hp;
        this.maxHp = aircraftData.hp;
        this.specialCharges = aircraftData.specialCharges;
        this.type = 'player';

        this.fireTimer = 0;
        this.weaponLevel = 1;
        this.score = 0;
        this.lives = 3;

        this.invincible = false;
        this.invincibleTimer = 0;
        this.flashTimer = 0;
        this.visible = true;

        this.speedBoost = 0;
        this.shieldTimer = 0;
        this.afterburnerTimer = 0;

        this.dead = false;
        this.deathTimer = 0;
        this.deathDuration = 1.2;
    }

    update(dt, input) {
        // Death animation
        if (this.dead) {
            this.deathTimer += dt;
            if (this.deathTimer >= this.deathDuration) {
                this.dead = false;
                this.deathTimer = 0;
                this.visible = true;
                if (this.lives >= 0) {
                    this.respawn();
                } else {
                    this.alive = false;
                }
            }
            return;
        }

        // Movement
        const spd = (this.speed + this.speedBoost) * dt;
        if (input.left())  this.x -= spd;
        if (input.right()) this.x += spd;
        if (input.up())    this.y -= spd;
        if (input.down())  this.y += spd;

        // Clamp to screen
        this.x = Math.max(0, Math.min(WIDTH - this.w, this.x));
        this.y = Math.max(HUD_TOP, Math.min(HEIGHT - this.h - HUD_BOTTOM, this.y));

        // Fire timer
        if (this.fireTimer > 0) this.fireTimer -= dt;

        // Invincibility
        if (this.invincible) {
            this.invincibleTimer -= dt;
            this.flashTimer += dt;
            this.visible = Math.floor(this.flashTimer * 10) % 2 === 0;
            if (this.invincibleTimer <= 0) {
                this.invincible = false;
                this.visible = true;
            }
        }

        // Shield
        if (this.shieldTimer > 0) {
            this.shieldTimer -= dt;
        }

        // Afterburner
        if (this.afterburnerTimer > 0) {
            this.afterburnerTimer -= dt;
        }
    }

    canFire() {
        return this.fireTimer <= 0;
    }

    fire() {
        this.fireTimer = this.fireRate;
    }

    getBullets() {
        const cx = this.centerX();
        const top = this.y;
        const dmg = this.bulletDamage;
        const bullets = [];

        switch (this.weaponLevel) {
            case 1:
                bullets.push({ x: cx - 1, y: top, vx: 0, vy: -300, dmg });
                break;
            case 2:
                bullets.push({ x: cx - 4, y: top, vx: 0, vy: -300, dmg });
                bullets.push({ x: cx + 2, y: top, vx: 0, vy: -300, dmg });
                break;
            case 3:
                bullets.push({ x: cx - 1, y: top, vx: 0, vy: -300, dmg });
                bullets.push({ x: cx - 4, y: top + 4, vx: -60, vy: -280, dmg });
                bullets.push({ x: cx + 2, y: top + 4, vx: 60, vy: -280, dmg });
                break;
            default:
                bullets.push({ x: cx - 4, y: top, vx: 0, vy: -300, dmg });
                bullets.push({ x: cx + 2, y: top, vx: 0, vy: -300, dmg });
                bullets.push({ x: cx - 6, y: top + 4, vx: -50, vy: -280, dmg });
                bullets.push({ x: cx + 4, y: top + 4, vx: 50, vy: -280, dmg });
                break;
        }
        return bullets;
    }

    takeDamage(amount) {
        if (this.invincible || this.shieldTimer > 0) return;
        super.takeDamage(amount);
        if (this.hp <= 0) {
            this.die();
        }
    }

    die() {
        this.lives--;
        this.dead = true;
        this.deathTimer = 0;
        this.visible = false;
    }

    respawn() {
        this.alive = true;
        this.hp = this.maxHp;
        this.x = WIDTH / 2 - SPRITE_W / 2;
        this.y = HEIGHT - 40;
        this.invincible = true;
        this.invincibleTimer = 2;
        this.flashTimer = 0;
        if (this.weaponLevel > 1) this.weaponLevel--;
    }

    render(renderer) {
        if (!this.visible) return;
        const img = getImage(this.aircraft.id);
        if (img) {
            renderer.drawImage(img, this.x, this.y, SPRITE_W, SPRITE_H);
        } else {
            renderer.drawRect(this.x, this.y, this.w, this.h, this.aircraft.color);
        }

        // Afterburner effect — flames behind the plane (below, since flying upward)
        if (this.afterburnerTimer > 0) {
            const abImg = getImage('afterburner');
            if (abImg) {
                const flicker = Math.sin(this.afterburnerTimer * 30);
                const abW = 18 + flicker * 4;
                const abH = 16 + Math.sin(this.afterburnerTimer * 25) * 4;
                renderer.drawImage(abImg, this.centerX() - abW / 2, this.y + SPRITE_H - 2, abW, abH);
            }
        }

        // Shield effect
        if (this.shieldTimer > 0) {
            renderer.offCtx.strokeStyle = '#44aaff';
            renderer.offCtx.lineWidth = 1;
            renderer.offCtx.beginPath();
            renderer.offCtx.arc(this.centerX(), this.centerY(), SPRITE_W / 2 + 2, 0, Math.PI * 2);
            renderer.offCtx.stroke();
        }
    }
}
