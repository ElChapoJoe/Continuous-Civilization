"""Search for the engine's per-tile art seed, using the measured seed -> street rule.

Measured (tools/seed-map-probe.js): the Antiquity layout bin picks its variant from bits 14-15 of the model seed:
0 -> street A, 1 -> B, 2 -> B, 3 -> A. So a candidate rule "seed = h(tile)" must give street B exactly on the tiles
where the engine painted B, i.e. bit14 xor bit15 of h matches all labels (chance 2^-N per rule for N tiles).

  python street_seed_search.py labels.json [min_margin] [grid_width] [seed ...]
"""
import itertools
import json
import os
import struct
import sys
import zlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
argv = sys.argv[:]
sys.argv = [argv[0], argv[1], "99"]      # import the hash tables without running a search on real tiles
import street_formula_search as F  # noqa: E402

M32 = 0xFFFFFFFF
labels = json.load(open(argv[1]))
min_margin = float(argv[2]) if len(argv) > 2 else 1.25
WIDTH = int(argv[3]) if len(argv) > 3 else 60
SEEDS = [int(s) for s in argv[4:]] or [0]
tiles = [t for t in labels if t["margin"] >= min_margin and t["angle"] in (0, 60, 300)]
N = len(tiles)
want = [1 if t["street"] == "B" else 0 for t in tiles]
print(N, "tiles, B on", sum(want))
F.WIDTH = WIDTH
results = []


def test(name, hs):
    # the measured rule, plus the same xor on every other bit pair and single bits, as a control for chance
    for s in range(0, 31):
        got = [((h >> s) ^ (h >> (s + 1))) & 1 for h in hs]
        hit = sum(1 for a, b in zip(got, want) if a == b)
        results.append((max(hit, N - hit), "%s xor bits %d,%d" % (name, s, s + 1), s == 14))
        got = [(h >> s) & 1 for h in hs]
        hit = sum(1 for a, b in zip(got, want) if a == b)
        results.append((max(hit, N - hit), "%s bit %d" % (name, s), False))


for seed in SEEDS:
    ins = [F.inputs(t, seed) for t in tiles]
    for key in ins[0]:
        vals = [i[key] for i in ins]
        for hn, hf in F.INT_HASHES.items():
            test("%s(%s)%s" % (hn, key, " seed %d" % seed if seed else ""), [hf(v) for v in vals])
    keys = ["x", "y", "plot", "did", "did_lo", "cid", "cid_lo"]
    for a, b in itertools.permutations(keys, 2):
        for pn, pf in F.PAIR.items():
            test("%s(%s,%s)" % (pn, a, b), [pf(i[a], i[b]) for i in ins])
    if seed:
        for a in keys:
            for pn, pf in F.PAIR.items():
                test("%s(%s,seed %d)" % (pn, a, seed), [pf(i[a], seed) for i in ins])
                test("%s(seed %d,%s)" % (pn, seed, a), [pf(seed, i[a]) for i in ins])

print(len(results), "tests")
exact = [r for r in results if r[2]]
print("the measured rule (xor of bits 14,15), best candidates of %d:" % len(exact))
for hit, desc, _ in sorted(exact, key=lambda r: -r[0])[:8]:
    print("  %2d of %d  %s" % (hit, N, desc))
print("any bit or bit pair (control), best:")
for hit, desc, _ in sorted(results, key=lambda r: -r[0])[:6]:
    print("  %2d of %d  %s" % (hit, N, desc))
