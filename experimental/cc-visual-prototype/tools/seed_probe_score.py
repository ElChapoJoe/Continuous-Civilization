"""Score the screenshots of tools/seed-probe.js: per candidate seed rule, how little drawing the engine's layout bin
with that seed changes each tile's picture (0 = it coincides with what the engine drew). Needs numpy.

  python seed_probe_score.py <folder with s00.bmp ...> <tiles.json> name1,name2,... [radius_px]
"""
import json
import os
import sys

import numpy as np

folder, tiles_path, names = sys.argv[1], sys.argv[2], sys.argv[3].split(",")
radius = int(sys.argv[4]) if len(sys.argv) > 4 else 90
per = len(names) + 1


def load(k):
    data = open(os.path.join(folder, "s%02d.bmp" % k), "rb").read()
    off = int.from_bytes(data[10:14], "little")
    w = int.from_bytes(data[18:22], "little", signed=True)
    h = int.from_bytes(data[22:26], "little", signed=True)
    row = (w * 3 + 3) & ~3
    img = np.frombuffer(data, np.uint8, count=row * abs(h), offset=off).reshape(abs(h), row)[:, :w * 3].reshape(abs(h), w, 3)
    return (img[::-1] if h > 0 else img).astype(np.float32)


tiles = json.load(open(tiles_path))
views = len(tiles[0]) - 5
base0 = load(0)
marker = (base0[:, :, 0] > 235) & (base0[:, :, 1] < 20)
ys, xs = np.nonzero(marker[:400, :400])
ox, oy = int(xs.min()), int(ys.min())
H, W = base0.shape[:2]
yy, xx = np.mgrid[-radius:radius + 1, -radius:radius + 1]
disc = (xx * xx + yy * yy) <= radius * radius
rows = {}
for v in range(views):
    shots = [load(v * per + c).mean(axis=2) for c in range(per)]
    for t in tiles:
        p = t[5 + v]
        if not p or t[4]:
            continue
        cx, cy = ox + p[0], oy + p[1]
        if (cx - radius < ox + 170 and cy - radius < oy + 170) or cx - radius < 0 or cy - radius < 0 \
                or cx + radius >= W or cy + radius >= oy + 993:
            continue
        win = (slice(cy - radius, cy + radius + 1), slice(cx - radius, cx + radius + 1))
        rows.setdefault((t[0], t[1]), [float(np.abs(shots[c][win] - shots[0][win])[disc].mean()) for c in range(1, per)])
d = np.array(list(rows.values()))
print(len(rows), "tiles; mean change per candidate (lower = closer to the engine's own art):")
best = d.argmin(axis=1)
for i, n in enumerate(names):
    print("  %-10s mean %6.2f  min %6.2f  best on %2d tiles  below 1.0 on %2d tiles" % (
        n, d[:, i].mean(), d[:, i].min(), int((best == i).sum()), int((d[:, i] < 1.0).sum())))
print("lowest change anywhere: %.2f; per-tile minimum mean %.2f" % (d.min(), d.min(axis=1).mean()))
