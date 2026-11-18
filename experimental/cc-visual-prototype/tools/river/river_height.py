"""Does the river channel in the terrain predict a river tile's street turn? (Analysis for river-height.js dumps.)

  python -I river_height.py <dump.txt> <street-table json of that map> [more street tables of the same size ...]

dump.txt: CCRiverHeight.dump() output. The first street table is the map the dump came from (its river tiles carry
the turn the engine gave them there); the others give each coordinate's own turn, measured where it has no river.
A tile "flips" when its turn on the river differs from the coordinate's own turn (rounds 48-52: about half of the
mouths and middles flip; sources and sharp bends keep it).

From each tile's height grid it takes the channel: the lowest 15% of the samples inside the hex. Features:
  side   the hex side (0-5, 60-degree sectors from east, counter-clockwise) the channel's centre lies toward
  off    how far the channel's centre is from the tile centre (tile units)
Then: how often each (street pattern, coordinate turn, side) group flips, the best rule of that form, and its
leave-one-out accuracy against always guessing "keeps the turn". If heights don't vary inside a tile, it says so.
"""
import collections
import json
import math
import sys

TURN = {"A0": 0, "B300": 0, "A60": 1, "B0": 1}   # turn bit shared by bare and wooded labels (round 45)

dump_path, own_path, other_paths = sys.argv[1], sys.argv[2], sys.argv[3:]
seed, size, n, body = open(dump_path).read().strip().split("|", 3)
n = int(n)
own = json.load(open(own_path))
base = {}
for p in other_paths:
    t = json.load(open(p))
    rivers = set(t.get("rivers", []))
    for k, v in t["tiles"].items():
        if k not in rivers and v[1] >= 2.5 and v[0] in TURN:
            base.setdefault(k, TURN[v[0]])

rows, flat = [], 0
for rec in body.split(";"):
    if not rec:
        continue
    x, y, kind, hs = rec.split(",", 3)
    key = f"{x},{y}"
    h = [float(v) for v in hs.split()]
    lab = own["tiles"].get(key)
    if not lab or lab[1] < 2.5 or lab[0] not in TURN or key not in base:
        continue
    pts = []
    for j in range(n):
        for i in range(n):
            ox, oy = -0.5 + i / (n - 1), -0.5 + j / (n - 1)
            if math.hypot(ox, oy) <= 0.5:
                pts.append((h[j * n + i], ox, oy))
    zs = sorted(p[0] for p in pts)
    if zs[-1] - zs[0] < 0.01:
        flat += 1
        continue
    cut = zs[max(0, int(len(zs) * 0.15) - 1)]
    low = [(ox, oy) for z, ox, oy in pts if z <= cut]
    cx, cy = sum(p[0] for p in low) / len(low), sum(p[1] for p in low) / len(low)
    side = int(((math.degrees(math.atan2(cy, cx)) + 30) % 360) // 60)
    rows.append(dict(key=key, kind=kind, pattern=lab[0][0], base=base[key], turn=TURN[lab[0]],
                     flip=TURN[lab[0]] != base[key], side=side, off=round(math.hypot(cx, cy), 2)))

print(f"map {seed} {size}: {len(rows)} river tiles with a known own turn; {flat} flat (no height variation)")
if flat and not rows:
    sys.exit("Heights don't vary inside tiles: getPlotLocation's z is not the terrain height. Need another reader.")
if not rows:
    sys.exit("nothing to analyse")
flips = sum(r["flip"] for r in rows)
print(f"flip rate {flips}/{len(rows)}; always guessing 'keeps': {len(rows) - flips}/{len(rows)}")
groups = collections.defaultdict(collections.Counter)
for r in rows:
    groups[(r["pattern"], r["base"], r["side"])][r["flip"]] += 1
print("group (pattern, own turn, channel side): keeps / flips")
for g in sorted(groups):
    c = groups[g]
    print(f"  {g}: {c[False]} / {c[True]}")
fit = sum(max(c.values()) for c in groups.values())
loo = 0
for r in rows:   # leave-one-out: predict each tile from the others in its group
    c = groups[(r["pattern"], r["base"], r["side"])].copy()
    c[r["flip"]] -= 1
    guess = c[True] > c[False]
    loo += guess == r["flip"]
print(f"best (pattern, turn, side) rule: {fit}/{len(rows)} in sample, {loo}/{len(rows)} leave-one-out "
      f"(vs {len(rows) - flips} for 'keeps'). Worth pursuing only if leave-one-out clearly beats 'keeps'.")
