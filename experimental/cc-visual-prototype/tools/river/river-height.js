// River-tile terrain heights (debug console, read-only), for tools/river/river_height.py.
// Idea: the engine seems to turn a river tile's streets so its houses avoid the river's actual curve, which scripts
// can't read directly; but a river cuts a channel into the terrain, and WorldUI.getPlotLocation(plot, offset,
// PlacementMode.TERRAIN) returns the terrain height at any point of a tile. If the channel shows in those heights,
// the curve is readable and the river turn may be predictable.
//
//   CCRiverHeight.probe(x, y)   the height grid of one tile, to check first that heights vary inside a tile
//                               (if every value is the same, z is not the terrain height and this idea needs another reader)
//   CCRiverHeight.dump(n)       every river tile of the map (navigable ones skipped): "x,y,kind,h0 h1 ..." per tile,
//                               n x n samples over the tile (default 9), heights relative to the tile centre, row by
//                               row from south to north, west to east; offsets in tile units (x east, y north)
// kind: source / mouth / bend / middle, as CCStreetTable.riverKind (needs ui/cc-street-table.js loaded) or "?".
(function () {
  const T = PlacementMode.TERRAIN;
  const z = (x, y, ox, oy) => WorldUI.getPlotLocation({ x, y }, { x: ox, y: oy, z: 0 }, T).z;

  function grid(x, y, n = 9) {
    const c = z(x, y, 0, 0), out = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const ox = -0.5 + i / (n - 1), oy = -0.5 + j / (n - 1);
      out.push(Math.round((z(x, y, ox, oy) - c) * 100) / 100);
    }
    return out;
  }

  function probe(x, y) {
    const g = grid(x, y, 9);
    const min = Math.min(...g), max = Math.max(...g);
    return JSON.stringify({ tile: [x, y], centreZ: z(x, y, 0, 0), min, max, varies: max - min > 0.01, grid: g });
  }

  function dump(n = 9) {
    const w = GameplayMap.getGridWidth(), seen = new Set(), out = [];
    for (let i = 0; i < MapRivers.numRivers; i++) {
      for (const p of MapRivers.getRiverPlots(MapRivers.getRiverIDByIndex(i)) || []) {
        const x = p % w, y = Math.floor(p / w), key = x + "," + y;
        if (seen.has(key) || GameplayMap.isNavigableRiver(x, y)) continue;
        seen.add(key);
        const kind = globalThis.CCStreetTable ? CCStreetTable.riverKind(x, y) : "?";
        out.push(key + "," + kind + "," + grid(x, y, n).join(" "));
      }
    }
    return Configuration.getMap().mapSeed + "|" + w + "x" + GameplayMap.getGridHeight() + "|" + n + "|" + out.join(";");
  }

  globalThis.CCRiverHeight = { probe, dump };
  return "CCRiverHeight ready";
})();
