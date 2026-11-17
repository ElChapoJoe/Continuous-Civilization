// Continuous Civilization - in-game experiments for questions the data can't answer (docs/audit-age-gated-mechanics.md
// "Could not decide without playing", docs/future-work.md). Unlike tests/cc-tests.js these CHANGE the game: they
// grant techs and civics to the local player, place buildings and found a religion. Run them last, on a throwaway
// game (tools/test-game.mjs --probes does: phase by phase, one AI turn between prepare and check).
//
// Each phase: CCProbe.prepare(i) changes the game, then one turn passes, then CCProbe.check(i) reads the outcome.
// Every probe reports what happened (answer), plus pass when there is an expected result. Grants only work for the
// local human player (id GameContext.localPlayerID), so every probe uses that player. Best with a few cities: run
// after some AI turns (test-game.mjs --turns 30).
(function () {
  const A = (t) => { const o = []; if (t) for (const x of t) o.push(x); return o; };
  const g = (f, d = null) => { try { const v = f(); return v === undefined ? d : v; } catch (e) { return "error: " + e; } };
  const pid = GameContext.localPlayerID;
  const P = () => Players.get(pid);
  const nodeIdx = (n) => GameInfo.ProgressionTreeNodes.lookup(n)?.$index;
  function grant(n) {
    const i = nodeIdx(n);
    if (i == null) return n + ": no such node";
    const args = { ProgressionTreeNodeType: i, FullyUnlock: 1 };
    const ok = Game.PlayerOperations.canStart(pid, PlayerOperationTypes.GRANT_TREE_NODE, args, false)?.Success;
    if (ok) Game.PlayerOperations.sendRequest(pid, PlayerOperationTypes.GRANT_TREE_NODE, args);
    return n + (ok ? ": granted" : ": refused");
  }
  const cities = () => A(g(() => P().Cities.getCities(), []));
  // Subjects of a modifier, as {owner, kind/id} summaries; getModifierSubjects returns the active subjects.
  const subjects = (id) => A(g(() => Game.Modifiers.getModifierSubjects(Game.getHash(id)), [])).map((s) => ({ owner: s?.owner, id: s?.id ?? s?.localId ?? null, type: s?.type ?? null }));
  const majors = () => A(Players.getAliveMajorIds());
  const exPlayers = () => majors().filter((id) => subjects("CC_TEST_IN_EXPLORATION").some((s) => s.owner === id));
  const ownersOf = (subs) => [...new Set(subs.map((s) => s.owner))].sort((a, b) => a - b);
  const state = {};

  const probes = [
    {
      // AI town purchases (future-work): can a personal-Age condition be used on a city's modifier?
      name: "cityOwnerAge",
      prepare() {
        state.cityBefore = { subject: ownersOf(subjects("CC_TEST_CITY_SUBJECT_EX")), owner: ownersOf(subjects("CC_TEST_CITY_OWNER_EX")), exPlayers: exPlayers() };
        return [grant("NODE_TECH_EX_CARTOGRAPHY")];
      },
      check() {
        const ex = exPlayers();
        const withCities = majors().filter((id) => (Players.get(id)?.Cities?.getCities()?.length ?? 0) > 0);
        const expected = ex.filter((id) => withCities.includes(id));
        const subj = subjects("CC_TEST_CITY_SUBJECT_EX"), own = subjects("CC_TEST_CITY_OWNER_EX");
        const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
        const r = {
          localInExploration: ex.includes(pid), exPlayers: ex, expectedOwners: expected, before: state.cityBefore,
          subjectCase: { owners: ownersOf(subj), count: subj.length, sample: subj.slice(0, 3) },
          ownerCase: { owners: ownersOf(own), count: own.length, sample: own.slice(0, 3) },
        };
        r.subjectCase.works = ex.includes(pid) && same(ownersOf(subj), expected);
        r.ownerCase.works = ex.includes(pid) && same(ownersOf(own), expected);
        r.answer = `city as subject: ${r.subjectCase.works ? "works" : "does not work"}; city as owner (town-focus projects): ${r.ownerCase.works ? "works" : "does not work"}`;
        r.pass = r.subjectCase.works && r.ownerCase.works;
        return r;
      },
    },
    {
      // Audit "could not decide" 1 (#2): do the personal-Age copies of Age-scaled bonuses switch on for this player?
      name: "ageScaledCopies",
      prepare() {
        state.copies = (tag) => A(GameInfo.Modifiers).map((m) => m.ModifierId).filter((id) => id.startsWith(`CC_SA_${tag}_`));
        state.activeBefore = state.copies("EX").filter((id) => subjects(id).some((s) => s.owner === pid)).length;
        return ["counted before the Cartography grant of cityOwnerAge (same phase, runs after)"];
      },
      check() {
        const all = state.copies("EX");
        const active = all.filter((id) => subjects(id).some((s) => s.owner === pid));
        const r = { exCopies: all.length, activeBefore: state.activeBefore, activeAfter: active.length, sample: active.slice(0, 5) };
        r.answer = `${active.length} of ${all.length} Exploration copies active for the local player after entering Exploration (before: ${state.activeBefore})`;
        r.pass = active.length > state.activeBefore;
        return r;
      },
    },
    {
      // Audit "could not decide" 6: can an ideology be chosen (trees re-tagged to Antiquity in 25-civic-tree.sql)?
      name: "ideology",
      prepare() {
        state.ideologyBefore = g(() => P().Culture.getChosenIdeology());
        return ["NODE_TECH_MO_ACADEMICS", "NODE_CIVIC_MO_MAIN_POLITICAL_THEORY", "NODE_CIVIC_MO_BRANCH_DEMOCRACY"].map(grant);
      },
      check() {
        const id = g(() => P().Culture.getChosenIdeology());
        const name = g(() => GameInfo.Ideologies.lookup(id)?.IdeologyType);
        const r = { before: state.ideologyBefore, chosen: id, ideology: name,
          democracyUnlocked: g(() => P().Culture.isNodeUnlocked(GameInfo.ProgressionTreeNodes.lookup("NODE_CIVIC_MO_BRANCH_DEMOCRACY").$hash)) };
        r.answer = name ? `ideology chosen: ${name}` : "no ideology after granting Political Theory and Democracy";
        r.pass = !!name;
        return r;
      },
    },
    {
      // Audit "could not decide" 12 (#3): founding a religion as a human, with the request the belief picker sends.
      name: "foundReligion",
      prepare() {
        const out = [grant("NODE_CIVIC_EX_MAIN_PIETY")];
        const rel = P().Religion;
        state.relBefore = { canCreate: g(() => rel.canCreateReligion()), hasCreated: g(() => rel.hasCreatedReligion()) };
        if (state.relBefore.hasCreated === true) return out.concat("already has a religion");
        const taken = new Set(A(g(() => Game.Religion.getReligions?.(), [])).map((x) => x?.religionType ?? x));
        const choice = A(GameInfo.Religions).find((x) => !taken.has(x.$hash) && !/PANTHEON/.test(x.ReligionType));
        state.relType = choice?.ReligionType;
        if (!choice) return out.concat("no free religion type");
        const args = { ReligionType: Database.makeHash(choice.ReligionType) };
        const res = Game.PlayerOperations.canStart(pid, PlayerOperationTypes.FOUND_RELIGION, args, false);
        state.relCanStart = { Success: res?.Success, FailureReasons: res?.FailureReasons ?? null };
        if (res?.Success) Game.PlayerOperations.sendRequest(pid, PlayerOperationTypes.FOUND_RELIGION, args);
        return out.concat(`FOUND_RELIGION ${choice.ReligionType}: ${res?.Success ? "sent" : "refused"}`);
      },
      check() {
        const rel = P().Religion;
        const r = { before: state.relBefore, tried: state.relType, canStart: state.relCanStart,
          hasCreated: g(() => rel.hasCreatedReligion()), religion: g(() => GameInfo.Religions.lookup(rel.getReligionType())?.ReligionType) };
        r.answer = r.hasCreated === true ? `religion founded: ${r.religion}` : `not founded (canStart: ${JSON.stringify(state.relCanStart)})`;
        r.pass = r.hasCreated === true || state.relBefore?.hasCreated === true;
        return r;
      },
    },
    {
      // Audit "could not decide" 5: do Rail Stations build rail (ROUTE_RAILROAD has no Age prerequisite)?
      name: "railStations",
      prepare() {
        const out = [grant("NODE_TECH_MO_INDUSTRIALIZATION")];
        const def = GameInfo.Constructibles.lookup("BUILDING_RAIL_STATION");
        const rail = GameInfo.Routes.lookup("ROUTE_RAILROAD");
        state.rail = rail ? [rail.$index, rail.$hash] : null;
        state.railBefore = countRoute(state.rail);
        state.stations = [];
        if (!def) return out.concat("no BUILDING_RAIL_STATION");
        for (const c of cities().slice(0, 3)) {
          const plots = A(g(() => c.getPurchasedPlots(), [])).map((i) => GameplayMap.getLocationFromIndex(i));
          let placed = null;
          for (const loc of plots) {
            const args = { Kind: "CONSTRUCTIBLE", Type: def.$index, Location: { x: loc.x, y: loc.y }, Parent: c.id, Owner: pid };
            if (Game.PlayerOperations.canStart(pid, "CREATE_ELEMENT", args, false)?.Success) {
              Game.PlayerOperations.sendRequest(pid, "CREATE_ELEMENT", args);
              placed = { x: loc.x, y: loc.y };
              break;
            }
          }
          state.stations.push({ city: g(() => Locale.compose(c.name)), placed });
        }
        return out.concat(state.stations.map((s) => `${s.city}: ${s.placed ? "station placed" : "no plot accepted"}`));
      },
      check() {
        const def = GameInfo.Constructibles.lookup("BUILDING_RAIL_STATION");
        const withStation = cities().filter((c) => g(() => c.Constructibles.hasConstructible("BUILDING_RAIL_STATION", false)) === true).length;
        const after = countRoute(state.rail);
        const r = { stationsTried: state.stations, citiesWithStation: withStation, cities: cities().length,
          railPlotsBefore: state.railBefore, railPlotsAfter: after, defined: !!def };
        r.answer = `${withStation} cities with a Rail Station; railroad plots ${state.railBefore} -> ${after}`;
        r.pass = withStation > 0 && after > state.railBefore;
        if (withStation > 0 && cities().length < 2 && after === state.railBefore) r.skipped = "one city only: nothing to connect";
        return r;
      },
    },
  ];
  // Plots whose route is the given one (getRouteType may answer with the row index or the hash: both are accepted).
  function countRoute(ids) {
    if (!ids) return null;
    let n = 0; const w = GameplayMap.getGridWidth(), h = GameplayMap.getGridHeight();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ids.includes(GameplayMap.getRouteType(x, y))) n++;
    return n;
  }
  // Phases: probes that can share one turn. Cartography first (personal Exploration), then the Modern experiments.
  const phases = [["ageScaledCopies", "cityOwnerAge"], ["ideology", "foundReligion", "railStations"]];
  const byName = Object.fromEntries(probes.map((p) => [p.name, p]));
  const results = {};
  globalThis.CCProbe = {
    phases: phases.length,
    localPlayer: pid,
    prepare(i) {
      const out = {};
      for (const n of phases[i]) { try { out[n] = byName[n].prepare(); } catch (e) { out[n] = "error: " + e; } }
      return JSON.stringify(out);
    },
    check(i) {
      for (const n of phases[i]) { try { results[n] = byName[n].check(); } catch (e) { results[n] = { pass: false, error: String(e) }; } }
      return JSON.stringify(Object.fromEntries(phases[i].map((n) => [n, results[n]])));
    },
    results() { return JSON.stringify(results); },
  };
  return `CCProbe loaded: ${probes.length} probes in ${phases.length} phases, local player ${pid}, ${cities().length} cities`;
})();
