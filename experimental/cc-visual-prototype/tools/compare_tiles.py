"""Compare the same city tiles in two games (vanilla vs our overlay), tile by tile, from tools/layout-copy.js shots.

  python compare_tiles.py <shots A> <pack A> <shots B> <pack B> <out folder> [radius_px] [worst_n]

Shots: one s<NN>.bmp per view from capture-states.ps1 while CCLayout.shoot(views) ran (the same views in both games).
Pack: CCLayout.pack() text ("x,y,view,px,py,kind;..."), saved to a file. Needs numpy (Blender's Python has it).

Per tile seen in both games, in a disc around the tile centre:
  shape  100 * (1 - correlation of fine detail): 0 = same structure (buildings, streets in the same places)
  tone   mean absolute grey difference (0-255): colour and lighting
Writes <out>/tiles.json (every tile, worst first) and <out>/worst.bmp (the worst tiles, A left, B right, one row each),
and prints the worst tiles. Same scoring idea as table_score.py.
"""
import json
import os
import sys

import numpy as np

a_dir, a_pack, b_dir, b_pack, out_dir = sys.argv[1:6]
radius = int(sys.argv[6]) if len(sys.argv) > 6 else 46
worst_n = int(sys.argv[7]) if len(sys.argv) > 7 else 24
os.makedirs(out_dir, exist_ok=True)


def read_bmp(path):
    data = open(path, "rb").read()
    off = int.from_bytes(data[10:14], "little")
    w = int.from_bytes(data[18:22], "little", signed=True)
    h = int.from_bytes(data[22:26], "little", signed=True)
    row = (w * 3 + 3) & ~3
    img = np.frombuffer(data, np.uint8, count=row * abs(h), offset=off).reshape(abs(h), row)[:, :w * 3].reshape(abs(h), w, 3)
    return img[::-1] if h > 0 else img   # BGR, top row first


def write_bmp(path, img):   # img: H x W x 3 BGR uint8, top row first
    h, w, _ = img.shape
    row = (w * 3 + 3) & ~3
    body = np.zeros((h, row), np.uint8)
    body[:, :w * 3] = img[::-1].reshape(h, w * 3)
    head = b"BM" + (54 + body.size).to_bytes(4, "little") + b"\0\0\0\0" + (54).to_bytes(4, "little")
    info = (40).to_bytes(4, "little") + w.to_bytes(4, "little") + h.to_bytes(4, "little") + (1).to_bytes(2, "little") \
        + (24).to_bytes(2, "little") + b"\0" * 24
    open(path, "wb").write(head + info + body.tobytes())


def origin(img):   # client-area origin: the marker square is pure blue in the top-left corner
    m = (img[:400, :400, 0] > 235) & (img[:400, :400, 2] < 40)
    ys, xs = np.nonzero(m)
    return (int(xs.min()), int(ys.min())) if len(xs) else (0, 0)


def detail(a, k):
    pad = np.pad(a, k, mode="edge")
    c = np.pad(np.cumsum(np.cumsum(pad, axis=0), axis=1), ((1, 0), (1, 0)))
    n = 2 * k + 1
    return a - (c[n:, n:] - c[:-n, n:] - c[n:, :-n] + c[:-n, :-n]) / (n * n)


def corr(a, b):
    a = a - a.mean()
    b = b - b.mean()
    return float((a * b).sum() / max(np.sqrt((a * a).sum() * (b * b).sum()), 1e-6))


def load_pack(path):
    out = {}
    for p in open(path).read().strip().split(";"):
        if not p:
            continue
        x, y, v, px, py, *kind = p.split(",")
        out[f"{x},{y}"] = (int(v), int(px), int(py), kind[0] if kind else "")
    return out


def crop(folder, cache, tile):
    v, px, py, _ = tile
    if v not in cache:
        path = os.path.join(folder, "s%02d.bmp" % v)
        cache[v] = read_bmp(path) if os.path.exists(path) else None
    img = cache[v]
    if img is None:
        return None
    ox, oy = origin(img)
    cx, cy = ox + px, oy + py
    if cx - radius < 0 or cy - radius < 0 or cx + radius >= img.shape[1] or cy + radius >= img.shape[0]:
        return None
    return img[cy - radius:cy + radius + 1, cx - radius:cx + radius + 1]


A, B = load_pack(a_pack), load_pack(b_pack)
yy, xx = np.mgrid[-radius:radius + 1, -radius:radius + 1]
disc = (xx * xx + yy * yy) <= radius * radius
k = max(4, radius // 10)
ca, cb, rows = {}, {}, []
for key in sorted(set(A) & set(B)):
    pa, pb = crop(a_dir, ca, A[key]), crop(b_dir, cb, B[key])
    if pa is None or pb is None:
        continue
    ga, gb = pa.astype(np.float32).mean(axis=2), pb.astype(np.float32).mean(axis=2)
    shape = 100.0 * (1.0 - corr(detail(ga, k)[disc], detail(gb, k)[disc]))
    tone = float(np.abs(ga[disc] - gb[disc]).mean())
    rows.append({"tile": key, "kind": A[key][3], "shape": round(shape, 1), "tone": round(tone, 1)})
rows.sort(key=lambda r: -r["shape"])
json.dump(rows, open(os.path.join(out_dir, "tiles.json"), "w"), indent=0)
only_a, only_b = len(set(A) - set(B)), len(set(B) - set(A))
print(f"compared {len(rows)} tiles (only in A: {only_a}, only in B: {only_b}); median shape "
      f"{np.median([r['shape'] for r in rows]) if rows else 0:.1f}, median tone {np.median([r['tone'] for r in rows]) if rows else 0:.1f}")
for r in rows[:worst_n]:
    print(f"  {r['tile']:>7} {r['kind']:<18} shape {r['shape']:5.1f}  tone {r['tone']:5.1f}")
if rows:
    s = 2 * radius + 1
    sheet = np.zeros((min(worst_n, len(rows)) * (s + 4), 2 * s + 4, 3), np.uint8)
    for i, r in enumerate(rows[:worst_n]):
        sheet[i * (s + 4):i * (s + 4) + s, :s] = crop(a_dir, ca, A[r["tile"]])
        sheet[i * (s + 4):i * (s + 4) + s, s + 4:] = crop(b_dir, cb, B[r["tile"]])
    write_bmp(os.path.join(out_dir, "worst.bmp"), sheet)
    print("wrote", os.path.join(out_dir, "worst.bmp"), "(A left, B right, worst first)")
