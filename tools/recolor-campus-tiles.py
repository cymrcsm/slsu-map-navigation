"""recolor-campus-tiles.py - paint the campus grounds on the street-map tiles green.

    python tools/recolor-campus-tiles.py                 (public/tiles in place, #CDEBB0)
    python tools/recolor-campus-tiles.py <src> <out> <#RRGGBB>

OpenStreetMap's standard style fills school and university grounds with a pale
cream (#FFFFE5). The kiosk shows OpenStreetMap's own park/lawn green (#CDEBB0)
there instead. This replaces that cream in the PNG tiles, including the
anti-aliased pixels where it blends into a road or a building edge (each such
pixel is unmixed into cream + its neighbour and the cream share swapped), and
saves 256-colour PNGs like the originals. Run it again after fetch-tiles.js
downloads new tiles; on tiles already recoloured it changes nothing. When the
colour or the tiles change, bump TILE_VERSION in app.js and mobile.js so
browsers that cached the old tiles fetch the new ones.

Needs Python 3 with numpy and Pillow:  pip install numpy pillow
"""
import os
import sys

import numpy as np
from PIL import Image

CREAM = np.array([0xFF, 0xFF, 0xE5], float)
args = sys.argv[1:] or ['public/tiles', 'public/tiles', '#CDEBB0']
src, out, hexcol = args[0], args[1], args[2]
NEW = np.array([int(hexcol[i:i + 2], 16) for i in (1, 3, 5)], float)

changed = edge_px = 0
for root, _, files in os.walk(src):
    for f in files:
        if not f.endswith('.png'):
            continue
        sp = os.path.join(root, f)
        dp = os.path.join(out, os.path.relpath(sp, src))
        os.makedirs(os.path.dirname(dp), exist_ok=True)
        im = Image.open(sp)
        mode = im.mode
        rgba = np.array(im.convert('RGBA')).astype(float)
        rgb = rgba[..., :3]
        exact = np.all(np.abs(rgb - CREAM) < 1.5, axis=-1)
        if not exact.any():
            # nothing to recolour: copied when writing elsewhere, left alone in
            # place (re-saving would change the file's bytes, not its pixels)
            if os.path.abspath(dp) != os.path.abspath(sp):
                im.save(dp)
            continue
        res = rgb.copy()
        res[exact] = NEW
        # edge pixels: next to a cream pixel but not cream. Unmix p = a*CREAM + (1-a)*X,
        # X = the 8-neighbour farthest from cream (the colour it blends with).
        h, w = exact.shape
        pad = np.pad(exact, 1)
        near = np.zeros_like(exact)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                near |= pad[1 + dy:1 + dy + h, 1 + dx:1 + dx + w]
        edge = near & ~exact
        prgb = np.pad(rgb, ((1, 1), (1, 1), (0, 0)), mode='edge')
        far = np.zeros_like(rgb)
        fard = np.full((h, w), -1.0)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nb = prgb[1 + dy:1 + dy + h, 1 + dx:1 + dx + w]
                d = np.linalg.norm(nb - CREAM, axis=-1)
                take = d > fard
                far[take] = nb[take]
                fard[take] = d[take]
        X = far[edge]
        P = rgb[edge]
        v = CREAM - X
        denom = (v * v).sum(-1)
        a = np.where(denom > 1, ((P - X) * v).sum(-1) / np.maximum(denom, 1), 0)
        a = np.clip(a, 0, 1)[:, None]
        res[edge] = P + a * (NEW - CREAM)
        rgba[..., :3] = np.clip(np.round(res), 0, 255)
        img = Image.fromarray(rgba.astype(np.uint8), 'RGBA')
        if mode == 'P':
            # the source tiles are 256-colour PNGs: an adaptive palette, no dithering
            img.convert('RGB').quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(dp, optimize=True)
        elif mode == 'RGBA':
            img.save(dp, optimize=True)
        else:
            img.convert('RGB').save(dp, optimize=True)
        changed += 1
        edge_px += int(edge.sum())
print(f'{hexcol}: {changed} tiles recoloured, {edge_px} edge pixels blended')
