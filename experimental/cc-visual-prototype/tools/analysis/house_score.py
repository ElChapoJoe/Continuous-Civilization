"""Score a per-tile candidate probe against the engine's own picture (house layouts, round 63).

  python house_score.py <engine shots> <candidate shots> <pack.txt> <radius_px> <states per view> <out.json>

Two runs of tools/game/street-probe.js with the same views and globalThis.CCProbeCands: the first with
CCProbeNoClip (its state 0 of each view is the engine's own picture), the second with the tiles clipped, so state k
shows candidate k alone. Per tile the candidate whose picture is closest to the engine's wins (fine detail, as
table_score.py). A sparse candidate gets no advantage this way, unlike scoring the unclipped run alone.
Writes {"x,y": [best index, ratio second/best, [distance per candidate]]} and prints a summary.
"""
import json
import os
import sys
from collections import Counter

import numpy as np

eng_dir, cand_dir, pack_path, radius, per, out_path = sys.argv[1:7]
radius, per = int(radius), int(per)


def load(folder, k):
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


tiles = [list(map(int, p.split(",")[:5])) for p in open(pack_path).read().strip().split(";") if p]
first = load(eng_dir, 0)
H, W = first.shape
# client origin from the probe's blue marker square
raw = open(os.path.join(eng_dir, "s00.bmp"), "rb").read()
off = int.from_bytes(raw[10:14], "little"); w0 = int.from_bytes(raw[18:22], "little", signed=True)
h0 = int.from_bytes(raw[22:26], "little", signed=True); row = (w0 * 3 + 3) & ~3
img = np.frombuffer(raw, np.uint8, count=row * abs(h0), offset=off).reshape(abs(h0), row)[:, :w0 * 3].reshape(abs(h0), w0, 3)
img = img[::-1] if h0 > 0 else img
m = (img[:400, :400, 0] > 235) & (img[:400, :400, 1] < 20)
ys, xs = np.nonzero(m)
ox, oy = int(xs.min()), int(ys.min())
yy, xx = np.mgrid[-radius:radius + 1, -radius:radius + 1]
disc = (xx * xx + yy * yy) <= radius * radius
by_view = {}
for t in tiles:
    by_view.setdefault(t[2], []).append(t)
out = {}
for v, ts in sorted(by_view.items()):
    try:
        base = load(eng_dir, v * per)
        cands = [load(cand_dir, v * per + k) for k in range(1, per)]
    except FileNotFoundError:
        print("view %d incomplete, skipped" % v)
        continue
    for x, y, _, px, py in ts:
        cx, cy = ox + px, oy + py
        if cx - radius < ox + 170 and cy - radius < oy + 170:
            continue
        if cx - radius < 0 or cy - radius < 0 or cx + radius >= W or cy + radius >= H:
            continue
        win = (slice(cy - radius, cy + radius + 1), slice(cx - radius, cx + radius + 1))
        b = detail(base[win])[disc]
        d = [100.0 * (1.0 - corr(b, detail(c[win])[disc])) for c in cands]
        o = sorted(range(len(d)), key=lambda i: d[i])
        out["%d,%d" % (x, y)] = [o[0], round(d[o[1]] / max(d[o[0]], 1e-6), 2), [round(z, 1) for z in d]]
json.dump(out, open(out_path, "w"))
ratios = sorted(r for _, r, _ in out.values())
print("tiles %d, best candidate %s, median ratio %.2f, ratio >1.5: %d" % (
    len(out), dict(Counter(b for b, _, _ in out.values())), ratios[len(ratios) // 2] if ratios else 0,
    sum(r > 1.5 for r in ratios)))
