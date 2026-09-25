"""Shared pixel-art helpers for the generated art (title video, stage art).

Frames are float32 numpy arrays of shape (h, w, 3); sprites are (h, w, 4)
with hard 0/255 alpha, matching the game's crisp look.
"""

import math
import os

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')

_B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]])
BAYER4 = _B4 / 16.0
BAYER8 = np.block([[4 * _B4, 4 * _B4 + 2], [4 * _B4 + 3, 4 * _B4 + 1]]) / 64.0


def rgb(h):
    return np.array([int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)], dtype=np.float32)


def hash1(n):
    n = (n * 374761393 + 668265263) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFF) / float(0xFFFFFF)


def noise1d(x, seed=0, octaves=3):
    """Smooth value noise in [0, 1) for ridgelines and coastlines."""
    total, amp, norm = 0.0, 1.0, 0.0
    for o in range(octaves):
        xi = x / (24.0 / (2 ** o))
        i = math.floor(xi)
        f = xi - i
        f = f * f * (3 - 2 * f)
        a = hash1(i + seed * 7919 + o * 104729)
        b = hash1(i + 1 + seed * 7919 + o * 104729)
        total += (a + (b - a) * f) * amp
        norm += amp
        amp *= 0.5
    return total / norm


def noise2d(x, y, seed=0, scale=8.0):
    """Smooth 2D value noise in [0, 1) for terrain textures."""
    xs, ys = x / scale, y / scale
    x0, y0 = math.floor(xs), math.floor(ys)
    fx, fy = xs - x0, ys - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)

    def h(i, j):
        return hash1((i * 73856093) ^ (j * 19349663) ^ (seed * 83492791))

    top = h(x0, y0) + (h(x0 + 1, y0) - h(x0, y0)) * fx
    bot = h(x0, y0 + 1) + (h(x0 + 1, y0 + 1) - h(x0, y0 + 1)) * fx
    return top + (bot - top) * fy


def dithered_bands(stops, rows, width):
    """Vertical gradient quantised to `stops`, ordered-dithered between bands."""
    pal = [rgb(s) for s in stops]
    out = np.zeros((rows, width, 3), dtype=np.float32)
    ys, xs = np.mgrid[0:rows, 0:width]
    t = ys / max(rows - 1, 1) * (len(pal) - 1)
    lo = np.floor(t).astype(int)
    frac = t - lo
    idx = np.clip(lo + (frac > BAYER4[ys % 4, xs % 4]), 0, len(pal) - 1)
    for i, c in enumerate(pal):
        out[idx == i] = c
    return out


# ---------------------------------------------------------------- drawing

def blit(frame, spr, x, y, alpha=1.0, tint=None, shade=1.0):
    fh, fw = frame.shape[:2]
    x, y = int(round(x)), int(round(y))
    sh, sw = spr.shape[:2]
    x0, y0 = max(x, 0), max(y, 0)
    x1, y1 = min(x + sw, fw), min(y + sh, fh)
    if x0 >= x1 or y0 >= y1:
        return
    src = spr[y0 - y:y1 - y, x0 - x:x1 - x]
    a = (src[..., 3:4] / 255.0) * alpha
    col = src[..., :3] * shade if tint is None else np.broadcast_to(tint, src[..., :3].shape)
    dst = frame[y0:y1, x0:x1]
    frame[y0:y1, x0:x1] = dst * (1 - a) + col * a


def px(frame, x, y, color, alpha=1.0):
    fh, fw = frame.shape[:2]
    x, y = int(x), int(y)
    if 0 <= x < fw and 0 <= y < fh:
        frame[y, x] = frame[y, x] * (1 - alpha) + color * alpha


def rect(frame, x, y, w, h, color, alpha=1.0):
    fh, fw = frame.shape[:2]
    x0, y0 = max(int(x), 0), max(int(y), 0)
    x1, y1 = min(int(x + w), fw), min(int(y + h), fh)
    if x0 < x1 and y0 < y1:
        frame[y0:y1, x0:x1] = frame[y0:y1, x0:x1] * (1 - alpha) + color * alpha


def fill_mask(frame, mask, color, alpha=1.0):
    m = mask[..., None] * alpha
    frame[:] = frame * (1 - m) + color * m


def polygon(frame, pts, color, alpha=1.0):
    fh, fw = frame.shape[:2]
    img = Image.new('L', (fw, fh), 0)
    ImageDraw.Draw(img).polygon([(round(x), round(y)) for x, y in pts], fill=255)
    fill_mask(frame, np.array(img) / 255.0, color, alpha)


def disc(frame, cx, cy, r, color, alpha=1.0, dither=None):
    """Filled circle; `dither` in (0,1] thins it out with the Bayer matrix."""
    for y in range(int(cy - r), int(cy + r) + 1):
        dy = y - cy
        if abs(dy) > r:
            continue
        half = int(math.sqrt(r * r - dy * dy))
        for x in range(int(cx) - half, int(cx) + half + 1):
            if dither is None or BAYER4[y % 4, x % 4] < dither:
                px(frame, x, y, color, alpha)


def line(frame, x0, y0, x1, y1, color, alpha=1.0, dash=0):
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    for i in range(n):
        if dash and (i // dash) % 2:
            continue
        t = i / max(n - 1, 1)
        px(frame, round(x0 + (x1 - x0) * t), round(y0 + (y1 - y0) * t), color, alpha)


# ---------------------------------------------------------------- sprites

# Side-view delta jet (Mirage/Dagger silhouette) facing right.
# '#' body, '%' underside, 'o' rim light, 'c' canopy, 'C' canopy glint.
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


def flip_x(spr):
    return spr[:, ::-1].copy()


def load_sprite(name, w, h, rotate=0):
    """Downscale a game sprite and harden its alpha like the in-game look."""
    img = Image.open(os.path.join(ASSETS, name)).convert('RGBA')
    img = img.resize((w, h), Image.BOX)
    if rotate:
        img = img.rotate(rotate, expand=True)
    a = np.array(img).astype(np.float32)
    a[..., 3] = np.where(a[..., 3] >= 110, 255, 0)
    return a


def build_cloud(puffs, size, top='#ffffff', mid='#dcecfa', low='#a9c4de'):
    """Puffy cloud from overlapping circles, lit from above with dithered bands."""
    cw, ch = size
    spr = np.zeros((ch, cw, 4), dtype=np.float32)
    top, mid, low = rgb(top), rgb(mid), rgb(low)
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


def to_image(frame, scale=1):
    img = Image.fromarray(np.clip(frame, 0, 255).astype(np.uint8))
    if scale != 1:
        img = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
    return img


def pitch(spr, slope):
    """Shear a right-facing side-view sprite so its nose points up."""
    h, w = spr.shape[:2]
    extra = int(math.ceil(w * slope))
    out = np.zeros((h + extra, w, 4), dtype=np.float32)
    for x in range(w):
        dy = extra - int(round(x * slope))
        out[dy:dy + h, x] = spr[:, x]
    return out


# ---------------------------------------------------------------- explosions

_explosions = None
_exp_cache = {}


def explosion(i, size):
    """Frame `i` (0-4) of the in-game explosion, downscaled to `size`."""
    global _explosions
    if _explosions is None:
        _explosions = [Image.open(os.path.join(ASSETS, f'explosion_{k}.png')).convert('RGBA')
                       for k in range(5)]
    key = (i, size)
    if key not in _exp_cache:
        a = np.array(_explosions[i].resize((size, size), Image.BOX)).astype(np.float32)
        a[..., 3] = np.where(a[..., 3] >= 100, 255, 0)
        _exp_cache[key] = a
    return _exp_cache[key]


def draw_explosion(frame, cx, cy, age, size, dur=0.6):
    if age < 0 or age >= dur:
        return
    s = explosion(min(int(age / dur * 5), 4), size)
    blit(frame, s, cx - size / 2, cy - size / 2)


# ---------------------------------------------------------------- encoding

def ffmpeg_exe():
    if os.environ.get('FFMPEG'):
        return os.environ['FFMPEG']
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return 'ffmpeg'


def encode_mp4(render, frames, fps, out, scale=2, crf=20):
    """Pipe `render(i)` frames through libx264, upscaled with nearest-neighbour."""
    import subprocess
    first = render(0)
    h, w = first.shape[:2]
    cmd = [ffmpeg_exe(), '-y', '-loglevel', 'error',
           '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w * scale}x{h * scale}', '-r', str(fps),
           '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation',
           '-crf', str(crf), '-pix_fmt', 'yuv420p', '-profile:v', 'main', '-movflags', '+faststart', out]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(frames):
        f = first if i == 0 else render(i)
        f = np.clip(f, 0, 255).astype(np.uint8)
        proc.stdin.write(f.repeat(scale, axis=0).repeat(scale, axis=1).tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError('ffmpeg failed')
