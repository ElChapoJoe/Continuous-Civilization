"""Checks of the measured street data (no game): exit code 1 on a failure.

  python check_tables.py

- every tools/data/street-table-*.json is well-formed: {"tiles": {"x,y": [bare label, margin, wooded label, margin]},
  "rivers": [...]}, coordinates inside its map size, labels the probe can produce (A/B at 0-300, or null);
- ui/cc-street-table.js is what build_street_table.py makes from these files today (rebuilt into a temporary file);
- the A/B layers have no disagreement between maps (they never had one; a new one means a bad run);
- prints the coverage per map size and Age.
"""
import glob
import json
import os
import re
import subprocess
import sys
import tempfile

here = os.path.dirname(os.path.abspath(__file__))
data = os.path.join(here, "..", "data")
ui = os.path.join(here, "..", "..", "ui", "cc-street-table.js")
SIZES = {"tiny": (60, 38), "small": (74, 46), "standard": (84, 54), "large": (96, 60), "huge": (106, 66)}
LABEL = re.compile(r"^[AB](0|60|120|180|240|300)$")
fails = []

for path in sorted(glob.glob(os.path.join(data, "street-table-*.json"))):
    name = os.path.basename(path)
    m = re.match(r"street-table-([a-z]+)-[0-9a-z]+(?:-(exploration|modern))?\.json$", name)
    if not m or m.group(1) not in SIZES:
        fails.append(f"{name}: name not street-table-<size>-<seed>[-exploration|-modern].json")
        continue
    w, h = SIZES[m.group(1)]
    try:
        t = json.load(open(path))
    except ValueError as e:
        fails.append(f"{name}: not JSON ({e})")
        continue
    if not isinstance(t.get("tiles"), dict) or not isinstance(t.get("rivers", []), list):
        fails.append(f"{name}: needs a tiles object and a rivers list")
        continue
    bad = 0
    for k, v in t["tiles"].items():
        xy = k.split(",")
        ok = len(xy) == 2 and all(p.isdigit() for p in xy) and int(xy[0]) < w and int(xy[1]) < h
        ok = ok and isinstance(v, list) and len(v) == 4
        ok = ok and all(lab is None or LABEL.match(lab) for lab in (v[0], v[2])) and all(isinstance(x, (int, float)) for x in (v[1], v[3]))
        bad += not ok
    if bad:
        fails.append(f"{name}: {bad} malformed tiles")

with tempfile.TemporaryDirectory() as tmp:
    out = os.path.join(tmp, "cc-street-table.js")
    r = subprocess.run([sys.executable, "-I", os.path.join(here, "build_street_table.py")], capture_output=True, text=True,
                       env={**os.environ, "CC_TABLE_OUT": out})
    if r.returncode:
        fails.append("build_street_table.py failed: " + r.stderr[-400:])
    else:
        print("\n".join(l for l in r.stdout.splitlines() if l.startswith(("A/B", "turn", "disagreements"))))
        m = re.search(r"disagreements: A/B (\d+)", r.stdout)
        if m and int(m.group(1)):
            fails.append(f"A/B layers: {m.group(1)} disagreements between maps (a bad run?)")
        new = open(out, encoding="utf-8").read().replace("\r\n", "\n")
        old = open(ui, encoding="utf-8").read().replace("\r\n", "\n")
        if new != old:
            fails.append("ui/cc-street-table.js is out of date: run tools/analysis/build_street_table.py")

for f in fails:
    print("FAIL", f)
print(f"{len(fails)} failed" if fails else "street data OK")
sys.exit(1 if fails else 0)
