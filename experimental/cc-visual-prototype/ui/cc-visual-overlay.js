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
  const WEDGE = "LAYOUT_CTY_MOD_Wedge";

  // Layouts per personal Age, as the engine composes a city tile (measured on a test bench, tools/bench.js):
  //   urban:   the street section plus the engine's "two hero building" house layout, leaving two lots A and B;
  //   capital/center: the plaza layout, with the palace or city hall filling the plaza at full size.
  // Offsets are in tile units (x east, y north; 0.5 = the tile's inner edge). The engine turns a whole urban section
  // in 60-degree steps per tile; `angle` turns models counter-clockwise, so lots are rotated the same way.
  const LAYOUTS = {
    1: {
      urban: ["LAYOUT_CTY_Hex_Section_AB_Road_EXP", "BIN_CTY_EXP_Layout_2HB_Full_A"],
      capital: ["LAYOUT_CTY_EXP_Hex_Section_AB_City_Center_Palace", "LAYOUT_CTY_EXP_Hex_Section_AB_City_Center_Palace_FOL"],
      center: ["LAYOUT_CTY_EXP_Hex_Section_AB_City_Center", "LAYOUT_CTY_EXP_Hex_Section_AB_City_Center_Less_FOL"],
      filler: ["BIN_EXP_T2_CityBld_4X4_A", "BIN_EXP_T2_CityBld_3x5_A"],
    },
    2: {
      urban: ["LAYOUT_CTY_MOD_Section_AB_Road", "BIN_CTY_MOD_Layout_2HB_Full_A"],
      capital: ["LAYOUT_CTY_MOD_Hex_Section_AB_City_Center_Palace", "LAYOUT_CTY_MOD_Hex_Section_AB_City_Center_Palace_FOL"],
      center: ["LAYOUT_CTY_MOD_Section_AB_City_Center", "LAYOUT_CTY_MOD_Section_AB_City_Center_FOL"],
      filler: ["BIN_MOD_T2_CityBld_4X4_A", "BIN_MOD_T2_CityBld_3x5_A"],
    },
  };
  // Engine order (measured on the reference city): the first building goes to lot B (north-east), the second
  // to lot A (south-west); an unused lot gets filler houses.
  const URBAN_LOTS = [{ x: 0.12, y: 0.25 }, { x: -0.19, y: -0.09 }];
  const BUILDING_SCALE = 0.68; // the engine's "_Scaled" building bins draw at about this size
  const FILLER_SCALE = 0.6;
  // Street eraser. The engine picks one of five Antiquity street patterns per urban tile (A or B, some turned
  // 60 degrees) in compiled code we can't read, so on most tiles its ground streets don't match ours, and the
  // clip doesn't hide ground decals. This high-priority dirt patch paints over every lower decal: three copies
  // turned 0/60/120 at this size cover the inside of the hex and leave the street ring along its edges, which all
  // five patterns share. Our own street decals are covered too, so the inside becomes one block for our models.
  const ERASER = "EXP_Decal_Patch_DirtRectangle_A_highPrio";
  const ERASER_SCALE = 2.2;
  // Off by default: the only high-priority patches in the game are sand-coloured dirt, which takes the ground
  // further from vanilla (grey paving in Modern, streets in Exploration). Kept as a switch for testing.
  let erase = false;
  /** Per edge: 3 if it faces water or a mountain, 1 if it is a cliff, else 0. */
  function edgeCosts(loc) {
    const cost = [];
    for (let d = 0; d < 6; d++) {
      const a = GameplayMap.getAdjacentPlotLocation(loc, d);
      cost[d] = !a ? 3 : GameplayMap.isWater(a.x, a.y) || GameplayMap.isMountain(a.x, a.y) ? 3
        : GameplayMap.isCliffCrossing(loc.x, loc.y, d) ? 1 : 0;
    }
    return cost;
  }
  // Edges (DirectionTypes 0 NE, 1 E, 2 SE, 3 SW, 4 W, 5 NW) that the two-building house layout fills, and each
  // direction's angle in degrees counter-clockwise from east.
  const HOUSE_EDGES = [5, 3, 2];
  const DIR_ANGLE = [60, 0, 300, 240, 180, 120];
  const rotate = (p, deg) => {
    const r = deg * Math.PI / 180;
    return { x: p.x * Math.cos(r) - p.y * Math.sin(r), y: p.x * Math.sin(r) + p.y * Math.cos(r), z: 0 };
  };

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
          // clipHexHeight can't hide the engine's riverside houses on a navigable-river tile, so redrawing there
          // stacks new models on old ones. Leave those tiles to the engine (Antiquity art, wooden bridges).
          if (GameplayMap.isNavigableRiver(loc.x, loc.y)) continue;
          const seed = (loc.x * 73856093) ^ (loc.y * 19349663);
          const parts = [];
          const civic = (b) => b === "BUILDING_PALACE" || b === "BUILDING_CITY_HALL";
          if (isCenter) {
            const kind = buildings.includes("BUILDING_PALACE") ? "capital" : "center";
            for (const asset of layout[kind]) parts.push([asset, ZERO, 1, 0]);
            const main = buildings.find(civic) || (kind === "capital" ? "BUILDING_PALACE" : "BUILDING_CITY_HALL");
            const model = buildingModel(main, owned, ageName, Math.abs(seed));
            if (model) parts.push([model, ZERO, 1, 0]);
          } else {
            // Lots are measured on the engine's unturned pattern A. The engine turns or swaps the pattern on most
            // tiles (35-district test), so the eraser above clears its inner streets and the lots stay at angle 0.
            const angle = 0;
            // On shore, cliff or mountain tiles the fixed house rows would spill onto rocks or beach (the engine
            // places its houses piece by piece around the terrain; we can't), so draw only the streets there.
            const costs = edgeCosts(loc);
            // Only a house edge facing water or a mountain counts: the engine still fills tiles next to cliffs,
            // rivers and coasts on other edges with full house rows (reference city, tile 48,10).
            const rough = HOUSE_EDGES.some((d) => costs[d] >= 3);
            if (erase) for (const a of [0, 60, 120]) parts.push([ERASER, ZERO, ERASER_SCALE, a]);
            for (const asset of rough ? layout.urban.slice(0, 1) : layout.urban) parts.push([asset, ZERO, 1, angle]);
            // On shore, cliff and mountain tiles the house rows are one fixed piece that would spill onto the terrain.
            // Place single house blocks instead, like the engine, only on the house edges that face land.
            if (rough) {
              HOUSE_EDGES.forEach((d, i) => {
                if (costs[d] > 0) return;
                const r = DIR_ANGLE[d] * Math.PI / 180;
                const bin = layout.filler[(Math.abs(seed) + i) % layout.filler.length];
                const model = resolve(bin, owned, ageName, Math.abs(seed) + i);
                if (model) parts.push([model, { x: 0.3 * Math.cos(r), y: 0.3 * Math.sin(r), z: 0 }, FILLER_SCALE, 0]);
              });
            }
            const others = buildings.filter((b) => !civic(b) && !/BRIDGE/.test(b));
            URBAN_LOTS.forEach((lot, i) => {
              const at = rotate(lot, angle);
              const type = others[i];
              let model = type && buildingModel(type, owned, ageName, Math.abs(seed));
              let scale = model && /_Scaled$/.test(model) ? 1 : BUILDING_SCALE;
              if (!model) {
                model = resolve(layout.filler[(Math.abs(seed) + i) % layout.filler.length], owned, ageName, Math.abs(seed) + i);
                scale = FILLER_SCALE;
              }
              if (model) parts.push([model, at, scale, angle]);
            });
          }
          // Modern gap filler: at angle 0 the engine's wedge piece fills the tile's east edge, the one edge our
          // layout leaves open. Draw it when the eastern neighbour is also a city tile (never on water or rivers).
          if (age === 2 && !isCenter) {
            const e = GameplayMap.getAdjacentPlotLocation(loc, 1);
            const ed = e && Districts.getAtLocation(e);
            if (ed && (ed.type === DistrictTypes.URBAN || ed.type === DistrictTypes.CITY_CENTER)
              && !GameplayMap.isWater(e.x, e.y) && !GameplayMap.isNavigableRiver(e.x, e.y)) {
              parts.push([WEDGE, ZERO, 1, 0]);
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
        // The engine redraws a city's tiles when the city changes (new building, new tile, growth), which undoes
        // the clip: re-hide every replaced tile on each rebuild, or old engine art shows through underneath.
        else WorldUI.clipHexHeight(loc(key), CLIP_HEIGHT);
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
    "ConstructibleAddedToMap", "ConstructibleChanged", "ConstructibleRemovedFromMap", "LocalPlayerChanged",
    "CityPopulationChanged", "CityProductionCompleted", "UrbanReligionChanged", "CityStateBonusChosen"]) {
    engine.on(event, schedule);
  }
  // Safety net: the engine can redraw a tile without an event we listen to, which undoes the clip. Re-hide the
  // replaced tiles every few seconds (cheap: one call per tile, no models redrawn).
  setInterval(() => {
    try { for (const key of current.keys()) WorldUI.clipHexHeight(loc(key), CLIP_HEIGHT); } catch (e) { /* game unloading */ }
  }, 3000);
  globalThis.CCVisualOverlay = {
    rebuild: () => { reset(); rebuild(); return current.size; },
    reset, personalAge, count: () => current.size,
    setErase: (on) => { erase = !!on; reset(); rebuild(); return erase; },
    tile: (x, y) => current.get(x + "," + y) || null,
    resolve, buildingModel,
  };
  reset();
  schedule();
})();
