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

  // Layouts per personal Age, as the engine composes a city tile:
  //   urban:   the street section plus the house layout, which leaves two building lots A and B;
  //   capital/center: the square layout, with the palace or city hall in its first slot.
  // Offsets are in tile units (x east, y north; 0.5 = the tile's inner edge); turns are degrees counter-clockwise.
  // The house and square layouts are chosen as the engine's own layout bins choose them (decoded rows of
  // BIN_CTY_*_Layout_2HB_Full_A, _Palace_Full_A, _City_Center_Full_A): a forest version on wooded tiles; in
  // Exploration a "Less" version for some cultures, otherwise one of the variants by tile seed.
  // Street pattern and turn of an urban tile follow the engine's Antiquity streets painted underneath, which the
  // clip can't hide: ui/cc-street-table.js has them per coordinate (measured; see streetPick). Exploration has
  // street patterns A and B, each with its own house layouts; Modern has one street and draws pattern-B tiles as A,
  // unturned. Unmeasured coordinates and river tiles whose turn is unsure get pattern A, unturned.
  const LAYOUTS = {
    1: {
      street: { A: "LAYOUT_CTY_Hex_Section_AB_Road_EXP", B: "LAYOUT_CTY_Hex_Section_AB_B_Road_EXP" },
      houses: {
        A: { plain: ["LAYOUT_CTY_EXP_Hex_Section_AB", "LAYOUT_CTY_EXP_Hex_Section_AB_VAR_A"],
          less: ["LAYOUT_CTY_EXP_Hex_Section_AB_Attatchment_Less"], fol: ["LAYOUT_CTY_EXP_Hex_Section_AB_Attatchment_Less_FOL"] },
        B: { plain: ["LAYOUT_CTY_EXP_Hex_Section_AB_B", "LAYOUT_CTY_EXP_Hex_Section_AB_B_VAR_A"],
          less: ["LAYOUT_CTY_EXP_Hex_Section_AB_B_Attachment_Less"], fol: ["LAYOUT_CTY_EXP_Hex_Section_AB_B_Attachment_Less_FOL"] },
      },
      capital: { plain: "LAYOUT_CTY_EXP_Hex_Section_AB_City_Center_Palace", fol: "LAYOUT_CTY_EXP_Hex_Section_AB_City_Center_Palace_FOL" },
      center: { plain: "LAYOUT_CTY_EXP_Hex_Section_AB_City_Center", less: "LAYOUT_CTY_EXP_Hex_Section_AB_City_Center_Less",
        fol: "LAYOUT_CTY_EXP_Hex_Section_AB_City_Center_Less_FOL" },
    },
    2: {
      street: { A: "LAYOUT_CTY_MOD_Section_AB_Road" },
      houses: { A: { plain: ["LAYOUT_CTY_MOD_Section_AB_Small_Packed"], fol: ["LAYOUT_CTY_MOD_Section_AB_Small_Packed_FOL"] } },
      capital: { plain: "LAYOUT_CTY_MOD_Hex_Section_AB_City_Center_Palace", fol: "LAYOUT_CTY_MOD_Hex_Section_AB_City_Center_Palace_FOL" },
      center: { plain: "LAYOUT_CTY_MOD_Section_AB_City_Center", fol: "LAYOUT_CTY_MOD_Section_AB_City_Center_FOL" },
    },
  };
  // The pattern-B "Less" house layouts are attachments the engine draws turned -60 degrees inside its B layouts
  // (LAYOUT_CTY_EXP_Hex_Section_AB_B carries LAYOUT_..._AB_B_Attachment at -60); drawn directly they need that turn.
  const LAYOUT_TURN = { LAYOUT_CTY_EXP_Hex_Section_AB_B_Attachment_Less: -60, LAYOUT_CTY_EXP_Hex_Section_AB_B_Attachment_Less_FOL: -60 };
  const norm = (deg) => ((Math.round(deg) % 360) + 360) % 360;
  const rot = (p, deg) => {
    const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z || 0 };
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
  // Building lots read from the engine's own layout assets (tools/extract/decode_layouts.py): the Herobuilding_A/B
  // attachment points of the urban and city-centre layouts, in tile units, with their turns in degrees.
  // The first building goes to A, the second to B.
  const LOTS = {
    // Hero_Building_A / _B of the house layouts (tools/extract/extract_layout_slots.py). Pattern B's are the same in its
    // full and "Less" layouts once the Less attachment's -60 degree turn is applied.
    urban: {
      1: { A: [{ x: 0.120, y: 0.245, turn: 330 }, { x: -0.214, y: -0.086, turn: 0 }],
        B: [{ x: 0.033, y: -0.196, turn: 300 }, { x: -0.133, y: 0.236, turn: 30 }] },
      2: { A: [{ x: 0.123, y: 0.275, turn: 330 }, { x: -0.215, y: -0.093, turn: 0 }] },
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
  // Farms: the engine picks a variant per tile; the rural probe of a vanilla Modern game (2026-11-18, 392 farms,
  // tools/pipeline/rural.mjs) read A on 338, B on 24, C on 30, all with clear margins, so we draw A. The farm's turn
  // is spread over all six and doesn't follow the Modern street-turn table: no rule yet, so it stays at 0.
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
      IMPROVEMENT_FARM: [["BIN_IMP_MOD_Farm_A", 0, 0]],
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
  /** The directions (0-5) whose edge faces water, a mountain, a cliff or the map's end. */
  function roughEdges(loc) {
    const out = [];
    for (let d = 0; d < 6; d++) {
      const a = GameplayMap.getAdjacentPlotLocation(loc, d);
      if (!a || GameplayMap.isWater(a.x, a.y) || GameplayMap.isMountain(a.x, a.y)
        || GameplayMap.isCliffCrossing(loc.x, loc.y, d)) out.push(d);
    }
    return out;
  }
  // Each direction's angle (DirectionTypes 0 NE, 1 E, 2 SE, 3 SW, 4 W, 5 NW) in degrees counter-clockwise from east.
  const DIR_ANGLE = [60, 0, 300, 240, 180, 120];
  // House slots closer than this (tile units) to an edge facing a cliff, water or a mountain are left out. Fitted on
  // two unturned cliff tiles of the vanilla Modern reference (48,10 and 50,27): the engine drops the slots 0.13 and
  // 0.15 from the cliff edge and keeps the next one at 0.22.
  const EDGE_CLEARANCE = 0.18;

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

  /**
   * Street pattern ("A" | "B") and turn (degrees) to draw on an urban tile so our streets lie on the engine's
   * Antiquity streets underneath. Measured coordinates only (ui/cc-street-table.js); river tiles whose turn may be
   * 60 degrees off, unmeasured coordinates and other map sizes get pattern A unturned, as before the table.
   */
  function streetPick(loc, age) {
    // First choice: the street the engine itself draws on this coordinate in the owner's Age (measured in vanilla
    // games of that Age; its turn is unrelated to the Antiquity paint, round 58). The Antiquity paint underneath then
    // shows wherever the two differ, but streets, houses and lots stand where vanilla puts them.
    const own = globalThis.CCStreetTable?.lookupAge?.(age, loc.x, loc.y, isWooded(loc));
    if (own && own.sure && LAYOUTS[age].street[own.street]) return { pattern: own.street, angle: norm(own.angle) };
    const t = globalThis.CCStreetTable?.lookup(loc.x, loc.y, isWooded(loc));
    if (!t || !t.sure) return { pattern: "A", angle: 0 };
    if (!LAYOUTS[age].street[t.street]) return { pattern: "A", angle: 0 };   // Modern has no pattern B
    return { pattern: t.street, angle: norm(t.angle) };
  }

  // Paving test switch: { 1: { model, scale, last }, 2: ... } per personal Age; empty = off (setGround()).
  const ground = {};
  /** "x,y" -> list of [asset, offset, scale, turn, owner] for every tile that should be rebuilt. */
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
            // A capital can hold a city hall too (Exploration start): the palace always takes the square's main slot.
            const main = kind === "capital" ? "BUILDING_PALACE" : (buildings.find(civic) || "BUILDING_CITY_HALL");
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
            const { pattern, angle } = streetPick(loc, age);
            parts.push([layout.street[pattern], ZERO, 1, angle]);
            // Exploration pattern A: the engine picks the plain layout or its _VAR_A by the tile's wooded-street A/B
            // bit (A -> plain, B -> _VAR_A; 104 of 104 tiles, round 65). Pattern B's pick is not known yet.
            let houseSeed = Math.abs(seed);
            if (age === 1 && pattern === "A") {
              const w = globalThis.CCStreetTable?.lookupAge?.(1, loc.x, loc.y, true);
              if (w) houseSeed = w.street === "A" ? 0 : 1;
            }
            const houses = pickLayout(layout.houses[pattern], loc, owned, houseSeed);
            const houseTurn = (LAYOUT_TURN[houses] || 0) + angle;
            // Next to a cliff, water or a mountain the engine leaves out the house slots nearest that edge (they
            // would stand on the rocks or the beach). Draw such tiles slot by slot from the engine's own slot table
            // and skip those slots; other tiles get the whole layout in one piece.
            const rough = roughEdges(loc);
            const slots = rough.length && globalThis.CCLayoutSlots?.[houses];
            if (!slots) parts.push([houses, ZERO, 1, norm(houseTurn)]);
            else {
              slots.forEach(([m, x, y, z, turn, scale], i) => {
                if (/^Hero_Building|_Road$/.test(m)) return; // our buildings and street are drawn separately
                const at = rot({ x, y, z }, houseTurn);
                const clear = Math.min(...rough.map((d) => {
                  const r = DIR_ANGLE[d] * Math.PI / 180;
                  return 0.5 - (at.x * Math.cos(r) + at.y * Math.sin(r));
                }));
                if (clear < EDGE_CLEARANCE) return;
                parts.push([resolve(m, owned, ageName, Math.abs(seed) + i) || m, at, scale, norm(turn + houseTurn)]);
              });
            }
            const others = buildings.filter((b) => !civic(b) && !/BRIDGE/.test(b));
            LOTS.urban[age][pattern].forEach((lot, i) => {
              const at = rot({ x: lot.x, y: lot.y, z: 0 }, angle);
              const type = others[i];
              let model = type && buildingModel(type, owned, ageName, Math.abs(seed));
              let scale = model && /_Scaled$/.test(model) ? 1 : BUILDING_SCALE;
              if (!model) {
                // An empty lot gets the engine's vacant-plot piece (BIN_Vacant_Building_Scaled), named directly
                // because the bin itself would pick by the game's Age.
                model = VACANT[age][(Math.abs(seed) + i) % VACANT[age].length];
                scale = BUILDING_SCALE;
              }
              parts.push([model, at, scale, norm(lot.turn + angle)]);
            });
          }
          // Modern gap filler: at angle 0 the engine's wedge piece fills the tile's east edge, the one edge our
          // layout leaves open (on a turned tile, the edge that turn faces). Draw it when that neighbour is also a
          // city tile (never on water or rivers).
          if (age === 2 && !isCenter && !GameplayMap.isWater(loc.x, loc.y)) {
            const wedgeTurn = streetPick(loc, age).angle;
            const e = GameplayMap.getAdjacentPlotLocation(loc, DIR_ANGLE.indexOf(wedgeTurn));
            const ed = e && Districts.getAtLocation(e);
            if (ed && (ed.type === DistrictTypes.URBAN || ed.type === DistrictTypes.CITY_CENTER)
              && !GameplayMap.isWater(e.x, e.y) && !GameplayMap.isNavigableRiver(e.x, e.y)) {
              parts.push([WEDGE, ZERO, 1, wedgeTurn]);
            }
          }
          // Ground test (round 64): a paving piece per Age under or over the tile's parts, set by setGround().
          const g = ground[age];
          if (g && !GameplayMap.isWater(loc.x, loc.y)) {
            const piece = [g.model, ZERO, g.scale, norm((loc.x * 37 + loc.y * 11) % 6 * 60)];
            if (g.last) parts.push(piece); else parts.unshift(piece);
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
  const PREFIX = GROUP_NAME + ":";
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
    WorldUI.getModelGroupByName?.(GROUP_NAME)?.clear(); // the single group of earlier versions
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
    tile: (x, y) => current.get(x + "," + y) || null,
    // setGround(age, model, scale, last): draw a paving piece first (or last) on every tile of that personal Age;
    // setGround(age) turns it off. Test switch; redraws everything.
    setGround: (age, model, scale = 1, last = false) => {
      if (model) ground[age] = { model, scale, last }; else delete ground[age];
      reset(); rebuild(); return JSON.stringify(ground);
    },
    resolve, buildingModel,
  };
  reset();
  schedule();
})();
