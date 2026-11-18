"""Writes a debug-console script that sets globalThis._have: the coordinates already measured for one map size.

  python have_mask.py <tiny|small|standard|large|huge> <out.js> [min_margin]

Reads every street-table-<size>-*.json in tools/data. A coordinate counts as measured when some map labelled it off
that map's rivers with both the bare and the wooded margin at least min_margin (default 2.5). Used by
tools/game/all-land.js to keep only camera views with new coordinates.
"""
import glob
import json
import os
import sys

SIZES = {"tiny": (60, 38), "small": (74, 46), "standard": (84, 54), "large": (96, 60), "huge": (106, 66)}
size, out = sys.argv[1], sys.argv[2]
MIN = float(sys.argv[3]) if len(sys.argv) > 3 else 2.5
w, h = SIZES[size]
here = os.path.dirname(os.path.abspath(__file__))
have = set()
for path in sorted(glob.glob(os.path.join(here, "..", "data", f"street-table-{size}-*.json"))):
    table = json.load(open(path))
    rivers = set(table.get("rivers", []))
    for k, v in table["tiles"].items():
        if k not in rivers and v[1] >= MIN and len(v) > 3 and v[3] >= MIN:
            have.add(k)
mask = "".join("1" if f"{i % w},{i // w}" in have else "0" for i in range(w * h))
js = ('(function(){const w=%d,m="%s";globalThis._have=new Set();'
      'for(let i=0;i<m.length;i++)if(m[i]==="1")_have.add((i%%w)+","+Math.floor(i/w));'
      'return "known "+_have.size+" of "+m.length})()' % (w, mask))
open(out, "w", encoding="utf8", newline="\n").write(js)
print(f"{size} {w}x{h}: {len(have)} known coordinates -> {out}")
