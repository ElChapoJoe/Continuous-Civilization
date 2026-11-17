// Checks of the overlay against the rules measured so far (debug console, any game with the prototype loaded; reads
// only). Every tile the overlay draws is checked; returns a summary, CCOverlayTests.failures() lists the failures.
//   CCOverlayTests.run()        -> "N checks, M failed (...)"
// Rules (see docs/visual-progression-investigation.md):
//   - personal Age: Modern if any of Academics/Steam Engine/Military Science, else Exploration if any of
//     Cartography/Astronomy/Machinery (round 1 onwards);
//   - urban tile: the street piece of the owner's Age, in the pattern and turn of CCStreetTable.lookupAge for that Age
//     when it is known and sure (rounds 58-60); Modern only street A;
//   - house layout: one the engine's own bin allows for that Age and pattern (round 63); Exploration pattern A on a
//     bare tile: the plain layout if the wooded-street bit is A, _VAR_A if B (round 65);
//   - capital: the palace layout and a palace model; other city centres: the centre layout;
//   - tiles with a wonder and navigable-river tiles are left to the engine.
(function () {
  const EX = ["NODE_TECH_EX_CARTOGRAPHY", "NODE_TECH_EX_ASTRONOMY", "NODE_TECH_EX_MACHINERY"];
  const MO = ["NODE_TECH_MO_ACADEMICS", "NODE_TECH_MO_STEAM_ENGINE", "NODE_TECH_MO_MILITARY_SCIENCE"];
  const STREET = { 1: { A: "LAYOUT_CTY_Hex_Section_AB_Road_EXP", B: "LAYOUT_CTY_Hex_Section_AB_B_Road_EXP" }, 2: { A: "LAYOUT_CTY_MOD_Section_AB_Road" } };
  const HOUSES = {
    1: { A: ["LAYOUT_CTY_EXP_Hex_Section_AB", "LAYOUT_CTY_EXP_Hex_Section_AB_VAR_A", "LAYOUT_CTY_EXP_Hex_Section_AB_Attatchment_Less", "LAYOUT_CTY_EXP_Hex_Section_AB_Attatchment_Less_FOL"],
      B: ["LAYOUT_CTY_EXP_Hex_Section_AB_B", "LAYOUT_CTY_EXP_Hex_Section_AB_B_VAR_A", "LAYOUT_CTY_EXP_Hex_Section_AB_B_Attachment_Less", "LAYOUT_CTY_EXP_Hex_Section_AB_B_Attachment_Less_FOL"] },
    2: { A: ["LAYOUT_CTY_MOD_Section_AB_Small_Packed", "LAYOUT_CTY_MOD_Section_AB_Small_Packed_FOL"] },
  };
  const WOODED = new Set(["FEATURE_FOREST", "FEATURE_SAGEBRUSH_STEPPE", "FEATURE_SAVANNA_WOODLAND", "FEATURE_TAIGA", "FEATURE_RAINFOREST"]);
  let fails = [], checks = 0;
  const check = (ok, what) => { checks++; if (!ok) fails.push(what); };
  const has = (p, list) => list.some((n) => { const h = GameInfo.ProgressionTreeNodes.lookup(n)?.$hash; return h !== undefined && p.Techs?.isNodeUnlocked(h); });
  const wooded = (x, y) => { const f = GameplayMap.getFeatureType(x, y); return f >= 0 && WOODED.has(GameInfo.Features.lookup(f)?.FeatureType); };
  const norm = (d) => ((Math.round(d) % 360) + 360) % 360;

  function run() {
    fails = []; checks = 0;
    const O = globalThis.CCVisualOverlay, T = globalThis.CCStreetTable;
    check(!!O, "CCVisualOverlay loaded");
    check(!!T && !!T.lookupAge, "CCStreetTable with lookupAge loaded");
    if (!O || !T) return summary();
    for (const id of Players.getAliveMajorIds()) {
      const p = Players.get(id);
      const want = has(p, MO) ? 2 : has(p, EX) ? 1 : 0;
      check(O.personalAge(p) === want, `player ${id}: personal Age ${O.personalAge(p)}, techs say ${want}`);
      if (!want) continue;
      for (const city of p.Cities.getCities()) for (const i of city.getPurchasedPlots()) {
        const l = GameplayMap.getLocationFromIndex(i), k = l.x + "," + l.y;
        const d = Districts.getAtLocation(l);
        if (!d || GameplayMap.getRevealedState(GameContext.localPlayerID, l.x, l.y) === RevealedStates.HIDDEN) continue;
        const parts = O.tile(l.x, l.y);
        const items = MapConstructibles.getConstructibles(l.x, l.y).map((c) => GameInfo.Constructibles.lookup(Constructibles.getByComponentID(c)?.type));
        if (items.some((c) => c?.ConstructibleClass === "WONDER") || GameplayMap.isNavigableRiver(l.x, l.y)) {
          if (d.type !== DistrictTypes.RURAL) check(!parts, `${k}: wonder or navigable river tile left to the engine`);
          continue;
        }
        if (d.type === DistrictTypes.CITY_CENTER) {
          check(!!parts, `${k}: city centre drawn`);
          if (!parts) continue;
          const capital = items.some((c) => c?.ConstructibleType === "BUILDING_PALACE");
          check(capital ? /Palace/.test(parts[0][0]) : /City_Center/.test(parts[0][0]), `${k}: centre layout ${parts[0][0]} (capital ${capital})`);
          if (capital) check(/Palace/i.test(parts[1]?.[0] || ""), `${k}: palace in the main slot, got ${parts[1]?.[0]}`);
          continue;
        }
        if (d.type !== DistrictTypes.URBAN || GameplayMap.isWater(l.x, l.y)) continue;
        check(!!parts, `${k}: urban tile drawn`);
        if (!parts) continue;
        const street = parts.find((q) => /Road/.test(q[0]));
        const s = T.lookupAge(want, l.x, l.y, wooded(l.x, l.y));
        check(!!street, `${k}: has a street piece`);
        if (street && s && s.sure && STREET[want][s.street]) {
          check(street[0] === STREET[want][s.street], `${k}: street ${street[0]}, table says ${s.street}`);
          check(norm(street[3]) === norm(s.angle), `${k}: street turn ${street[3]}, table says ${s.angle}`);
        }
        const pattern = street && street[0] === STREET[want].B ? "B" : "A";
        const house = parts.find((q) => /^LAYOUT_CTY_(EXP|MOD)_/.test(q[0]) && !/Road|Wedge/.test(q[0]));
        if (house) {
          check(HOUSES[want][pattern].includes(house[0]), `${k}: house layout ${house[0]} not allowed for pattern ${pattern}`);
          if (want === 1 && pattern === "A" && !wooded(l.x, l.y) && /Section_AB(_VAR_A)?$/.test(house[0])) {
            const w = T.lookupAge(1, l.x, l.y, true);
            if (w) check(house[0].endsWith("_VAR_A") === (w.street === "B"), `${k}: house variant ${house[0]}, wooded bit ${w.street}`);
          }
        } // no whole layout: drawn slot by slot next to a cliff, water or mountain
        check(parts.every((q) => typeof q[0] === "string" && q[0] && q[2] > 0), `${k}: every part has a model and a scale`);
      }
    }
    return summary();
  }
  function summary() {
    const byKind = {};
    for (const f of fails) { const kind = f.replace(/^[0-9,]+: /, "").replace(/[0-9A-Z_]{6,}/g, "*").slice(0, 40); byKind[kind] = (byKind[kind] || 0) + 1; }
    return `${checks} checks, ${fails.length} failed` + (fails.length ? " " + JSON.stringify(byKind) : "");
  }
  globalThis.CCOverlayTests = { run, failures: () => fails.slice() };
  return "CCOverlayTests ready";
})();
