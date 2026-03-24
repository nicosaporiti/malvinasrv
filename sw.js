const CACHE_NAME = 'malvinas-srv-v1';

const PRECACHE_URLS = [
    './',
    'index.html',
    'style.css',
    'manifest.webmanifest',
    'js/main.js',
    'js/data/aircraft.js',
    'js/data/stages.js',
    'js/engine/assets.js',
    'js/engine/audio.js',
    'js/engine/collision.js',
    'js/engine/game-loop.js',
    'js/engine/input.js',
    'js/engine/renderer.js',
    'js/entities/boss-turret.js',
    'js/entities/boss.js',
    'js/entities/enemy-plane.js',
    'js/entities/enemy-ship.js',
    'js/entities/entity.js',
    'js/entities/explosion.js',
    'js/entities/player.js',
    'js/entities/powerup.js',
    'js/entities/projectile.js',
    'js/scenes/game-scene.js',
    'js/scenes/gameover-scene.js',
    'js/scenes/select-scene.js',
    'js/scenes/title-scene.js',
    'js/sprites/sprites.js',
    'assets/afterburner.png',
    'assets/bomb.png',
    'assets/boss.png',
    'assets/boss_destroyer.png',
    'assets/boss_insignia.png',
    'assets/boss_portaviones.png',
    'assets/dagger.png',
    'assets/enemy_carrier.png',
    'assets/enemy_destroyer.png',
    'assets/enemy_harrier.png',
    'assets/enemy_ship.png',
    'assets/explosion_0.png',
    'assets/explosion_1.png',
    'assets/explosion_2.png',
    'assets/explosion_3.png',
    'assets/explosion_4.png',
    'assets/mirage.png',
    'assets/missile.png',
    'assets/music_boss.mp3',
    'assets/music_gameover.mp3',
    'assets/music_stage.mp3',
    'assets/music_title.mp3',
    'assets/music_victory.mp3',
    'assets/skyhawk.png',
    'assets/title_art.png',
    'assets/turret_damaged.png',
    'assets/turret_destroyed.png',
    'assets/turret_fire1.png',
    'assets/turret_fire2.png',
    'assets/turret_idle.png',
    'assets/icons/icon-192.png',
    'assets/icons/icon-512.png',
    'assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys
                .filter((key) => key !== CACHE_NAME)
                .map((key) => caches.delete(key))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put('index.html', responseClone));
                    return networkResponse;
                })
                .catch(() => caches.match('index.html'))
        );
        return;
    }

    event.respondWith(
        fetch(request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
                }

                return networkResponse;
            })
            .catch(() => caches.match(request))
    );
});
