"""Print every row (condition -> model) of the named art bins, unfiltered: Age, culture, building and state
conditions. Read-only; the game folder is found like extract_building_art.py does (or set CIV7_DIR).

  python -I bin_rows.py BIN_NAME [...]     (a name ending in * matches as a prefix)
"""
import bisect
import glob
import os
import re
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
want = sys.argv[1:]
sys.argv = sys.argv[:1]
import extract_building_art as E  # noqa: E402

base = E.find_base()
files = sorted(glob.glob(os.path.join(base, "Platforms", "Windows", "BLPs", "StandardAsset.*.blp")))
names = {}
for f in files:
    for m in E.STRING.finditer(open(f, "rb").read()):
        s = m.group().decode()
        names.setdefault(E.fnv1a(s), s)


def match(n):
    return any(n == w or (w.endswith("*") and n.startswith(w[:-1])) for w in want)


seen = set()
for path in files:
    data = open(path, "rb").read()
    if not any(w.rstrip("*").encode() in data for w in want):
        continue
    strings = [(m.start(), m.group().decode()) for m in E.STRING.finditer(data)]
    tab = E.string_table(data)
    byhash = {}
    for i, nm in enumerate(tab):
        byhash.setdefault(E.fnv1a(nm), []).append(i)
    records = [(m.start(), struct.unpack("<I", m.group(2))[0], struct.unpack("<H", m.group(3))[0],
                struct.unpack("<H", m.group(4))[0]) for m in E.RECORD.finditer(data)]
    anchor = {}
    for _, h, mi, _ in records:
        c = byhash.get(h, [])
        if len(c) == 1:
            anchor.setdefault(mi, c[0])
    keys = sorted(anchor)

    def condition(ci):
        k = bisect.bisect_right(keys, ci) - 1
        if k < 0:
            return None
        p = anchor[keys[k]] + (ci - keys[k])
        s = tab[p] if 0 <= p < len(tab) else None
        return s if s and s.startswith("[") else None

    runs = []
    for o, h, _, c in records:
        if runs and o - runs[-1][1] <= 32:
            runs[-1][1] = o
            runs[-1][2].append((h, c))
        else:
            runs.append([o, o, [(h, c)]])
    starts = [o for o, _ in strings]
    for i, (a, b, recs) in enumerate(runs):
        end = runs[i + 1][0] if i + 1 < len(runs) else len(data)
        j = bisect.bisect_right(starts, b + 32)
        region = []
        while j < len(strings) and strings[j][0] < end:
            region.append(strings[j][1])
            j += 1
        last = max((k for k, s in enumerate(region) if s.startswith("[")), default=-1)
        name = next((s for s in region[last + 1:] if s.startswith("BIN_")), None)
        if not name or not match(name) or name in seen:
            continue
        seen.add(name)
        print(f"{name}  ({os.path.basename(path)})")
        for h, c in recs:
            print(f"   {str(condition(c)):80s} -> {names.get(h, hex(h))}")
