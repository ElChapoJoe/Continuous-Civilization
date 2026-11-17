// Continuous Civilization - dev helpers for the game's debug console. Load once per UI session (after a UI reload too).
// Everything here is a test shortcut; nothing runs unless called. Returns JSON strings so console output is readable.
//   CCDev.status()                 turn, local player, autoplay, each civ's personal Age and the world Age
//   CCDev.victory()                victory points per civ, Launch Pads / space projects, victories won
//   CCDev.balance()                per-civ numbers for balance reports (tools/balance-run.mjs): Age, cities, population,
//                                  overseas cities, techs, civics, net yields, victory points
//   CCDev.costs(pid)               a few Influence costs and tech/civic costs for a player (cost-rule checks)
//   CCDev.load(name[, auto])       load a save by file name (normal folder, or the autosave folder if auto=true)
//   CCDev.save(name)               save the game under a name (fails while no local player is alive)
//   CCDev.newGame()                new map, same setup, database rebuilt from the deployed mod (Network.restartGame)
//   CCDev.autoplay(turns[, pid])   AI autoplay for n turns, returning control to pid (default 0)
//   CCDev.stopAutoplay()
//   CCDev.grant(pid, node)         give a tech/civic (only works for the local human player)
//   CCDev.wildcard(pid, n)         add Wildcard attribute points
//   CCDev.exitToDesktop()          quit the game (then tools\restart-civ.ps1 to start it again)
//   CCDev.run(asyncFn) / CCDev.result()  the console can't await: run() starts it, result() reads the answer later
(function () {
  const J = (o) => JSON.stringify(o);
  const hashOf = (n) => GameInfo.ProgressionTreeNodes.lookup(n)?.$hash;
  const roots = (setId) => {
    const out = [];
    for (const row of GameInfo.RequirementSetRequirements) {
      if (row.RequirementSetId !== setId) continue;
      const arg = GameInfo.RequirementArguments.find((a) => a.RequirementId === row.RequirementId && a.Name === "ProgressionTreeNodeType");
      if (arg) out.push(hashOf(arg.Value));
    }
    return out.filter((h) => h != null);
  };
  const exRoots = roots("CC_REQSET_PERSONAL_AGE_EXPLORATION"), moRoots = roots("CC_REQSET_PERSONAL_AGE_MODERN");
  const ageOf = (pid) => {
    const t = Players.get(pid)?.Techs;
    if (!t) return "?";
    return moRoots.some((h) => t.isNodeUnlocked(h)) ? "MO" : exRoots.some((h) => t.isNodeUnlocked(h)) ? "EX" : "AQ";
  };
  const subjects = (id) => { try { return Game.Modifiers.getModifierSubjects(Game.getHash(id))?.length ?? 0; } catch (e) { return -1; } };
  const civName = (pid) => GameInfo.Civilizations.lookup(Players.get(pid).civilizationType)?.CivilizationType?.replace("CIVILIZATION_", "");
  const saveArgs = (name, auto) => ({
    Location: SaveLocations.LOCAL_STORAGE, LocationCategories: auto ? SaveLocationCategories.AUTOSAVE : SaveLocationCategories.NORMAL,
    Type: SaveTypes.SINGLE_PLAYER, ContentType: SaveFileTypes.GAME_STATE,
    FileName: name.endsWith(".Civ7Save") ? name : name + ".Civ7Save", DisplayName: name.replace(/\.Civ7Save$/, "") });

  const CCDev = {
    status() {
      const ids = Players.getAliveMajorIds();
      return J({
        turn: Game.turn, local: GameContext.localPlayerID, autoplay: Autoplay.isActive,
        civs: ids.map((id) => `${id}:${civName(id)}:${ageOf(id)}`),
        world: subjects("CC_TEST_WORLD_MODERN") > 0 ? "MO" : subjects("CC_TEST_WORLD_EXPLORATION") > 0 ? "EX" : "AQ",
      });
    },
    victory() {
      const types = { C: "VICTORY_CULTURE_MODERN", S: "VICTORY_SCIENCE_MODERN", E: "VICTORY_ECONOMIC_MODERN", M: "VICTORY_MILITARY_MODERN" };
      const pad = GameInfo.Constructibles.lookup("BUILDING_LAUNCH_PAD");
      const projs = ["PROJECT_TRANS_OCEANIC_FLIGHT", "PROJECT_BREAK_SOUND_BARRIER", "PROJECT_LAUNCH_SATELLITE", "PROJECT_LAUNCH_ROCKET"];
      const out = { turn: Game.turn, targets: {}, civs: {} };
      for (const [k, t] of Object.entries(types)) out.targets[k] = GameInfo.VictoryTypes.lookup(t)?.MinimumPoints;
      for (const id of Players.getAliveMajorIds()) {
        const p = Players.get(id), o = { civ: civName(id), age: ageOf(id) };
        for (const [k, t] of Object.entries(types)) { try { o[k] = p.Victories.getPointsForVictoryType(GameInfo.Victories.lookup(t).$hash); } catch (e) { o[k] = "?"; } }
        o.pads = p.Cities.getCities().filter((c) => { try { return c.Constructibles.hasConstructible(pad.$hash, false); } catch (e) { return false; } }).length;
        o.space = projs.map((x) => { try { return p.Stats.getNumProjectsAdvanced(GameInfo.Projects.lookup(x).$hash); } catch (e) { return "?"; } }).join("");
        o.cities = p.Cities.getCities().length;
        out.civs[id] = o;
      }
      try { out.won = (Game.VictoryManager.getVictories() || []).map((v) => ({ team: v.team, turn: v.turn, victory: GameInfo.Victories.lookup(v.victory)?.VictoryType })); } catch (e) {}
      return J(out);
    },
    balance() {
      // One row per living major civ. Every field is guarded: a missing API gives null, not a failed snapshot.
      const g = (f) => { try { const v = f(); return v == null || Number.isNaN(v) ? null : v; } catch (e) { return null; } };
      const yields = { sci: "YIELD_SCIENCE", cul: "YIELD_CULTURE", gold: "YIELD_GOLD", prod: "YIELD_PRODUCTION",
        food: "YIELD_FOOD", infl: "YIELD_DIPLOMACY", happy: "YIELD_HAPPINESS" };
      const vps = { vpC: "VICTORY_CULTURE_MODERN", vpS: "VICTORY_SCIENCE_MODERN", vpE: "VICTORY_ECONOMIC_MODERN", vpM: "VICTORY_MILITARY_MODERN" };
      const done = (tree) => g(() => tree.getResearched().filter((h) => (h?.state ?? 5) >= 4).length);
      const out = { turn: Game.turn, world: JSON.parse(CCDev.status()).world, civs: [] };
      for (const id of Players.getAliveMajorIds()) {
        const p = Players.get(id), cities = g(() => p.Cities.getCities()) || [];
        const o = { id, civ: civName(id), age: ageOf(id), cities: cities.length,
          pop: g(() => cities.reduce((n, c) => n + (c.population || 0), 0)),
          techs: done(p.Techs), civics: done(p.Culture), units: g(() => p.Units.getUnits().length),
          // Settled across the Ocean: cities in the player's Distant Lands, and how many continents hold a city.
          overseas: g(() => cities.filter((c) => p.isDistantLands(c.location)).length),
          continents: g(() => new Set(cities.map((c) => GameplayMap.getContinentType(c.location.x, c.location.y))).size) };
        for (const [k, t] of Object.entries(yields)) o[k] = g(() => Math.round(p.Stats.getNetYield(YieldTypes[t])));
        for (const [k, t] of Object.entries(vps)) o[k] = g(() => p.Victories.getPointsForVictoryType(GameInfo.Victories.lookup(t).$hash));
        out.civs.push(o);
      }
      return J(out);
    },
    costs(pid = GameContext.localPlayerID) {
      const other = Players.getAliveMajorIds().find((x) => x !== pid);
      const d = (a) => GameInfo.DiplomacyActions.lookup(a).$hash;
      const p = Players.get(pid);
      const cost = (sys, n) => { try { return (sys === "t" ? p.Techs : p.Culture).getNodeCost(hashOf(n)); } catch (e) { return "?"; } };
      return J({
        pid, age: ageOf(pid),
        influence: Object.fromEntries(["DENOUNCE", "OPEN_BORDERS", "ESPIONAGE_STEAL_TECH"].map((a) => [a, Game.Diplomacy.getInfluenceForBaseAction(d("DIPLOMACY_ACTION_" + a), pid, other)])),
        tech: { AQ_WRITING: cost("t", "NODE_TECH_AQ_WRITING"), EX_CARTOGRAPHY: cost("t", "NODE_TECH_EX_CARTOGRAPHY"), MO_ACADEMICS: cost("t", "NODE_TECH_MO_ACADEMICS") },
        civic: { AQ_MYSTICISM: cost("c", "NODE_CIVIC_AQ_MAIN_MYSTICISM"), EX_PIETY: cost("c", "NODE_CIVIC_EX_MAIN_PIETY") },
      });
    },
    load(name, auto = false) { return Network.loadGame(saveArgs(name, auto), ServerType.SERVER_TYPE_NONE); },
    save(name) { return Network.saveGame(saveArgs(name, false)); },
    newGame() { return Network.restartGame(); },
    autoplay(turns, pid = 0) { Autoplay.setTurns(turns); Autoplay.setReturnAsPlayer(pid); Autoplay.setObserveAsPlayer(pid); Autoplay.setActive(true); return Autoplay.isActive; },
    stopAutoplay() { Autoplay.setActive(false); return Autoplay.isActive; },
    grant(pid, nodeType) {
      // The engine accepts the request for any player but only applies it to the local human player.
      if (pid !== GameContext.localPlayerID) return "not applied: grants only work for the local player (" + GameContext.localPlayerID + ")";
      const n = GameInfo.ProgressionTreeNodes.lookup(nodeType);
      const args = { ProgressionTreeNodeType: n.$index, FullyUnlock: 1 };
      if (!Game.PlayerOperations.canStart(pid, PlayerOperationTypes.GRANT_TREE_NODE, args, false).Success) return "refused (a turn-1 dialog may still be open)";
      Game.PlayerOperations.sendRequest(pid, PlayerOperationTypes.GRANT_TREE_NODE, args);
      return "granted " + nodeType;
    },
    wildcard(pid, n) { Players.get(pid).Identity.addWildcardAttributePoints(n); return "added"; },
    exitToDesktop() { engine.call("exitToDesktop"); return "exiting"; },
    run(fn) {
      globalThis.__ccDevResult = "pending";
      Promise.resolve().then(fn).then((r) => { globalThis.__ccDevResult = typeof r === "string" ? r : J(r); }, (e) => { globalThis.__ccDevResult = "error " + e; });
      return "started; read it with CCDev.result()";
    },
    result() { return globalThis.__ccDevResult; },
  };
  globalThis.CCDev = CCDev;
  return "CCDev loaded: " + Object.keys(CCDev).join(",");
})();
