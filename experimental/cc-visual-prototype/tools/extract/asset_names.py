"""List every asset name in Civilization VII's art packages (Base and DLC), with the packages it is in. Read-only;
the game folder is found like extract_building_art.py does (or set CIV7_DIR).

  python -I asset_names.py <out.tsv>        then search it, e.g. grep Decal_Block out.tsv
"""
import glob
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
out_path = sys.argv[1]
sys.argv = sys.argv[:1]   # find_base reads argv[1] as the game folder
import extract_building_art as E  # noqa: E402

game = os.path.dirname(E.find_base())   # Base and DLC
files = sorted(glob.glob(os.path.join(game, "**", "Platforms", "Windows", "BLPs", "*.blp"), recursive=True))
pat = re.compile(rb"[A-Za-z0-9_]{6,}(?=\x00)")
names = {}
for f in files:
    rel = os.path.relpath(f, game)
    for m in pat.finditer(open(f, "rb").read()):
        names.setdefault(m.group().decode(), set()).add(rel)
with open(out_path, "w", encoding="utf-8") as out:
    for s in sorted(names):
        out.write(s + "\t" + ";".join(sorted(names[s])[:3]) + "\n")
print(len(files), "packages,", len(names), "names")
