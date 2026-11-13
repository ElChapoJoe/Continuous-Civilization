// Continuous Civilization - EXPERIMENTAL per-player city architecture (display only).
//
// The engine draws a city's buildings and filler from the single game Age, and the mod can't change that Age per
// player (see docs/visual-progression-investigation.md). This prototype instead replaces the picture tile by tile:
//   1. WorldUI.clipHexHeight(plot, 0) hides everything the engine draws on the tile above ground level
//      (buildings, houses, walls on the tile), leaving terrain, units and the UI.
//   2. A later-Age city-block model (EXP_URBAN_* / MOD_URBAN_*) is drawn on the same tile.
// Which Age is used comes from the OWNER's personal Age (the same techs as the main mod):
//   Antiquity   - engine art, untouched
//   Exploration - any of Cartography, Astronomy, Machinery researched
//   Modern      - any of Academics, Steam Engine, Military Science researched
//
// Display only: it reads game state and changes nothing in the simulation, so yields, production, districts and
// multiplayer sync are untouched, and every client draws the same picture from the same state. It only touches
// tiles the local player has revealed. It rebuilds when the game UI loads (so after loading a save) and whenever
// research, cities, districts, ownership or visibility change, and on each turn.
//
// Known limits: replaced tiles show generic city blocks, so the player's actual buildings on those tiles
// (including Modern ones such as factories) are not shown individually; walls on tile edges and wonders on their
// own tiles keep their engine art. NEVER call clipHexHeight without the height argument: that crashes the game.
(function () {
  const GROUP_NAME = "ccVisualOverlay";
  const CLIP_HEIGHT = 0;
  const EXPLORATION = ["NODE_TECH_EX_CARTOGRAPHY", "NODE_TECH_EX_ASTRONOMY", "NODE_TECH_EX_MACHINERY"];
  const MODERN = ["NODE_TECH_MO_ACADEMICS", "NODE_TECH_MO_STEAM_ENGINE", "NODE_TECH_MO_MILITARY_SCIENCE"];
  const ASSETS = {
    1: { capital: "EXP_URBAN_City_Center_Palace_Layout", center: "EXP_URBAN_City_Center_Layout", urban: "EXP_URBAN_Basic_City_Layout" },
    2: { capital: "MOD_URBAN_City_Center_Palace_Layout", center: "MOD_URBAN_City_Center_Layout", urban: "MOD_URBAN_Basic_City_Layout" },
  };
  const hashes = (types) => types.map((t) => GameInfo.ProgressionTreeNodes.lookup(t)?.$hash).filter((h) => h !== undefined);
  const exHashes = hashes(EXPLORATION), moHashes = hashes(MODERN);

  /** 0 Antiquity, 1 Exploration, 2 Modern - from the player's own research, as the mod's personal Age does. */
  function personalAge(player) {
    const techs = player?.Techs;
    if (!techs) return 0;
    if (moHashes.some((h) => techs.isNodeUnlocked(h))) return 2;
    if (exHashes.some((h) => techs.isNodeUnlocked(h))) return 1;
    return 0;
  }

  function viewer() {
    const id = GameContext.localPlayerID;
    return id >= 0 ? id : GameContext.localObserverID;
  }

  /** "x,y" -> asset name for every tile that should be replaced. */
  function desiredTiles() {
    const want = new Map();
    const me = viewer();
    const ids = Players.getAliveIds ? Players.getAliveIds() : Players.getAliveMajorIds();
    for (const id of ids) {
      const player = Players.get(id);
      if (!player?.Cities) continue;
      const age = personalAge(player);
      if (!ASSETS[age]) continue;
      for (const city of player.Cities.getCities()) {
        for (const index of city.getPurchasedPlots()) {
          const loc = GameplayMap.getLocationFromIndex(index);
          const district = Districts.getAtLocation(loc);
          if (!district) continue;
          let kind = null;
          if (district.type === DistrictTypes.CITY_CENTER) kind = city.isCapital ? "capital" : "center";
          else if (district.type === DistrictTypes.URBAN) kind = "urban";
          if (!kind) continue;
          if (me >= 0 && GameplayMap.getRevealedState(me, loc.x, loc.y) === RevealedStates.HIDDEN) continue;
          want.set(loc.x + "," + loc.y, ASSETS[age][kind]);
        }
      }
    }
    return want;
  }

  const group = WorldUI.getModelGroupByName?.(GROUP_NAME) || WorldUI.createModelGroup(GROUP_NAME);
  let current = new Map();
  const loc = (key) => { const [x, y] = key.split(",").map(Number); return { x, y }; };

  function rebuild() {
    try {
      const want = desiredTiles();
      const same = want.size === current.size && [...want].every(([k, v]) => current.get(k) === v);
      if (same) return;
      for (const key of current.keys()) {
        if (!want.has(key)) WorldUI.restoreHexHeight(loc(key));
      }
      group.clear();
      for (const [key, asset] of want) {
        const plot = loc(key);
        WorldUI.clipHexHeight(plot, CLIP_HEIGHT);
        group.addModelAtPlot(asset, plot, { x: 0, y: 0, z: 0 }, {});
      }
      current = want;
    } catch (e) {
      console.error("cc-visual-overlay: " + e);
    }
  }

  function reset() {
    group.clear();
    WorldUI.restoreAllHexHeight();
    current = new Map();
  }

  let pending = 0;
  function schedule() {
    if (pending) return;
    pending = setTimeout(() => { pending = 0; rebuild(); }, 250);
  }

  for (const event of ["PlayerTurnActivated", "TechNodeCompleted", "TechTreeChanged", "CityAddedToMap", "CityRemovedFromMap", "CityInitialized",
    "DistrictAddedToMap", "DistrictRemovedFromMap", "DistrictControlChanged", "PlotOwnershipChanged", "PlotVisibilityChanged",
    "ConstructibleAddedToMap", "LocalPlayerChanged"]) {
    engine.on(event, schedule);
  }
  globalThis.CCVisualOverlay = {
    rebuild: () => { reset(); rebuild(); return current.size; },
    reset, personalAge, count: () => current.size,
  };
  reset();
  schedule();
})();
