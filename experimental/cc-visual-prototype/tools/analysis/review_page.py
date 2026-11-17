"""A review page for a comparison of the same city tiles in two games (vanilla left, ours right), worst first.

  python review_page.py <shots A> <pack A> <shots B> <pack B> <compare dir> [radius_px] [baseline tiles.json] [title]

<compare dir> is compare_tiles.py's output folder (its tiles.json is read); writes <compare dir>/index.html and
<compare dir>/crops/*.png. With a baseline (tiles.json of an earlier run) each tile shows how its score moved
(lower shape = closer to vanilla). Opens in any browser; nothing is fetched from outside.
"""
import html
import json
import os
import struct
import sys
import zlib

import numpy as np

a_dir, a_pack, b_dir, b_pack, out_dir = sys.argv[1:6]
radius = int(sys.argv[6]) if len(sys.argv) > 6 else 46
baseline_path = sys.argv[7] if len(sys.argv) > 7 and sys.argv[7] != "-" else None
title = sys.argv[8] if len(sys.argv) > 8 else "Vanilla vs overlay"
rows = json.load(open(os.path.join(out_dir, "tiles.json")))
base = {r["tile"]: r for r in json.load(open(baseline_path))} if baseline_path and os.path.exists(baseline_path) else {}


def read_bmp(path):
    data = open(path, "rb").read()
    off = int.from_bytes(data[10:14], "little")
    w = int.from_bytes(data[18:22], "little", signed=True)
    h = int.from_bytes(data[22:26], "little", signed=True)
    row = (w * 3 + 3) & ~3
    img = np.frombuffer(data, np.uint8, count=row * abs(h), offset=off).reshape(abs(h), row)[:, :w * 3].reshape(abs(h), w, 3)
    return img[::-1] if h > 0 else img   # BGR, top row first


def origin(img):
    m = (img[:400, :400, 0] > 235) & (img[:400, :400, 2] < 40)
    ys, xs = np.nonzero(m)
    return (int(xs.min()), int(ys.min())) if len(xs) else (0, 0)


def write_png(path, bgr):
    h, w, _ = bgr.shape
    raw = b"".join(b"\0" + bgr[y, :, ::-1].tobytes() for y in range(h))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
                           + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b""))


def load_pack(path):
    out = {}
    for p in open(path).read().strip().split(";"):
        if p:
            x, y, v, px, py, *kind = p.split(",")
            out[f"{x},{y}"] = (int(v), int(px), int(py))
    return out


def crop(folder, cache, t, r):
    v, px, py = t
    if v not in cache:
        p = os.path.join(folder, "s%02d.bmp" % v)
        cache[v] = read_bmp(p) if os.path.exists(p) else None
    img = cache[v]
    if img is None:
        return None
    ox, oy = origin(img)
    cx, cy = ox + px, oy + py
    if cx - r < 0 or cy - r < 0 or cx + r >= img.shape[1] or cy + r >= img.shape[0]:
        return None
    return img[cy - r:cy + r + 1, cx - r:cx + r + 1]


A, B = load_pack(a_pack), load_pack(b_pack)
os.makedirs(os.path.join(out_dir, "crops"), exist_ok=True)
ca, cb, cards = {}, {}, []
r = int(radius * 1.6)   # a bit of the neighbours for context
for row in rows:
    k = row["tile"]
    if k not in A or k not in B:
        continue
    pa, pb = crop(a_dir, ca, A[k], r), crop(b_dir, cb, B[k], r)
    if pa is None or pb is None:
        continue
    name = k.replace(",", "_")
    write_png(os.path.join(out_dir, "crops", name + "_a.png"), pa)
    write_png(os.path.join(out_dir, "crops", name + "_b.png"), pb)
    delta = ""
    if k in base:
        d = row["shape"] - base[k]["shape"]
        cls = "better" if d < -2 else "worse" if d > 2 else "same"
        delta = f'<span class="{cls}">{d:+.1f} since the baseline</span>'
    cards.append(f'''<figure><figcaption><b>{html.escape(k)}</b> {html.escape(row.get("kind", ""))}
<span>shape {row["shape"]:.1f} · tone {row["tone"]:.1f}</span>{delta}</figcaption>
<div class="pair"><img src="crops/{name}_a.png" alt="vanilla {html.escape(k)}"><img src="crops/{name}_b.png" alt="ours {html.escape(k)}"></div></figure>''')

shapes = [x["shape"] for x in rows]
summary = f"{len(rows)} tiles, median shape {np.median(shapes):.1f}" if rows else "no tiles"
if base:
    moved = [x["shape"] - base[x["tile"]]["shape"] for x in rows if x["tile"] in base]
    summary += f"; against the baseline: {sum(d < -2 for d in moved)} closer to vanilla, {sum(d > 2 for d in moved)} further, median change {np.median(moved):+.1f}" if moved else ""
page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title><style>
:root {{ --bg: #f6f5f2; --fg: #1d1d1b; --muted: #6b6a66; --card: #fff; --good: #1f7a3a; --bad: #b3261e; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg: #161615; --fg: #ecebe7; --muted: #a3a29d; --card: #222220; --good: #6fcf8e; --bad: #f28b82; }} }}
body {{ margin: 0; padding: 16px; background: var(--bg); color: var(--fg); font: 15px/1.4 system-ui, sans-serif; }}
h1 {{ font-size: 20px; margin: 0 0 4px; }} p {{ color: var(--muted); margin: 0 0 16px; }}
main {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }}
figure {{ margin: 0; background: var(--card); border-radius: 8px; padding: 8px; }}
figcaption {{ display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; margin-bottom: 6px; }} figcaption span {{ color: var(--muted); }}
.pair {{ display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }} .pair img {{ width: 100%; border-radius: 4px; }}
.better {{ color: var(--good) !important; }} .worse {{ color: var(--bad) !important; }}
</style></head><body><h1>{html.escape(title)}</h1>
<p>Vanilla left, overlay right, worst first. Shape: how different the structure is (0 = same buildings and streets in the same places). Tone: colour and light. {html.escape(summary)}.</p>
<main>{"".join(cards)}</main></body></html>'''
open(os.path.join(out_dir, "index.html"), "w", encoding="utf-8").write(page)
print("wrote", os.path.join(out_dir, "index.html"), len(cards), "tiles;", summary)
