// Candidates for tools/pipeline/probe.mjs: which Modern rural model and turn the engine draws per tile (round 66).
// Use on a vanilla Modern game prepared with tools/game/rural-map.js (load that file before this one, or the save made
// after CCRural.run()). Per tile 18 candidates: farms A/B/C (BIN_IMP_MOD_Farm_A..C) at six turns; the single-model
// improvements (mine, woodcutter, clay pit, quarry) at six turns and nothing for the other twelve.
(function () {
  const ANGLES = [0, 60, 120, 180, 240, 300];
  const SINGLE = { IMPROVEMENT_MINE: "IMP_Mine_MOD", IMPROVEMENT_WOODCUTTER: "IMP_MOD_WoodCutter",
    IMPROVEMENT_CLAY_PIT: "BIN_IMP_MOD_Claypit_Base", IMPROVEMENT_QUARRY: "IMP_MOD_Quarry" };
  const FARMS = ["BIN_IMP_MOD_Farm_A", "BIN_IMP_MOD_Farm_B", "BIN_IMP_MOD_Farm_C"];
  const typeAt = (x, y) => {
    for (const id of MapConstructibles.getConstructibles(x, y)) {
      const t = GameInfo.Constructibles.lookup(Constructibles.getByComponentID(id)?.type)?.ConstructibleType;
      if (t) return t;
    }
    return null;
  };
  globalThis.CCProbeRural = true;   // street-probe.js: probe rural tiles
  globalThis.CCProbeViews = (h, dx, dy) => CCRural.views(h, dx, dy);
  globalThis.CCProbeCands = {
    n: 18,
    labels: [...FARMS.flatMap((f) => ANGLES.map((a) => `${f.slice(-1)}@${a}`))],   // single models use the first six
    of: (t) => {
      const type = typeAt(t.x, t.y);
      if (type === "IMPROVEMENT_FARM") return FARMS.flatMap((m) => ANGLES.map((a) => [m, a]));
      const m = SINGLE[type];
      return m ? [...ANGLES.map((a) => [m, a]), ...Array(12).fill(null)] : null;
    },
  };
  return "rural candidates ready (" + CCRural.tiles().length + " rural tiles)";
})();
