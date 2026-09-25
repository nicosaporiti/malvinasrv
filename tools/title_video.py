"""Render the title-screen cinematic (assets/title_video.mp4).

Full-screen pixel-art loop at the game's native resolution (256x384),
upscaled 2x with nearest-neighbour before encoding so the pixels survive
compression. The game overlays the title text, so the action stays in the
middle of the frame. The first frame is also written to
assets/title_poster.png, shown while the video loads.

Shot A: side-view sunset over the South Atlantic, delta jets skimming the
        sea and striking a frigate on the horizon.
Shot B: top-down vertical pass, like gameplay, using the in-game sprites
        (Mirage, Skyhawk, Dagger) attacking ships and a Harrier.
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

from pixelart import (ASSETS, BAYER4, BAYER8, JET_ROWS, blit, build_cloud, dithered_bands,
                      draw_explosion, ffmpeg_exe, hash1, load_sprite, pixel_map, px, rect, rgb,
                      upscale)

OUT = os.path.join(ASSETS, 'title_video.mp4')
POSTER = os.path.join(ASSETS, 'title_poster.png')

W, H = 256, 384
FPS = 24
DURATION = 12.0
SCALE = 2

# Timeline (seconds): A plays, wipe A->B, B plays, wipe B->A(0).
A_END = 5.5
WIPE = 0.5
B_START = A_END
LOOP = DURATION


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

# ---------------------------------------------------------------- shot A

HORIZON = 250
SKY = dithered_bands(['#0c0a26', '#140f33', '#241646', '#3a1f5c', '#5e2a6c', '#8e3a6e',
                      '#c24e66', '#e56a58', '#f2934a', '#ffc46a'], HORIZON, W)
SEA = dithered_bands(['#6a2f58', '#4a2450', '#321c46', '#22163a', '#161030', '#100c26'],
                     H - HORIZON, W)
SUN_X, SUN_Y, SUN_R = 176, 242, 26

STARS = [(int(hash1(i * 3) * W), int(hash1(i * 3 + 1) * 140), hash1(i * 3 + 2)) for i in range(60)]
CLOUDS_A = [  # (x0, y, length, speed, seed)
    (200, 70, 60, 3, 7), (-40, 88, 80, 4, 8), (150, 108, 90, 4, 2), (20, 126, 70, 5, 1),
    (300, 146, 80, 6, 5), (230, 164, 60, 7, 3), (60, 184, 50, 9, 4), (110, 206, 70, 8, 6),
]
ISLANDS = [(-10, 40, 8), (22, 36, 12), (52, 30, 7), (78, 26, 9), (230, 30, 6)]

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
            sy = HORIZON - 4 - life * 60
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

    for start, y0, speed in ((0.6, HORIZON - 74, 78), (0.9, HORIZON - 60, 74)):
        lt = t - start
        if lt > 0:
            x = -40 + speed * lt
            y = y0 + lt * 9 + math.sin(lt * 2.5 + y0) * 1.5
            if x < W + 10:
                jet(JET, x, y, 1)

    lt = t - 1.8
    if lt > 0:
        x = -90 + 160 * lt
        y = HORIZON + 12 + math.sin(lt * 3) * 2
        if x < W + 20:
            # Spray streak on the water below the close jet.
            for k in range(26):
                sx = x + 10 - k * 3
                if hash1(k + int(t * 20)) < 0.7:
                    px(f, sx, y + 27 + (k % 3), rgb('#ffd8a8'), 0.8 - k / 40)
            jet(JET2, x, y, 2)

    # Flash on impact.
    if 0 <= t - FRIGATE_HIT < 0.09:
        f = f * 0.55 + rgb('#fff4d0') * 0.45
    return f


# ---------------------------------------------------------------- shot B

WATER = [rgb('#0a2a4a'), rgb('#0c3056'), rgb('#0e365f')]
CREST_DIM, CREST_HI, FOAM = rgb('#1d4d79'), rgb('#3a7ab0'), rgb('#d8f0ff')
TEX_H = 768


def build_water():
    tex = np.zeros((TEX_H, W, 3), dtype=np.float32)
    ys, xs = np.mgrid[0:TEX_H, 0:W]
    a = ys * 2 * np.pi / TEX_H  # periodic in y so the scroll wraps seamlessly
    n = (np.sin(a * 6 + np.sin(xs * 0.035) * 2.5) + np.sin(xs * 0.06 + a * 2) + 2) / 4
    idx = np.clip((n * 3 + BAYER4[ys % 4, xs % 4] - 0.5).astype(int), 0, 2)
    for i, c in enumerate(WATER):
        tex[idx == i] = c
    crests = []
    for i in range(420):
        crests.append((int(hash1(i * 5) * W), int(hash1(i * 5 + 1) * TEX_H),
                       3 + int(hash1(i * 5 + 2) * 7), hash1(i * 5 + 3) < 0.35))
    return tex, crests


WATER_TEX, CRESTS = build_water()
SCROLL_B = 70  # px/s, world moves down while the formation flies up
SHIP_SPEED = 8  # ships steam up against the scroll

PLANE_W, PLANE_H = 40, 50
MIRAGE = load_sprite('mirage.png', PLANE_W, PLANE_H)
SKYHAWK = load_sprite('skyhawk.png', PLANE_W, PLANE_H)
DAGGER = load_sprite('dagger.png', PLANE_W, PLANE_H)
HARRIER = load_sprite('enemy_harrier.png', 30, 34)
FRIGATE_TOP = load_sprite('enemy_ship.png', 20, 64)
DESTROYER_TOP = load_sprite('boss_destroyer.png', 22, 110)
MISSILE = load_sprite('missile.png', 6, 14)
BURNER = load_sprite('afterburner.png', 18, 20)

CLOUD = build_cloud([(22, 26, 14), (40, 18, 17), (60, 24, 15), (78, 30, 12), (34, 36, 12),
                     (56, 38, 13), (12, 34, 9)], (96, 54))

# (sprite, x, y) V formation flying up.
FORMATION = [(MIRAGE, 108, 184), (SKYHAWK, 56, 226), (DAGGER, 160, 226)]

SHIPS_B = [  # sprite, x, screen y (top) at hit time, hit time
    (FRIGATE_TOP, 56, 110, 2.75),
    (DESTROYER_TOP, 168, 64, 3.9),
]
DECOY = (FRIGATE_TOP, 206, 4.4)  # (sprite, x, time its top enters the screen)
HARRIER_ENTER = 4.1
HARRIER_HIT = 5.0
# Clouds sweeping down: (x, time entering at the top, alpha).
CLOUDS_B = [(150, 0.4, 0.85), (-20, 4.6, 0.9), (170, 5.4, 0.8)]


def ship_b_y(y_hit, hit, t):
    return y_hit + (SCROLL_B - SHIP_SPEED) * (t - hit)


def plane_pos(i, t):
    _, x, y = FORMATION[i]
    return x, y + math.sin(t * 2 + x) * 1.5


def draw_ship(f, spr, x, y, t, hit=None):
    sw, sh = spr.shape[1], spr.shape[0]
    if y > H + 10 or y + sh < -70:
        return
    # Wake trailing behind the stern.
    for k in range(34):
        wyk = y + sh + k * 2
        spread = k // 4
        for side in (-1, 1):
            if hash1(k * 3 + side + int(t * 10)) < 0.75:
                px(f, x + sw // 2 + side * spread, wyk, FOAM, 0.7 - k / 50)
    if hit is None or t < hit + 0.25:
        blit(f, spr, x, y)
        return
    blit(f, spr, x, y, shade=0.38)
    for k in range(6):
        if int(t * 14 + k) % 2 == 0:
            px(f, x + sw // 2 + (k % 2), y + 4 + k * (sh // 6), rgb('#ff8030'))
    for k in range(10):
        life = (t * 1.2 + k / 10) % 1.0
        sy = y + sh * 0.5 + life * 30 + math.sin(k) * 4
        r = 1 + int(life * 5)
        rect(f, x + sw // 2 - r + life * 6, sy - r, 2 * r, 2 * r, rgb('#3a3a44'), 0.6 * (1 - life))


def shot_b(t):
    off = int(SCROLL_B * t) % TEX_H
    f = WATER_TEX[(np.arange(H) - off) % TEX_H].copy()
    for cx, cy, ln, hi in CRESTS:
        y = (cy + SCROLL_B * t * (1.0 if hi else 0.8)) % TEX_H
        if y < H:
            col = CREST_HI if hi else CREST_DIM
            rect(f, cx, y, ln, 1, col)
            if hi and math.sin(t * 6 + cx) > 0.6:
                px(f, cx + ln // 2, y, FOAM)

    # Ships steaming toward the formation; hit ships burn as they drift past.
    for spr, x, y_hit, hit in SHIPS_B:
        y = ship_b_y(y_hit, hit, t)
        sw, sh = spr.shape[1], spr.shape[0]
        draw_ship(f, spr, x, y, t, hit)
        draw_explosion(f, x + sw / 2, y + sh / 2, t - hit, 44, 0.7)
        draw_explosion(f, x + sw / 2 + 4, y + sh * 0.7, t - hit - 0.2, 30, 0.6)
    spr, x, enter = DECOY
    draw_ship(f, spr, x, -spr.shape[0] + (SCROLL_B - SHIP_SPEED) * (t - enter), t)

    # Missiles from the formation toward the ships.
    launches = [(2.2, 1, SHIPS_B[0]), (3.3, 2, SHIPS_B[1]), (3.45, 0, SHIPS_B[1])]
    for lt0, pi, (spr, x, y_hit, hit) in launches:
        lt = t - lt0
        dur = hit - lt0
        if 0 <= lt < dur:
            px0, py0 = plane_pos(pi, lt0)
            sx, sy = px0 + PLANE_W / 2, py0
            tx = x + spr.shape[1] / 2
            ty = y_hit + spr.shape[0] / 2
            p = lt / dur
            mx, my = sx + (tx - sx) * p, sy + (ty - sy) * p
            blit(f, MISSILE, mx - 3, my - 7)
            for k in range(1, 8):
                px(f, mx + math.sin(k + t * 30) * 0.8, my + 7 + k * 2, rgb('#c8d8e8'), 0.7 - k * 0.08)

    # Harrier diving at the formation, downed by the lead's cannon.
    lt = t - HARRIER_ENTER
    if lt > 0:
        hx = 150 - lt * 36
        hy = -40 + 150 * lt
        if t < HARRIER_HIT:
            blit(f, HARRIER, hx, hy)
        draw_explosion(f, hx + 15, hy + 17, t - HARRIER_HIT, 40, 0.6)
        if HARRIER_ENTER + 0.35 < t < HARRIER_HIT:
            lx, ly = plane_pos(0, t)
            gun_x, gun_y = lx + PLANE_W / 2, ly - 2
            span = gun_y - (hy + 34)
            for k in range(4):
                if span > 4:
                    by = gun_y - ((t * 400 + k * 30) % span)
                    bx = gun_x + (hx + 15 - gun_x) * (gun_y - by) / span
                    rect(f, bx + (k % 2) * 2, by, 1, 3, rgb('#fff080'))

    # Formation: shadows first, then planes with afterburners.
    for i, (spr, _, _) in enumerate(FORMATION):
        x, y = plane_pos(i, t)
        blit(f, spr, x + 12, y + 16, alpha=0.35, tint=rgb('#021020'))
    for i, (spr, _, _) in enumerate(FORMATION):
        x, y = plane_pos(i, t)
        flick = int(t * 24) % 2
        blit(f, BURNER, x + PLANE_W / 2 - 9, y + PLANE_H - 7 + flick * 2)
        blit(f, spr, x, y)

    # High clouds sweeping down for depth, with shadows on the sea.
    for cx, enter, alpha in CLOUDS_B:
        cy = -CLOUD.shape[0] + (t - enter) * 170
        if -CLOUD.shape[0] - 30 < cy < H + 30:
            blit(f, CLOUD, cx + 24, cy + 40, alpha=0.3, tint=rgb('#021020'))
            blit(f, CLOUD, cx, cy, alpha=alpha)

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


def main():
    n = int(DURATION * FPS)
    ow, oh = W * SCALE, H * SCALE
    cmd = [ffmpeg_exe(), '-y', '-loglevel', 'error',
           '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{ow}x{oh}', '-r', str(FPS), '-i', '-',
           '-an', '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '22',
           '-pix_fmt', 'yuv420p', '-profile:v', 'main', '-movflags', '+faststart', OUT]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    preview = '--preview' in sys.argv
    for i in range(n):
        f = np.clip(frame_at(i / FPS), 0, 255).astype(np.uint8)
        if i == 0:
            Image.fromarray(f).save(POSTER, optimize=True)
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
