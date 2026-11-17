"""Merge the measured street tables (tools/data/street-table-*.json) into ui/cc-street-table.js for the overlay.

  python build_street_table.py [min_margin]

What the engine picks per urban tile (rounds 45-60):
  - a street layout A or B, separately for bare and wooded tiles. It depends on the map size and coordinate, and is
    the same in every Age (Exploration's pick = Antiquity's on Tiny and Small; Modern has one layout only);
  - a turn of 0 or 60 degrees per Age. It depends on the coordinate only: the same on every map size (Antiquity:
    Tiny/Small/Standard; Exploration and Modern: Tiny/Small, rounds 46, 53, 60) and on bare and wooded tiles, but
    each Age has its own turn.
So the data is one A/B layer pair per map size and one turn layer per Age, on a grid as large as the largest map.

Input files: street-table-<size>-<seed>.json (Antiquity), street-table-<size>-<seed>-<age>.json (age = exploration
or modern), each {"tiles": {"x,y": [bare label, margin, wooded label, margin]}, "rivers": [...]}. Labels are what our
script-drawn street must be to match: A or B at an angle (see LABEL below). River tiles are left out (their turn
follows the river, round 48). Where maps disagree (readings above min_margin) the majority wins if it has at least twice the votes, else the
value is left unknown; disagreements are reported.
"""
import glob
import json
import os
import re
import sys

MIN = float(sys.argv[1]) if len(sys.argv) > 1 else 2.5
SIZES = {"tiny": (60, 38), "small": (74, 46), "standard": (84, 54), "large": (96, 60), "huge": (106, 66)}
GW, GH = SIZES["huge"]   # the turn layers cover the largest map
AGES = ["antiquity", "exploration", "modern"]
# Script-drawn label for (street, turn): bare and wooded B differ (round 45); Exploration's A/B roads follow the same
# rule as Antiquity's (round 58); Modern has street A only, its turn is the angle itself.
LABEL = {
    "bare": {("A", 0): "A0", ("A", 1): "A60", ("B", 0): "B300", ("B", 1): "B0"},
    "wood": {("A", 0): "A0", ("A", 1): "A60", ("B", 0): "B0", ("B", 1): "B60"},
}
SPLIT = {layer: {lab: key for key, lab in m.items()} for layer, m in LABEL.items()}
here = os.path.dirname(os.path.abspath(__file__))

ab = {}                        # size -> {"x,y": [bare A/B, wooded A/B]}
turn = {a: {} for a in AGES}   # age -> {"x,y": 0 | 1}
report = {"ab": 0, "turn": 0, "ab_dropped": 0, "turn_dropped": 0}


def put(store, key, i, value, kind):
    """Count one reading; the value of a cell is decided later by vote (see decide)."""
    if i is None:
        votes = store.setdefault(key, {})
    else:
        votes = store.setdefault(key, [{}, {}])[i]
    votes[value] = votes.get(value, 0) + 1


def decide(votes, kind):
    """The value most maps read, if it has at least twice the votes of any other; else unknown (reported)."""
    if not votes:
        return None
    ranked = sorted(votes.items(), key=lambda kv: -kv[1])
    if len(ranked) > 1:
        report[kind] += 1
        if ranked[0][1] < 2 * ranked[1][1]:
            report[kind + "_dropped"] += 1
            return None
    return ranked[0][0]


for path in sorted(glob.glob(os.path.join(here, "..", "data", "street-table-*.json"))):
    m = re.match(r"street-table-([a-z]+)-[0-9a-z]+(?:-(exploration|modern))?\.json$", os.path.basename(path))
    if not m:
        continue
    size, age = m.group(1), m.group(2) or "antiquity"
    table = json.load(open(path))
    rivers = set(table.get("rivers", []))
    n = 0
    for k, (b, mb, w, mw) in table["tiles"].items():
        if k in rivers:
            continue
        for i, layer, lab, mar in ((0, "bare", b, mb), (1, "wood", w, mw)):
            if lab is None or mar < MIN:
                continue
            if age == "modern":
                if lab not in ("A0", "A60"):
                    continue
                put(turn[age], k, None, 0 if lab == "A0" else 1, "turn")
            else:
                if lab not in SPLIT[layer]:
                    continue
                street, t = SPLIT[layer][lab]
                put(ab.setdefault(size, {}), k, i, street, "ab")
                put(turn[age], k, None, t, "turn")
            n += 1
    print("%-10s %-11s %-42s %5d readings" % (size, age, os.path.basename(path), n))

ab_out = {}
for size, cells in ab.items():
    w, h = SIZES[size]
    layers = []
    for i in (0, 1):
        layers.append("".join(
            decide(cells["%d,%d" % (x, y)][i], "ab") or "." if "%d,%d" % (x, y) in cells else "."
            for y in range(h) for x in range(w)))
    ab_out["%dx%d" % (w, h)] = layers
    print("A/B %-8s %dx%d: bare %d, wooded %d of %d plots" % (
        size, w, h, sum(c != "." for c in layers[0]), sum(c != "." for c in layers[1]), w * h))
turn_out = {}
for age in AGES:
    s = "".join({0: "0", 1: "1"}.get(decide(turn[age].get("%d,%d" % (x, y)), "turn"), ".")
                for y in range(GH) for x in range(GW))
    turn_out[age] = s
    print("turn %-11s %d coordinates known" % (age, sum(c != "." for c in s)))

print("disagreements: A/B %d (%d left unknown), turn %d (%d left unknown)" % (
    report["ab"], report["ab_dropped"], report["turn"], report["turn_dropped"]))
js = """// Generated by tools/analysis/build_street_table.py from the measured street tables (tools/data/street-table-*.json).
// Per urban tile the engine picks a street layout A or B (per map size and coordinate, separately for bare and wooded
// tiles, the same in every Age) and a turn of 0 or 60 degrees (per coordinate only, the same on every map size, but
// its own for each Age). Wooded = forest, rainforest, savanna woodland, taiga, sagebrush steppe. River tiles keep the
// A/B pick, but only river sources and sharp bends reliably keep the turn (rounds 48-52); mouths and middles often
// turn 60 degrees more. Results are what our own script-drawn street must be to match: street A or B at that angle.
//   CCStreetTable.lookup(x, y, wooded)          Antiquity -> { street: "A" | "B", angle, river, sure } or null
//   CCStreetTable.lookupAge(age, x, y, wooded)  age 0 Antiquity, 1 Exploration, 2 Modern (street A only): the street
//                                               the engine itself draws there in that Age, same shape, or null
//     river: false | "source" | "bend" | "mouth" | "middle" | "navigable" (from MapRivers; bend = sharp 60-degree bend);
//     sure: false when the angle may be 60 degrees off (river mouths and middles)
(function () {
  const LABEL = %s;
  const AB = %s;
  const GW = %d, TURN = %s;
  const AGES = ["antiquity", "exploration", "modern"];
  let riverKinds = null, riverKey = null;
  function riverKind(x, y) {   // where a river tile sits on its river: source (one river neighbour), mouth or middle
    if (!GameplayMap.isRiver(x, y)) return false;
    if (GameplayMap.isNavigableRiver(x, y)) return "navigable";
    const w = GameplayMap.getGridWidth(), key = Configuration.getMap().mapSeed + ":" + w;
    if (riverKey !== key && typeof MapRivers !== "undefined") {
      riverKinds = {}; riverKey = key;
      for (let i = 0; i < MapRivers.numRivers; i++) {
        const plots = MapRivers.getRiverPlots(MapRivers.getRiverIDByIndex(i)) || [];
        const pts = plots.map((p) => ({ x: p %% w, y: Math.floor(p / w) }));
        pts.forEach((p, j) => {
          if (GameplayMap.isNavigableRiver(p.x, p.y)) return;
          const adj = (q) => q && GameplayMap.getPlotDistance(p.x, p.y, q.x, q.y) === 1;
          const mouth = j === 0 || GameplayMap.isNavigableRiver(pts[j - 1].x, pts[j - 1].y);
          const links = [pts[j - 1], pts[j + 1]].filter(adj).length;
          const bend = links === 2 && GameplayMap.getPlotDistance(pts[j - 1].x, pts[j - 1].y, pts[j + 1].x, pts[j + 1].y) === 1;
          riverKinds[p.x + "," + p.y] = mouth ? "mouth" : links <= 1 ? "source" : bend ? "bend" : "middle";
        });
      }
    }
    return (riverKinds && riverKinds[x + "," + y]) || "middle";
  }
  function lookupAge(age, x, y, wooded) {
    const w = GameplayMap.getGridWidth(), h = GameplayMap.getGridHeight();
    const name = AGES[age], turns = name && TURN[name];
    if (!turns || x < 0 || y < 0 || x >= w || y >= h || x >= GW) return null;
    const t = turns[y * GW + x];
    if (t === ".") return null;
    let street = "A";
    if (name !== "modern") {
      const layers = AB[w + "x" + h];
      street = layers ? layers[wooded ? 1 : 0][y * w + x] : ".";
      if (street === ".") return null;
    }
    const lab = name === "modern" ? "A" + (t === "1" ? 60 : 0) : LABEL[wooded ? "wood" : "bare"][street + t];
    const river = riverKind(x, y);
    return { street: lab[0], angle: Number(lab.slice(1)), river, sure: !river || river === "source" || river === "bend" };
  }
  const lookup = (x, y, wooded) => lookupAge(0, x, y, wooded);
  globalThis.CCStreetTable = { lookup, lookupAge, riverKind, sizes: Object.keys(AB) };
})();
""" % (json.dumps({layer: {s + str(t): lab for (s, t), lab in m.items()} for layer, m in LABEL.items()}),
       json.dumps(ab_out, indent=1), GW, json.dumps(turn_out, indent=1))
# CC_TABLE_OUT: write somewhere else (check_tables.py rebuilds into a temporary file and compares).
dest = os.environ.get("CC_TABLE_OUT") or os.path.join(here, "..", "..", "ui", "cc-street-table.js")
open(dest, "w", newline="\n").write(js)
print("wrote", os.path.normpath(dest), len(js), "bytes")
