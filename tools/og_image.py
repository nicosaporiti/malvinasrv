"""Render the link-preview image (assets/og-image.png, Open Graph / Twitter).

Composed at the game's pixel scale (256x134, the 1.91:1 ratio link previews
use) from a band of the stage art, with the title in the game's monospace
font rendered without anti-aliasing, then upscaled 4x with nearest-neighbour.

Requires Pillow and numpy.
Usage: python3 tools/og_image.py [stage_number] [band_top]   (published: 1 96)
"""

import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from pixelart import ASSETS

W, H, SCALE = 256, 134, 4
FONT = '/System/Library/Fonts/Supplemental/Courier New Bold.ttf'
OUT = os.path.join(ASSETS, 'og-image.png')


def text(draw, xy, s, size, fill, shadow=(0, 0, 0)):
    font = ImageFont.truetype(FONT, size)
    x, y = xy
    draw.text((x + 1, y + 1), s, font=font, fill=shadow)
    draw.text((x, y), s, font=font, fill=fill)


def main():
    stage = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    top = int(sys.argv[2]) if len(sys.argv) > 2 else 96
    art = Image.open(os.path.join(ASSETS, f'stage_{stage}.png')).convert('RGB')
    img = art.crop((0, top, W, top + H))

    # Darken the left side so the title reads over the art.
    a = np.array(img).astype(np.float32)
    ramp = np.clip(1 - np.arange(W) / 150, 0, 1) ** 1.2 * 0.8
    a *= (1 - ramp)[None, :, None]
    img = Image.fromarray(a.astype(np.uint8))

    draw = ImageDraw.Draw(img)
    draw.fontmode = '1'  # no anti-aliasing: crisp pixel text
    text(draw, (10, 30), 'MALVINAS', 30, (255, 255, 255))
    text(draw, (12, 62), 'S.R.V.', 20, (136, 187, 221))
    text(draw, (12, 94), 'Soberania, Resistencia,', 11, (220, 200, 140))
    text(draw, (12, 106), 'Victoria', 11, (220, 200, 140))

    img.resize((W * SCALE, H * SCALE), Image.NEAREST).save(OUT, optimize=True)
    print(f'wrote {OUT} ({os.path.getsize(OUT) // 1024} KB)')


if __name__ == '__main__':
    main()
