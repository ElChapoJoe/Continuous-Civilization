// Continuous Civilization - Age-dependency audit of the LOADED gameplay database.
// Run in a game with the mod (FireTuner / civ7 execute_js_file), then call CCAge.audit().
// Lists every remaining Age dependency so nothing silently never fires in a never-ending Antiquity:
//   kind 3  REQUIREMENT_GAME_AGE_TYPE_MATCH  ("the current Age is X")
//   kind 4  REQUIREMENT_IS_AGE_COUNT         ("N Age transitions have happened")
//   kind 2  rows tagged with a later Age in tables the engine filters by the current Age
// Requirements already rewritten to the personal Age (data/70-personal-age.sql) are reported separately.
(function () {
  const A = (t) => { const o = []; if (t) for (const x of t) o.push(x); return o; };
  const CHALLENGE = /^(CHALLENGE_|REQSET_.*_TRIUMPH|.*_TRIUMPHS?_)/;

  function users(setIds) {
    const set = new Set(setIds);
    const mods = A(GameInfo.Modifiers).filter((m) => set.has(m.SubjectRequirementSetId) || set.has(m.OwnerRequirementSetId));
    const trees = A(GameInfo.ProgressionTrees).filter((t) => set.has(t.RevealRequirementSetId)).map((t) => t.ProgressionTreeType);
    const stories = A(GameInfo.NarrativeStories).filter((s) => set.has(s.RequirementSetId)).map((s) => s.NarrativeStoryType);
    // nested: sets that contain REQUIREMENT_REQUIREMENTSET_IS_MET pointing at one of ours
    const nested = A(GameInfo.RequirementArguments).filter((a) => a.Name === "RequirementSetId" && set.has(a.Value)).map((a) => a.RequirementId);
    return { mods: mods.map((m) => m.ModifierId), trees, stories, nested };
  }

  function requirementAudit(type) {
    const reqs = A(GameInfo.Requirements).filter((q) => q.RequirementType === type);
    const args = A(GameInfo.RequirementArguments);
    const srr = A(GameInfo.RequirementSetRequirements);
    const gm = new Set(A(GameInfo.GameModifiers).map((g) => g.ModifierId));
    const rows = [];
    for (const q of reqs) {
      const a = args.filter((x) => x.RequirementId === q.RequirementId).map((x) => x.Name + "=" + x.Value).join(",");
      const sets = srr.filter((s) => s.RequirementId === q.RequirementId).map((s) => s.RequirementSetId);
      const u = users(sets);
      const challenge = CHALLENGE.test(q.RequirementId) || (u.mods.length > 0 && u.mods.every((m) => /^CHALLENGE_/.test(m)));
      rows.push({ id: q.RequirementId, inverse: !!q.Inverse, args: a, sets, challenge,
        mods: u.mods.slice(0, 6), modCount: u.mods.length, activeGameMods: u.mods.filter((m) => gm.has(m)).length,
        trees: u.trees, stories: u.stories.slice(0, 4), storyCount: u.stories.length, nested: u.nested.slice(0, 4) });
    }
    return rows;
  }

  const AGE_TABLES = [
    ["Constructibles", "Age"], ["Warehouse_YieldChanges", "Age"], ["Adjacency_YieldChanges", "Age"],
    ["ProgressionTrees", "AgeType"], ["StartingGovernments", "AgeType"], ["Traditions", "AgeType"],
    ["GreatPersonIndividuals", "AgeType"], ["NarrativeStories", "Age"], ["Legacies", "Age"], ["LegacyPaths", "AgeType"],
    ["HappinessStages", "Age"], ["AgeGrowthBalances", "Age"], ["Crises", "AgeType"], ["CivilizationItems", "AgeType"],
    ["GreatWorks", "AgeType"], ["Resource_ValidAges", "AgeType"], ["NarrativeStory_Yield_Rewards", "Age"],
    ["DiscoveryStory_Yield_Rewards", "Age"], ["AgeCrisisEvents", "Age"], ["StartingPolicies", "AgeType"]
  ];
  function columnAudit() {
    const out = {};
    for (const [t, c] of AGE_TABLES) {
      const tbl = GameInfo[t]; if (!tbl) { out[t] = "n/a"; continue; }
      const counts = {};
      for (const r of tbl) { const v = r[c]; if (v) counts[v] = (counts[v] || 0) + 1; }
      out[t + "." + c] = counts;
    }
    return out;
  }

  globalThis.CCAge = {
    audit() {
      const k3 = requirementAudit("REQUIREMENT_GAME_AGE_TYPE_MATCH");
      const k4 = requirementAudit("REQUIREMENT_IS_AGE_COUNT");
      const summarize = (rows) => ({
        total: rows.length,
        challenge: rows.filter((r) => r.challenge).length,
        gameplay: rows.filter((r) => !r.challenge)
      });
      return { kind3: summarize(k3), kind4: summarize(k4), kind2: columnAudit() };
    }
  };
  return "CCAge loaded: audit()";
})();
