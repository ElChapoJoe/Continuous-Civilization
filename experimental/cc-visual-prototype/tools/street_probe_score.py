"""Score the screenshots of tools/street-probe.js: for every tile, which candidate street layout changes the picture
least when drawn over the engine's own ground (that one is the engine's). Needs numpy (Blender's Python has it).

  python street_probe_score.py <folder with s00.bmp ...> <tiles.json> [radius_px]

tiles.json: [[x, y, districtId, constructibleId, isCentre, [px, py] in view 0 or 0, [px, py] in view 1 or 0, ...], ...]
(pixel positions inside the game's client area). Prints one line per tile and writes labels.json next to the shots.
"""
import json
import os
import sys

import numpy as np

folder, tiles_path = sys.argv[1], sys.argv[2]
radius = int(sys.argv[3]) if len(sys.argv) > 3 else 100
CANDS = [None] + [(s, a) for s in (0, 1) for a in range(0, 360, 60)]
NAMES = ["A", "B"]


def load(k):
    with open(os.path.join(folder, "s%02d.bmp" % k), "rb") as f:
        data = f.read()
    off = int.from_bytes(data[10:14], "little")
    w = int.from_bytes(data[18:22], "little", signed=True)
    h = int.from_bytes(data[22:26], "little", signed=True)
    row = (w * 3 + 3) & ~3
    img = np.frombuffer(data, np.uint8, count=row * abs(h), offset=off).reshape(abs(h), row)[:, :w * 3].reshape(abs(h), w, 3)
    return (img[::-1] if h > 0 else img).astype(np.float32)   # BGR, top row first


def detail(a, k=12):
    """The window minus a (2k+1)-pixel box blur of itself."""
    pad = np.pad(a, k, mode="edge")
    c = np.cumsum(np.cumsum(pad, axis=0), axis=1)
    c = np.pad(c, ((1, 0), (1, 0)))
    n = 2 * k + 1
    blur = (c[n:, n:] - c[:-n, n:] - c[n:, :-n] + c[:-n, :-n]) / (n * n)
    return a - blur


def corr(a, b):
    a = a - a.mean()
    b = b - b.mean()
    return float((a * b).sum() / max(np.sqrt((a * a).sum() * (b * b).sum()), 1e-6))


tiles = json.load(open(tiles_path))
views = len(tiles[0]) - 5
base0 = load(0)
marker = (base0[:, :, 0] > 235) & (base0[:, :, 1] < 20)          # the probe's blue marker square
ys, xs = np.nonzero(marker[:400, :400])
ox, oy = int(xs.min()), int(ys.min())
print("client origin", ox, oy)
H, W = base0.shape[:2]
yy, xx = np.mgrid[-radius:radius + 1, -radius:radius + 1]
disc = (xx * xx + yy * yy) <= radius * radius

labels = {}
for v in range(views):
    shots = [load(v * len(CANDS) + c).mean(axis=2) for c in range(len(CANDS))]
    for t in tiles:
        p = t[5 + v]
        if not p or t[4]:
            continue
        cx, cy = ox + p[0], oy + p[1]
        if cx - radius < ox + 170 and cy - radius < oy + 170:
            continue                                                  # under the marker
        if cx - radius < 0 or cy - radius < 0 or cx + radius >= W or cy + radius >= oy + 993:
            continue                                                  # not fully on screen
        win = (slice(cy - radius, cy + radius + 1), slice(cx - radius, cx + radius + 1))
        # Compare fine detail only (picture minus its own blur), as 100 * (1 - correlation): a passing cloud
        # shadow or haze changes the brightness of a whole shot and must not count as a different pattern.
        base = detail(shots[0][win])[disc]
        d = [100.0 * (1.0 - corr(base, detail(shots[c][win])[disc])) for c in range(1, len(CANDS))]
        order = np.argsort(d)
        best, second = int(order[0]), int(order[1])
        s, a = CANDS[best + 1]
        key = "%d,%d" % (t[0], t[1])
        margin = d[second] / max(d[best], 1e-6)
        if key not in labels or margin > labels[key]["margin"]:
            labels[key] = {"x": t[0], "y": t[1], "did": t[2], "cid": t[3], "street": NAMES[s], "angle": a,
                           "margin": round(margin, 2), "view": v,
                           "second": "%s%d" % (NAMES[CANDS[second + 1][0]], CANDS[second + 1][1]),
                           "scores": [round(x, 2) for x in d]}
for key, l in sorted(labels.items(), key=lambda kv: (kv[1]["y"], kv[1]["x"])):
    print("%-6s %s%-3d margin %5.2f (next %s)  %s" % (key, l["street"], l["angle"], l["margin"], l["second"],
                                                    " ".join("%5.2f" % x for x in l["scores"])))
json.dump(list(labels.values()), open(os.path.join(folder, "labels.json"), "w"))
print(len(labels), "tiles")
