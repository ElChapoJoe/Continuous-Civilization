// Continuous Civilization - EXPERIMENTAL per-player city architecture (display only).
//
// The engine draws city art from the single game Age, which the mod can't change per player (see
// docs/visual-progression-investigation.md). This prototype rebuilds each city tile of a player whose personal
// Age is later than Antiquity:
//   1. WorldUI.clipHexHeight(plot, 0) hides everything the engine draws on the tile above ground.
//   2. The tile is composed again from the game's own models:
//      - the street layout of the owner's personal Age (Exploration or Modern),
//      - each completed building actually on the tile, resolved through the game's art bins with the owner's
//        building cultures and personal Age (ui/cc-building-art.js, extracted from the installed game),
//      - filler houses of that Age in the owner's regional style in the free lots.
// Personal Age uses the same techs as the main mod:
//   Antiquity   - engine art, untouched
//   Exploration - any of Cartography, Astronomy, Machinery researched
//   Modern      - any of Academics, Steam Engine, Military Science researched
//
// Display only: it reads game state and changes nothing in the simulation, so every client draws the same
// picture from the same state. It only touches tiles the local player has revealed. It rebuilds when the game UI
// loads (so after loading a save) and when research, cities, districts, buildings, ownership or visibility change.
//
// Tiles with a wonder are left to the engine. NEVER call clipHexHeight without the height argument: that crashes
// the game.
(function () {
  const GROUP_NAME = "ccVisualOverlay";
  const CLIP_HEIGHT = 0;
  const EXPLORATION = ["NODE_TECH_EX_CARTOGRAPHY", "NODE_TECH_EX_ASTRONOMY", "NODE_TECH_EX_MACHINERY"];
  const MODERN = ["NODE_TECH_MO_ACADEMICS", "NODE_TECH_MO_STEAM_ENGINE", "NODE_TECH_MO_MILITARY_SCIENCE"];
  const AGE_NAMES = ["ANTIQUITY", "EXPLORATION", "MODERN"];
  const ZERO = { x: 0, y: 0, z: 0 };

  // Street and house layouts per personal Age. The urban layouts put houses on the west side of the tile and leave
  // two lots on the east side for the tile's buildings, measured in tile units (x east, y north, +-0.5 is the tile
  // edge). The city-center layouts leave one plaza for the palace or city hall.
  const LAYOUTS = {
    1: {
      urban: ["LAYOUT_CTY_Hex_Section_AB_Road_EXP", "LAYOUT_CTY_EXP_Hex_Section_AB_Attatchment_Less", "LAYOUT_CTY_EXP_Hex_Section_AB_Attatchment_Less_FOL"],
      capital: ["LAYOUT_CTY_EXP_Hex_Section_AB_City_Center_Palace", "LAYOUT_CTY_EXP_Hex_Section_AB_City_Center_Palace_FOL"],
      center: ["LAYOUT_CTY_EXP_Hex_Section_AB_City_Center", "LAYOUT_CTY_EXP_Hex_Section_AB_City_Center_Less_FOL"],
      filler: ["BIN_EXP_T2_CityBld_4X4_A", "BIN_EXP_T2_CityBld_3x5_A", "BIN_EXP_T2_CityBld_2X4_A"],
    },
    2: {
      urban: ["LAYOUT_CTY_MOD_Section_AB_Road", "LAYOUT_CTY_MOD_Section_AB_Small_Packed", "LAYOUT_CTY_MOD_Section_AB_Small_Packed_FOL"],
      capital: ["LAYOUT_CTY_MOD_Hex_Section_AB_City_Center_Palace", "LAYOUT_CTY_MOD_Hex_Section_AB_City_Center_Palace_FOL"],
      center: ["LAYOUT_CTY_MOD_Section_AB_City_Center", "LAYOUT_CTY_MOD_Section_AB_City_Center_FOL"],
      filler: ["BIN_MOD_T2_CityBld_4X4_A", "BIN_MOD_T2_CityBld_3x5_A", "BIN_MOD_T2_CityBld_5x6_A"],
    },
  };
  const URBAN_LOTS = [
    { x: 0.15, y: 0.2, scale: 0.55 },
    { x: 0.15, y: -0.2, scale: 0.55 },
  ];
  const CENTER_LOTS = [
    { x: 0, y: -0.1, scale: 0.7, angle: 0 },
    { x: -0.3, y: 0.3, scale: 0.3 },
    { x: 0.3, y: 0.3, scale: 0.3 },
  ];
  const FILLER_SCALE = 0.6;

  // Loaded by ui/cc-building-art.js; read lazily so the load order of the two scripts does not matter.
  const ART = () => globalThis.CCBuildingArt || { bins: {}, art: {} };
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

  // Civilization -> its building cultures (MED, MED_ANT, SAM_MOD ...), from the game's own table.
  const culturesByCiv = new Map();
  try {
    for (const row of Database.query("gameplay", "select CivilizationType c, BuildingCulture b from VisArt_CivilizationBuildingCultures") || []) {
      if (!culturesByCiv.has(row.c)) culturesByCiv.set(row.c, new Set());
      culturesByCiv.get(row.c).add(String(row.b).replace("BUILDING_CULTURE_", ""));
    }
  } catch (e) {
    console.error("cc-visual-overlay: cultures " + e);
  }
  function cultures(player) {
    const civ = GameInfo.Civilizations.lookup(player.civilizationType)?.CivilizationType;
    return culturesByCiv.get(civ) || new Set();
  }

  /**
   * The model the engine would draw for this bin for an owner with these cultures in this Age, following bins
   * that point at other bins. Age-specific cultures (SAM_MOD) win over regional ones (MED), which win over
   * unconditioned variants; among unconditioned variants `seed` picks one, so a tile always gets the same.
   */
  function resolve(bin, owned, ageName, seed, depth = 0) {
    const rows = ART().art[bin] || ART().art[bin.replace(/_Scaled$/, "")];
    if (!rows || depth > 4) return bin;
    const fits = rows.filter(([c, a]) => a === "*" || a === ageName);
    const pick = fits.find(([c]) => c.includes("_") && owned.has(c))
      || fits.find(([c]) => c !== "*" && owned.has(c));
    let model;
    if (pick) model = pick[2];
    else {
      const any = fits.filter(([c]) => c === "*");
      if (!any.length) return null;
      // Prefer a variant from the owner's own region (model names start with it: MED_ROM_Kiln for MED).
      const own = any.filter(([, , m]) => owned.has(m.replace(/^BIN_/, "").slice(0, 3)));
      const pool = own.length ? own : any;
      model = pool[seed % pool.length][2];
    }
    return ART().art[model] ? resolve(model, owned, ageName, seed, depth + 1) : model;
  }

  function buildingModel(type, owned, ageName, seed) {
    const bins = ART().bins[type] || [];
    for (const bin of bins) {
      const model = resolve(bin, owned, ageName, seed);
      if (model) return model;
    }
    // No variant for the owner's cultures (airfield, launch pad ...): let the game pick from the bin itself.
    return bins[0] || null;
  }

  /** Degrees for `angle` so a model at this lot faces the tile centre. 0 faces south; positive turns toward east. */
  function facing(l) {
    if (!l.x && !l.y) return 0;
    return Math.round(Math.atan2(-l.x, l.y) * 180 / Math.PI);
  }

  function viewer() {
    const id = GameContext.localPlayerID;
    return id >= 0 ? id : GameContext.localObserverID;
  }

  /** The completed buildings on a tile, or null if the tile has a wonder (left to the engine). */
  function tileBuildings(loc) {
    const out = [];
    for (const id of MapConstructibles.getConstructibles(loc.x, loc.y) || []) {
      const c = Constructibles.getByComponentID(id);
      const info = c && GameInfo.Constructibles.lookup(c.type);
      if (!info) continue;
      if (info.ConstructibleClass === "WONDER") return null;
      if (info.ConstructibleClass !== "BUILDING" || !c.complete) continue;
      if (/WALLS|FORTIFICATION/.test(info.ConstructibleType)) continue; // drawn on tile edges by the engine
      out.push(info.ConstructibleType);
    }
    return out;
  }

  /** "x,y" -> list of [asset, offset, scale, angle] for every tile that should be rebuilt. */
  function desiredTiles() {
    const want = new Map();
    const me = viewer();
    const ids = Players.getAliveIds ? Players.getAliveIds() : Players.getAliveMajorIds();
    for (const id of ids) {
      const player = Players.get(id);
      if (!player?.Cities) continue;
      const age = personalAge(player);
      const layout = LAYOUTS[age];
      if (!layout) continue;
      const ageName = AGE_NAMES[age];
      const owned = cultures(player);
      for (const city of player.Cities.getCities()) {
        for (const index of city.getPurchasedPlots()) {
          const loc = GameplayMap.getLocationFromIndex(index);
          const district = Districts.getAtLocation(loc);
          if (!district) continue;
          const isCenter = district.type === DistrictTypes.CITY_CENTER;
          if (!isCenter && district.type !== DistrictTypes.URBAN) continue;
          if (me >= 0 && GameplayMap.getRevealedState(me, loc.x, loc.y) === RevealedStates.HIDDEN) continue;
          const buildings = tileBuildings(loc);
          if (!buildings) continue;
          const seed = (loc.x * 73856093) ^ (loc.y * 19349663);
          const parts = [];
          const kind = isCenter ? (buildings.includes("BUILDING_PALACE") ? "capital" : "center") : "urban";
          for (const asset of layout[kind]) parts.push([asset, ZERO, 1, 0]);
          const lots = isCenter ? CENTER_LOTS : URBAN_LOTS;
          // On a city center the palace or city hall takes the plaza.
          const order = isCenter
            ? [...buildings.filter((b) => b === "BUILDING_PALACE" || b === "BUILDING_CITY_HALL"),
               ...buildings.filter((b) => b !== "BUILDING_PALACE" && b !== "BUILDING_CITY_HALL")]
            : buildings;
          let lot = 0;
          for (const type of order) {
            if (lot >= lots.length) break;
            const model = buildingModel(type, owned, ageName, Math.abs(seed));
            if (!model) continue;
            const l = lots[lot++];
            parts.push([model, { x: l.x, y: l.y, z: 0 }, l.scale, l.angle ?? facing(l)]);
          }
          if (!isCenter) {
            for (; lot < lots.length; lot++) {
              const bin = layout.filler[(Math.abs(seed) + lot) % layout.filler.length];
              const model = resolve(bin, owned, ageName, Math.abs(seed) + lot);
              if (model) parts.push([model, { x: lots[lot].x, y: lots[lot].y, z: 0 }, FILLER_SCALE, facing(lots[lot])]);
            }
          }
          want.set(loc.x + "," + loc.y, parts);
        }
      }
    }
    return want;
  }

  // One model group per tile, so a change on one tile redraws only that tile. Redrawing everything made models
  // restart loading, and buildings often never finished appearing during busy turns.
  const PREFIX = "ccVisualOverlay:";
  const groups = new Map();
  function groupFor(key) {
    let g = groups.get(key);
    if (!g) {
      g = WorldUI.getModelGroupByName?.(PREFIX + key) || WorldUI.createModelGroup(PREFIX + key);
      groups.set(key, g);
    }
    return g;
  }
  let current = new Map();
  const loc = (key) => { const [x, y] = key.split(",").map(Number); return { x, y }; };
  const signature = (parts) => parts.map((p) => p[0] + "@" + p[1].x + "," + p[1].y + "," + p[2] + "," + p[3]).join("|");

  function drawTile(key, parts) {
    const plot = loc(key);
    const g = groupFor(key);
    g.clear();
    WorldUI.clipHexHeight(plot, CLIP_HEIGHT);
    for (const [asset, offset, scale, angle] of parts) {
      g.addModelAtPlot(asset, plot, offset, { placement: PlacementMode.TERRAIN, scale, angle });
    }
  }

  function rebuild() {
    try {
      const want = desiredTiles();
      for (const key of current.keys()) {
        if (want.has(key)) continue;
        groups.get(key)?.clear();
        WorldUI.restoreHexHeight(loc(key));
      }
      for (const [key, parts] of want) {
        const old = current.get(key);
        if (!old || signature(old) !== signature(parts)) drawTile(key, parts);
      }
      current = want;
    } catch (e) {
      console.error("cc-visual-overlay: " + e);
    }
  }

  function reset() {
    for (const g of groups.values()) g.clear();
    WorldUI.getModelGroupByName?.("ccVisualOverlay")?.clear(); // the single group of earlier versions
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
    "ConstructibleAddedToMap", "ConstructibleChanged", "ConstructibleRemovedFromMap", "LocalPlayerChanged"]) {
    engine.on(event, schedule);
  }
  globalThis.CCVisualOverlay = {
    rebuild: () => { reset(); rebuild(); return current.size; },
    reset, personalAge, count: () => current.size,
    tile: (x, y) => current.get(x + "," + y) || null,
    resolve, buildingModel,
  };
  reset();
  schedule();
})();
