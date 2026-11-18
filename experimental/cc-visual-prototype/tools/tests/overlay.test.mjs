// Offline checks of the overlay (no game): a small fake world with the game's script objects mocked, the real
// overlay, street table, art and slot data loaded, and tools/game/overlay-tests.js plus case checks run against what
// the overlay would draw.   node tools/tests/overlay.test.mjs      (exit code 1 on a failure)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROTO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const W = 60, H = 38;
const g = globalThis;
let failed = 0, passed = 0;
const expect = (ok, what) => { if (ok) passed++; else { failed++; console.log("FAIL", what); } };

// ---- the fake world: Rome (player 0), capital at 24,25, Cartography researched (Exploration)
const idx = (x, y) => y * W + x;
const tiles = new Map();   // "x,y" -> { district, items: [type], feature, water, navRiver, river }
const T = (x, y, o) => tiles.set(x + "," + y, { items: [], feature: -1, ...o });
// City hall listed before the palace, as the game listed them when the overlay put the city hall in the palace slot.
T(24, 25, { district: "CITY_CENTER", items: ["BUILDING_CITY_HALL", "BUILDING_PALACE"] });
T(24, 27, { district: "URBAN", items: ["BUILDING_BANK", "BUILDING_GUILDHALL"] });
T(23, 25, { district: "URBAN", items: ["BUILDING_MARKET"], feature: 1 });          // forest
T(25, 26, { district: "URBAN", items: ["BUILDING_ARENA"] });
T(23, 26, { district: "URBAN", items: [] });
T(24, 26, { district: "URBAN", items: ["BUILDING_LIBRARY"] });
T(25, 24, { district: "URBAN", items: ["BUILDING_FISHING_QUAY"], water: true });     // harbour
T(25, 25, { district: "URBAN", items: ["WONDER_COLOSSEUM"] });                       // wonder
T(23, 24, { district: "URBAN", items: ["BUILDING_GRANARY"], navRiver: true, river: true });
T(22, 25, { district: "RURAL", items: ["IMPROVEMENT_FARM"] });
const at = (x, y) => tiles.get(x + "," + y);

const DT = { CITY_CENTER: 1, URBAN: 2, RURAL: 3 };
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
const TECHS = new Set(["NODE_TECH_EX_CARTOGRAPHY"]);
const FEATURES = { 1: "FEATURE_FOREST" };
const CLASS = (t) => t.startsWith("WONDER") ? "WONDER" : t.startsWith("IMPROVEMENT") ? "IMPROVEMENT" : "BUILDING";
const consts = [];   // component ids -> { type, complete }
const consAt = new Map();
for (const [k, t] of tiles) consAt.set(k, t.items.map((type) => { consts.push({ type, complete: true }); return consts.length - 1; }));
const lookupTable = (field) => ({ lookup: (v) => (typeof v === "string" ? { [field]: v, $hash: hash(v), $index: hash(v) } : null) });
const drawn = new Map();   // group name -> parts

Object.assign(g, {
  engine: { on: () => {} },
  setInterval: () => 0,
  GameContext: { localPlayerID: 0, localObserverID: -1 },
  RevealedStates: { HIDDEN: 0, REVEALED: 1, VISIBLE: 2 },
  DistrictTypes: DT,
  PlacementMode: { TERRAIN: 0 },
  UI: { Player: { getPrimaryColorValueAsHex: () => "#ff00ff", getSecondaryColorValueAsHex: () => "#ffffff" } },
  Configuration: { getMap: () => ({ mapSeed: 1 }) },
  Database: { query: () => [{ c: "CIVILIZATION_ROME", b: "BUILDING_CULTURE_MED" }, { c: "CIVILIZATION_ROME", b: "BUILDING_CULTURE_MED_ANT" }] },
  GameInfo: {
    ProgressionTreeNodes: lookupTable("ProgressionTreeNodeType"),
    Civilizations: { lookup: (v) => (v === "CIVILIZATION_ROME" ? { CivilizationType: v } : null) },
    Features: { lookup: (f) => (FEATURES[f] ? { FeatureType: FEATURES[f] } : null) },
    Constructibles: { lookup: (t) => ({ ConstructibleType: t, ConstructibleClass: CLASS(t) }) },
  },
  Players: {
    getAliveIds: () => [0], getAliveMajorIds: () => [0],
    get: () => ({
      civilizationType: "CIVILIZATION_ROME",
      Techs: { isNodeUnlocked: (h) => [...TECHS].some((n) => hash(n) === h) },
      Cities: { getCities: () => [{ location: { x: 24, y: 25 }, getPurchasedPlots: () => [...tiles.keys()].map((k) => idx(...k.split(",").map(Number))) }] },
    }),
  },
  GameplayMap: {
    getGridWidth: () => W, getGridHeight: () => H,
    getLocationFromIndex: (i) => ({ x: i % W, y: Math.floor(i / W) }),
    getRevealedState: () => 2,
    isWater: (x, y) => !!at(x, y)?.water,
    isNavigableRiver: (x, y) => !!at(x, y)?.navRiver,
    isRiver: (x, y) => !!at(x, y)?.river,
    isMountain: () => false,
    isCliffCrossing: () => false,
    getFeatureType: (x, y) => at(x, y)?.feature ?? -1,
    getPlotDistance: (a, b, c, d) => Math.max(Math.abs(a - c), Math.abs(b - d)),
    getAdjacentPlotLocation: (l, d) => { const o = l.y & 1; return [{ x: l.x + o, y: l.y + 1 }, { x: l.x + 1, y: l.y }, { x: l.x + o, y: l.y - 1 }, { x: l.x - 1 + o, y: l.y - 1 }, { x: l.x - 1, y: l.y }, { x: l.x - 1 + o, y: l.y + 1 }][d]; },
  },
  Districts: { getAtLocation: (l) => { const t = at(l.x, l.y); return t ? { type: DT[t.district], location: l } : null; } },
  MapConstructibles: { getConstructibles: (x, y) => consAt.get(x + "," + y) || [] },
  Constructibles: { getByComponentID: (id) => consts[id] },
  WorldUI: {
    clipHexHeight: () => {}, restoreHexHeight: () => {}, restoreAllHexHeight: () => {},
    getModelGroupByName: () => null,
    createModelGroup: (name) => { const parts = []; drawn.set(name, parts); return { clear: () => { parts.length = 0; }, addModelAtPlot: (m, p, o, opt) => parts.push([m, o, opt.scale, opt.angle]) }; },
  },
});
for (const f of ["cc-building-art.js", "cc-layout-slots.js", "cc-street-table.js", "cc-visual-overlay.js"]) (0, eval)(fs.readFileSync(path.join(PROTO, "ui", f), "utf8"));
(0, eval)(fs.readFileSync(path.join(PROTO, "tools", "game", "overlay-tests.js"), "utf8"));

// ---- the rule checks of the in-game suite, against this world
g.CCVisualOverlay.rebuild();
const summary = g.CCOverlayTests.run();
console.log("overlay-tests.js:", summary);
for (const f of g.CCOverlayTests.failures()) console.log("  ", f);
expect(g.CCOverlayTests.failures().length === 0, "overlay-tests.js rules");

// ---- cases
const O = g.CCVisualOverlay, S = g.CCStreetTable;
expect(O.personalAge(g.Players.get(0)) === 1, "Cartography -> personal Age Exploration");
const cap = O.tile(24, 25);
expect(cap && cap[0][0] === "LAYOUT_CTY_EXP_Hex_Section_AB_City_Center_Palace", "capital square layout");
expect(cap && /Palace/.test(cap[1][0]), "palace (not the city hall) in the capital's main slot: " + cap?.[1]?.[0]);
expect(O.tile(25, 25) === null, "wonder tile left to the engine");
expect(O.tile(23, 24) === null, "navigable-river tile left to the engine");
const harbour = O.tile(25, 24);
expect(harbour && harbour[0][0] === "LAYOUT_CTY_Coastal_2Shore", "harbour gets the pier piece");
const forest = O.tile(23, 25);
expect(forest && forest.some((p) => /_FOL$/.test(p[0])), "forest tile uses a _FOL house layout");
for (const k of ["24,27", "23,26", "24,26"]) {
  const [x, y] = k.split(",").map(Number), parts = O.tile(x, y), s = S.lookupAge(1, x, y, false), w = S.lookupAge(1, x, y, true);
  if (!parts || !s) { expect(false, `${k}: drawn and in the street table`); continue; }
  const street = parts.find((p) => /Road/.test(p[0]));
  expect(street[0] === (s.street === "B" ? "LAYOUT_CTY_Hex_Section_AB_B_Road_EXP" : "LAYOUT_CTY_Hex_Section_AB_Road_EXP") && street[3] === s.angle, `${k}: street ${s.street}${s.angle}`);
  const house = parts.find((p) => /^LAYOUT_CTY_EXP_Hex_Section_AB(_B)?(_VAR_A)?$/.test(p[0]));
  if (s.street === "A" && house) expect(house[0].endsWith("_VAR_A") === (w.street === "B"), `${k}: house variant follows the wooded bit (${w.street}) -> ${house[0]}`);
}
const empty = O.tile(23, 26);
expect(empty && empty.some((p) => /^Vacant_Hero_Building_Plot/.test(p[0])), "empty lots get the vacant-plot piece");
expect(O.tile(22, 25) === null, "Exploration farm left to the engine (same art as Antiquity)");

// Modern: Academics researched
TECHS.add("NODE_TECH_MO_ACADEMICS");
O.rebuild();
expect(O.personalAge(g.Players.get(0)) === 2, "Academics -> personal Age Modern");
const mcap = O.tile(24, 25);
expect(mcap && mcap[0][0] === "LAYOUT_CTY_MOD_Hex_Section_AB_City_Center_Palace", "Modern capital square layout");
const m = O.tile(24, 27), ms = S.lookupAge(2, 24, 27, false);
const mstreet = m && m.find((p) => /Road/.test(p[0]));
expect(mstreet && mstreet[0] === "LAYOUT_CTY_MOD_Section_AB_Road" && mstreet[3] === ms.angle, `Modern street turn from the Modern layer (${ms?.angle})`);
const farm = O.tile(22, 25);
expect(farm && farm.some((p) => p[0] === "BIN_IMP_MOD_Farm_A"), "Modern farm drawn");
console.log("overlay-tests.js (Modern):", g.CCOverlayTests.run());
expect(g.CCOverlayTests.failures().length === 0, "overlay-tests.js rules (Modern)");

console.log(`${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
