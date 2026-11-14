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
//      - the engine's house layout of that Age, placed and chosen from its own layout data (ui/cc-layout-slots.js,
//        drawn slot by slot next to cliffs, water and mountains), and its vacant-plot piece in empty lots.
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
  // The house and square layouts are chosen as the engine's own layout bins choose them (decoded rows of
  // BIN_CTY_*_Layout_2HB_Full_A, _Palace_Full_A, _City_Center_Full_A): a forest version on wooded tiles; in
  // Exploration a "Less" version for some cultures, otherwise one of the street-pattern-A variants at random
  // (pattern B would not fit the pattern-A streets we draw). `street` is drawn on every urban tile.
  const LAYOUTS = {
    1: {
      street: "LAYOUT_CTY_Hex_Section_AB_Road_EXP",
      houses: { plain: ["LAYOUT_CTY_EXP_Hex_Section_AB", "LAYOUT_CTY_EXP_Hex_Section_AB_VAR_A"],
        less: ["LAYOUT_CTY_EXP_Hex_Section_AB_Attatchment_Less"], fol: ["LAYOUT_CTY_EXP_Hex_Section_AB_Attatchment_Less_FOL"] },
      capital: { plain: "LAYOUT_CTY_EXP_Hex_Section_AB_City_Center_Palace", fol: "LAYOUT_CTY_EXP_Hex_Section_AB_City_Center_Palace_FOL" },
      center: { plain: "LAYOUT_CTY_EXP_Hex_Section_AB_City_Center", less: "LAYOUT_CTY_EXP_Hex_Section_AB_City_Center_Less",
        fol: "LAYOUT_CTY_EXP_Hex_Section_AB_City_Center_Less_FOL" },
    },
    2: {
      street: "LAYOUT_CTY_MOD_Section_AB_Road",
      houses: { plain: ["LAYOUT_CTY_MOD_Section_AB_Small_Packed"], fol: ["LAYOUT_CTY_MOD_Section_AB_Small_Packed_FOL"] },
      capital: { plain: "LAYOUT_CTY_MOD_Hex_Section_AB_City_Center_Palace", fol: "LAYOUT_CTY_MOD_Hex_Section_AB_City_Center_Palace_FOL" },
      center: { plain: "LAYOUT_CTY_MOD_Section_AB_City_Center", fol: "LAYOUT_CTY_MOD_Section_AB_City_Center_FOL" },
    },
  };
  const WOODED = new Set(["FEATURE_FOREST", "FEATURE_SAGEBRUSH_STEPPE", "FEATURE_SAVANNA_WOODLAND", "FEATURE_TAIGA", "FEATURE_RAINFOREST"]);
  const LESS_CULTURES = ["SAM", "SEA", "PAC", "NAM", "SAF"];
  function isWooded(loc) {
    const f = GameplayMap.getFeatureType(loc.x, loc.y);
    return f >= 0 && WOODED.has(GameInfo.Features.lookup(f)?.FeatureType);
  }
  /** The variant of a layout set ({plain, less?, fol?}) the engine would pick for this tile and owner. */
  function pickLayout(set, loc, owned, seed) {
    const pick = (v) => Array.isArray(v) ? v[seed % v.length] : v;
    if (set.fol && isWooded(loc)) return pick(set.fol);
    if (set.less && LESS_CULTURES.some((c) => owned.has(c) || owned.has(c + "_EXP"))) return pick(set.less);
    return pick(set.plain);
  }
  // Building lots read from the engine's own layout assets (tools/decode_layouts.py): the Herobuilding_A/B
  // attachment points of the urban and city-centre layouts, in tile units, with their turns in degrees.
  // The first building goes to A, the second to B.
  const LOTS = {
    urban: {
      1: [{ x: 0.120, y: 0.245, turn: 330 }, { x: -0.214, y: -0.086, turn: 0 }],
      2: [{ x: 0.123, y: 0.275, turn: 330 }, { x: -0.215, y: -0.093, turn: 0 }],
    },
    center: {
      1: [{ x: 0.120, y: 0.245, turn: 150 }, { x: -0.214, y: -0.086, turn: 0 }],
      2: [{ x: 0.123, y: 0.275, turn: 330 }, { x: -0.215, y: -0.093, turn: 0 }],
    },
    // Palace square (Hero_Building_A_1 / A_2), the same in Exploration and Modern.
    capital: [{ x: -0.103, y: -0.179, turn: 330 }, { x: 0.129, y: 0.224, turn: 330 }],
  };
  // Rural improvements with their own Modern art (from the game's bins: BIN_IMP_Farms, BIN_IMP_WoodCutters,
  // BIN_IMP_ClayPits, BIN_IMP_Mine_MOD pick these by [AGE:AGE_MODERN]). Exploration has no farm or woodcutter
  // variant and falls back to the Antiquity mine and clay pit, so only Modern rural tiles are redrawn.
  // Farms: the engine's variant B matches the reference farm's house, tractor and shed placement.
  // Camps and quarries have whole Modern models (camps also an Exploration one). Pastures and plantations
  // pick only their buildings by Age (the animals and crops come from resource bins), and the game ignores an
  // Age passed in selectionScriptParams, so they are rebuilt from parts: the resource bin plus the Modern
  // buildings at the spots the engine uses (measured on the vanilla Modern reference game, round 27).
  // Each entry: list of [model, x, y] in tile units.
  const RURAL = {
    1: {
      IMPROVEMENT_CAMP: [["IMP_EXP_CAMP", 0, 0]],
    },
    2: {
      IMPROVEMENT_FARM: [["BIN_IMP_MOD_Farm_B", 0, 0]],
      IMPROVEMENT_WOODCUTTER: [["IMP_MOD_WoodCutter", 0, 0]],
      IMPROVEMENT_WOODCUTTER_RESOURCE: [["IMP_MOD_WoodCutter", 0, 0]],
      IMPROVEMENT_CLAY_PIT: [["BIN_IMP_MOD_Claypit_Base", 0, 0]],
      IMPROVEMENT_CLAY_PIT_RESOURCE: [["BIN_IMP_MOD_Claypit_Base", 0, 0]],
      IMPROVEMENT_MINE: [["IMP_Mine_MOD", 0, 0]],
      IMPROVEMENT_MINE_RESOURCE: [["IMP_Mine_MOD", 0, 0]],
      IMPROVEMENT_CAMP: [["IMP_MOD_CAMP", 0, 0]],
      IMPROVEMENT_QUARRY: [["IMP_MOD_Quarry", 0, 0]],
      IMPROVEMENT_PASTURE: [["IMP_Pasture", 0, 0], ["BIN_Pasture_Resources_Finished", 0, 0],
        ["PROP_Pasture_MOD_Barn", 0.2, -0.11], ["PROP_Pasture_MOD_BldB", 0.04, 0.32]],
      IMPROVEMENT_PLANTATION: [["BIN_PROP_Plantation_RES", 0, 0], ["IMP_Plantation_Bld_MOD", -0.13, 0.3]],
    },
  };
  /** The parts for a rural tile's improvement in this personal Age, or null to leave the tile to the engine. */
  function ruralParts(loc, age) {
    const table = RURAL[age];
    if (!table) return null;
    for (const id of MapConstructibles.getConstructibles(loc.x, loc.y) || []) {
      const c = Constructibles.getByComponentID(id);
      const type = c && GameInfo.Constructibles.lookup(c.type)?.ConstructibleType;
      if (type && table[type] && c.complete !== false) return table[type];
    }
    return null;
  }
  const HARBOUR_PIER = "LAYOUT_CTY_Coastal_2Shore"; // the engine's coastal pier piece
  const HARBOUR_OFFSET = 0.2; // tile units from the centre toward the shore
  const BUILDING_SCALE = 0.68; // the engine's "_Scaled" building bins draw at about this size
  // Empty building lot: rows of BIN_Vacant_Building (decoded): Modern picks MOD_01/02, other Ages one of 01-05.
  // Drawn at the scaled bin's size, which matched the engine's own on the reference game.
  const VACANT = {
    1: ["Vacant_Hero_Building_Plot_01", "Vacant_Hero_Building_Plot_02", "Vacant_Hero_Building_Plot_03",
      "Vacant_Hero_Building_Plot_04", "Vacant_Hero_Building_Plot_05"],
    2: ["Vacant_Hero_Building_Plot_MOD_01", "Vacant_Hero_Building_Plot_MOD_02"],
  };
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
  // Each direction's angle (DirectionTypes 0 NE, 1 E, 2 SE, 3 SW, 4 W, 5 NW) in degrees counter-clockwise from east.
  const DIR_ANGLE = [60, 0, 300, 240, 180, 120];
  // House slots closer than this (tile units) to an edge facing a cliff, water or a mountain are left out. Fitted on
  // two unturned cliff tiles of the vanilla Modern reference (48,10 and 50,27): the engine drops the slots 0.13 and
  // 0.15 from the cliff edge and keeps the next one at 0.22.
  const EDGE_CLEARANCE = 0.18;
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
          if (me >= 0 && GameplayMap.getRevealedState(me, loc.x, loc.y) === RevealedStates.HIDDEN) continue;
          if (district.type === DistrictTypes.RURAL) {
            const rural = ruralParts(loc, age);
            if (rural) want.set(loc.x + "," + loc.y, rural.map(([m, x, y]) => [m, { x, y, z: 0 }, 1, 0, id]));
            continue;
          }
          if (!isCenter && district.type !== DistrictTypes.URBAN) continue;
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
            parts.push([pickLayout(layout[kind], loc, owned, Math.abs(seed)), ZERO, 1, 0]);
            // The palace or city hall takes the first slot of the square, at full size; any other building on the
            // centre tile takes the second slot.
            const main = buildings.find(civic) || (kind === "capital" ? "BUILDING_PALACE" : "BUILDING_CITY_HALL");
            const slots = kind === "capital" ? LOTS.capital : LOTS.center[age];
            [main, ...buildings.filter((b) => !civic(b) && !/BRIDGE/.test(b))].slice(0, 2).forEach((type, i) => {
              const model = buildingModel(type, owned, ageName, Math.abs(seed));
              if (!model) return;
              const s = slots[i];
              const scale = i === 0 ? 1 : /_Scaled$/.test(model) ? 1 : BUILDING_SCALE;
              parts.push([model, { x: s.x, y: s.y, z: 0 }, scale, s.turn]);
            });
          } else if (GameplayMap.isWater(loc.x, loc.y)) {
            // Harbour tile (wharf, shipyard, fishing quay ...): no streets or houses on the water. Like the engine
            // (reference game, tile 50,9), each harbour building stands at full size on the land side, its long
            // side facing the shore, with a pier running out to sea.
            let lx = 0, ly = 0;
            for (let d = 0; d < 6; d++) {
              const a = GameplayMap.getAdjacentPlotLocation(loc, d);
              if (a && !GameplayMap.isWater(a.x, a.y)) {
                lx += Math.cos(DIR_ANGLE[d] * Math.PI / 180);
                ly += Math.sin(DIR_ANGLE[d] * Math.PI / 180);
              }
            }
            const land = (lx || ly) ? Math.atan2(ly, lx) * 180 / Math.PI : 210;
            const turn = (deg) => ((Math.round(deg) % 360) + 360) % 360;
            parts.push([HARBOUR_PIER, ZERO, 1, turn(land - 90)]);
            buildings.filter((b) => !/BRIDGE/.test(b)).forEach((type, i) => {
              const model = buildingModel(type, owned, ageName, Math.abs(seed) + i);
              if (!model) return;
              const r = (land + (i === 0 ? 0 : i === 1 ? 70 : -70)) * Math.PI / 180;
              const at = { x: HARBOUR_OFFSET * Math.cos(r), y: HARBOUR_OFFSET * Math.sin(r), z: 0 };
              parts.push([model, at, 1, turn(land + 120)]);
            });
          } else {
            // Lots are measured on the engine's unturned pattern A. The engine turns or swaps the pattern on most
            // tiles (35-district test), so the eraser above clears its inner streets and the lots stay at angle 0.
            const angle = 0;
            // On shore, cliff or mountain tiles the fixed house rows would spill onto rocks or beach (the engine
            // places its houses piece by piece around the terrain; we can't), so draw only the streets there.
            const costs = edgeCosts(loc);
            if (erase) for (const a of [0, 60, 120]) parts.push([ERASER, ZERO, ERASER_SCALE, a]);
            parts.push([layout.street, ZERO, 1, angle]);
            const houses = pickLayout(layout.houses, loc, owned, Math.abs(seed));
            // Next to a cliff, water or a mountain the engine leaves out the house slots nearest that edge (they
            // would stand on the rocks or the beach). Draw such tiles slot by slot from the engine's own slot table
            // and skip those slots; other tiles get the whole layout in one piece.
            const roughEdges = [0, 1, 2, 3, 4, 5].filter((d) => costs[d] > 0);
            const slots = roughEdges.length && globalThis.CCLayoutSlots?.[houses];
            if (!slots) parts.push([houses, ZERO, 1, angle]);
            else {
              slots.forEach(([m, x, y, z, turn, scale], i) => {
                if (/^Hero_Building|_Road$/.test(m)) return; // our buildings and street are drawn separately
                const clear = Math.min(...roughEdges.map((d) => {
                  const r = DIR_ANGLE[d] * Math.PI / 180;
                  return 0.5 - (x * Math.cos(r) + y * Math.sin(r));
                }));
                if (clear < EDGE_CLEARANCE) return;
                parts.push([resolve(m, owned, ageName, Math.abs(seed) + i) || m, { x, y, z }, scale, turn]);
              });
            }
            const others = buildings.filter((b) => !civic(b) && !/BRIDGE/.test(b));
            LOTS.urban[age].forEach((lot, i) => {
              const at = { x: lot.x, y: lot.y, z: 0 };
              const type = others[i];
              let model = type && buildingModel(type, owned, ageName, Math.abs(seed));
              let scale = model && /_Scaled$/.test(model) ? 1 : BUILDING_SCALE;
              if (!model) {
                // An empty lot gets the engine's vacant-plot piece (BIN_Vacant_Building_Scaled), named directly
                // because the bin itself would pick by the game's Age.
                model = VACANT[age][(Math.abs(seed) + i) % VACANT[age].length];
                scale = BUILDING_SCALE;
              }
              if (model) parts.push([model, at, scale, lot.turn]);
            });
          }
          // Modern gap filler: at angle 0 the engine's wedge piece fills the tile's east edge, the one edge our
          // layout leaves open. Draw it when the eastern neighbour is also a city tile (never on water or rivers).
          if (age === 2 && !isCenter && !GameplayMap.isWater(loc.x, loc.y)) {
            const e = GameplayMap.getAdjacentPlotLocation(loc, 1);
            const ed = e && Districts.getAtLocation(e);
            if (ed && (ed.type === DistrictTypes.URBAN || ed.type === DistrictTypes.CITY_CENTER)
              && !GameplayMap.isWater(e.x, e.y) && !GameplayMap.isNavigableRiver(e.x, e.y)) {
              parts.push([WEDGE, ZERO, 1, 0]);
            }
          }
          // Owner's colours (banners, awnings, roof stripes), as the engine tints its own city models.
          for (const p of parts) p[4] = id;
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
  const signature = (parts) => parts.map((p) => p[0] + "@" + p[1].x + "," + p[1].y + "," + p[2] + "," + p[3] + "," + p[4]).join("|");
  /** The player's colours as the game's own UI passes them to models (leader-model-manager.js). */
  function tint(owner) {
    try {
      return { tintColor1: UI.Player.getPrimaryColorValueAsHex(owner), tintColor2: UI.Player.getSecondaryColorValueAsHex(owner) };
    } catch (e) {
      return {};
    }
  }

  function drawTile(key, parts) {
    const plot = loc(key);
    const g = groupFor(key);
    g.clear();
    WorldUI.clipHexHeight(plot, CLIP_HEIGHT);
    for (const [asset, offset, scale, angle, owner] of parts) {
      g.addModelAtPlot(asset, plot, offset, { placement: PlacementMode.TERRAIN, scale, angle, ...tint(owner) });
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
