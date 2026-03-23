import { WIDTH, HEIGHT } from '../engine/renderer.js';
import { checkCollisions } from '../engine/collision.js';
import { Audio } from '../engine/audio.js';
import { Player } from '../entities/player.js';
import { EnemyPlane } from '../entities/enemy-plane.js';
import { EnemyShip } from '../entities/enemy-ship.js';
import { Boss } from '../entities/boss.js';
import { spawnProjectile, getProjectilePool } from '../entities/projectile.js';
import { spawnExplosion, getExplosionPool } from '../entities/explosion.js';
import { PowerUp, randomPowerType } from '../entities/powerup.js';
import { STAGES } from '../data/stages.js';

const STATE_BRIEFING = 'briefing';
const STATE_PLAYING = 'playing';
const STATE_BOSS_INTRO = 'boss_intro';
const STATE_BOSS = 'boss';
const STATE_STAGE_CLEAR = 'stage_clear';
const STATE_TRANSITION = 'transition';

export class GameScene {
    constructor() {
        this.player = null;
        this.enemies = [];
        this.powerups = [];
        this.boss = null;
        this.stageIndex = 0;
        this.stage = null;
        this.scrollY = 0;
        this.scrollPos = 0;
        this.waveIndex = 0;
        this.state = STATE_BRIEFING;
        this.stateTimer = 0;
        this.screenShake = 0;
        this.aircraftData = null;
    }

    enter(aircraftData, stageIndex = 0) {
        this.aircraftData = aircraftData;
        this.stageIndex = stageIndex;
        this._prevScore = undefined;
        this._prevLives = undefined;
        this._prevWeapon = undefined;
        this._prevSpecial = undefined;
        this.startStage();
    }

    startStage() {
        this.stage = STAGES[this.stageIndex];
        this.player = new Player(this.aircraftData);
        // Preserve score and lives from previous stages
        if (this._prevScore !== undefined) {
            this.player.score = this._prevScore;
            this.player.lives = this._prevLives;
            this.player.weaponLevel = this._prevWeapon;
            this.player.specialCharges = this._prevSpecial;
        }
        this.enemies = [];
        this.powerups = [];
        this.boss = null;
        this.scrollY = 0;
        this.scrollPos = 0;
        this.waveIndex = 0;
        this.state = STATE_BRIEFING;
        this.stateTimer = 0;
        this.screenShake = 0;

        // Reset projectile pool
        for (const p of getProjectilePool()) p.alive = false;
        for (const e of getExplosionPool()) e.alive = false;
    }

    update(dt, input) {
        this.stateTimer += dt;

        switch (this.state) {
            case STATE_BRIEFING:
                return this._updateBriefing(dt, input);
            case STATE_PLAYING:
                return this._updatePlaying(dt, input);
            case STATE_BOSS_INTRO:
                return this._updateBossIntro(dt, input);
            case STATE_BOSS:
                return this._updateBoss(dt, input);
            case STATE_STAGE_CLEAR:
                return this._updateStageClear(dt, input);
            case STATE_TRANSITION:
                return this._updateTransition(dt, input);
        }
        return null;
    }

    _setState(newState) {
        this.state = newState;
        this.stateTimer = 0;
    }

    // --- BRIEFING ---
    _updateBriefing(dt, input) {
        if (this.stateTimer > 1 && (input.enter() || input.shoot())) {
            this._setState(STATE_PLAYING);
            Audio.playMusic('stage');
        }
        return null;
    }

    // --- PLAYING ---
    _updatePlaying(dt, input) {
        this.scrollY += 60 * dt;
        this.scrollPos += 60 * dt;

        // Spawn waves
        while (this.waveIndex < this.stage.waves.length &&
               this.scrollPos >= this.stage.waves[this.waveIndex].at) {
            this._spawnWave(this.stage.waves[this.waveIndex]);
            this.waveIndex++;
        }

        this._updateGameplay(dt, input);

        // Check if scroll reached boss trigger
        if (this.scrollPos >= this.stage.length && this.enemies.every(e => !e.alive)) {
            this._setState(STATE_BOSS_INTRO);
            this.boss = new Boss(this.stage.bossType);
            Audio.bossAlarm();
        }

        if (!this.player.alive && !this.player.dead) {
            return { scene: 'gameover', score: this.player.score, stageIndex: this.stageIndex };
        }
        return null;
    }

    // --- BOSS INTRO ---
    _updateBossIntro(dt, input) {
        this.scrollY += 20 * dt;
        this.boss.update(dt, this.player.centerX());
        this._updatePlayer(dt, input);
        this._updateProjectiles(dt);
        this._updateExplosions(dt);

        if (!this.boss.entering) {
            this._setState(STATE_BOSS);
            Audio.playMusic('boss');
        }
        return null;
    }

    // --- BOSS ---
    _updateBoss(dt, input) {
        this.scrollY += 10 * dt;

        this.boss.update(dt, this.player.centerX());

        // Boss fires
        if (this.boss.canFire()) {
            const bullets = this.boss.getFirePattern(this.player.centerX(), this.player.centerY());
            for (const b of bullets) {
                spawnProjectile(b.x, b.y, b.vx, b.vy, 1, false);
            }
            Audio.enemyShoot();
        }

        this._updatePlayer(dt, input);
        this._updateProjectiles(dt);
        this._updateExplosions(dt);

        // Player bullets vs boss
        const projectiles = getProjectilePool();
        for (const p of projectiles) {
            if (!p.alive || !p.isPlayer) continue;
            if (p.x < this.boss.x + this.boss.w && p.x + p.w > this.boss.x &&
                p.y < this.boss.y + this.boss.h && p.y + p.h > this.boss.y) {
                this.boss.takeDamage(p.damage);
                p.alive = false;
                Audio.hit();
                spawnExplosion(p.x, p.y, 12);
            }
        }

        // Enemy bullets vs player
        if (!this.player.dead) {
            for (const p of projectiles) {
                if (!p.alive || p.isPlayer) continue;
                if (p.x < this.player.x + this.player.w && p.x + p.w > this.player.x &&
                    p.y < this.player.y + this.player.h && p.y + p.h > this.player.y) {
                    this.player.takeDamage(1);
                    p.alive = false;
                    if (this.player.hp <= 0) {
                        this._playerDeathSequence();
                    }
                }
            }
        }

        // Boss dead
        if (!this.boss.alive) {
            this.player.score += this.boss.points;
            Audio.bigExplosion();
            spawnExplosion(this.boss.centerX(), this.boss.centerY(), 48);
            spawnExplosion(this.boss.x, this.boss.y, 32);
            spawnExplosion(this.boss.x + this.boss.w, this.boss.y + this.boss.h, 32);
            this.screenShake = 0.5;
            this.boss = null;
            this._setState(STATE_STAGE_CLEAR);
            Audio.playMusic('victory', false);
        }

        if (!this.player.alive && !this.player.dead) {
            return { scene: 'gameover', score: this.player.score, stageIndex: this.stageIndex };
        }
        return null;
    }

    // --- STAGE CLEAR ---
    _updateStageClear(dt, input) {
        this.scrollY += 30 * dt;
        this._updateExplosions(dt);

        if (this.stateTimer > 3) {
            if (this.stageIndex >= STAGES.length - 1) {
                return { scene: 'gameover', score: this.player.score, victory: true };
            }
            this._setState(STATE_TRANSITION);
        }
        return null;
    }

    // --- TRANSITION ---
    _updateTransition(dt, input) {
        if (this.stateTimer > 1.5) {
            this._prevScore = this.player.score;
            this._prevLives = this.player.lives;
            this._prevWeapon = this.player.weaponLevel;
            this._prevSpecial = this.player.specialCharges;
            this.stageIndex++;
            this.startStage();
            // Skip briefing auto-set, it's set in startStage
        }
        return null;
    }

    // --- Shared gameplay logic ---
    _updateGameplay(dt, input) {
        this._updatePlayer(dt, input);
        this._updateEnemies(dt);
        this._updatePowerups(dt);
        this._updateProjectiles(dt);
        this._updateExplosions(dt);
        this._checkCollisions();
    }

    _updatePlayer(dt, input) {
        this.player.update(dt, input);

        // Shooting
        if (input.shoot() && this.player.canFire()) {
            this.player.fire();
            const bullets = this.player.getBullets();
            for (const b of bullets) {
                spawnProjectile(b.x, b.y, b.vx, b.vy, b.dmg, true);
            }
            Audio.shoot();
        }

        // Bomb / Special
        if (input.bomb() && this.player.specialCharges > 0) {
            this.player.specialCharges--;
            this._activateSpecial();
        }

        // Screen shake decay
        if (this.screenShake > 0) {
            this.screenShake -= dt;
        }
    }

    _activateSpecial() {
        const special = this.player.aircraft.special;
        Audio.bomb();
        this.screenShake = 0.3;

        switch (special) {
            case 'bomb_run':
                // Spawn visual bomb projectiles forward (upward), then damage all enemies
                const bcx = this.player.centerX();
                const bcy = this.player.y;
                for (let i = -1; i <= 1; i++) {
                    spawnProjectile(bcx + i * 12, bcy, i * 20, -200, 0, true, 'bomb', 8, 14);
                }
                // Delayed damage to all enemies (bomb impact)
                setTimeout(() => {
                    for (const e of this.enemies) {
                        if (e.alive) {
                            e.takeDamage(8);
                            if (!e.alive) {
                                this.player.score += e.points;
                                spawnExplosion(e.centerX(), e.centerY(), 28);
                            }
                        }
                    }
                    if (this.boss && this.boss.alive) {
                        this.boss.takeDamage(15);
                        spawnExplosion(this.boss.centerX(), this.boss.centerY(), 36);
                    }
                    this.screenShake = 0.5;
                }, 400);
                break;

            case 'afterburner':
                this.player.invincible = true;
                this.player.invincibleTimer = 2;
                this.player.afterburnerTimer = 2;
                this.player.speedBoost += 60;
                setTimeout(() => { this.player.speedBoost -= 60; }, 2000);
                break;

            case 'missile_salvo':
                // Fire 4 homing-ish missiles with sprite
                const cx = this.player.centerX();
                const cy = this.player.y;
                for (let i = 0; i < 4; i++) {
                    const angle = -Math.PI / 2 + (i - 1.5) * 0.3;
                    const vx = Math.cos(angle) * 200;
                    const vy = Math.sin(angle) * 200;
                    spawnProjectile(cx, cy, vx, vy, 5, true, 'missile', 6, 14);
                }
                break;
        }
    }

    _updateEnemies(dt) {
        const px = this.player.centerX();
        const py = this.player.centerY();

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (!e.alive) {
                this.enemies.splice(i, 1);
                continue;
            }

            if (e.update.length > 1) {
                e.update(dt, px, py);
            } else {
                e.update(dt);
            }

            // Enemy firing
            if (e.canFire()) {
                if (e instanceof EnemyShip) {
                    const burst = e.getFireBurst(px, py);
                    for (const b of burst) {
                        spawnProjectile(e.centerX(), e.centerY() + e.h / 2, b.vx, b.vy, 1, false);
                    }
                } else if (e.getFireDir) {
                    const dir = e.getFireDir(px, py);
                    spawnProjectile(e.centerX(), e.centerY() + 4, dir.vx, dir.vy, 1, false);
                }
                Audio.enemyShoot();
            }
        }
    }

    _updatePowerups(dt) {
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const p = this.powerups[i];
            p.update(dt);
            if (!p.alive) {
                this.powerups.splice(i, 1);
            }
        }
    }

    _updateProjectiles(dt) {
        for (const p of getProjectilePool()) {
            if (p.alive) p.update(dt);
        }
    }

    _updateExplosions(dt) {
        for (const e of getExplosionPool()) {
            if (e.alive) e.update(dt);
        }
    }

    _playerDeathSequence() {
        const cx = this.player.centerX();
        const cy = this.player.centerY();
        Audio.playerDeath();
        this.screenShake = 0.5;

        // Immediate main explosion
        spawnExplosion(cx, cy, 36);

        // Staggered secondary explosions
        setTimeout(() => spawnExplosion(cx - 8, cy - 6, 24), 150);
        setTimeout(() => spawnExplosion(cx + 10, cy + 4, 20), 300);
        setTimeout(() => {
            spawnExplosion(cx, cy + 2, 28);
            Audio.explosion();
        }, 500);
    }

    _checkCollisions() {
        const projectiles = getProjectilePool();
        const playerBullets = projectiles.filter(p => p.alive && p.isPlayer);
        const enemyBullets = projectiles.filter(p => p.alive && !p.isPlayer);

        // Player bullets vs enemies
        checkCollisions(playerBullets, this.enemies, (bullet, enemy) => {
            bullet.alive = false;
            enemy.takeDamage(bullet.damage);
            Audio.hit();
            spawnExplosion(bullet.x, bullet.y, 3);

            if (!enemy.alive) {
                this.player.score += enemy.points;
                Audio.explosion();
                spawnExplosion(enemy.centerX(), enemy.centerY(), 24);
                this.screenShake = 0.1;

                // Drop powerup
                if (enemy.canDrop) {
                    this.powerups.push(new PowerUp(enemy.centerX(), enemy.centerY(), randomPowerType()));
                }
            }
        });

        // Enemy bullets vs player
        if (!this.player.invincible && this.player.shieldTimer <= 0 && !this.player.dead) {
            checkCollisions(enemyBullets, [this.player], (bullet, player) => {
                bullet.alive = false;
                player.takeDamage(1);
                if (player.hp <= 0) {
                    this._playerDeathSequence();
                }
            });
        }

        // Player vs enemies (collision damage)
        if (!this.player.invincible && this.player.shieldTimer <= 0 && !this.player.dead) {
            checkCollisions([this.player], this.enemies, (player, enemy) => {
                player.takeDamage(1);
                enemy.takeDamage(3);
                if (!enemy.alive) {
                    this.player.score += enemy.points;
                    spawnExplosion(enemy.centerX(), enemy.centerY(), 24);
                }
                if (player.hp <= 0) {
                    this._playerDeathSequence();
                }
            });
        }

        // Player vs powerups
        checkCollisions([this.player], this.powerups, (player, powerup) => {
            powerup.apply(player);
            powerup.alive = false;
            Audio.powerup();
        });
    }

    _spawnWave(wave) {
        if (wave.type === 'plane') {
            for (let i = 0; i < wave.count; i++) {
                const x = wave.startX + (i % 4) * wave.spacing;
                const y = -10 - i * 20;
                const hp = wave.hp || 1;
                const points = wave.points || 100;
                this.enemies.push(new EnemyPlane(x, y, wave.pattern, hp, points));
            }
        } else if (wave.type === 'ship') {
            this.enemies.push(new EnemyShip(wave.startX, -15, wave.shipType));
        }
    }

    // --- RENDER ---
    render(renderer) {
        // Screen shake offset
        let shakeX = 0, shakeY = 0;
        if (this.screenShake > 0) {
            shakeX = (Math.random() - 0.5) * 4;
            shakeY = (Math.random() - 0.5) * 4;
        }

        renderer.offCtx.save();
        renderer.offCtx.translate(shakeX, shakeY);

        renderer.drawOceanBackground(this.scrollY);

        switch (this.state) {
            case STATE_BRIEFING:
                this._renderBriefing(renderer);
                break;
            case STATE_PLAYING:
            case STATE_BOSS_INTRO:
            case STATE_BOSS:
                this._renderGameplay(renderer);
                break;
            case STATE_STAGE_CLEAR:
                this._renderGameplay(renderer);
                this._renderStageClear(renderer);
                break;
            case STATE_TRANSITION:
                this._renderTransition(renderer);
                break;
        }

        renderer.offCtx.restore();
    }

    _renderBriefing(renderer) {
        // Darken
        renderer.drawRect(0, 0, WIDTH, HEIGHT, 'rgba(0,0,0,0.6)');

        renderer.drawTextCentered(`ETAPA ${this.stage.id}`, 80, '#88ccff', 2);
        renderer.drawTextCentered(this.stage.name, 110, '#fff', 2);
        renderer.drawTextCentered(this.stage.subtitle, 138, '#8899aa', 1);

        // Briefing text
        const lines = this.stage.briefing.split('\n');
        for (let i = 0; i < lines.length; i++) {
            renderer.drawTextCentered(lines[i], 170 + i * 14, '#aabbcc', 1);
        }

        // Aircraft info
        renderer.drawTextCentered(`Avion: ${this.aircraftData.name}`, 230, this.aircraftData.color, 1);

        if (this.stateTimer > 1 && Math.floor(this.stateTimer * 2) % 2 === 0) {
            renderer.drawTextCentered('PRESIONA ENTER', 280, '#aaa', 1);
        }
    }

    _renderGameplay(renderer) {
        // Powerups
        for (const p of this.powerups) {
            if (p.alive) p.render(renderer);
        }

        // Enemies
        for (const e of this.enemies) {
            if (e.alive) e.render(renderer);
        }

        // Boss
        if (this.boss && this.boss.alive) {
            this.boss.render(renderer);
        }

        // Projectiles
        for (const p of getProjectilePool()) {
            if (p.alive) p.render(renderer);
        }

        // Player
        if (this.player.alive || this.player.lives >= 0) {
            this.player.render(renderer);
        }

        // Explosions
        for (const e of getExplosionPool()) {
            if (e.alive) e.render(renderer);
        }

        // HUD
        this._renderHUD(renderer);
    }

    _renderHUD(renderer) {
        // Top bar background
        renderer.drawRect(0, 0, WIDTH, 18, 'rgba(0,0,0,0.7)');

        // Score
        renderer.drawText(`SCORE ${this.player.score}`, 4, 4, '#fff');

        // Lives
        const livesText = `VID:${Math.max(0, this.player.lives)}`;
        renderer.drawText(livesText, 140, 4, '#44dd44');

        // Bombs/Special
        const bombText = `ESP:${this.player.specialCharges}`;
        renderer.drawText(bombText, 195, 4, '#ddaa44');

        // Stage
        renderer.drawText(`E${this.stage.id}`, WIDTH - 18, 4, '#8899aa');

        // Weapon level indicator
        renderer.drawText(`W${this.player.weaponLevel}`, 120, 4, '#88aadd');

        // Boss health bar
        if (this.boss && this.boss.alive && this.state === STATE_BOSS) {
            renderer.drawRect(0, HEIGHT - 14, WIDTH, 14, 'rgba(0,0,0,0.7)');
            renderer.drawText(this.boss.name, 4, HEIGHT - 12, '#ff6644');
            const barW = 100;
            const barX = WIDTH - barW - 4;
            renderer.drawBar(barX, HEIGHT - 10, barW, 6, this.boss.hp / this.boss.maxHp, '#ff4444', '#331111');
        }
    }

    _renderStageClear(renderer) {
        renderer.drawRect(0, 0, WIDTH, HEIGHT, 'rgba(0,0,0,0.3)');
        renderer.drawTextCentered('ETAPA COMPLETADA!', 150, '#ffdd44', 2);

        if (this.stageIndex >= STAGES.length - 1) {
            renderer.drawTextCentered('VICTORIA!', 180, '#44ff44', 2);
            renderer.drawTextCentered('Las tropas en tierra', 210, '#aabbcc', 1);
            renderer.drawTextCentered('reciben apoyo aereo.', 224, '#aabbcc', 1);
            renderer.drawTextCentered('Mision cumplida.', 248, '#88ccff', 1);
        }
    }

    _renderTransition(renderer) {
        const alpha = Math.min(this.stateTimer / 1.5, 1);
        renderer.drawRect(0, 0, WIDTH, HEIGHT, `rgba(0,0,0,${alpha})`);
    }

    exit() {}
}
