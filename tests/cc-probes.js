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
  // Subjects of a modifier, as {owner, kind/id} summaries; getModifierSubjects returns the active subjects, but only
  // for game-wide modifiers (GameModifiers): it answers null for ones attached by traits, tree nodes or other modifiers.
  const subjects = (id) => A(g(() => Game.Modifiers.getModifierSubjects(Game.getHash(id)), [])).map((s) => ({ owner: s?.owner, id: s?.id ?? s?.localId ?? null, type: s?.type ?? null }));
  // The modifiers active on a player or a city, by ModifierId: <object>.Modifiers.getModifiers() lists them with
  // modifierType = the hash of the ModifierId (checked 2026-11-18: inactive ones are left out).
  let idByHash = null;
  const activeIds = (obj) => {
    if (!idByHash) idByHash = new Map(A(GameInfo.Modifiers).map((r) => [r.$hash, r.ModifierId]));
    return A(g(() => obj.Modifiers.getModifiers(), [])).map((m) => idByHash.get(m.modifierType) ?? "?");
  };
  // Places a finished building in a city (first plot the engine accepts); returns the plot or null.
  function place(c, type) {
    const def = GameInfo.Constructibles.lookup(type);
    if (!def) return null;
    for (const i of A(g(() => c.getPurchasedPlots(), []))) {
      const loc = GameplayMap.getLocationFromIndex(i);
      const args = { Kind: "CONSTRUCTIBLE", Type: def.$index, Location: { x: loc.x, y: loc.y }, Parent: c.id, Owner: pid };
      if (Game.PlayerOperations.canStart(pid, "CREATE_ELEMENT", args, false)?.Success) {
        Game.PlayerOperations.sendRequest(pid, "CREATE_ELEMENT", args);
        return { x: loc.x, y: loc.y };
      }
    }
    return null;
  }
  const majors = () => A(Players.getAliveMajorIds());
  const exPlayers = () => majors().filter((id) => subjects("CC_TEST_IN_EXPLORATION").some((s) => s.owner === id));
  const ownersOf = (subs) => [...new Set(subs.map((s) => s.owner))].sort((a, b) => a - b);
  const state = {};

  const probes = [
    {
      // AI town purchases (future-work): can a personal-Age condition be used on a city's modifier?
      name: "cityOwnerAge",
      prepare() {
        state.cityBefore = { subject: ownersOf(subjects("CC_TEST_CITY_SUBJECT_EX")), owner: cityOwnerCase().owners, exPlayers: exPlayers() };
        return [grant("NODE_TECH_EX_CARTOGRAPHY")];
      },
      check() {
        const ex = exPlayers();
        const withCities = majors().filter((id) => (Players.get(id)?.Cities?.getCities()?.length ?? 0) > 0);
        const expected = ex.filter((id) => withCities.includes(id));
        const subj = subjects("CC_TEST_CITY_SUBJECT_EX"), own = cityOwnerCase();
        const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
        const r = {
          localInExploration: ex.includes(pid), exPlayers: ex, expectedOwners: expected, before: state.cityBefore,
          subjectCase: { owners: ownersOf(subj), count: subj.length, sample: subj.slice(0, 3) },
          // Attached (unconditionally) to every city; active only where the owner condition holds.
          ownerCase: { owners: own.owners, activeCities: own.active, attachedTo: ownersOf(subjects("CC_TEST_CITY_OWNER_EX_ATTACH")) },
        };
        r.subjectCase.works = ex.includes(pid) && same(ownersOf(subj), expected);
        r.ownerCase.works = ex.includes(pid) && same(own.owners, expected) && r.ownerCase.attachedTo.length > own.owners.length;
        r.answer = `city as subject: ${r.subjectCase.works ? "works" : "does not work"}; city as owner (town-focus projects): ${r.ownerCase.works ? "works" : "does not work"}`;
        r.pass = r.subjectCase.works && r.ownerCase.works;
        return r;
      },
    },
    {
      // Audit "could not decide" 1 (#2): do the personal-Age copies of Age-scaled bonuses switch on for this player?
      name: "ageScaledCopies",
      // The copies hang on traits, mementos, traditions and tree nodes: read the player's active list, not
      // getModifierSubjects (null for those). Only this leader's/civ's copies can switch on, so the count is small.
      prepare() {
        state.exActive = () => activeIds(P()).filter((id) => id.startsWith("CC_SA_EX_"));
        state.activeBefore = state.exActive().length;
        return ["counted before the Cartography grant of cityOwnerAge (same phase, runs after)"];
      },
      check() {
        const all = A(GameInfo.Modifiers).filter((m) => m.ModifierId.startsWith("CC_SA_EX_")).length;
        const active = state.exActive();
        const r = { exCopies: all, activeBefore: state.activeBefore, activeAfter: active.length, sample: active.slice(0, 5) };
        r.answer = `${active.length} Exploration copies (of ${all}, all leaders) active for the local player after entering Exploration (before: ${state.activeBefore})`;
        r.pass = active.length > state.activeBefore;
        return r;
      },
    },
    {
      // Audit "could not decide" 6: can an ideology be chosen (trees re-tagged to Antiquity in 25-civic-tree.sql)?
      // Two steps: Democracy can only be granted once the Political Theory grant has landed (a later phase).
      name: "ideology",
      steps: [
        () => { state.ideologyBefore = g(() => P().Culture.getChosenIdeology()); return ["NODE_TECH_MO_ACADEMICS", "NODE_CIVIC_MO_MAIN_POLITICAL_THEORY"].map(grant); },
        () => [grant("NODE_CIVIC_MO_BRANCH_DEMOCRACY")],
      ],
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
      // Two steps, as a player: Piety and a Temple (canCreateReligion turns true with both), then the request.
      name: "foundReligion",
      steps: [
        () => {
          const rel = P().Religion;
          state.relBefore = { canCreate: g(() => rel.canCreateReligion()), hasCreated: g(() => rel.hasCreatedReligion()) };
          const c = cities()[0];
          const temple = c && !g(() => c.Constructibles.hasConstructible("BUILDING_TEMPLE", false)) ? place(c, "BUILDING_TEMPLE") : "already there or no city";
          return [grant("NODE_CIVIC_EX_MAIN_PIETY"), "temple: " + JSON.stringify(temple)];
        },
        () => foundReligion(),
      ],
      check() {
        const rel = P().Religion;
        const r = { before: state.relBefore, ready: state.relReady, tried: state.relType, canStart: state.relCanStart,
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
  function foundReligion() {
    const rel = P().Religion;
    state.relReady = { canCreate: g(() => rel.canCreateReligion()), hasCreated: g(() => rel.hasCreatedReligion()) };
    if (state.relReady.hasCreated === true) return ["already has a religion"];
    const taken = new Set(A(g(() => Game.Religion.getReligions?.(), [])).map((x) => x?.religionType ?? x));
    const choice = A(GameInfo.Religions).find((x) => !taken.has(x.$hash) && !/PANTHEON/.test(x.ReligionType));
    state.relType = choice?.ReligionType;
    if (!choice) return ["no free religion type"];
    const args = { ReligionType: Database.makeHash(choice.ReligionType) };
    const res = Game.PlayerOperations.canStart(pid, PlayerOperationTypes.FOUND_RELIGION, args, false);
    state.relCanStart = { Success: res?.Success, FailureReasons: res?.FailureReasons ?? null };
    if (res?.Success) Game.PlayerOperations.sendRequest(pid, PlayerOperationTypes.FOUND_RELIGION, args);
    return [`FOUND_RELIGION ${choice.ReligionType}: ${res?.Success ? "sent" : "refused"}`];
  }
  // The city-owned test modifier (CC_TEST_CITY_OWNER_EX): which players' cities have it active.
  function cityOwnerCase() {
    const owners = [], active = [];
    for (const id of majors()) {
      for (const c of A(g(() => Players.get(id).Cities.getCities(), []))) {
        if (activeIds(c).includes("CC_TEST_CITY_OWNER_EX")) { active.push(g(() => Locale.compose(c.name))); if (!owners.includes(id)) owners.push(id); }
      }
    }
    return { owners: owners.sort((a, b) => a - b), active };
  }
  // Plots whose route is the given one (getRouteType may answer with the row index or the hash: both are accepted).
  function countRoute(ids) {
    if (!ids) return null;
    let n = 0; const w = GameplayMap.getGridWidth(), h = GameplayMap.getGridHeight();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ids.includes(GameplayMap.getRouteType(x, y))) n++;
    return n;
  }
  // Phases: what can share one turn (one AI turn passes between a phase's prepare and its check, so a grant has
  // landed before the next phase). "name" is a one-step probe (prepare); "name:k" is step k of a probe with steps.
  // A probe is checked after the phase of its last step. Cartography first (personal Exploration), then Modern.
  const phases = [["ageScaledCopies", "cityOwnerAge"], ["ideology:0", "foundReligion:0", "railStations"], ["ideology:1", "foundReligion:1"]];
  const byName = Object.fromEntries(probes.map((p) => [p.name, p]));
  const split = (e) => { const [n, k] = e.split(":"); return { n, k: k === undefined ? null : Number(k) }; };
  const isLast = ({ n, k }) => k === null || k === byName[n].steps.length - 1;
  const results = {};
  globalThis.CCProbe = {
    phases: phases.length,
    localPlayer: pid,
    prepare(i) {
      const out = {};
      for (const e of phases[i]) {
        const { n, k } = split(e);
        try { out[e] = k === null ? byName[n].prepare() : byName[n].steps[k](); } catch (err) { out[e] = "error: " + err; }
      }
      return JSON.stringify(out);
    },
    check(i) {
      const done = phases[i].map(split).filter(isLast).map((s) => s.n);
      for (const n of done) { try { results[n] = byName[n].check(); } catch (e) { results[n] = { pass: false, error: String(e) }; } }
      return JSON.stringify(Object.fromEntries(done.map((n) => [n, results[n]])));
    },
    results() { return JSON.stringify(results); },
  };
  return `CCProbe loaded: ${probes.length} probes in ${phases.length} phases, local player ${pid}, ${cities().length} cities`;
})();
