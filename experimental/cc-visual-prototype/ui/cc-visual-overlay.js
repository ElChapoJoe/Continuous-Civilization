// Continuous Civilization - EXPERIMENTAL per-player city architecture overlay (display only).
//
// The engine draws city filler art (houses, streets) from one game-wide Age, and exposes no way to hide or
// replace it (see docs/visual-progression-investigation.md). This prototype draws the matching later-Age
// city-block models (EXP_URBAN_* / MOD_URBAN_*) on top of each city's city-centre and urban tiles, chosen by
// the OWNER's personal Age:
//   Antiquity   - nothing drawn (the engine's own art)
//   Exploration - any of Cartography, Astronomy, Machinery researched
//   Modern      - any of Academics, Steam Engine, Military Science researched
//
// It never changes the game simulation: it only reads game state and adds client-side models, so yields,
// production, districts and multiplayer sync are untouched, and every client draws the same thing from the same
// state. It only draws on tiles the local player has revealed, so it never shows hidden cities. It rebuilds
// after loading a save (the script runs when the game UI loads) and whenever research, cities, districts,
// ownership or visibility change.
//
// Known limit: the engine's Antiquity houses stay underneath, so cities look mixed rather than replaced.
(function () {
  const GROUP_NAME = "ccVisualOverlay";
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

  /** "x,y" -> asset name for every tile that should carry a later-Age model. */
  function desiredModels() {
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

  let group = WorldUI.getModelGroupByName?.(GROUP_NAME) || WorldUI.createModelGroup(GROUP_NAME);
  let current = new Map();

  function rebuild() {
    try {
      const want = desiredModels();
      const same = want.size === current.size && [...want].every(([k, v]) => current.get(k) === v);
      if (same) return;
      group.clear();
      for (const [key, asset] of want) {
        const [x, y] = key.split(",").map(Number);
        group.addModelAtPlot(asset, { x, y }, { x: 0, y: 0, z: 0 }, {});
      }
      current = want;
    } catch (e) {
      console.error("cc-visual-overlay: " + e);
    }
  }

  let pending = 0;
  function schedule() {
    if (pending) return;
    pending = setTimeout(() => { pending = 0; rebuild(); }, 250);
  }

  for (const event of ["PlayerTurnActivated", "TechNodeCompleted", "CityAddedToMap", "CityRemovedFromMap", "CityInitialized",
    "DistrictAddedToMap", "DistrictRemovedFromMap", "DistrictControlChanged", "PlotOwnershipChanged", "PlotVisibilityChanged",
    "LocalPlayerChanged"]) {
    engine.on(event, schedule);
  }
  globalThis.CCVisualOverlay = { rebuild: () => { current = new Map(); rebuild(); return current.size; }, personalAge, count: () => current.size };
  schedule();
})();
