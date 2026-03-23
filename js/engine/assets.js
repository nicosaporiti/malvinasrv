const cache = {};

export function loadImage(key, src) {
    return new Promise((resolve, reject) => {
        if (cache[key]) {
            resolve(cache[key]);
            return;
        }
        const img = new Image();
        img.onload = () => {
            cache[key] = img;
            resolve(img);
        };
        img.onerror = () => reject(new Error(`Failed to load: ${src}`));
        img.src = src;
    });
}

export function getImage(key) {
    return cache[key] || null;
}

export async function loadAllAssets() {
    await Promise.all([
        loadImage('skyhawk', 'assets/skyhawk.png'),
        loadImage('mirage', 'assets/mirage.png'),
        loadImage('dagger', 'assets/dagger.png'),
        loadImage('enemy_harrier', 'assets/enemy_harrier.png'),
        loadImage('enemy_ship', 'assets/enemy_ship.png'),
        loadImage('enemy_destroyer', 'assets/enemy_destroyer.png'),
        loadImage('enemy_carrier', 'assets/enemy_carrier.png'),
        loadImage('boss', 'assets/boss.png'),
        loadImage('boss_frigate', 'assets/boss_destroyer.png'),
        loadImage('boss_destroyer', 'assets/boss_insignia.png'),
        loadImage('boss_carrier', 'assets/boss_portaviones.png'),
        loadImage('turret_idle', 'assets/turret_idle.png'),
        loadImage('turret_fire1', 'assets/turret_fire1.png'),
        loadImage('turret_fire2', 'assets/turret_fire2.png'),
        loadImage('turret_damaged', 'assets/turret_damaged.png'),
        loadImage('turret_destroyed', 'assets/turret_destroyed.png'),
        loadImage('missile', 'assets/missile.png'),
        loadImage('bomb', 'assets/bomb.png'),
        loadImage('afterburner', 'assets/afterburner.png'),
        loadImage('title_art', 'assets/title_art.png'),
        loadImage('explosion_0', 'assets/explosion_0.png'),
        loadImage('explosion_1', 'assets/explosion_1.png'),
        loadImage('explosion_2', 'assets/explosion_2.png'),
        loadImage('explosion_3', 'assets/explosion_3.png'),
        loadImage('explosion_4', 'assets/explosion_4.png'),
    ]);
}
