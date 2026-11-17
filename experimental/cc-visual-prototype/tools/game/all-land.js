// All-land street-table run (debug console, TEST GAMES ONLY: it rewrites the map's terrain).
// The street pattern belongs to the coordinate, not the terrain (round 56: sea turned into land got the same streets
// as the same coordinates on maps where they were land), so one map with every plot turned into land measures nearly
// every coordinate of its map size in one sitting.
//
// Runbook for one map size (Tiny 60x38, Small 74x46, Standard 84x54, Large 96x60, Huge 106x66):
//   1. Start a fresh game of that size (any map script and seed) and close both start dialogs.
//   2. Load tools/game/table-map.js, tools/game/street-probe.js and this file with execute_js_file.
//   3. CCAllLand.convert()            every water and mountain plot -> flat grassland, no feature
//   4. CCAllLand.save("CC_AllLand_<size>"), then CCAllLand.load(...) and press Begin Game: the terrain art only
//      rebuilds on load (before that the converted plots still draw as sea). Reveal the map, load the three
//      scripts again.
//   5. Load the known-coordinate mask: python tools/analysis/have_mask.py <size> <out.js>, then execute_js_file <out.js>
//      (sets globalThis._have; a size with no table yet gives an empty mask: every coordinate is new).
//   6. CCTable.plan(); CCTable.run()  found cities and urban districts everywhere (CCTable.status() until "done";
//      about 10 minutes for 150 cities), then SAVE AT ONCE: CCAllLand.save("CC_AllLand_<size>_Cities"). Founding is
//      the slow step and the game can close during a long capture; with this save a lost game costs one load.
//   7. CCAllLand.views()              keeps the camera views with 4 or more new coordinates (globalThis._views)
//   8. Bare pass: CCTable.wood(false); start tools/game/capture-states.ps1 for views x 13 states, then
//      CCStreetProbe.start(-1, _views, 6); afterwards CCAllLand.pack() for table_score.py.
//      Save the pack text to a file at once (it needs this run's camera data, which a closed game loses; a re-run
//      on the reloaded save gives the same views and positions). Forest pass: CCTable.wood(true) and the same again
//      into another folder.
//   9. CCAllLand.rivers() -> rivers.json; table_score.py on both passes; merge_passes.py writes
//      street-table-<size>-<seed>.json; build_street_table.py.
// Nothing can cover the game window while the screenshot script runs.
(function () {
  const W = () => GameplayMap.getGridWidth(), H = () => GameplayMap.getGridHeight();

  /** Every water and mountain plot (natural wonders kept) becomes flat grassland without a feature. */
  function convert(bounds) {
    const flat = GameInfo.Terrains.lookup("TERRAIN_FLAT").$index;
    const grass = GameInfo.Biomes.lookup("BIOME_GRASSLAND").$index;
    const b = bounds || [0, 0, W() - 1, H() - 1];
    let n = 0, fail = 0;
    for (let y = b[1]; y <= b[3]; y++) for (let x = b[0]; x <= b[2]; x++) {
      if (!(GameplayMap.isWater(x, y) || GameplayMap.isMountain(x, y)) || GameplayMap.isNaturalWonder(x, y)) continue;
      try {
        WorldBuilder.MapPlots.setTerrain(flat, { x, y });
        WorldBuilder.MapPlots.setBiome(grass, { x, y });
        WorldBuilder.MapPlots.setFeature(FeatureTypes.NO_FEATURE, { x, y });
        n++;
      } catch (e) { fail++; }
    }
    return `converted ${n}, failed ${fail}: save and load the game to redraw the terrain`;
  }

  const saveInfo = (name) => ({ Location: SaveLocations.LOCAL_STORAGE, LocationCategories: SaveLocationCategories.NORMAL,
    Type: SaveTypes.SINGLE_PLAYER, ContentType: SaveFileTypes.GAME_STATE, FileName: name, DisplayName: name });
  function save(name) { Network.saveGame(saveInfo(name)); return "saving " + name; }
  function load(name) {
    const info = saveInfo(name);
    info.FileName = name + ".Civ7Save";
    Network.loadGame(info, ServerType.SERVER_TYPE_NONE);
    return "loading " + name + " (press Begin Game when it is up; never send another load meanwhile)";
  }

  const known = () => globalThis._have || new Set();
  const isNew = (x, y) => !known().has(x + "," + y);

  /** Camera views (height 900, 16 x 6 tiles apart) that hold at least minNew urban tiles at new coordinates. */
  function views(minNew = 4) {
    const fresh = CCTable.urbanTiles().filter(([x, y]) => isNew(x, y));
    let v = CCTable.views(900, 16, 6);
    if (typeof v === "string") v = JSON.parse(v);
    const count = (w) => fresh.filter((t) => Math.abs(t[0] - w[0]) <= 9 && Math.abs(t[1] - w[1]) <= 3).length;
    globalThis._views = v.filter((w) => count(w) >= minNew);
    return `urban ${CCTable.urbanTiles().length}, new ${fresh.length}, views ${_views.length} (${_views.length * 13} states)`;
  }

  /** After the probe run: new coordinates, river tiles and every 6th known tile, packed for table_score.py. */
  function pack() {
    const s = new Set();
    let k = 0;
    for (const [x, y] of CCTable.urbanTiles()) {
      const key = x + "," + y;
      if (isNew(x, y) || GameplayMap.isRiver(x, y) || (k++) % 6 === 0) s.add(key);
    }
    return CCTable.pack64(s);
  }

  /** River tiles among the urban tiles, as JSON ["x,y", ...] for merge_passes.py (their turn follows the river). */
  function rivers() {
    return JSON.stringify(CCTable.urbanTiles().filter(([x, y]) => GameplayMap.isRiver(x, y)).map(([x, y]) => x + "," + y));
  }

  globalThis.CCAllLand = { convert, save, load, views, pack, rivers };
  return "CCAllLand ready";
})();
