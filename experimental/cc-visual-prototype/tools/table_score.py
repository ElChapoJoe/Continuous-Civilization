"""Score a whole-map street-probe run (tools/table-map.js + street-probe.js with cityIndex -1).

  python table_score.py <shots folder> <pack.txt> <radius_px> <out.json> [known.json ...]

pack.txt is CCTable.pack() ("x,y,view,px,py;...") or CCTable.pack64() (pixel position in the game's client area, in that view).
Writes {"x,y": [label, margin]} and prints a summary; known.json files ({"x,y": "A60", ...}) are compared.
Same scoring as street_probe_score.py: fine detail (picture minus its blur), 100 * (1 - correlation).
"""
import json
import os
import sys

import numpy as np

folder, pack_path, radius, out_path = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
known_paths = sys.argv[5:]
CANDS = [None] + [(s, a) for s in (0, 1) for a in range(0, 360, 60)]
NAMES = ["A", "B"]
PER = len(CANDS)


def load(k):
    with open(os.path.join(folder, "s%02d.bmp" % k), "rb") as f:
        data = f.read()
    off = int.from_bytes(data[10:14], "little")
    w = int.from_bytes(data[18:22], "little", signed=True)
    h = int.from_bytes(data[22:26], "little", signed=True)
    row = (w * 3 + 3) & ~3
    img = np.frombuffer(data, np.uint8, count=row * abs(h), offset=off).reshape(abs(h), row)[:, :w * 3].reshape(abs(h), w, 3)
    return (img[::-1] if h > 0 else img).astype(np.float32).mean(axis=2)


def detail(a, k=None):
    k = k or max(4, radius // 10)
    pad = np.pad(a, k, mode="edge")
    c = np.pad(np.cumsum(np.cumsum(pad, axis=0), axis=1), ((1, 0), (1, 0)))
    n = 2 * k + 1
    return a - (c[n:, n:] - c[:-n, n:] - c[n:, :-n] + c[:-n, :-n]) / (n * n)


def corr(a, b):
    a = a - a.mean()
    b = b - b.mean()
    return float((a * b).sum() / max(np.sqrt((a * a).sum() * (b * b).sum()), 1e-6))


raw_pack = open(pack_path).read().strip()
if ";" in raw_pack or "," in raw_pack:
    tiles = [list(map(int, p.split(","))) for p in raw_pack.split(";") if p]
else:   # CCTable.pack64(): 9 characters per tile
    B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
    d = lambda s: B64.index(s[0]) * 64 + B64.index(s[1])
    tiles = [[d(raw_pack[i:i + 2]), d(raw_pack[i + 2:i + 4]), B64.index(raw_pack[i + 4]), d(raw_pack[i + 5:i + 7]),
              d(raw_pack[i + 7:i + 9])] for i in range(0, len(raw_pack), 9)]
first_k = next(k for k in range(10000) if os.path.exists(os.path.join(folder, "s%02d.bmp" % k)))
first = load(first_k)
H, W = first.shape
# client origin: the probe's marker square is pure blue in the top-left corner
raw = open(os.path.join(folder, "s%02d.bmp" % first_k), "rb").read()
off = int.from_bytes(raw[10:14], "little"); w0 = int.from_bytes(raw[18:22], "little", signed=True)
h0 = int.from_bytes(raw[22:26], "little", signed=True); row = (w0 * 3 + 3) & ~3
img = np.frombuffer(raw, np.uint8, count=row * abs(h0), offset=off).reshape(abs(h0), row)[:, :w0 * 3].reshape(abs(h0), w0, 3)
img = img[::-1] if h0 > 0 else img
m = (img[:400, :400, 0] > 235) & (img[:400, :400, 1] < 20)
ys, xs = np.nonzero(m)
ox, oy = int(xs.min()), int(ys.min())
yy, xx = np.mgrid[-radius:radius + 1, -radius:radius + 1]
disc = (xx * xx + yy * yy) <= radius * radius
labels = {}
by_view = {}
for t in tiles:
    by_view.setdefault(t[2], []).append(t)
for v, ts in sorted(by_view.items()):
    if not all(os.path.exists(os.path.join(folder, "s%02d.bmp" % (v * PER + c))) for c in range(PER)):
        print("view %d incomplete, its %d tiles skipped" % (v, len(ts)))
        continue
    shots = [load(v * PER + c) for c in range(PER)]
    for x, y, _, px, py in ts:
        cx, cy = ox + px, oy + py
        if cx - radius < ox + 170 and cy - radius < oy + 170:
            continue
        if cx - radius < 0 or cy - radius < 0 or cx + radius >= W or cy + radius >= H:
            continue
        win = (slice(cy - radius, cy + radius + 1), slice(cx - radius, cx + radius + 1))
        base = detail(shots[0][win])[disc]
        d = [100.0 * (1.0 - corr(base, detail(shots[c][win])[disc])) for c in range(1, PER)]
        order = np.argsort(d)
        s, a = CANDS[int(order[0]) + 1]
        labels["%d,%d" % (x, y)] = ["%s%d" % (NAMES[s], a), round(d[int(order[1])] / max(d[int(order[0])], 1e-6), 2)]
json.dump(labels, open(out_path, "w"))
margins = sorted(m for _, m in labels.values())
print("tiles in pack %d, labelled %d, margin <2: %d, <3: %d, median %.1f" % (
    len(tiles), len(labels), sum(m < 2 for m in margins), sum(m < 3 for m in margins),
    margins[len(margins) // 2] if margins else 0))
for kp in known_paths:
    known = json.load(open(kp))
    both = [k for k in known if k in labels]
    same = [k for k in both if labels[k][0] == known[k]]
    print("%s: %d shared, %d same; differ: %s" % (os.path.basename(kp), len(both), len(same),
          " ".join("%s %s/%s(%.1f)" % (k, labels[k][0], known[k], labels[k][1]) for k in both if k not in same)))
