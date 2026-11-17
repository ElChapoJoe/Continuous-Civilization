"""Join the bare and wooded scores of one map into a street-table-<size>-<seed>.json for build_street_table.py.

  python merge_passes.py <bare.json> <wood.json> <rivers.json> <out.json> "<note>"

bare/wood: table_score.py output ({"x,y": [label, margin]}); rivers.json: ["x,y", ...] river tiles of this map
(CCAllLand.rivers()).
"""
import json
import sys

bare_p, wood_p, rivers_p, out_p, note = sys.argv[1:6]
bare, wood = json.load(open(bare_p)), json.load(open(wood_p))
rivers = json.load(open(rivers_p))
# A tile read in one pass only (a view whose capture missed a state) keeps that reading; the other layer is null.
none = [None, 0]
tiles = {k: [*bare.get(k, none), *wood.get(k, none)] for k in sorted(set(bare) | set(wood))}
# Bare and wooded must share the turn (rounds 45-55): bare A0/B300 pairs with wooded A0/B0, bare A60/B0 with A60/B60.
TURN_B = {"A0": 0, "B300": 0, "A60": 1, "B0": 1}
TURN_W = {"A0": 0, "B0": 0, "A60": 1, "B60": 1}
mismatch = [k for k, v in tiles.items() if v[0] in TURN_B and v[2] in TURN_W and TURN_B[v[0]] != TURN_W[v[2]]]
json.dump({"note": note, "rivers": sorted(set(rivers)), "tiles": tiles}, open(out_p, "w"), indent=0)
print(f"{len(tiles)} tiles ({len(bare)} bare, {len(wood)} wooded), {len(rivers)} river tiles, "
      f"turn mismatches bare/wooded: {len(mismatch)} {mismatch[:10]}")
