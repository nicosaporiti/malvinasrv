"""Render the title-screen cinematic (assets/title_video.mp4).

Pixel-art loop at the game's native resolution (256x142), upscaled 2x with
nearest-neighbour before encoding so the pixels survive compression.

Shot A: side-view sunset over the South Atlantic, delta jets skimming the
        sea and striking a frigate on the horizon.
Shot B: top-down pass using the in-game sprites (Mirage, Skyhawk, Dagger)
        attacking ships and a Harrier.
Dithered diagonal wipes join the shots; the loop point is seamless.

Requires Pillow, numpy and an ffmpeg with libx264 (set FFMPEG or have
imageio-ffmpeg installed).
Usage: python3 tools/title_video.py
"""

import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
OUT = os.path.join(ASSETS, 'title_video.mp4')

W, H = 256, 142
FPS = 24
DURATION = 12.0
SCALE = 2

# Timeline (seconds): A plays, wipe A->B, B plays, wipe B->A(0).
A_END = 5.5
WIPE = 0.5
B_START = A_END
LOOP = DURATION

_B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]])
BAYER4 = _B4 / 16.0
BAYER8 = np.block([[4 * _B4, 4 * _B4 + 2], [4 * _B4 + 3, 4 * _B4 + 1]]) / 64.0


def rgb(h):
    return np.array([int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)], dtype=np.float32)


def hash1(n):
    n = (n * 374761393 + 668265263) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFF) / float(0xFFFFFF)


def dithered_bands(stops, rows):
    """Vertical gradient quantised to `stops`, ordered-dithered between bands."""
    pal = [rgb(s) for s in stops]
    out = np.zeros((rows, W, 3), dtype=np.float32)
    ys, xs = np.mgrid[0:rows, 0:W]
    t = ys / max(rows - 1, 1) * (len(pal) - 1)
    lo = np.floor(t).astype(int)
    frac = t - lo
    thresh = BAYER4[ys % 4, xs % 4]
    idx = np.clip(lo + (frac > thresh), 0, len(pal) - 1)
    for i, c in enumerate(pal):
        out[idx == i] = c
    return out


# ---------------------------------------------------------------- sprites

def load_sprite(name, w, h, rotate=0):
    """Downscale a game sprite and harden its alpha like the in-game look."""
    img = Image.open(os.path.join(ASSETS, name)).convert('RGBA')
    img = img.resize((w, h), Image.BOX)
    if rotate:
        img = img.rotate(rotate, expand=True)
    a = np.array(img).astype(np.float32)
    a[..., 3] = np.where(a[..., 3] >= 110, 255, 0)
    return a


def blit(frame, spr, x, y, alpha=1.0, tint=None, shade=1.0):
    x, y = int(round(x)), int(round(y))
    sh, sw = spr.shape[:2]
    x0, y0 = max(x, 0), max(y, 0)
    x1, y1 = min(x + sw, W), min(y + sh, H)
    if x0 >= x1 or y0 >= y1:
        return
    src = spr[y0 - y:y1 - y, x0 - x:x1 - x]
    a = (src[..., 3:4] / 255.0) * alpha
    col = src[..., :3] * shade if tint is None else np.broadcast_to(tint, src[..., :3].shape)
    dst = frame[y0:y1, x0:x1]
    frame[y0:y1, x0:x1] = dst * (1 - a) + col * a


def px(frame, x, y, color, alpha=1.0):
    x, y = int(x), int(y)
    if 0 <= x < W and 0 <= y < H:
        frame[y, x] = frame[y, x] * (1 - alpha) + color * alpha


def rect(frame, x, y, w, h, color, alpha=1.0):
    x0, y0 = max(int(x), 0), max(int(y), 0)
    x1, y1 = min(int(x + w), W), min(int(y + h), H)
    if x0 < x1 and y0 < y1:
        frame[y0:y1, x0:x1] = frame[y0:y1, x0:x1] * (1 - alpha) + color * alpha


def pixel_map(rows, palette):
    h, w = len(rows), max(len(r) for r in rows)
    spr = np.zeros((h, w, 4), dtype=np.float32)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in palette:
                spr[y, x, :3] = rgb(palette[ch])
                spr[y, x, 3] = 255
    return spr


def upscale(spr, k):
    return spr.repeat(k, axis=0).repeat(k, axis=1)


# Side-view delta jet (Mirage/Dagger silhouette) facing right.
JET_ROWS = [
    "    oo                           ",
    "    ooo                          ",
    "    o#oo                         ",
    "    o##oo              cc        ",
    "    o###ooooooooooooooccCco      ",
    "   ####################ccc#ooo   ",
    "  ##########################o##o ",
    "  ###############################",
    "   #########################%%%  ",
    "      ##########%%%%%%%%%%%%     ",
    "        ########%%               ",
    "          #####                  ",
]
JET = pixel_map(JET_ROWS, {'#': '#1a1026', '%': '#2a1a3a', 'o': '#f29a4a',
                           'c': '#6a86b0', 'C': '#dff0ff'})
JET2 = upscale(JET, 2)

FLAME = [rgb('#fff2a0'), rgb('#ffb040'), rgb('#ff6020')]

# Horizon frigate silhouette facing left.
SHIP_ROWS = [
    "            #            ",
    "            #    #       ",
    "           ###   #       ",
    "          #####  ##      ",
    "       ##########o###    ",
    " ########################",
    "  ###################### ",
    "   ####################  ",
]
SHIP = pixel_map(SHIP_ROWS, {'#': '#1e1230', 'o': '#ffd070'})

EXPLOSIONS = [Image.open(os.path.join(ASSETS, f'explosion_{i}.png')).convert('RGBA') for i in range(5)]
_exp_cache = {}


def explosion(i, size):
    key = (i, size)
    if key not in _exp_cache:
        img = EXPLOSIONS[i].resize((size, size), Image.BOX)
        a = np.array(img).astype(np.float32)
        a[..., 3] = np.where(a[..., 3] >= 100, 255, 0)
        _exp_cache[key] = a
    return _exp_cache[key]


def draw_explosion(frame, cx, cy, age, size, dur=0.6):
    if age < 0 or age >= dur:
        return
    i = min(int(age / dur * 5), 4)
    s = explosion(i, size)
    blit(frame, s, cx - size / 2, cy - size / 2)


# ---------------------------------------------------------------- shot A

SKY = dithered_bands(['#140f33', '#241646', '#3a1f5c', '#5e2a6c', '#8e3a6e',
                      '#c24e66', '#e56a58', '#f2934a', '#ffc46a'], 92)
SEA = dithered_bands(['#6a2f58', '#4a2450', '#321c46', '#22163a', '#161030'], H - 92)
HORIZON = 92
SUN_X, SUN_Y, SUN_R = 176, 86, 22

STARS = [(int(hash1(i * 3) * W), int(hash1(i * 3 + 1) * 34), hash1(i * 3 + 2)) for i in range(26)]
CLOUDS_A = [  # (x0, y, length, speed, seed)
    (20, 30, 70, 5, 1), (150, 20, 90, 4, 2), (230, 46, 60, 7, 3), (60, 58, 50, 9, 4), (300, 38, 80, 6, 5),
]
ISLANDS = [(-10, 40, 6), (22, 36, 9), (52, 30, 5), (78, 26, 7), (230, 30, 4)]

FRIGATE_HIT = 3.55


def island_height(x):
    h = 0
    for cx, half, peak in ISLANDS:
        d = abs(x - cx)
        if d < half:
            h = max(h, peak * (1 - (d / half) ** 2) + 0.8 * math.sin(x * 0.7 + cx))
    return int(h)


def shot_a(t):
    f = np.empty((H, W, 3), dtype=np.float32)
    f[:HORIZON] = SKY
    f[HORIZON:] = SEA

    for sx, sy, ph in STARS:
        if math.sin(t * 3 + ph * 20) > -0.3:
            px(f, sx, sy, rgb('#e8d8ff'), 0.4 + 0.5 * ph)

    # Retro striped sun, clipped by the horizon.
    sun_hi, sun_lo = rgb('#fff0b0'), rgb('#ffb050')
    for y in range(SUN_Y - SUN_R, HORIZON):
        dy = y - SUN_Y
        if abs(dy) > SUN_R:
            continue
        rel = (y - (SUN_Y - SUN_R)) / (2 * SUN_R)
        if dy > -4 and (y - SUN_Y) % 4 < 1 + (dy + 4) // 5:
            continue
        half = int(math.sqrt(SUN_R * SUN_R - dy * dy))
        col = sun_hi * (1 - rel) + sun_lo * rel
        rect(f, SUN_X - half, y, 2 * half + 1, 1, col)

    # Flat sunset clouds drifting left.
    for x0, cy, length, speed, seed in CLOUDS_A:
        x = (x0 - speed * t) % (W + 140) - 100
        for row in range(4):
            inset = abs(row - 1) * 6 + int(hash1(seed * 7 + row) * 6)
            col = rgb('#f08a5a') if row == 3 else (rgb('#7a3466') if row < 2 else rgb('#a8406a'))
            rect(f, x + inset, cy + row, length - 2 * inset, 1, col, 0.9)

    # Malvinas silhouette on the horizon.
    for x in range(W):
        h = island_height(x)
        if h > 0:
            rect(f, x, HORIZON - h, 1, h, rgb('#2a1838'))
            px(f, x, HORIZON - h, rgb('#6a2c5a'))

    # Sun glitter column + wave dashes on the sea.
    for y in range(HORIZON + 1, H):
        depth = (y - HORIZON) / (H - HORIZON)
        spread = int(10 + depth * 38)
        n = 2 + int(depth * 5)
        for k in range(n):
            seed = y * 131 + k * 17 + int(t * 8)
            if hash1(seed) < 0.55:
                gx = SUN_X + int((hash1(seed + 1) - 0.5) * 2 * spread)
                gl = 2 + int(hash1(seed + 2) * (3 + depth * 8))
                col = rgb('#ffd070') if hash1(seed + 3) < 0.5 else rgb('#f29a4a')
                rect(f, gx, y, gl, 1, col, 0.55 + 0.4 * (1 - depth))
        if y % 3 == 0:
            speed = 6 + depth * 30
            for k in range(3):
                wx = (hash1(y * 7 + k) * (W + 40) - speed * t) % (W + 40) - 20
                rect(f, wx, y, 4 + int(depth * 8), 1, rgb('#8a3f68'), 0.5)

    # Frigate on the horizon, sinking after the strike.
    ship_x = 196 - 3 * t
    sink = max(0.0, t - FRIGATE_HIT - 0.3) * 2.2
    ship_y = HORIZON - SHIP.shape[0] + 1 + sink
    if sink < SHIP.shape[0]:
        clip = int(HORIZON + 1 - ship_y)
        if clip > 0:
            blit(f, SHIP[:clip], ship_x, ship_y)
    if t > FRIGATE_HIT:
        age = t - FRIGATE_HIT
        # Rising smoke column.
        for k in range(18):
            life = (age * 1.6 + k / 18) % 1.0
            if age * 1.6 < k / 18:
                continue
            sx = ship_x + 12 + math.sin(k * 2.1 + life * 3) * 3 - life * 16
            sy = HORIZON - 4 - life * 38
            r = 1 + int(life * 4)
            rect(f, sx - r, sy - r, 2 * r, 2 * r, rgb('#2b1a33'), 0.75 * (1 - life))
        # Fire glow at the waterline.
        if int(t * 12) % 2 == 0:
            rect(f, ship_x + 8, HORIZON - 2, 10, 2, rgb('#ff8030'), 0.9)
        draw_explosion(f, ship_x + 12, HORIZON - 7, age, 30)

    # Jets: two far (1x) on the bombing run, one close (2x) low over the sea.
    def jet(sprite, x, y, flame_scale):
        blit(f, sprite, x, y)
        fl = int(t * 24) % 3
        fh = sprite.shape[0]
        fy = y + int(fh * 0.55)
        flen = (4 + fl * 2) * flame_scale
        tail = x + 2 * flame_scale
        rect(f, tail - flen, fy, flen, flame_scale, FLAME[fl])
        rect(f, tail - flen // 2, fy, flen // 2, flame_scale, FLAME[0])

    for start, y0, speed in ((0.6, 64, 78), (0.9, 74, 74)):
        lt = t - start
        if lt > 0:
            x = -40 + speed * lt
            y = y0 + math.sin(lt * 2.5 + y0) * 1.5
            if x < W + 10:
                jet(JET, x, y, 1)

    lt = t - 1.8
    if lt > 0:
        x = -90 + 160 * lt
        y = 104 + math.sin(lt * 3) * 2
        if x < W + 20:
            # Spray streak on the water below the close jet.
            for k in range(26):
                sx = x + 10 - k * 3
                if hash1(k + int(t * 20)) < 0.7:
                    px(f, sx, H - 12 + (k % 3), rgb('#ffd8a8'), 0.8 - k / 40)
            jet(JET2, x, y, 2)

    # Flash on impact.
    if 0 <= t - FRIGATE_HIT < 0.09:
        f = f * 0.55 + rgb('#fff4d0') * 0.45
    return f


# ---------------------------------------------------------------- shot B

WATER = [rgb('#0a2a4a'), rgb('#0c3056'), rgb('#0e365f')]
CREST_DIM, CREST_HI, FOAM = rgb('#1d4d79'), rgb('#3a7ab0'), rgb('#d8f0ff')
TEX_W = 512


def build_water():
    tex = np.zeros((H, TEX_W, 3), dtype=np.float32)
    ys, xs = np.mgrid[0:H, 0:TEX_W]
    n = (np.sin(xs * 0.05 + np.sin(ys * 0.11) * 2) + np.sin(ys * 0.07 + xs * 0.013) + 2) / 4
    idx = np.clip((n * 3 + BAYER4[ys % 4, xs % 4] - 0.5).astype(int), 0, 2)
    for i, c in enumerate(WATER):
        tex[idx == i] = c
    crests = []
    for i in range(140):
        crests.append((int(hash1(i * 5) * TEX_W), int(hash1(i * 5 + 1) * H),
                       3 + int(hash1(i * 5 + 2) * 7), hash1(i * 5 + 3) < 0.35))
    return tex, crests


WATER_TEX, CRESTS = build_water()
SCROLL_B = 70  # px/s, world moves left

PLANE_W, PLANE_H = 32, 40
MIRAGE = load_sprite('mirage.png', PLANE_W, PLANE_H, rotate=-90)
SKYHAWK = load_sprite('skyhawk.png', PLANE_W, PLANE_H, rotate=-90)
DAGGER = load_sprite('dagger.png', PLANE_W, PLANE_H, rotate=-90)
HARRIER = load_sprite('enemy_harrier.png', 30, 34, rotate=90)
FRIGATE_TOP = load_sprite('enemy_ship.png', 20, 64, rotate=90)
DESTROYER_TOP = load_sprite('boss_destroyer.png', 22, 110, rotate=90)
MISSILE = load_sprite('missile.png', 6, 14, rotate=-90)
BURNER = load_sprite('afterburner.png', 18, 16, rotate=-90)

def build_cloud():
    puffs = [(22, 26, 14), (40, 18, 17), (60, 24, 15), (78, 30, 12), (34, 36, 12), (56, 38, 13), (12, 34, 9)]
    cw, ch = 96, 54
    spr = np.zeros((ch, cw, 4), dtype=np.float32)
    top, mid, low = rgb('#ffffff'), rgb('#dcecfa'), rgb('#a9c4de')
    for y in range(ch):
        for x in range(cw):
            best = None
            for pxc, pyc, r in puffs:
                d = ((x - pxc) ** 2 + (y - pyc) ** 2) ** 0.5
                if d <= r and (best is None or pyc > best[1]):
                    best = (d, pyc, r)
            if best is None:
                continue
            d, pyc, r = best
            shade = (y - pyc) / r + BAYER4[y % 4, x % 4] * 0.5 - 0.25
            spr[y, x, :3] = low if shade > 0.45 else (mid if shade > -0.2 else top)
            spr[y, x, 3] = 255
    return spr


CLOUD = build_cloud()

# (sprite, x, y) formation, flying right.
FORMATION = [(SKYHAWK, 58, 10), (MIRAGE, 96, 51), (DAGGER, 58, 92)]

SHIPS_B = [  # sprite, world x, y, hit time
    (FRIGATE_TOP, 385, 28, 2.75),
    (DESTROYER_TOP, 470, 90, 3.9),
]
HARRIER_ENTER = 4.1
HARRIER_HIT = 4.85


def ship_b_x(wx, t):
    return wx - SCROLL_B * t - 8 * t


def shot_b(t):
    off = int(SCROLL_B * t) % TEX_W
    f = np.concatenate([WATER_TEX[:, off:], WATER_TEX[:, :off]], axis=1)[:, :W].copy()
    for cx, cy, ln, hi in CRESTS:
        x = (cx - SCROLL_B * t * (1.0 if hi else 0.8)) % TEX_W
        if x < W:
            col = CREST_HI if hi else CREST_DIM
            rect(f, x, cy, ln, 1, col)
            if hi and math.sin(t * 6 + cx) > 0.6:
                px(f, x + ln // 2, cy, FOAM)

    # Ships with wakes; sunk ships leave burning wrecks.
    for spr, wx, y, hit in SHIPS_B:
        x = ship_b_x(wx, t)
        sw, sh = spr.shape[1], spr.shape[0]
        if x > W + 10 or x + sw < -60:
            continue
        for k in range(30):
            wxk = x + sw + k * 2
            spread = k // 4
            for side in (-1, 1):
                if hash1(k * 3 + side + int(t * 10)) < 0.75:
                    px(f, wxk, y + sh // 2 + side * spread, FOAM, 0.7 - k / 45)
        if t < hit + 0.25:
            blit(f, spr, x, y)
        else:
            blit(f, spr, x, y, shade=0.38)
            for k in range(6):
                if int(t * 14 + k) % 2 == 0:
                    px(f, x + 4 + k * (sw // 6), y + sh // 2 + (k % 2), rgb('#ff8030'))
            for k in range(10):
                life = (t * 1.2 + k / 10) % 1.0
                sx = x + sw * 0.5 - life * 30 + math.sin(k) * 4
                r = 1 + int(life * 5)
                rect(f, sx - r, y + sh // 2 - r - life * 6, 2 * r, 2 * r, rgb('#3a3a44'), 0.6 * (1 - life))
        draw_explosion(f, x + sw / 2, y + sh / 2, t - hit, 44, 0.7)
        draw_explosion(f, x + sw * 0.25, y + sh / 2 + 4, t - hit - 0.2, 30, 0.6)

    # Missiles from the wingmen toward the ships.
    launches = [(2.2, 0, SHIPS_B[0]), (3.3, 2, SHIPS_B[1]), (3.45, 1, SHIPS_B[1])]
    for lt0, pi, (spr, wx, y, hit) in launches:
        lt = t - lt0
        dur = hit - lt0
        if 0 <= lt < dur:
            _, fx, fy = FORMATION[pi]
            sx, sy = fx + PLANE_H, fy + PLANE_W / 2
            tx = ship_b_x(wx, hit) + spr.shape[1] / 2
            ty = y + spr.shape[0] / 2
            p = lt / dur
            mx, my = sx + (tx - sx) * p, sy + (ty - sy) * p
            blit(f, MISSILE, mx - 7, my - 3)
            for k in range(1, 8):
                px(f, mx - 7 - k * 2, my + math.sin(k + t * 30) * 0.8, rgb('#c8d8e8'), 0.7 - k * 0.08)

    # Harrier crossing right-to-left, downed by the lead's cannon.
    lt = t - HARRIER_ENTER
    if lt > 0:
        hx = W + 10 - 150 * lt
        hy = 60 - lt * 18
        if t < HARRIER_HIT:
            blit(f, HARRIER, hx, hy)
        draw_explosion(f, hx + 15, hy + 17, t - HARRIER_HIT, 40, 0.6)
        if HARRIER_ENTER + 0.35 < t < HARRIER_HIT:
            for k in range(4):
                bx = 96 + PLANE_H + ((t * 400 + k * 30) % (hx - 96 - PLANE_H + 20))
                rect(f, bx, 70 + (k % 2) * 2, 3, 1, rgb('#fff080'))

    # Formation: shadows first, then planes with afterburners.
    for spr, x, y in FORMATION:
        bob = math.sin(t * 2 + y) * 1.5
        blit(f, spr, x + 10, y + bob + 16, alpha=0.35, tint=rgb('#021020'))
    for spr, x, y in FORMATION:
        bob = math.sin(t * 2 + y) * 1.5
        flick = int(t * 24) % 2
        blit(f, BURNER, x - 12 - flick * 2, y + bob + PLANE_W / 2 - 9)
        blit(f, spr, x, y + bob)

    # A high cloud sweeping across for depth, with its shadow on the sea.
    cx = W + 20 - (t - 4.6) * 200
    if -CLOUD.shape[1] - 30 < cx < W + 30:
        blit(f, CLOUD, cx + 24, 46, alpha=0.3, tint=rgb('#021020'))
        blit(f, CLOUD, cx, 8, alpha=0.9)

    if 0 <= t - SHIPS_B[0][3] < 0.08 or 0 <= t - SHIPS_B[1][3] < 0.08:
        f = f * 0.6 + rgb('#ffffff') * 0.4
    return f


# ---------------------------------------------------------------- compose

_ys, _xs = np.mgrid[0:H, 0:W]
WIPE_KEY = ((_xs + _ys * 1.4) / (W + H * 1.4)) * 0.75 + BAYER8[_ys % 8, _xs % 8] * 0.25


def wipe(a, b, p):
    mask = (WIPE_KEY < p)[..., None]
    return np.where(mask, b, a)


def frame_at(t):
    if t < A_END:
        return shot_a(t)
    tb = t - B_START
    if t < A_END + WIPE:
        return wipe(shot_a(t), shot_b(tb), (t - A_END) / WIPE)
    if t < LOOP - WIPE:
        return shot_b(tb)
    return wipe(shot_b(tb), shot_a(t - LOOP), (t - (LOOP - WIPE)) / WIPE)


def ffmpeg_exe():
    if os.environ.get('FFMPEG'):
        return os.environ['FFMPEG']
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return 'ffmpeg'


def main():
    n = int(DURATION * FPS)
    ow, oh = W * SCALE, H * SCALE
    cmd = [ffmpeg_exe(), '-y', '-loglevel', 'error',
           '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{ow}x{oh}', '-r', str(FPS), '-i', '-',
           '-an', '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '20',
           '-pix_fmt', 'yuv420p', '-profile:v', 'main', '-movflags', '+faststart', OUT]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    preview = '--preview' in sys.argv
    for i in range(n):
        f = np.clip(frame_at(i / FPS), 0, 255).astype(np.uint8)
        big = f.repeat(SCALE, axis=0).repeat(SCALE, axis=1)
        proc.stdin.write(big.tobytes())
        if preview and i % 12 == 0:
            Image.fromarray(big).save(os.path.join(os.environ.get('PREVIEW_DIR', '.'), f'f{i:03d}.png'))
    proc.stdin.close()
    if proc.wait() != 0:
        sys.exit('ffmpeg failed')
    print(f'wrote {OUT} ({os.path.getsize(OUT) // 1024} KB, {n} frames)')


if __name__ == '__main__':
    main()
