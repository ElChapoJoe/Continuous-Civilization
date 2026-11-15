// Continuous Civilization - Phase 2 acceptance checks.
// Run through FireTuner MCP:  execute_js_file("tests/cc-tests.js")  then call e.g.  JSON.stringify(CC.db())
// Every check returns {pass:boolean, ...details}. Nothing here mutates game state except CC.grant().
(function () {
  const A = (t) => { const o = []; for (const x of t) o.push(x); return o; };
  const node = (n) => GameInfo.ProgressionTreeNodes.lookup(n);
  const nodeName = (h) => GameInfo.ProgressionTreeNodes.lookup(h)?.ProgressionTreeNodeType;
  const unitName = (h) => GameInfo.Units.lookup(h)?.UnitType;
  const conName = (h) => GameInfo.Constructibles.lookup(h)?.ConstructibleType;
  const isEX = (s) => /_EX_/.test(s || "");

  // Exploration content = anything unlocked by an NODE_TECH_EX_* node.
  function exUnlocks(kind) {
    return A(GameInfo.ProgressionTreeNodeUnlocks)
      .filter((u) => isEX(u.ProgressionTreeNodeType) && u.TargetKind === kind)
      .map((u) => ({ node: u.ProgressionTreeNodeType, target: u.TargetType, trait: u.RequiredTraitType || null, depth: u.UnlockDepth }));
  }

  const CC = {};

  // ---------- static database checks (run once per new game) ----------
  CC.db = function () {
    const r = { checks: {} };
    const nodes = A(GameInfo.ProgressionTreeNodes).filter((n) => /^NODE_TECH_/.test(n.ProgressionTreeNodeType));
    const byTree = {}; nodes.forEach((n) => (byTree[n.ProgressionTree] = (byTree[n.ProgressionTree] || 0) + 1));
    const ex = nodes.filter((n) => isEX(n.ProgressionTreeNodeType));
    const prereqs = A(GameInfo.ProgressionTreePrereqs);
    r.checks.oneTree = { pass: !byTree.TREE_TECHS_EX && ex.every((n) => n.ProgressionTree === "TREE_TECHS_AQ"), byTree, exCount: ex.length };
    r.checks.aqFutureTechRemoved = { pass: !node("NODE_TECH_AQ_FUTURE_TECH") };
    // Phase 3.1: Modern's Future Tech is the end of the merged tree (Exploration's is removed in 21).
    const exf = node("NODE_TECH_MO_FUTURE_TECH");
    const exfPre = prereqs.filter((p) => p.Node === "NODE_TECH_MO_FUTURE_TECH").map((p) => p.PrereqNode);
    r.checks.futureTechAtEnd = { pass: !!exf && exf.Repeatable && exf.ProgressionTree === "TREE_TECHS_AQ" && exfPre.includes("NODE_TECH_MO_ROCKETRY") &&
      exfPre.includes("NODE_TECH_MO_NUCLEAR_FISSION") && !prereqs.some((p) => p.PrereqNode === "NODE_TECH_MO_FUTURE_TECH") && !node("NODE_TECH_EX_FUTURE_TECH"), prereqs: exfPre };
    const roots = { NODE_TECH_EX_CARTOGRAPHY: "NODE_TECH_AQ_NAVIGATION", NODE_TECH_EX_ASTRONOMY: "NODE_TECH_AQ_MATHEMATICS", NODE_TECH_EX_MACHINERY: "NODE_TECH_AQ_MILITARY_TRAINING" };
    r.checks.rootsLinked = { pass: Object.entries(roots).every(([n, p]) => prereqs.some((x) => x.Node === n && x.PrereqNode === p)) };
    r.checks.everyExNodeHasPrereq = { pass: ex.every((n) => prereqs.some((p) => p.Node === n.ProgressionTreeNodeType)) };
    // prereq graph acyclic + every node reachable from Agriculture
    const kids = {}; prereqs.forEach((p) => (kids[p.PrereqNode] = (kids[p.PrereqNode] || []).concat(p.Node)));
    const seen = new Set(["NODE_TECH_AQ_AGRICULTURE"]); const q = ["NODE_TECH_AQ_AGRICULTURE"];
    while (q.length) for (const k of kids[q.shift()] || []) if (!seen.has(k)) { seen.add(k); q.push(k); }
    const unreachable = nodes.filter((n) => n.ProgressionTree === "TREE_TECHS_AQ" && !seen.has(n.ProgressionTreeNodeType)).map((n) => n.ProgressionTreeNodeType);
    r.checks.allReachable = { pass: unreachable.length === 0, unreachable };

    const ap = A(GameInfo.AgeProgressions);
    r.checks.ageClock = { pass: ap.length > 0 && ap.every((a) => !a.EndsAge && a.MaxPoints_Standard >= 1000000),
      rows: ap.map((a) => [a.AgeProgressionType, a.EndsAge, a.MaxPoints_Standard]),
      eventPoints: A(GameInfo.AgeProgressionEvents).reduce((s, e) => s + e.Points, 0) };

    // every imported trainable unit / freely-buildable constructible must have a tech gate
    const gatedTargets = new Set(A(GameInfo.ProgressionTreeNodeUnlocks).filter((u) => /^NODE_TECH_/.test(u.ProgressionTreeNodeType)).map((u) => u.TargetType));
    const exUnitTypes = new Set(exUnlocks("KIND_UNIT").map((u) => u.target));
    const exUnits = A(GameInfo.Units).filter((u) => exUnitTypes.has(u.UnitType) || /^UNIT_(SWORDSMAN|HEAVY_ARCHER|COURSER|CATAPULT|COG)$/.test(u.UnitType));
    r.checks.ageStartUnitsGated = { pass: ["UNIT_SWORDSMAN", "UNIT_HEAVY_ARCHER", "UNIT_COURSER", "UNIT_CATAPULT", "UNIT_COG"].every((u) => gatedTargets.has(u)) };
    // the Exploration (non-unique) buildings + civic-unlocked wonders; each must be unlocked by an EX tech
    const EX_BUILDINGS = ["BUILDING_UNIVERSITY", "BUILDING_BANK", "BUILDING_TEMPLE", "BUILDING_BAZAAR", "BUILDING_GUILDHALL", "BUILDING_KILN", "BUILDING_TAVERN",
      "BUILDING_ARMORER", "BUILDING_DUNGEON", "BUILDING_OBSERVATORY", "BUILDING_WHARF", "BUILDING_SHIPYARD", "BUILDING_HOSPITAL", "BUILDING_PAVILION",
      "BUILDING_MENAGERIE", "BUILDING_GRISTMILL", "BUILDING_SAWMILL", "BUILDING_MEDIEVAL_WALLS", "BUILDING_MEDIEVAL_BRIDGE",
      "WONDER_NOTRE_DAME", "WONDER_EL_ESCORIAL", "WONDER_WHITE_TOWER", "WONDER_HOUSE_OF_WISDOM", "WONDER_BOROBUDUR", "WONDER_BRIHADEESWARAR_TEMPLE",
      "WONDER_ERDENE_ZUU", "WONDER_HALE_O_KEAWE", "WONDER_TOMB_OF_ASKIA", "WONDER_MACHU_PIKCHU", "WONDER_FORBIDDEN_CITY", "WONDER_SHWEDAGON_ZEDI_DAW"];
    const exTechTargets = new Set(exUnlocks("KIND_CONSTRUCTIBLE").map((u) => u.target));
    const ungatedEx = EX_BUILDINGS.filter((b) => !exTechTargets.has(b)).map((b) => ({ ConstructibleType: b }));
    r.checks.exBuildingsGated = { pass: ungatedEx.length === 0, ungated: ungatedEx.map((c) => c.ConstructibleType) };
    const exCon = A(GameInfo.Constructibles).filter((c) => c.Age === "AGE_EXPLORATION");
    r.checks.noBuildingLeftInExplorationAge = { pass: exCon.every((c) => !gatedTargets.has(c.ConstructibleType)), remainingExAgeTagged: exCon.map((c) => c.ConstructibleType) };
    const ups = A(GameInfo.UnitUpgrades);
    r.checks.upgradeLineage = { pass: [["UNIT_PHALANX", "UNIT_SWORDSMAN"], ["UNIT_ARCHER", "UNIT_HEAVY_ARCHER"], ["UNIT_HORSEMAN", "UNIT_COURSER"], ["UNIT_BALLISTA", "UNIT_CATAPULT"], ["UNIT_QUADRIREME", "UNIT_COG"]]
      .every(([a, b]) => ups.some((u) => u.Unit === a && u.UpgradeUnit === b)) };
    const wy = A(GameInfo.WorkerYields).map((w) => w.YieldType + "=" + w.Amount);
    const palace = A(GameInfo.Constructible_YieldChanges).filter((c) => c.ConstructibleType === "BUILDING_PALACE").map((c) => c.YieldType + "=" + c.YieldChange);
    const wya = A(GameInfo.WorkerYields_AgeModifier).map((w) => w.YieldType + "=" + w.Amount);
    // Antiquity values (age-antiquity/data/constructibles-no-persist.xml): workers F-1 H-1 S0 C0, age modifier F-1 H-1, Palace 5/5/5
    r.checks.antiquityGlobalsKept = {
      pass: ["YIELD_FOOD=-1", "YIELD_HAPPINESS=-1", "YIELD_SCIENCE=0", "YIELD_CULTURE=0"].every((x) => wy.includes(x)) &&
            ["YIELD_FOOD=-1", "YIELD_HAPPINESS=-1"].every((x) => wya.includes(x)) && wya.length === 2 &&
            ["YIELD_FOOD=5", "YIELD_PRODUCTION=5", "YIELD_HAPPINESS=5"].every((x) => palace.includes(x)),
      workerYields: wy, workerAgeModifier: wya, palace };
    r.checks.noLeftoverWorkTables = { pass: !Object.keys(GameInfo).some((k) => /^cc_/.test(k)) };
    r.counts = { techNodes: nodes.length, units: A(GameInfo.Units).length, exUnits: exUnits.length, constructibles: A(GameInfo.Constructibles).length,
      exUnitUnlocks: exUnlocks("KIND_UNIT").length, exConstructibleUnlocks: exUnlocks("KIND_CONSTRUCTIBLE").length };
    r.pass = Object.values(r.checks).every((c) => c.pass);
    return r;
  };

  // ---------- gating check for one player: nothing trainable/buildable before its tech ----------
  CC.gating = function (pid) {
    const p = Players.get(pid); const out = { pid, violations: [], trainable: [], buildable: [] };
    const city = p.Cities.getCities()[0]; if (!city) return { pid, pass: null, note: "no city" };
    // Node state works for techs and civics alike (Techs.isNodeUnlocked is false for every civic, e.g. Piety).
    const researched = (n) => Game.ProgressionTrees.getNodeState(pid, node(n).$hash) >= 4;
    for (const u of exUnlocks("KIND_UNIT")) {
      const d = GameInfo.Units.lookup(u.target); if (!d) continue;
      const ok = Game.CityOperations.canStart(city.id, CityOperationTypes.BUILD, { UnitType: d.$index }, false)?.Success;
      if (ok) { out.trainable.push(u.target); if (!researched(u.node)) out.violations.push(u.target + " before " + u.node); }
    }
    for (const c of exUnlocks("KIND_CONSTRUCTIBLE")) {
      const d = GameInfo.Constructibles.lookup(c.target); if (!d) continue;
      const ok = Game.CityOperations.canStart(city.id, CityOperationTypes.BUILD, { ConstructibleType: d.$index }, false)?.Success;
      if (ok) { out.buildable.push(c.target); if (!researched(c.node)) out.violations.push(c.target + " before " + c.node); }
    }
    out.pass = out.violations.length === 0;
    return out;
  };

  // ---------- game-wide status snapshot (for the long autoplay run) ----------
  CC.status = function () {
    const exUnitSet = new Set(exUnlocks("KIND_UNIT").map((u) => u.target));
    const exConSet = new Set(exUnlocks("KIND_CONSTRUCTIBLE").map((u) => u.target));
    const s = { turn: Game.turn, age: GameInfo.Ages.lookup(Game.age)?.AgeType,
      progress: [Game.AgeProgressManager.getCurrentAgeProgressionPoints(), Game.AgeProgressManager.getMaxAgeProgressionPoints()],
      isAgeOver: Game.AgeProgressManager.isAgeOver, countdown: Game.AgeProgressManager.ageCountdownStarted, players: {} };
    for (const id of Players.getAliveMajorIds()) {
      // getResearched() returns every node with a state; >= NODE_STATE_UNLOCKED (4) means actually researched
      const p = Players.get(id); const res = p.Techs.getResearched().filter((h) => (h?.state ?? 5) >= 4).map((h) => nodeName(h?.type ?? h));
      const exUnits = p.Units.getUnits().map((u) => unitName(u.type)).filter((n) => exUnitSet.has(n));
      const exBuilt = [];
      for (const c of p.Cities.getCities()) {
        let ids = []; try { ids = c.Constructibles.getIds(); } catch (e) {}
        for (const cid of ids) { const k = Constructibles.getByComponentID(cid); const n = conName(k?.type); if (exConSet.has(n)) exBuilt.push(n); }
      }
      const cur = p.Techs.getResearching?.();
      s.players[id] = { civ: GameInfo.Civilizations.lookup(p.civilizationType)?.CivilizationType, cities: p.Cities.getCities().length,
        techs: res.length, exTechs: res.filter(isEX), researching: nodeName(cur?.type ?? cur), exUnits, exBuilt };
    }
    return s;
  };

  // ---------- compact per-player snapshot for long runs (techs, civics, government, yields) ----------
  CC.long = function () {
    const civics = A(GameInfo.ProgressionTreeNodes).filter((n) => n.ProgressionTreeNodeType.startsWith("NODE_CIVIC_EX_MAIN_"));
    const st = CC.status();
    const out = { turn: Game.turn, players: {} };
    for (const id of Players.getAliveMajorIds()) {
      const p = Players.get(id); const s = st.players[id];
      const y = (t) => Math.round(p.Stats.getNetYield(YieldTypes[t]) || 0);
      out.players[id] = {
        civ: (s.civ || "").replace("CIVILIZATION_", ""), cities: s.cities, gov: (CC.gov(id) + "").replace("GOVERNMENT_", ""),
        techs: s.techs, exTechs: s.exTechs.length, exCivics: civics.filter((n) => p.Culture.isNodeUnlocked(n.$hash)).length,
        sci: y("YIELD_SCIENCE"), cul: y("YIELD_CULTURE"), gold: y("YIELD_GOLD"), prod: y("YIELD_PRODUCTION"),
        exUnits: s.exUnits.length, exBuilt: s.exBuilt.length
      };
    }
    return out;
  };

  // ---------- map resources (data/60-resources.sql, data/65-modern-resources.sql) ----------
  const EX_ONLY = ["RESOURCE_CLOVES", "RESOURCE_COCOA", "RESOURCE_FURS", "RESOURCE_NITER", "RESOURCE_PITCH",
    "RESOURCE_SPICES", "RESOURCE_SUGAR", "RESOURCE_TEA", "RESOURCE_TRUFFLES", "RESOURCE_WHALES"];
  const MODERN_ONLY = ["RESOURCE_COAL", "RESOURCE_OIL", "RESOURCE_RUBBER", "RESOURCE_NICKEL", "RESOURCE_COFFEE",
    "RESOURCE_TOBACCO", "RESOURCE_CITRUS", "RESOURCE_QUININE"];
  CC.mapCounts = function () {
    const c = {}, w = GameplayMap.getGridWidth(), h = GameplayMap.getGridHeight();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      // The mod's UI script hides locked Modern resources from getResourceType; count the real map.
      const r = (GameplayMap.__ccOriginalGetResourceType ?? GameplayMap.getResourceType).call(GameplayMap, x, y);
      if (r !== ResourceTypes.NO_RESOURCE) { const n = GameInfo.Resources.lookup(r)?.ResourceType; c[n] = (c[n] || 0) + 1; }
    }
    return c;
  };
  CC.resources = function () {
    const r = { checks: {} };
    const valid = new Set(A(GameInfo.Resource_ValidAges).filter((v) => v.AgeType === "AGE_ANTIQUITY").map((v) => v.ResourceType));
    r.checks.exValidInAntiquity = { pass: EX_ONLY.every((x) => valid.has(x)), missing: EX_ONLY.filter((x) => !valid.has(x)) };
    // Modern resources spawn at map start (inactive until their tech).
    r.checks.modernValidInAntiquity = { pass: MODERN_ONLY.every((x) => valid.has(x)), missing: MODERN_ONLY.filter((x) => !valid.has(x)) };
    r.checks.modernBaseYieldsGated = { pass: !A(GameInfo.Resource_YieldChanges).some((y) => MODERN_ONLY.includes(y.ResourceType)) };
    const dist = A(GameInfo.Resource_Distribution).find((d) => d.AgeType === "AGE_ANTIQUITY");
    r.checks.typeCapRaised = { pass: dist?.MaxResourceTypes >= 25 + EX_ONLY.length + MODERN_ONLY.length, max: dist?.MaxResourceTypes };
    const gm = new Set(A(GameInfo.GameModifiers).map((g) => g.ModifierId));
    const args = A(GameInfo.ModifierArguments);
    const resOf = (id) => args.find((a) => a.ModifierId === id && a.Name === "ResourceType")?.Value;
    // Antiquity keeps its own version of shared effects (Exploration's Cotton is +3 Food, Antiquity's +2).
    const cotton = args.find((a) => a.ModifierId === "MOD_COTTON_CITY_FLAT_FOOD" && a.Name === "Amount")?.Value;
    r.checks.antiquityEffectsKept = { pass: String(cotton) === "2" && !GameInfo.Modifiers.lookup("MOD_MARBLE_DESERT_WONDER_PRODUCTION"), cottonFood: cotton };
    const tip = Locale.compose("LOC_EXP_RESOURCE_SPICES_TOOLTIP");
    r.checks.exTooltips = { pass: !/next age/i.test(tip) && /Inactive until you research Cartography/.test(tip), spices: tip.slice(0, 80) };
    r.checks.antTooltipsKept = { pass: /2\[icon:YIELD_FOOD\]/.test(Locale.compose("LOC_ANT_RESOURCE_COTTON_TOOLTIP")) };
    // Each Modern resource: tech-gated wrappers (CC_GATE_*) for its base yields and Modern effects.
    const gates = {};
    for (const id of gm) {
      if (!id.startsWith("CC_GATE_")) continue;
      const inner = args.find((a) => a.ModifierId === id && a.Name === "ModifierId")?.Value;
      const res = resOf(inner) || GameInfo.Modifiers.lookup(inner)?.SubjectRequirementSetId?.replace("CC_REQSET_PLOT_", "");
      gates[res] = (gates[res] || 0) + 1;
    }
    r.checks.modernGated = { pass: MODERN_ONLY.every((x) => gates[x] > 0), gates };
    // Exploration resources are gated the same way (their effects are no longer game-wide).
    const resArg = new Map(args.filter((a) => a.Name === "ResourceType").map((a) => [a.ModifierId, a.Value]));
    const ungated = [...gm].filter((id) => !id.startsWith("CC_") && EX_ONLY.includes(resArg.get(id)));
    r.checks.exGated = { pass: EX_ONLY.every((x) => gates[x] > 0) && ungated.length === 0, ungated };
    r.checks.exBaseYieldsGated = { pass: !A(GameInfo.Resource_YieldChanges).some((y) => EX_ONLY.includes(y.ResourceType)) };
    r.checks.modernTooltips = { pass: /Inactive until you research Steam Engine/.test(Locale.compose("LOC_MOD_RESOURCE_COAL_TOOLTIP")) && /Inactive until you research Combustion/.test(Locale.compose("LOC_MOD_RESOURCE_OIL_TOOLTIP")) };
    r.checks.iconsHidden = { pass: typeof GameplayMap.__ccOriginalGetResourceType === "function" };
    const counts = CC.mapCounts();
    r.onMap = { exploration: EX_ONLY.filter((x) => counts[x]).map((x) => x + ":" + counts[x]), modern: MODERN_ONLY.filter((x) => counts[x]).map((x) => x + ":" + counts[x]) };
    r.pass = Object.values(r.checks).every((c) => c.pass);
    return r;
  };

  // Civics and governments (25-civic-tree.sql, 35-governments.sql, ui/cc-governments.js).
  CC.civics = function () {
    const r = { checks: {} };
    const nodes = A(GameInfo.ProgressionTreeNodes);
    const exMain = nodes.filter((n) => n.ProgressionTreeNodeType.startsWith("NODE_CIVIC_EX_MAIN_"));
    r.checks.exCivicsGrafted = { pass: exMain.length >= 12 && exMain.every((n) => n.ProgressionTree === "TREE_CIVICS_AQ_MAIN"), count: exMain.length };
    const pre = A(GameInfo.ProgressionTreePrereqs);
    const hasPre = (n, p) => pre.some((x) => x.Node === n && x.PrereqNode === p);
    r.checks.rootsLinked = { pass: hasPre("NODE_CIVIC_EX_MAIN_ECONOMICS", "NODE_CIVIC_AQ_MAIN_COMMERCE") && hasPre("NODE_CIVIC_EX_MAIN_PIETY", "NODE_CIVIC_AQ_MAIN_PHILOSOPHY") };
    r.checks.noAqFutureCivic = { pass: !node("NODE_CIVIC_AQ_MAIN_FUTURE_CIVIC") };
    r.checks.theologyBranch = { pass: nodes.filter((n) => n.ProgressionTree === "TREE_CIVICS_EX_BRANCH_THEOLOGY").length === 2 };
    // Religion (Exploration gamecapabilities / religion / greatworks).
    r.checks.foundReligions = { pass: A(GameInfo.GameCapabilities).some((c) => c.GameCapability === "CAPABILITY_FOUND_RELIGIONS") && A(GameInfo.GameCapabilities).some((c) => c.GameCapability === "CAPABILITY_FOUND_PANTHEONS") };
    r.checks.beliefs = { pass: A(GameInfo.BeliefClasses).length >= 3, classes: A(GameInfo.BeliefClasses).map((b) => b.BeliefClassType) };
    r.checks.relics = { pass: A(GameInfo.GreatWorks).some((g) => /RELIC/.test(g.GreatWorkObjectType || g.GreatWorkType)) };
    const unl = A(GameInfo.ProgressionTreeNodeUnlocks);
    r.checks.templeAtPiety = { pass: unl.some((u) => u.ProgressionTreeNodeType === "NODE_CIVIC_EX_MAIN_PIETY" && u.TargetType === "BUILDING_TEMPLE") && !unl.some((u) => u.TargetType === "BUILDING_TEMPLE" && /^NODE_TECH/.test(u.ProgressionTreeNodeType)) };
    r.checks.civicNames = { pass: Locale.compose(node("NODE_CIVIC_EX_MAIN_ECONOMICS").Name) !== node("NODE_CIVIC_EX_MAIN_ECONOMICS").Name };
    const govs = ["GOVERNMENT_FEUDAL_MONARCHY", "GOVERNMENT_PLUTOCRACY", "GOVERNMENT_THEOCRACY"];
    r.checks.exGovernments = { pass: govs.every((g) => GameInfo.Governments.lookup(g)), missing: govs.filter((g) => !GameInfo.Governments.lookup(g)) };
    const startDb = [];
    for (const row of (GameInfo.StartingGovernments.__ccBaseIterator ?? GameInfo.StartingGovernments[Symbol.iterator]).call(GameInfo.StartingGovernments)) startDb.push(row.GovernmentType);
    r.checks.exNotStarting = { pass: !govs.some((g) => startDb.includes(g)), starting: startDb };
    r.checks.unlockSets = { pass: govs.every((g) => GameInfo.RequirementSets.lookup("CC_GOVUNLOCK_" + g)) };
    r.checks.celebrations = { pass: govs.every((g) => A(GameInfo.Government_ValidGoldenAges).some((v) => v.GovernmentType === g)) };
    r.checks.uiScript = { pass: typeof GameInfo.StartingGovernments.__ccBaseIterator === "function" };
    // AI switch / revert modifiers survive the merge (60-resources.sql must not sweep them up).
    const aiMods = A(GameInfo.GameModifiers).map((g) => g.ModifierId).filter((id) => /^CC_AI_GOVRULE_/.test(id));
    r.checks.aiGovModifiers = { pass: aiMods.length >= 9 && aiMods.every((id) => GameInfo.Modifiers.lookup(id) && GameInfo.Modifiers.lookup(id).SubjectRequirementSetId && GameInfo.RequirementSets.lookup(GameInfo.Modifiers.lookup(id).SubjectRequirementSetId)), count: aiMods.length };
    r.pass = Object.values(r.checks).every((c) => c.pass);
    return r;
  };
  // Personal Age (70-personal-age.sql): Age conditions rewritten to "player is in their Exploration".
  CC.personalAge = function () {
    const r = { checks: {} };
    const q = (id) => GameInfo.Requirements.lookup(id);
    const arg = (id, n) => A(GameInfo.RequirementArguments).find((a) => a.RequirementId === id && a.Name === n)?.Value;
    const left = A(GameInfo.Requirements).filter((x) => (x.RequirementType === "REQUIREMENT_GAME_AGE_TYPE_MATCH" || x.RequirementType === "REQUIREMENT_IS_AGE_COUNT")
      && !/CHALLENGE|TRIUMPH|^METAPROGRESSION/.test(x.RequirementId)
      && ["AGE_ANTIQUITY", "AGE_EXPLORATION", "AGE_MODERN", "1", "2"].includes(arg(x.RequirementId, "AgeType") ?? arg(x.RequirementId, "AgeCount")));
    r.checks.noneLeft = { pass: left.length === 0, left: left.map((x) => x.RequirementId) };
    const tt = q("TRUNG_TRAC_MOD_TRUNG_NHI_SUBJECT_REQUIREMENTS_2");
    r.checks.trungTracRewritten = { pass: !tt || (tt.RequirementType === "REQUIREMENT_REQUIREMENTSET_IS_MET" && arg(tt.RequirementId, "RequirementSetId") === "CC_REQSET_PERSONAL_AGE_EXPLORATION") };
    const ant = q("REQ_AGE_IS_ANTIQUITY");
    r.checks.antiquityFlipped = { pass: !ant || (ant.RequirementType === "REQUIREMENT_REQUIREMENTSET_IS_MET" && !!ant.Inverse) };
    const roots = ["NODE_TECH_EX_CARTOGRAPHY", "NODE_TECH_EX_ASTRONOMY", "NODE_TECH_EX_MACHINERY"].map((n) => node(n).$hash);
    const expected = Players.getAliveMajorIds().filter((id) => roots.some((h) => Players.get(id).Techs.isNodeUnlocked(h)));
    const subjects = (Game.Modifiers.getModifierSubjects(Game.getHash("CC_TEST_IN_EXPLORATION")) || []).map((s) => s.owner).sort();
    r.checks.inExploration = { pass: JSON.stringify(subjects) === JSON.stringify(expected.sort()), subjects, expected };
    // Phase 3.3: personal Modern Age.
    const moRoots = ["NODE_TECH_MO_ACADEMICS", "NODE_TECH_MO_STEAM_ENGINE", "NODE_TECH_MO_MILITARY_SCIENCE"].map((n) => node(n).$hash);
    const moExpected = Players.getAliveMajorIds().filter((id) => moRoots.some((h) => Players.get(id).Techs.isNodeUnlocked(h))).sort();
    const moSubjects = (Game.Modifiers.getModifierSubjects(Game.getHash("CC_TEST_IN_MODERN")) || []).map((s) => s.owner).sort();
    r.checks.inModern = { pass: JSON.stringify(moSubjects) === JSON.stringify(moExpected), subjects: moSubjects, expected: moExpected };
    const exOnly = A(GameInfo.RequirementArguments).filter((a) => a.Name === "RequirementSetId" && a.Value === "CC_REQSET_PERSONAL_AGE_EXPLORATION_ONLY").length;
    const moRw = A(GameInfo.RequirementArguments).filter((a) => a.Name === "RequirementSetId" && a.Value === "CC_REQSET_PERSONAL_AGE_MODERN" && !a.RequirementId.startsWith("CC_")).length;
    // Modern conditions loaded so far sat in advanced-start modifiers (replaced); count only (noneLeft covers misses).
    r.checks.modernRewrites = { pass: exOnly > 0, explorationOnly: exOnly, modern: moRw };
    r.pass = Object.values(r.checks).every((c) => c.pass);
    return r;
  };
  // Modern Age rules (74-modern-rules.sql) and Exploration rules ending at Modern (72).
  CC.modernRules = function () {
    const r = { checks: {} };
    const gm = A(GameInfo.GameModifiers).map((g) => g.ModifierId);
    const wr = gm.filter((id) => id.startsWith("CC_MORULE_"));
    r.checks.wrappers = { pass: wr.length >= 12, count: wr.length, missing: wr.filter((id) => !GameInfo.Modifiers.lookup(id.slice(10))).map((id) => id.slice(10)) };
    const capArg = (id) => A(GameInfo.ModifierArguments).find((a) => a.ModifierId === id && a.Name === "Amount")?.Value;
    r.checks.settlementCaps = { pass: capArg("CC_EX_SETTLEMENT_CAP") === "8" && capArg("CC_MO_SETTLEMENT_CAP") === "16" && gm.includes("CC_EXRULE_CC_EX_SETTLEMENT_CAP") && gm.includes("CC_MORULE_CC_MO_SETTLEMENT_CAP"), antiquity: capArg("TRAIT_INITIAL_SETTLEMENT_CAP") };
    const exRules = gm.filter((id) => id.startsWith("CC_EXRULE_")).map((id) => id.slice(10));
    // Rules that carry on into Modern on purpose: the Economic trackers, and the per-Age steps that Modern adds to.
    const gdp = (id) => /_GDP$/.test(id) || /^CC_EX_(TRADE_RANGE_|EMBARKED_STRENGTH|GROWTH|WORKER_CAP|TOWN_UPGRADE)/.test(id) || /^EX_HANDICAP_.*_WALLS$/.test(id);
    const ending = exRules.filter((id) => !gdp(id)).map((id) => GameInfo.Modifiers.lookup(id));
    const notEnding = ending.filter((m) => m && m.SubjectRequirementSetId !== "CC_REQSET_NOT_IN_MODERN" && !(m.SubjectRequirementSetId || "").startsWith("CC_REQSET_EXRULE_")).map((m) => m.ModifierId + ":" + m.SubjectRequirementSetId);
    r.checks.explorationRulesEndAtModern = { pass: notEnding.length === 0, notEnding };
    r.checks.gdpCarriesOn = { pass: exRules.filter(gdp).every((id) => !/^CC_REQSET_(NOT_IN_MODERN|EXRULE_)/.test(GameInfo.Modifiers.lookup(id)?.SubjectRequirementSetId || "")) };
    const inMo = (Game.Modifiers.getModifierSubjects(Game.getHash("CC_TEST_IN_MODERN")) || []).map((s) => s.owner).sort();
    const yieldsMo = (Game.Modifiers.getModifierSubjects(Game.getHash("CC_MORULE_TRAIT_MOD_DEFAULT_YIELD_30")) || []).map((s) => s.owner).sort();
    r.checks.rulesFollowPersonalAge = { pass: JSON.stringify(yieldsMo) === JSON.stringify(inMo), yieldsMo, inMo };
    r.pass = Object.values(r.checks).every((c) => c.pass);
    return r;
  };
  // Batch A (36-batch-a.sql): great people, projects, city-states, AI lists; cascade restore (06).
  CC.batchA = function () {
    const r = { checks: {} };
    const ind = A(GameInfo.Independents);
    r.checks.cityStatesBothAges = { pass: ind.some((i) => /EXPLORATION/.test(i.IndependentType)) && ind.filter((i) => !/EXPLORATION/.test(i.IndependentType)).length >= 20,
      exploration: ind.filter((i) => /EXPLORATION/.test(i.IndependentType)).length, other: ind.filter((i) => !/EXPLORATION/.test(i.IndependentType)).length };
    const gp = A(GameInfo.GreatPersonIndividuals);
    r.checks.greatPeopleRetagged = { pass: gp.some((g) => /ALIM|CONQUISTADOR/.test(g.GreatPersonClassType)) && !gp.some((g) => g.AgeType === "AGE_EXPLORATION") };
    const pr = (t) => GameInfo.Projects.lookup(t);
    r.checks.projectsKeepAntiquity = { pass: pr("PROJECT_CITY_CULTURE_PROJECT")?.Cost === 200 && pr("PROJECT_CITY_SCIENCE_PROJECT")?.Cost === 200 && !pr("PROJECT_TOWN_TRADE")?.RequiresUnlock };
    r.checks.newProjects = { pass: ["PROJECT_TOWN_TEMPLE", "PROJECT_TOWN_INN", "PROJECT_HELIOCENTRIC_MODEL", "PROJECT_INVENT_CALCULUS"].every((t) => pr(t)) };
    r.checks.projectText = { pass: Locale.compose("LOC_PROJECT_TOWN_INN_NAME") !== "LOC_PROJECT_TOWN_INN_NAME" };
    r.checks.cultureProjectUnlock = { pass: A(GameInfo.ProgressionTreeNodeUnlocks).some((u) => u.TargetType === "PROJECT_CITY_CULTURE_PROJECT") };
    r.pass = Object.values(r.checks).every((c) => c.pass);
    return r;
  };
  // Batch B (37-batch-b.sql): Exploration narratives and discoveries.
  CC.batchB = function () {
    const r = { checks: {} };
    const st = A(GameInfo.NarrativeStories);
    const byAge = {}; for (const s of st) byAge[s.Age] = (byAge[s.Age] || 0) + 1;
    r.checks.storiesRetagged = { pass: !byAge.AGE_EXPLORATION && (byAge.AGE_ANTIQUITY || 0) > 3000, byAge };
    r.checks.discoveries = { pass: st.some((s) => /SHIPWRECK/.test(s.Queue || "")), shipwreckQueues: st.filter((s) => /SHIPWRECK/.test(s.Queue || "")).length };
    const pa = CC.personalAge();
    r.checks.ageConditionsRewritten = { pass: pa.checks.noneLeft.pass, left: pa.checks.noneLeft.left };
    const rewritten = A(GameInfo.RequirementArguments).filter((a) => a.Name === "RequirementSetId" && a.Value === "CC_REQSET_PERSONAL_AGE_EXPLORATION").length;
    r.checks.personalAgeUses = { pass: rewritten >= 20, rewritten };
    r.pass = Object.values(r.checks).every((c) => c.pass);
    return r;
  };
  // Exploration Age rules (72-exploration-rules.sql): attached per player in their personal Exploration.
  CC.exRules = function () {
    const r = { checks: {} };
    const wr = A(GameInfo.GameModifiers).map((g) => g.ModifierId).filter((id) => id.startsWith("CC_EXRULE_"));
    r.checks.wrappers = { pass: wr.length >= 10, count: wr.length, missing: wr.filter((id) => !GameInfo.Modifiers.lookup(id.slice(10))).map((id) => id.slice(10)) };
    r.checks.wrapperTargetsExist = { pass: r.checks.wrappers.missing.length === 0 };
    const inEx = (Game.Modifiers.getModifierSubjects(Game.getHash("CC_TEST_IN_EXPLORATION")) || []).map((s) => s.owner).sort();
    const ocean = (Game.Modifiers.getModifierSubjects(Game.getHash("CC_EXRULE_MOD_TECH_OCEAN_TRAVEL")) || []).map((s) => s.owner).sort();
    r.checks.oceanFollowsPersonalAge = { pass: JSON.stringify(ocean) === JSON.stringify(inEx), ocean, inEx };
    const y5 = GameInfo.Modifiers.lookup("TRAIT_MOD_DEFAULT_YIELD_5");
    r.checks.antiquityYieldsEnd = { pass: y5?.SubjectRequirementSetId === "CC_REQSET_NOT_IN_EXPLORATION" && !y5?.Permanent };
    const gdp = ["TRAIT_BONUS_RESOURCE_GDP", "TRAIT_CITY_RESOURCE_GDP", "TRAIT_GOLD_BUILDING_GDP", "TRAIT_IMPORTED_RESOURCE_GDP"];
    r.checks.economicGdpTrackers = { pass: gdp.every((id) => wr.includes("CC_EXRULE_" + id)), missing: gdp.filter((id) => !wr.includes("CC_EXRULE_" + id)) };
    r.pass = Object.values(r.checks).every((c) => c.pass);
    return r;
  };
  // Ocean crossing and Distant Lands (beta feedback, 72-exploration-rules.sql). Live checks use player pid's units and
  // revealed plots: reveal the map and give the player Cartography (or Shipbuilding mastery for military units) first.
  CC.distantLands = function (pid = 0) {
    const r = { checks: {} };
    r.checks.distantLandsOpen = { pass: GameInfo.Ages.lookup("AGE_ANTIQUITY")?.NoVictoriesSecondaryHemisphere === false };
    const inv = GameInfo.Modifiers.lookup("AGE_ANTIQUITY_MOD_OCEAN_TERRAIN_INVALID");
    r.checks.oceanRuleEndsAtExploration = { pass: inv?.OwnerRequirementSetId === "CC_REQSET_NOT_IN_EXPLORATION" && !inv?.Permanent };
    const p = Players.get(pid), terr = (l) => GameInfo.Terrains.lookup(GameplayMap.getTerrainType(l.x, l.y))?.TerrainType;
    let claims = 0;
    for (let x = 0; x < GameplayMap.getGridWidth(); x++) for (let y = 0; y < GameplayMap.getGridHeight(); y++) {
      if (!GameplayMap.isWater(x, y) && p.isDistantLands({ x, y }) && p.Diplomacy.isValidLandClaimLocation({ x, y }, true)) claims++;
    }
    // Late in a game the free spots may all be taken; settlements already in the Distant Lands count as proof too.
    let distantCities = 0;
    for (const id of Players.getAliveMajorIds()) for (const c of Players.get(id).Cities.getCities()) if (Players.get(id).isDistantLands(c.location)) distantCities++;
    r.checks.distantSettleSpots = { pass: claims > 0 || distantCities > 0, count: claims, distantCities };
    // Every land unit with deep-water embarkation must find a path to an unoccupied Ocean plot within 3 tiles (any of
    // them: a single plot can be blocked by units or borders for reasons unrelated to the Ocean rule).
    const deep = Database.makeHash("UNIT_EMBARKATION_DEEP_WATER");
    const blocked = [], tested = [];
    for (const u of p.Units.getUnits()) {
      if (u.embarkationType !== deep) continue;
      const { x: ux, y: uy } = u.location;
      const targets = [];
      for (let x = ux - 3; x <= ux + 3; x++) for (let y = uy - 3; y <= uy + 3; y++) {
        if (y >= 0 && y < GameplayMap.getGridHeight() && GameplayMap.getPlotDistance(ux, uy, x, y) <= 3 && terr({ x, y }) === "TERRAIN_OCEAN"
          && MapUnits.getUnits(x, y).length === 0) targets.push({ x, y });
      }
      if (!targets.length) continue;
      tested.push(unitName(u.type));
      if (!targets.some((q) => (Units.getPathTo(u.id, q)?.plots || []).length)) blocked.push(unitName(u.type));
    }
    r.checks.deepWaterUnitsEnterOcean = { pass: tested.length > 0 && blocked.length === 0, tested, blocked };
    r.pass = Object.values(r.checks).every((c) => c.pass);
    return r;
  };
  // Modern trees (Phase 3.1: 21-modern-tech-tree.sql, 26-modern-civic-tree.sql).
  CC.modernTrees = function () {
    const r = { checks: {} };
    const nodes = A(GameInfo.ProgressionTreeNodes);
    const mo = (p) => nodes.filter((n) => n.ProgressionTreeNodeType.startsWith(p));
    const tech = mo("NODE_TECH_MO_"), civ = mo("NODE_CIVIC_MO_MAIN_");
    r.checks.techsInMergedTree = { pass: tech.length === 17 && tech.every((n) => n.ProgressionTree === "TREE_TECHS_AQ"), count: tech.length };
    r.checks.civicsInMergedTree = { pass: civ.length === 10 && civ.every((n) => n.ProgressionTree === "TREE_CIVICS_AQ_MAIN"), count: civ.length };
    const pre = A(GameInfo.ProgressionTreePrereqs);
    const links = [["NODE_TECH_MO_ACADEMICS", "NODE_TECH_EX_URBAN_PLANNING"], ["NODE_TECH_MO_STEAM_ENGINE", "NODE_TECH_EX_GUNPOWDER"],
      ["NODE_TECH_MO_MILITARY_SCIENCE", "NODE_TECH_EX_GUNPOWDER"], ["NODE_CIVIC_MO_MAIN_MODERNIZATION", "NODE_CIVIC_EX_MAIN_IMPERIALISM"],
      ["NODE_CIVIC_MO_MAIN_NATURAL_HISTORY", "NODE_CIVIC_EX_MAIN_SOCIAL_CLASS"], ["NODE_CIVIC_MO_MAIN_SOCIAL_QUESTION", "NODE_CIVIC_EX_MAIN_SOVEREIGNTY"]];
    const missing = links.filter(([n, p]) => !pre.some((x) => x.Node === n && x.PrereqNode === p));
    r.checks.rootLinks = { pass: missing.length === 0, missing };
    const orphans = [...tech, ...civ].filter((n) => !pre.some((x) => x.Node === n.ProgressionTreeNodeType)).map((n) => n.ProgressionTreeNodeType);
    r.checks.noOrphans = { pass: orphans.length === 0, orphans };
    r.checks.explorationFutureRemoved = { pass: !GameInfo.ProgressionTreeNodes.lookup("NODE_TECH_EX_FUTURE_TECH") && !GameInfo.ProgressionTreeNodes.lookup("NODE_CIVIC_EX_MAIN_FUTURE_CIVIC") };
    const ideo = ["TREE_CIVIC_MO_BRANCH_DEMOCRACY", "TREE_CIVIC_MO_BRANCH_FASCISM", "TREE_CIVIC_MO_BRANCH_COMMUNISM"].map((t) => GameInfo.ProgressionTrees.lookup(t));
    r.checks.ideologyTreesAntiquity = { pass: ideo.every((t) => t && t.AgeType === "AGE_ANTIQUITY"), ages: ideo.map((t) => t?.AgeType) };
    const name = Locale.compose(GameInfo.ProgressionTreeNodes.lookup("NODE_TECH_MO_ACADEMICS")?.Name ?? "");
    r.checks.text = { pass: !!name && !name.startsWith("LOC_"), academics: name, futureTech: Locale.compose("LOC_TECH_FUTURE_TECH_NAME") };
    const badUnlocks = A(GameInfo.ProgressionTreeNodeUnlocks).filter((u) => u.TargetKind === "KIND_UNIT" && !GameInfo.Units.lookup(u.TargetType)).length;
    r.checks.noDanglingUnitUnlocks = { pass: badUnlocks === 0, badUnlocks };
    // Phase 3.2: a node with nothing to unlock is "can never unlock" and the tree screen hides it (and its links).
    const hidden = tech.filter((n) => Game.ProgressionTrees.canEverUnlock(GameContext.localPlayerID, n.$hash).isLocked).map((n) => n.ProgressionTreeNodeType);
    r.checks.allModernTechsShown = { pass: hidden.length === 0, hidden };
    r.pass = Object.values(r.checks).every((c) => c.pass);
    return r;
  };
  // Modern buildings and units (Phase 3.2: imports in cc-import-modern, gates in 30/40).
  CC.modernContent = function () {
    const r = { checks: {} };
    const un = A(GameInfo.ProgressionTreeNodeUnlocks);
    const at = (t) => un.filter((u) => u.TargetType === t).map((u) => u.ProgressionTreeNodeType);
    const units = ["UNIT_LINE_INFANTRY", "UNIT_FIELD_CANNON", "UNIT_CUIRASSIER", "UNIT_MORTAR", "UNIT_FRIGATE"];
    r.checks.ageStartUnitsGated = { pass: units.every((u) => at(u).includes("NODE_TECH_MO_MILITARY_SCIENCE")), got: units.map((u) => u + ":" + at(u)) };
    const bld = { BUILDING_GROCER: "NODE_TECH_MO_URBANIZATION", BUILDING_CITY_PARK: "NODE_TECH_MO_URBANIZATION", IMPROVEMENT_MOUNTAIN: "NODE_TECH_MO_INDUSTRIALIZATION" };
    r.checks.ageStartBuildingsGated = { pass: Object.entries(bld).every(([b, n]) => at(b).includes(n)), got: Object.keys(bld).map((b) => b + ":" + at(b)) };
    r.checks.schoolhouseAtAcademics = { pass: at("BUILDING_SCHOOLHOUSE").includes("NODE_TECH_MO_ACADEMICS") };
    const modernCons = A(GameInfo.Constructibles).filter((c) => c.Age === "AGE_MODERN");
    r.checks.noModernAgeTags = { pass: modernCons.length === 0, left: modernCons.slice(0, 10).map((c) => c.ConstructibleType) };
    // Exploration catch-alls must not have swallowed Modern content.
    const wrong = un.filter((u) => (u.ProgressionTreeNodeType === "NODE_TECH_EX_MACHINERY" || u.ProgressionTreeNodeType === "NODE_TECH_EX_FEUDALISM") &&
      /^(UNIT_(LINE_INFANTRY|RIFLEMAN|TANK|FRIGATE|IRONCLAD)|BUILDING_(GROCER|CITY_PARK|FACTORY|SCHOOLHOUSE))$/.test(u.TargetType)).map((u) => u.TargetType);
    r.checks.noModernInExplorationCatchAll = { pass: wrong.length === 0, wrong };
    const ups = A(GameInfo.UnitUpgrades); const up = (u) => ups.find((x) => x.Unit === u)?.UpgradeUnit;
    r.checks.upgradesIntoModern = { pass: up("UNIT_ARQUEBUSIER") === "UNIT_LINE_INFANTRY" && up("UNIT_LANCER") === "UNIT_CUIRASSIER" && up("UNIT_GALLEON") === "UNIT_FRIGATE" && up("UNIT_BOMBARD") === "UNIT_FIELD_CANNON" };
    const name = Locale.compose(GameInfo.Units.lookup("UNIT_LINE_INFANTRY")?.Name ?? "");
    r.checks.text = { pass: !!name && !name.startsWith("LOC_"), lineInfantry: name };
    r.pass = Object.values(r.checks).every((c) => c.pass);
    return r;
  };
  // Modern systems (Phase 3.4): governments, AI government rules, great people, projects, city-states, narratives.
  CC.modernSystems = function () {
    const r = { checks: {} };
    const govs = ["GOVERNMENT_BUREAUCRATIC_MONARCHY", "GOVERNMENT_ELECTIVE_REPUBLIC", "GOVERNMENT_AUTHORITARIANISM"];
    r.checks.governmentsUnlockByCivic = { pass: govs.every((g) => GameInfo.Governments.lookup(g) && GameInfo.RequirementSets.lookup("CC_GOVUNLOCK_" + g)) };
    // Read the table without ui/cc-governments.js's addition (it appends the local player's unlocked governments).
    const sgT = GameInfo.StartingGovernments, sgIt = sgT.__ccBaseIterator;
    const sg = sgIt ? [...{ [Symbol.iterator]: () => sgIt.call(sgT) }] : A(sgT);
    r.checks.notStartingGovernments = { pass: !sg.some((s) => govs.includes(s.GovernmentType) || s.AgeType !== "AGE_ANTIQUITY"), base: sg.map((s) => s.GovernmentType) };
    const gm = A(GameInfo.GameModifiers).map((g) => g.ModifierId);
    const rules = ["GOVERNMENT_FEUDAL_MONARCHY_SWITCH", "GOVERNMENT_PLUTOCRACY_SWITCH", "GOVERNMENT_THEOCRACY_SWITCH",
      "GOVERNMENT_FEUDAL_MONARCHY_REVERT", "GOVERNMENT_AUTHORITARIANISM_REVERT"].map((x) => "CC_AI_GOVRULE_" + x);
    r.checks.aiRules = { pass: rules.every((x) => gm.includes(x)), missing: rules.filter((x) => !gm.includes(x)) };
    const gp = A(GameInfo.GreatPersonIndividuals);
    r.checks.greatPeopleOneAge = { pass: !gp.some((g) => g.AgeType && g.AgeType !== "AGE_ANTIQUITY"), total: gp.length };
    r.checks.storiesOneAge = { pass: !A(GameInfo.NarrativeStories).some((n) => n.Age === "AGE_MODERN" || n.Age === "AGE_EXPLORATION") };
    const ind = A(GameInfo.Independents);
    r.checks.cityStatesAllAges = { pass: ind.length >= 60, total: ind.length,
      byAffinity: ["AFFINITY_FRIENDLY", "AFFINITY_NEUTRAL", "AFFINITY_HOSTILE"].map((a) => a.slice(9) + ":" + ind.filter((i) => i.Affinity === a).length) };
    r.checks.spaceProjects = { pass: ["PROJECT_LAUNCH_SATELLITE", "PROJECT_LAUNCH_ROCKET"].every((p) => GameInfo.Projects.lookup(p)) };
    r.checks.railroad = { pass: !!GameInfo.Routes.lookup("ROUTE_RAILROAD") };
    // Major-civ AI keeps the base Military/Diplomatic/Tactical components (36-batch-a.sql); no later-Age swaps.
    const ai = A(GameInfo.AiDefinitions).filter((d) => d.LeaderTrait === "TRAIT_LEADER_MAJOR_CIV").map((d) => d.AiComponent);
    r.checks.aiBaseComponents = { pass: ["Military", "Diplomatic", "Tactical"].every((c) => ai.includes(c)) && !ai.some((c) => /^(Military|Diplomatic|Tactical)_/.test(c)), ai: ai.filter((c) => /Military|Diplomatic|Tactical/.test(c)) };
    const un = A(GameInfo.ProgressionTreeNodeUnlocks).filter((u) => u.TargetKind === "KIND_DIPLOMATIC_ACTION" && !GameInfo.DiplomacyActions.lookup(u.TargetType));
    r.checks.noRawDiplomacyUnlocks = { pass: un.length === 0, left: un.map((u) => u.TargetType) };
    r.pass = Object.values(r.checks).every((c) => c.pass);
    return r;
  };
  // Parked modifiers keep their links (01/55): every modifier vanilla attaches to TRAIT_ANTIQUITY_CIV is still attached.
  // Found in Phase 3: parking cascaded these links away (settlement cap, resource caps, base +10 yields lost).
  CC.parkLinks = function () {
    const want = ["TRAIT_MOD_MARKET_RESOURCE_CAP", "TRAIT_MOD_LIGHTHOUSE_RESOURCE_CAP", "TRAIT_MOD_CAPITAL_RESOURCE_CAP", "TRAIT_MOD_CITY_RESOURCE_CAP",
      "MOD_DEFAULT_CIV_RIVER_EMBARKATION", "TRAIT_MOD_CAPITAL_FREE_FOOD", "TRAIT_MOD_PENALTY_OVER_SETTLEMENT_CAP_SETTLEMENTS", "TRAIT_INITIAL_SETTLEMENT_CAP",
      "TRAIT_MOD_CHIEFDOM_UNLOCKS_GOVERNMENT", "TRAIT_MOD_DEFAULT_YIELD_5", "TRAIT_MOD_DEFAULT_YIELD_10", "TRAIT_MOD_NEGATIVE_INFLUENCE_CONQUERED_SETTLEMENTS",
      "TRAIT_MOD_NEGATIVE_INFLUENCE_RAZED_SETTLEMENTS", "TRAIT_MOD_GOLD_UNASSIGNED_RESOURCE", "TRAIT_MOD_HAPPINESS_UNASSIGNED_RESOURCE",
      "TRAIT_MOD_TOWN_FARMING_PROJECT", "TRAIT_MOD_TOWN_FISHING_PROJECT", "TRAIT_MOD_TOWN_URBAN_CENTER_PROJECT", "TRAIT_MOD_TOWN_GROWTH_PROJECT"];
    const have = new Set(A(GameInfo.TraitModifiers).filter((t) => t.TraitType === "TRAIT_ANTIQUITY_CIV").map((t) => t.ModifierId));
    const missing = want.filter((m) => !have.has(m));
    const cap = A(GameInfo.ModifierArguments).find((a) => a.ModifierId === "TRAIT_INITIAL_SETTLEMENT_CAP" && a.Name === "Amount")?.Value;
    const r = { checks: { antiquityTraitIntact: { pass: missing.length === 0, missing }, antiquityCapIs3: { pass: cap === "3", cap } } };
    r.pass = Object.values(r.checks).every((c) => c.pass);
    return r;
  };
  // Victories (76-victories.sql). Science and Domination as in vanilla; Culture, Economic and Military with a fixed points target.
  CC.victories = function () {
    const r = { checks: {} };
    const vm = Game.VictoryManager, h = (t) => GameInfo.Victories.lookup(t)?.$hash;
    r.checks.dominationEnabled = { pass: vm.getConfiguration().enabledVictories.includes(h("VICTORY_DOMINATION")) };
    r.checks.scienceFixedTarget = { pass: vm.getCountdownVictoryDominanceScore(h("VICTORY_SCIENCE_MODERN")) === 100 };
    const rocket = GameInfo.Projects.lookup("PROJECT_LAUNCH_ROCKET");
    const pre = A(GameInfo.ProjectPrereqs).filter((p) => p.ProjectType === "PROJECT_LAUNCH_ROCKET").map((p) => p.PrereqProjectType).sort();
    r.checks.rocketNeedsSpaceProjects = { pass: !!rocket && !rocket.RequireCompletedLegacyPathType && pre.length === 3, pre };
    r.checks.notSingleAge = { pass: !Game.AgeProgressManager.isSingleAge };
    r.checks.cultureFixedTarget = { pass: vm.getCountdownVictoryDominanceScore(h("VICTORY_CULTURE_MODERN")) === 150 };
    r.checks.economicFixedTarget = { pass: vm.getCountdownVictoryDominanceScore(h("VICTORY_ECONOMIC_MODERN")) === 12000 };
    r.checks.militaryFixedTarget = { pass: vm.getCountdownVictoryDominanceScore(h("VICTORY_MILITARY_MODERN")) === 100 };
    r.pass = Object.values(r.checks).every((c) => c.pass);
    return r;
  };
  // Triumphs (80-triumphs.sql): Exploration and Modern Triumphs exist as Antiquity ones, are valid for the player, and
  // each later-Age trigger requires the personal Age (directly, or through a CC_REQSET_TRIUMPH_ wrapper).
  CC.triumphs = function (pid = 0) {
    const r = { checks: {} };
    const L = A(GameInfo.Legacies);
    const later = L.filter((l) => /^LEGACY_(EX|MO)_/.test(l.LegacyType));
    r.checks.imported = { pass: later.length > 100, count: later.length };
    r.checks.retagged = { pass: later.every((l) => l.Age === "AGE_ANTIQUITY"), notAntiquity: later.filter((l) => l.Age !== "AGE_ANTIQUITY").length };
    const leg = Players.get(pid)?.Legacies;
    const valid = leg ? later.filter((l) => leg.isValidLegacy(l.$hash)).length : null;
    r.checks.validForPlayer = { pass: valid > 0, valid };
    const rsr = A(GameInfo.RequirementSetRequirements);
    const reqsOf = (set) => rsr.filter((x) => x.RequirementSetId === set).map((x) => x.RequirementId);
    const lm = A(GameInfo.LegacyModifiers).filter((m) => /^LEGACY_(EX|MO)_/.test(m.LegacyType));
    const ungated = lm.filter((m) => {
      const need = /^LEGACY_EX_/.test(m.LegacyType) ? "CC_REQ_IN_EXPLORATION" : "CC_REQ_IN_MODERN";
      const set = m.RequirementSetId;
      return !(reqsOf(set).includes(need) || (/^CC_REQSET_TRIUMPH_/.test(set) && reqsOf(set).includes(need)));
    }).map((m) => m.LegacyType);
    r.checks.gatedByPersonalAge = { pass: lm.length > 0 && ungated.length === 0, triggers: lm.length, ungated: ungated.slice(0, 10) };
    // Wonders Triumphs count only their own Age's wonders (by tag), not every wonder (all are tagged Antiquity here).
    const args = A(GameInfo.RequirementArguments);
    const wonderReqs = ["REQSET_LEGACY_EX_CULTURAL_2_1", "REQSET_LEGACY_MO_CULTURAL_2_1"].map((id) => ({
      type: GameInfo.Requirements.lookup(id)?.RequirementType, tag: args.find((a) => a.RequirementId === id && a.Name === "BuildingTag")?.Value }));
    const tagged = (tag) => A(GameInfo.TypeTags).filter((t) => t.Tag === tag).map((t) => t.Type);
    const aqTagged = [...tagged("CC_WONDER_EXPLORATION"), ...tagged("CC_WONDER_MODERN")]
      .filter((w) => A(GameInfo.ProgressionTreeNodeUnlocks).some((u) => u.TargetType === w && /_AQ_/.test(u.ProgressionTreeNodeType)));
    r.checks.wonderTriumphsByAge = { pass: wonderReqs[0].tag === "CC_WONDER_EXPLORATION" && wonderReqs[1].tag === "CC_WONDER_MODERN"
      && wonderReqs.every((w) => w.type === "REQUIREMENT_PLAYER_HAS_AT_LEAST_NUM_BUILDINGS")
      && tagged("CC_WONDER_EXPLORATION").length >= 10 && tagged("CC_WONDER_MODERN").length >= 10 && aqTagged.length === 0,
      ex: tagged("CC_WONDER_EXPLORATION").length, mo: tagged("CC_WONDER_MODERN").length, aqTagged };
    // UI (ui/cc-triumphs.js): progress shown without the personal-Age requirement's share, e.g. 0/20, not 0/200.
    const proto = leg && Object.getPrototypeOf(leg);
    const shown = leg ? later.filter((l) => leg.isValidLegacy(l.$hash)).map((l) => leg.getProgress(l.$hash)?.progress?.[0]?.total) : [];
    r.checks.progressDisplay = { pass: !!proto?.__ccTriumphs && shown.length > 0 && shown.every((t) => t !== 200), patched: !!proto?.__ccTriumphs, at200: shown.filter((t) => t === 200).length };
    r.pass = Object.values(r.checks).every((c) => c.pass);
    return r;
  };
  // Dedications (82/83, ui/cc-dedications.js): a Dedications attribute tree with one node per Major Triumph card;
  // each node's modifiers need a completed Triumph, the card's Age and a human owner; AI copies on the major-civ
  // trait; 3 + 3 points for humans; the buy check refuses Dedications that don't qualify yet.
  CC.dedications = function (pid = 0) {
    const r = { checks: {} };
    const nodes = A(GameInfo.ProgressionTreeNodes).filter((n) => n.ProgressionTreeNodeType.startsWith("CC_DED_"));
    r.checks.tree = { pass: !!GameInfo.Attributes.lookup("ATTRIBUTE_CC_DEDICATION") && nodes.length >= 40, nodes: nodes.length };
    const unlocks = A(GameInfo.ProgressionTreeNodeUnlocks).filter((u) => u.ProgressionTreeNodeType.startsWith("CC_DED_"));
    const rsr = A(GameInfo.RequirementSetRequirements);
    const reqsOf = (set) => rsr.filter((x) => x.RequirementSetId === set).map((x) => x.RequirementId);
    const mods = A(GameInfo.Modifiers);
    const ungated = unlocks.filter((u) => {
      const m = mods.find((x) => x.ModifierId === u.TargetType);
      const reqs = m ? reqsOf(m.OwnerRequirementSetId) : [];
      return !(reqs.includes("CC_REQ_DED_IS_HUMAN") && reqs.some((q) => q.startsWith("CC_REQ_DED_TRIUMPH_"))
        && reqs.some((q) => /^CC_REQ_IN_(EXPLORATION|MODERN)$/.test(q)));
    }).map((u) => u.TargetType);
    r.checks.humanEffectsGated = { pass: unlocks.length >= nodes.length && ungated.length === 0, effects: unlocks.length, ungated: ungated.slice(0, 5) };
    const ai = A(GameInfo.TraitModifiers).filter((t) => t.TraitType === "TRAIT_LEADER_MAJOR_CIV" && t.ModifierId.startsWith("CC_DMAI_"));
    const aiUngated = ai.filter((t) => {
      const m = mods.find((x) => x.ModifierId === t.ModifierId);
      const reqs = m ? reqsOf(m.OwnerRequirementSetId) : [];
      return !(reqs.includes("CC_REQ_DED_IS_AI") && reqs.some((q) => q.startsWith("CC_REQ_DED_TRIUMPH_")));
    }).length;
    r.checks.aiCopies = { pass: ai.length === unlocks.length && aiUngated === 0, ai: ai.length, aiUngated };
    const pts = A(GameInfo.TraitModifiers).filter((t) => /^CC_DEDPOINTS_(EX|MO)$/.test(t.ModifierId));
    r.checks.points = { pass: pts.length === 2 };
    r.checks.buyCheck = { pass: !!Game.PlayerOperations.__ccDedications };
    const P = Players.get(pid);
    if (P) {
      r.points = P.Identity.getAvailableAttributePoints("ATTRIBUTE_CC_DEDICATION");
      r.bought = nodes.filter((n) => Game.ProgressionTrees.getNodeState(pid, n.$hash) >= 4).map((n) => n.ProgressionTreeNodeType);
    }
    r.pass = Object.values(r.checks).every((c) => c.pass);
    return r;
  };
  // Diplomacy and espionage (00-snapshot, 50-restore, 78-diplomacy.sql): Exploration and Modern actions exist and need
  // an unlock; shared actions keep Antiquity's Influence costs; ruins are Antiquity discoveries (30-buildings.sql).
  CC.diplomacy = function () {
    const r = { checks: {} };
    const acts = ["DIPLOMACY_ACTION_ESPIONAGE_OPEN_THE_GATES", "DIPLOMACY_ACTION_ESPIONAGE_CONVERT_POPULATION", "DIPLOMACY_ACTION_ESPIONAGE_SABOTAGE_WORKERS",
      "DIPLOMACY_ACTION_ESPIONAGE_STEAL_RICHES", "DIPLOMACY_ACTION_ESTABLISH_TREASURE_FLEET", "DIPLOMACY_ACTION_DEMAND_TRIBUTE",
      "DIPLOMACY_ACTION_ESPIONAGE_SABOTAGE_SHIPPING", "DIPLOMACY_ACTION_ESPIONAGE_FAKE_ARTIFACTS", "DIPLOMACY_ACTION_ESPIONAGE_INFILTRATE_ENEMY_POSITIONS",
      "DIPLOMACY_ACTION_ESPIONAGE_SABOTAGE_SPACE_PROGRAM", "DIPLOMACY_ACTION_ESPIONAGE_IDEOLOGICAL_REVOLT"];
    const bad = acts.filter((a) => !GameInfo.DiplomacyActions.lookup(a)?.RequiresUnlock);
    r.checks.newActionsNeedUnlock = { pass: bad.length === 0, bad };
    const unlocked = new Set(A(GameInfo.ProgressionTreeNodeUnlocks).filter((u) => u.TargetKind === "KIND_DIPLOMATIC_ACTION").map((u) => u.TargetType));
    const noTree = acts.filter((a) => !unlocked.has(a) && !/DEMAND_TRIBUTE|IDEOLOGICAL_REVOLT/.test(a));
    r.checks.treeUnlocks = { pass: noTree.length === 0, noTree };
    const cost = (a) => A(GameInfo.DiplomaticActionInfluenceCosts).find((c) => c.DiplomacyActionType === a);
    const war = cost("DIPLOMACY_ACTION_DECLARE_WAR")?.InfCostNeutral, spy = cost("DIPLOMACY_ACTION_COUNTER_SPY")?.InfCostNeutral;
    r.checks.antiquityCosts = { pass: war === 60 && spy === 40, war, spy };
    const ruins = GameInfo.Constructibles.lookup("IMPROVEMENT_RUINS"), ri = GameInfo.Improvements.lookup("IMPROVEMENT_RUINS");
    r.checks.ruinsAreDiscoveries = { pass: !!ruins?.Discovery && !ruins?.Archaeology && !!ruins?.CanBeHidden && !!ri?.RemoveOnEntry };
    r.pass = Object.values(r.checks).every((c) => c.pass);
    return r;
  };
  CC.gov = function (pid = 0) {
    const cur = Players.get(pid).Culture.getGovernmentType();
    return A(GameInfo.Governments).find((g) => g.$hash === cur || g.$index === cur)?.GovernmentType ?? cur;
  };
  CC.setGov = function (pid, gov) {
    const args = { GovernmentType: GameInfo.Governments.lookup(gov).$index, Action: PlayerOperationParameters.Activate };
    const ok = Game.PlayerOperations.canStart(pid, PlayerOperationTypes.CHANGE_GOVERNMENT, args, false).Success;
    if (ok) Game.PlayerOperations.sendRequest(pid, PlayerOperationTypes.CHANGE_GOVERNMENT, args);
    return ok;
  };

  // Global-Age values raised per player (audit #5, #6, #7: 72, 74, 79). Live checks use player pid's first city and
  // identity: compare before and after granting Cartography and then a Modern root tech.
  CC.ageScaling = function (pid = 0) {
    const r = { checks: {} };
    const gm = A(GameInfo.GameModifiers).map((g) => g.ModifierId);
    const rules = ["CC_EXRULE_CC_EX_TRADE_RANGE_LAND", "CC_EXRULE_CC_EX_TRADE_RANGE_SEA", "CC_EXRULE_CC_EX_EMBARKED_STRENGTH",
      "CC_MORULE_CC_MO_TRADE_RANGE_LAND", "CC_MORULE_CC_MO_TRADE_RANGE_SEA", "CC_MORULE_CC_MO_EMBARKED_STRENGTH"];
    r.checks.wrappers = { pass: rules.every((id) => gm.includes(id)), missing: rules.filter((id) => !gm.includes(id)) };
    const tm = A(GameInfo.TraitModifiers).filter((t) => /^CC_(EX|MO)_(ATTR_|IBN_BATTUTA_WILDCARD)/.test(t.ModifierId));
    r.checks.attributeTraits = { pass: tm.length === 16, count: tm.length };
    // City balance by personal Age (72/74, audit #9): growth, specialist cap, town upgrade cost.
    const balance = ["GROWTH", "WORKER_CAP", "TOWN_UPGRADE"].flatMap((k) => ["CC_EXRULE_CC_EX_" + k, "CC_MORULE_CC_MO_" + k]);
    r.checks.cityBalanceWrappers = { pass: balance.every((id) => gm.includes(id)), missing: balance.filter((id) => !gm.includes(id)) };
    // Age-scaled bonuses (81, audit #2): an Exploration and a Modern copy of each player-owned ScaleByGameAge modifier.
    const scaled = A(GameInfo.Modifiers).filter((m) => /^CC_SA_(EX|MO)_/.test(m.ModifierId));
    const ex = scaled.filter((m) => m.ModifierId.startsWith("CC_SA_EX_")).length, mo = scaled.length - ex;
    r.checks.ageScaledCopies = { pass: ex > 80 && ex === mo, ex, mo };
    // Narrative rewards (37, audit #15): later-Age reward sizes exist as Antiquity rows and stories point to them.
    const nyr = A(GameInfo.NarrativeStory_Yield_Rewards).filter((x) => x.Age === "AGE_ANTIQUITY" && /^CC_(EX|MO)_/.test(x.Type)).length;
    const repointed = A(GameInfo.ModifierArguments).filter((a) => a.Name === "MultiplierType" && /^CC_(EX|MO)_/.test(a.Value)).length;
    r.checks.narrativeRewardSizes = { pass: nyr > 0 && repointed > 500, rows: nyr, repointed };
    const city = Players.get(pid)?.Cities?.getCities()[0];
    const t = city && Cities.get(city.id)?.Trade;
    r.tradeRange = t ? { land: t.landTradeRouteRange?.value, sea: t.waterTradeRouteRange?.value } : null;
    const id = Players.get(pid)?.Identity;
    r.attributePoints = id ? A(GameInfo.Attributes).reduce((n, a) => n + id.getAvailableAttributePoints(a.AttributeType) + id.getSpentAttributePoints(a.AttributeType), 0) : null;
    const on = (rid) => (Game.Modifiers.getModifierSubjects(Game.getHash(rid)) || []).some((s) => s.owner === pid);
    r.active = Object.fromEntries(rules.map((rid) => [rid.replace(/^CC_(EX|MO)RULE_/, ""), on(rid)]));
    r.pass = Object.values(r.checks).every((c) => c.pass);
    return r;
  };

  // Missing content (cc-import-dlc-*, cc-import-difficulty): DLC wonders of the later Ages (only if the pack is
  // installed and enabled), and the AI's later-Age difficulty bonuses attached by personal Age.
  CC.missingContent = function () {
    const r = { checks: {} };
    const dlc = { "asia-wonders": ["WONDER_GRAND_BAZAAR", "WONDER_WAT_XIENG_THONG", "WONDER_UBUDIAH_MOSQUE"],
      "japan-korea-wonders": ["WONDER_NIRAYAMA_REVERBERATORY_FURNACE"], "water-wonders": ["WONDER_NAN_MADOL"],
      "bulgaria": ["WONDER_RILA_MONASTERY"], "shawnee-tecumseh": ["WONDER_SERPENT_MOUND"],
      "great-britain": ["WONDER_BATTERSEA_POWER_STATION"], "nepal": ["WONDER_BOUDHANATH"] };
    const active = new Set((Modding.getActiveMods?.() || []).map((m) => (typeof m === "object" ? m.id : m)));
    r.wonders = {};
    for (const [pack, list] of Object.entries(dlc)) {
      for (const w of list) {
        const c = GameInfo.Constructibles.lookup(w);
        const unlock = A(GameInfo.ProgressionTreeNodeUnlocks).find((u) => u.TargetType === w);
        r.wonders[w] = c ? (c.Age + (unlock ? " @" + unlock.ProgressionTreeNodeType : " (no unlock)")) : "missing";
      }
    }
    const loaded = Object.values(r.wonders).filter((v) => v !== "missing");
    r.checks.wondersBuildable = { pass: loaded.every((v) => v.startsWith("AGE_ANTIQUITY @")), loaded: loaded.length };
    const gm = A(GameInfo.GameModifiers).map((g) => g.ModifierId);
    const ex = gm.filter((id) => /^CC_EXRULE_EX_HANDICAP_/.test(id)), mo = gm.filter((id) => /^CC_MORULE_MO_HANDICAP_/.test(id));
    const onTrait = A(GameInfo.TraitModifiers).filter((t) => /^(EX|MO)_HANDICAP_/.test(t.ModifierId));
    r.checks.difficultyByPersonalAge = { pass: ex.length === 8 && mo.length === 8 && onTrait.length === 0, ex: ex.length, mo: mo.length, stillOnTrait: onTrait.length };
    r.pass = Object.values(r.checks).every((c) => c.pass);
    return r;
  };

  CC.grant = function (pid, nodeType) {
    Game.PlayerOperations.sendRequest(pid, PlayerOperationTypes.GRANT_TREE_NODE, { ProgressionTreeNodeType: node(nodeType).$index, FullyUnlock: 1 });
    return nodeType;
  };

  globalThis.CC = CC;
  return "CC loaded: " + Object.keys(CC).join(",");
})();
