import { WIDTH, HEIGHT } from './renderer.js';

// Procedural 80s-arcade ocean background: dithered water texture, parallax
// wave crests, blinking whitecaps, procedural islands and drifting clouds.
// Everything is deterministic (hash-based) so the world repeats consistently
// as the stage scrolls.

const ISLAND_SEG = 240;      // world pixels per island slot
const CLOUD_SEG = 480;       // world pixels per cloud slot
const STRAIT_W = 60;         // coastline strip width for strait theme

function hash(n) {
    let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

function hash2(a, b) {
    return hash(Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263));
}

function rgb(hex) {
    return [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
    ];
}

export const THEMES = {
    open: {
        water: ['#0a2a4a', '#0c3056', '#0e365f'],
        crestDim: '#1d4d79', crestHi: '#3a7ab0', foam: '#d8f0ff',
        shallow: '#17557a', sand: '#d6bc7e', sandDk: '#b89a5e',
        grass: '#3c8a46', grassDk: '#2b6433', rock: '#6f7d70',
        islandDensity: 0.32, islandMin: 34, islandMax: 64,
        clouds: 0.5, cloudAlpha: 0.85, strait: false,
    },
    dusk: {
        water: ['#082040', '#0a2448', '#0b2a50'],
        crestDim: '#16406b', crestHi: '#2e639a', foam: '#cfe4ff',
        shallow: '#124a6e', sand: '#c2a86e', sandDk: '#a08a58',
        grass: '#33703c', grassDk: '#244f2b', rock: '#646f64',
        islandDensity: 0.4, islandMin: 36, islandMax: 70,
        clouds: 0.45, cloudAlpha: 0.6, strait: false,
    },
    strait: {
        water: ['#061830', '#071c38', '#082040'],
        crestDim: '#103358', crestHi: '#234f80', foam: '#b8d8f8',
        shallow: '#0e3a58', sand: '#a08a58', sandDk: '#84714a',
        grass: '#26512e', grassDk: '#1a3a20', rock: '#525c52',
        islandDensity: 0.5, islandMin: 24, islandMax: 44,
        clouds: 0.3, cloudAlpha: 0.5, strait: true,
    },
    islands: {
        water: ['#0a3024', '#0c3629', '#0e3c2e'],
        crestDim: '#1d6045', crestHi: '#359a70', foam: '#d8fff0',
        shallow: '#1a6a55', sand: '#d8c080', sandDk: '#b6a062',
        grass: '#3e8a42', grassDk: '#2b6030', rock: '#6f7d6a',
        islandDensity: 0.8, islandMin: 44, islandMax: 96,
        clouds: 0.55, cloudAlpha: 0.8, strait: false,
    },
    malvinas: {
        water: ['#0a2a1a', '#0c2f1f', '#0e3424'],
        crestDim: '#1b5a3c', crestHi: '#2f8a60', foam: '#dcfff2',
        shallow: '#176048', sand: '#ccb476', sandDk: '#ab955c',
        grass: '#34743a', grassDk: '#234f28', rock: '#6a7566',
        islandDensity: 0.85, islandMin: 50, islandMax: 110,
        clouds: 0.5, cloudAlpha: 0.75, strait: false,
    },
};

// Shared instance so gameplay code can query island positions consistently
// with what the renderer draws. Lazy to avoid touching the DOM at import time.
let sharedOcean = null;
export function getOcean() {
    if (!sharedOcean) sharedOcean = new OceanBackground();
    return sharedOcean;
}

export class OceanBackground {
    constructor() {
        this.themeName = null;
        this.theme = null;
        this.tex = null;
        this.texCache = new Map();
        this.islandCache = new Map();
        this.cloudSprites = null;
        this.islandCutoff = null;
        this.setTheme('open');
    }

    // Suppress islands whose world-y is beyond `wy` (i.e. not yet on screen),
    // clearing the sea ahead — used for boss arenas.
    setIslandCutoff(wy) {
        this.islandCutoff = wy;
        this.islandCache.clear();
    }

    clearIslandCutoff() {
        this.islandCutoff = null;
        this.islandCache.clear();
    }

    // Screen-space rects (including the shallow-water ring) of islands on or
    // near the screen, for entities that must navigate around them.
    islandsNear(scrollY, margin = 280) {
        const rects = [];
        const j0 = Math.floor((-scrollY - margin) / ISLAND_SEG) - 1;
        const j1 = Math.floor((HEIGHT + margin - scrollY) / ISLAND_SEG) + 1;
        for (let j = j0; j <= j1; j++) {
            const island = this._getIsland(j);
            if (!island) continue;
            const sy = island.wy + scrollY;
            if (sy + island.canvas.height < -margin || sy > HEIGHT + margin) continue;
            rects.push({ x: island.x, y: sy, w: island.canvas.width, h: island.canvas.height });
        }
        return rects;
    }

    setTheme(name) {
        if (!THEMES[name]) name = 'open';
        if (name === this.themeName) return;
        this.themeName = name;
        this.theme = THEMES[name];
        if (!this.texCache.has(name)) {
            this.texCache.set(name, this._buildTextures(this.theme));
        }
        this.tex = this.texCache.get(name);
        this.islandCache.clear();
    }

    render(ctx, scrollY, withClouds = true) {
        const t = this.theme;
        const off = ((scrollY % HEIGHT) + HEIGHT) % HEIGHT;

        // Base dithered water + slow crest layer (moves with the water)
        ctx.drawImage(this.tex.base, 0, off - HEIGHT);
        ctx.drawImage(this.tex.base, 0, off);
        ctx.drawImage(this.tex.crestDim, 0, off - HEIGHT);
        ctx.drawImage(this.tex.crestDim, 0, off);

        // Bright crest layer drifts slightly faster: organic swell motion
        const off2 = ((scrollY * 1.07 % HEIGHT) + HEIGHT) % HEIGHT;
        ctx.drawImage(this.tex.crestHi, 0, off2 - HEIGHT);
        ctx.drawImage(this.tex.crestHi, 0, off2);

        this._renderWhitecaps(ctx, scrollY);
        this._renderIslands(ctx, scrollY);

        if (t.strait) {
            ctx.drawImage(this.tex.straitL, 0, off - HEIGHT);
            ctx.drawImage(this.tex.straitL, 0, off);
            ctx.drawImage(this.tex.straitR, WIDTH - STRAIT_W, off - HEIGHT);
            ctx.drawImage(this.tex.straitR, WIDTH - STRAIT_W, off);
        }

        // Cloud shadows always belong on the water, under everything
        this._renderCloudPass(ctx, scrollY, 'shadow');
        if (withClouds) this._renderCloudPass(ctx, scrollY, 'lit');
    }

    // The lit cloud puffs, as a separate overlay pass: the game scene draws
    // this after ships and bosses so clouds drift over them.
    renderCloudLayer(ctx, scrollY) {
        this._renderCloudPass(ctx, scrollY, 'lit');
    }

    // --- live layers ---

    _renderWhitecaps(ctx, scrollY) {
        const cell = 26;
        const step = Math.floor(scrollY / 8);
        const j0 = Math.floor(-scrollY / cell) - 1;
        const j1 = Math.floor((HEIGHT - scrollY) / cell) + 1;
        const cols = Math.ceil(WIDTH / cell);
        ctx.fillStyle = this.theme.foam;
        for (let j = j0; j <= j1; j++) {
            for (let i = 0; i < cols; i++) {
                const h = hash2(i * 53, j);
                if (h > 0.35) continue;
                const blink = (step + Math.floor(h * 1000)) % 8;
                if (blink > 2) continue;
                const x = i * cell + Math.floor(hash2(j, i * 31) * (cell - 4));
                const y = Math.round(j * cell + hash2(i, j * 17) * (cell - 2) + scrollY);
                ctx.fillRect(x, y, blink === 1 ? 3 : 2, 1);
                if (blink === 1) ctx.fillRect(x + 1, y - 1, 1, 1);
            }
        }
    }

    _renderIslands(ctx, scrollY) {
        const j0 = Math.floor(-scrollY / ISLAND_SEG) - 1;
        const j1 = Math.floor((HEIGHT - scrollY) / ISLAND_SEG) + 1;
        for (let j = j0; j <= j1; j++) {
            const island = this._getIsland(j);
            if (!island) continue;
            const sy = island.wy + scrollY;
            if (sy + island.canvas.height < 0 || sy > HEIGHT) continue;
            ctx.drawImage(island.canvas, island.x, Math.round(sy));
        }
    }

    _renderCloudPass(ctx, scrollY, pass) {
        const t = this.theme;
        if (!this.cloudSprites) this.cloudSprites = buildCloudSprites();
        const cy = scrollY * 1.55;
        const j0 = Math.floor((-cy - 120) / CLOUD_SEG);
        const j1 = Math.floor((HEIGHT - cy + 60) / CLOUD_SEG) + 1;
        for (let j = j0; j <= j1; j++) {
            if (hash2(j, 9001) > t.clouds) continue;
            const spr = this.cloudSprites[Math.floor(hash2(j, 9007) * this.cloudSprites.length)];
            const x = Math.floor(hash2(j, 9011) * (WIDTH + 40 - spr.lit.width)) - 20;
            const sy = Math.round(j * CLOUD_SEG + hash2(j, 9013) * (CLOUD_SEG - 80) + cy);
            if (sy + spr.lit.height < -20 || sy > HEIGHT + 20) continue;
            if (pass === 'shadow') {
                ctx.globalAlpha = 0.25;
                ctx.drawImage(spr.shadow, x + 12, sy + 18);
            } else {
                ctx.globalAlpha = t.cloudAlpha;
                ctx.drawImage(spr.lit, x, sy);
            }
        }
        ctx.globalAlpha = 1;
    }

    // --- procedural islands ---

    _getIsland(j) {
        if (this.islandCache.has(j)) return this.islandCache.get(j);
        if (this.islandCache.size > 32) this.islandCache.clear();
        const t = this.theme;
        let result = null;
        if (hash2(j, 7001) < t.islandDensity) {
            const sizeT = hash2(j, 7003);
            const w = Math.floor(t.islandMin + sizeT * (t.islandMax - t.islandMin));
            const h = Math.floor(w * (0.55 + hash2(j, 7005) * 0.35));
            const canvas = this._buildIsland(j, w, h);
            const xMin = t.strait ? STRAIT_W + 4 : 6;
            const xMax = WIDTH - canvas.width - xMin;
            const x = Math.floor(xMin + hash2(j, 7007) * Math.max(1, xMax - xMin));
            const wy = j * ISLAND_SEG + Math.floor(hash2(j, 7009) * Math.max(1, ISLAND_SEG - canvas.height));
            result = { canvas, x, wy };
            if (this.islandCutoff !== null && wy < this.islandCutoff) result = null;
        }
        this.islandCache.set(j, result);
        return result;
    }

    _buildIsland(seed, w, h) {
        const t = this.theme;
        const pad = 9;
        const cw = w + pad * 2, ch = h + pad * 2;
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const g = canvas.getContext('2d');
        const img = g.createImageData(cw, ch);
        const data = img.data;

        const grass = rgb(t.grass), grassDk = rgb(t.grassDk);
        const sand = rgb(t.sand), sandDk = rgb(t.sandDk);
        const foam = rgb(t.foam), shallow = rgb(t.shallow), rock = rgb(t.rock);

        const cx = cw / 2, cyc = ch / 2;
        const rx = w / 2, ry = h / 2;
        const p1 = hash2(seed, 7011) * Math.PI * 2;
        const p2 = hash2(seed, 7013) * Math.PI * 2;
        const p3 = hash2(seed, 7017) * Math.PI * 2;

        for (let y = 0; y < ch; y++) {
            for (let x = 0; x < cw; x++) {
                const dx = (x - cx) / rx;
                const dy = (y - cyc) / ry;
                const ang = Math.atan2(dy, dx);
                const wob = 1 + 0.15 * Math.sin(3 * ang + p1)
                              + 0.11 * Math.sin(5 * ang + p2)
                              + 0.07 * Math.sin(8 * ang + p3);
                let d = Math.sqrt(dx * dx + dy * dy) / wob;
                d += ((x + y) & 1) ? 0.022 : -0.022;
                const n = hash2(Math.imul(seed, 131) + x, y);

                let c = null;
                let alpha = 255;
                if (d < 0.42) {
                    c = n < 0.22 ? grass : grassDk;
                    if (n > 0.965) c = rock;
                } else if (d < 0.72) {
                    c = n < 0.14 ? grassDk : grass;
                    if (n > 0.975) c = rock;
                } else if (d < 0.78) {
                    c = n < 0.5 ? grass : sand;
                } else if (d < 0.97) {
                    c = n < 0.12 ? sandDk : sand;
                } else if (d < 1.05) {
                    if (n < 0.85) c = foam;
                } else if (d < 1.22) {
                    if (d < 1.12 || ((x + y) & 1) === 0) c = shallow;
                }
                if (!c) continue;
                const i = (y * cw + x) * 4;
                data[i] = c[0];
                data[i + 1] = c[1];
                data[i + 2] = c[2];
                data[i + 3] = alpha;
            }
        }
        g.putImageData(img, 0, 0);
        return canvas;
    }

    // --- pre-rendered tile textures ---

    _buildTextures(t) {
        const tex = {
            base: this._buildBase(t),
            crestDim: buildCrestLayer(t.crestDim, null, 16, 16, 0.42, 11),
            crestHi: buildCrestLayer(t.crestHi, t.foam, 32, 24, 0.4, 37),
        };
        if (t.strait) {
            tex.straitL = buildStraitStrip(t, false);
            tex.straitR = buildStraitStrip(t, true);
        }
        return tex;
    }

    _buildBase(t) {
        const canvas = document.createElement('canvas');
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        const g = canvas.getContext('2d');
        const img = g.createImageData(WIDTH, HEIGHT);
        const data = img.data;
        const c0 = rgb(t.water[0]), c1 = rgb(t.water[1]), c2 = rgb(t.water[2]);
        const TAU = Math.PI * 2;

        for (let y = 0; y < HEIGHT; y++) {
            const fy = y / HEIGHT;
            for (let x = 0; x < WIDTH; x++) {
                // horizontally-elongated swell noise, periodic in y so it tiles
                let v = Math.sin(fy * TAU * 5 + 1.7 * Math.sin(x * 0.025 + fy * TAU * 2)) * 0.6
                      + Math.sin(fy * TAU * 11 + x * 0.045 + 2.3 * Math.sin(x * 0.013)) * 0.4;
                v += ((x + y) & 1) ? 0.09 : -0.09; // checkerboard dither
                const c = v > 0.62 ? c2 : (v > 0.1 ? c1 : c0);
                const i = (y * WIDTH + x) * 4;
                data[i] = c[0];
                data[i + 1] = c[1];
                data[i + 2] = c[2];
                data[i + 3] = 255;
            }
        }
        g.putImageData(img, 0, 0);
        return canvas;
    }
}

// Scattered wave-crest glyphs (small arcs with upturned tips), tileable.
function buildCrestLayer(color, tipColor, cellW, cellH, prob, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const g = canvas.getContext('2d');
    const cols = Math.ceil(WIDTH / cellW);
    const rows = Math.ceil(HEIGHT / cellH);
    for (let jy = 0; jy < rows; jy++) {
        for (let ix = 0; ix < cols; ix++) {
            const h = hash2(ix * 7 + seed, jy * 13 + seed);
            if (h > prob) continue;
            const x = ix * cellW + Math.floor(hash2(ix + seed, jy) * Math.max(1, cellW - 10));
            const y = jy * cellH + 2 + Math.floor(hash2(jy + seed, ix) * Math.max(1, cellH - 5));
            const len = 3 + Math.floor((h / prob) * 6);
            g.fillStyle = color;
            g.fillRect(x, y, len, 1);
            g.fillRect(x - 1, y - 1, 1, 1);
            g.fillRect(x + len, y - 1, 1, 1);
            if (tipColor && h < prob * 0.4) {
                g.fillStyle = tipColor;
                g.fillRect(x + 1, y, Math.max(2, len - 2), 1);
            }
        }
    }
    return canvas;
}

// Ragged coastline strip for the strait stage (periodic in y).
function buildStraitStrip(t, mirrored) {
    const canvas = document.createElement('canvas');
    canvas.width = STRAIT_W;
    canvas.height = HEIGHT;
    const g = canvas.getContext('2d');
    const img = g.createImageData(STRAIT_W, HEIGHT);
    const data = img.data;
    const grass = rgb(t.grass), grassDk = rgb(t.grassDk);
    const sand = rgb(t.sand), sandDk = rgb(t.sandDk);
    const foam = rgb(t.foam), shallow = rgb(t.shallow), rock = rgb(t.rock);
    const TAU = Math.PI * 2;
    const s1 = mirrored ? 2.1 : 0.4, s2 = mirrored ? 4.7 : 1.9, s3 = mirrored ? 0.8 : 3.6;

    for (let y = 0; y < HEIGHT; y++) {
        const fy = y / HEIGHT;
        const wEdge = 26 + 10 * Math.sin(fy * TAU * 3 + s1)
                         + 6 * Math.sin(fy * TAU * 7 + s2)
                         + 4 * Math.sin(fy * TAU * 13 + s3);
        for (let px = 0; px < STRAIT_W; px++) {
            const x = mirrored ? STRAIT_W - 1 - px : px;
            let depth = wEdge - px; // > 0 means land, measured inland
            depth += ((x + y) & 1) ? 0.45 : -0.45;
            const n = hash2(x * (mirrored ? 977 : 661), y);

            let c = null;
            if (depth > 14) {
                c = n < 0.2 ? grass : grassDk;
                if (n > 0.97) c = rock;
            } else if (depth > 7) {
                c = n < 0.15 ? grassDk : grass;
            } else if (depth > 5.5) {
                c = n < 0.5 ? grass : sand;
            } else if (depth > 1.5) {
                c = n < 0.12 ? sandDk : sand;
            } else if (depth > 0) {
                if (n < 0.85) c = foam;
            } else if (depth > -4) {
                if (depth > -2 || ((x + y) & 1) === 0) c = shallow;
            }
            if (!c) continue;
            const i = (y * STRAIT_W + x) * 4;
            data[i] = c[0];
            data[i + 1] = c[1];
            data[i + 2] = c[2];
            data[i + 3] = 255;
        }
    }
    g.putImageData(img, 0, 0);
    return canvas;
}

// Dithered cumulus sprites, shared across themes (lit + shadow versions).
function buildCloudSprites() {
    const sprites = [];
    for (let v = 0; v < 3; v++) {
        const w = 78 + v * 18, h = 32 + v * 7;
        const blobs = [];
        const count = 4 + v;
        for (let b = 0; b < count; b++) {
            blobs.push({
                x: w * 0.15 + hash2(v * 17 + b, 3) * w * 0.7,
                y: h * 0.3 + hash2(v * 23 + b, 5) * h * 0.45,
                r: h * 0.28 + hash2(v * 29 + b, 7) * h * 0.3,
            });
        }
        const make = (core, edge, shade) => {
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const g = canvas.getContext('2d');
            const img = g.createImageData(w, h);
            const data = img.data;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    let inside = false, near = false;
                    for (const bl of blobs) {
                        const dx = x - bl.x, dy = (y - bl.y) * 1.5;
                        const dd = dx * dx + dy * dy;
                        if (dd < bl.r * bl.r) inside = true;
                        else if (dd < bl.r * bl.r * 1.35) near = true;
                    }
                    let c = null;
                    if (inside) c = (shade && y > h * 0.68) ? shade : core;
                    else if (near && ((x + y) & 1) === 0) c = edge;
                    if (!c) continue;
                    const i = (y * w + x) * 4;
                    data[i] = c[0];
                    data[i + 1] = c[1];
                    data[i + 2] = c[2];
                    data[i + 3] = 255;
                }
            }
            g.putImageData(img, 0, 0);
            return canvas;
        };
        sprites.push({
            lit: make(rgb('#eef6ff'), rgb('#c8dcec'), rgb('#bcd0e0')),
            shadow: make(rgb('#041018'), rgb('#041018'), null),
        });
    }
    return sprites;
}
