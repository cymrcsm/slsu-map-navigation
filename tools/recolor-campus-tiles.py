"""recolor-campus-tiles.py - paint the campus on the street-map tiles plain lawn green.

    python tools/recolor-campus-tiles.py                 (public/tiles in place, #CDEBB0)
    python tools/recolor-campus-tiles.py <src> <out> <#RRGGBB>

OpenStreetMap's standard style fills school and university grounds with a pale
cream (#FFFFE5) and prints its own building, road and amenity names over them.
On the kiosk the floor drawing draws the campus itself - buildings, roads,
courts - and its own names, so inside the campus the street map is only seen
in the gaps between drawn things, where OSM's names showed through as stray
text ("University Clinic", "Learning Commons"). This turns the whole campus
into OpenStreetMap's park/lawn green (#CDEBB0):

  1. Each zoom level's tiles are stitched into one picture.
  2. The campus outline is the cream area, with the cream blocks joined across
     the roads between them (a closing about one road wide) and everything they
     enclose filled in - the campus buildings, roads, oval and names.
  3. Inside it every pixel becomes the green. On its edge, the anti-aliased
     pixels where the cream blended into what lies outside are unmixed into
     cream + that neighbour, and the cream share swapped for the green.
  4. Changed tiles are saved as 256-colour PNGs like the originals; tiles with
     nothing of the campus on them are left untouched.

Run it on tiles fresh from fetch-tiles.js (it finds the campus by the cream);
on tiles already done it changes nothing. A label that OSM printed across the
campus edge keeps the part outside. When the colour or the tiles change, bump
TILE_VERSION in app.js and the ?v= in mobile.js so browsers that cached the
old tiles fetch the new ones.

Needs Python 3 with numpy, Pillow and scipy:  pip install numpy pillow scipy
"""
import glob
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

CREAM = np.array([0xFF, 0xFF, 0xE5], float)
args = sys.argv[1:] or ['public/tiles', 'public/tiles', '#CDEBB0']
src, out, hexcol = args[0], args[1], args[2]
NEW = np.array([int(hexcol[i:i + 2], 16) for i in (1, 3, 5)], float)
ROAD_PX = {15: 2, 16: 3, 17: 5, 18: 9, 19: 17}     # about one campus road's width


def disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r


def save(img, mode, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if mode == 'P':
        img.convert('RGB').quantize(256, method=Image.Quantize.MEDIANCUT,
                                    dither=Image.Dither.NONE).save(path, optimize=True)
    elif mode == 'RGBA':
        img.save(path, optimize=True)
    else:
        img.convert('RGB').save(path, optimize=True)


changed_tiles = 0
for zdir in sorted(glob.glob(os.path.join(src, '*'))):
    if not os.path.basename(zdir).isdigit():
        continue
    z = int(os.path.basename(zdir))
    files = glob.glob(os.path.join(zdir, '*', '*.png'))
    if not files:
        continue
    key = lambda f: (int(f.split(os.sep)[-2]), int(os.path.basename(f)[:-4]))
    x0 = min(key(f)[0] for f in files); y0 = min(key(f)[1] for f in files)
    x1 = max(key(f)[0] for f in files); y1 = max(key(f)[1] for f in files)
    H, W = (y1 - y0 + 1) * 256, (x1 - x0 + 1) * 256
    rgba = np.zeros((H, W, 4), float)
    modes = {}
    for f in files:
        x, y = key(f)
        im = Image.open(f)
        modes[f] = im.mode
        rgba[(y - y0) * 256:(y - y0 + 1) * 256, (x - x0) * 256:(x - x0 + 1) * 256] = np.array(im.convert('RGBA'))
    rgb = rgba[..., :3]
    cream = np.all(np.abs(rgb - CREAM) < 1.5, axis=-1)
    if not cream.any():
        print(f'z{z}: no campus cream - left as it is')
        continue

    # 2. the campus outline
    r = ROAD_PX.get(z, 9)
    pad = r + 2
    closed = ndimage.binary_closing(np.pad(cream, pad), structure=disk(r))[pad:-pad, pad:-pad]
    region = ndimage.binary_fill_holes(closed)
    lab, n = ndimage.label(region)
    if n > 1:
        region = lab == (np.argmax(ndimage.sum(region, lab, range(1, n + 1))) + 1)
    region |= cream

    # 3a. the edge: outside the campus, next to it - unmix the cream share
    near = ndimage.binary_dilation(region, structure=np.ones((3, 3), bool))
    edge = near & ~region
    res = rgb.copy()
    if edge.any():
        h, w = cream.shape
        prgb = np.pad(rgb, ((1, 1), (1, 1), (0, 0)), mode='edge')
        far = np.zeros_like(rgb); fard = np.full((h, w), -1.0)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nb = prgb[1 + dy:1 + dy + h, 1 + dx:1 + dx + w]
                d = np.linalg.norm(nb - CREAM, axis=-1)
                take = (d > fard) & ~np.pad(region, 1)[1 + dy:1 + dy + h, 1 + dx:1 + dx + w]
                far[take] = nb[take]; fard[take] = d[take]
        X, P = far[edge], rgb[edge]
        v = CREAM - X
        denom = (v * v).sum(-1)
        a = np.where(denom > 1, ((P - X) * v).sum(-1) / np.maximum(denom, 1), 0)
        a = np.clip(a, 0, 1)[:, None]
        res[edge] = P + a * (NEW - CREAM)
    # 3b. inside: the green
    res[region] = NEW
    rgba[..., :3] = np.clip(np.round(res), 0, 255)
    touched = region | edge

    # 4. write the tiles that changed
    n_changed = 0
    for f in files:
        x, y = key(f)
        sl = (slice((y - y0) * 256, (y - y0 + 1) * 256), slice((x - x0) * 256, (x - x0 + 1) * 256))
        dp = os.path.join(out, os.path.relpath(f, src))
        if not touched[sl].any():
            if os.path.abspath(dp) != os.path.abspath(f):
                os.makedirs(os.path.dirname(dp), exist_ok=True)
                Image.open(f).save(dp)
            continue
        save(Image.fromarray(rgba[sl].astype(np.uint8), 'RGBA'), modes[f], dp)
        n_changed += 1
    changed_tiles += n_changed
    print(f'z{z}: campus {int(region.sum())} px green, {int(edge.sum())} edge px blended, {n_changed} tiles written')
print(f'{hexcol}: {changed_tiles} tiles recoloured')
