// Continuous Civilization - Triumph progress for Exploration and Modern Triumphs (UI side).
// data/80-triumphs.sql adds a personal-Age requirement to each later-Age Triumph's trigger. With two requirements
// the engine reports the set's progress differently: as a percentage per requirement (0-200, e.g. 105/200 for
// 1 of 20 relics), in raw units with the Age counted as 1 more (10/74), or for some requirement types in raw units of
// the goal alone (2/6 Modern wonders, left as is). The Triumphs screen and tracker show that
// number as is, so getProgress() is wrapped to take the Age requirement's share out and show the real count again
// (1/20). Display only: whether a Triumph triggers is still decided by the engine.
// Personal Age uses the same root techs as data/70-personal-age.sql.

function rootHashes(setId) {
  const out = [];
  for (const row of GameInfo.RequirementSetRequirements) {
    if (row.RequirementSetId !== setId) continue;
    const arg = GameInfo.RequirementArguments.find(
      (a) => a.RequirementId === row.RequirementId && a.Name === "ProgressionTreeNodeType");
    const node = arg && GameInfo.ProgressionTreeNodes.lookup(arg.Value);
    if (node) out.push(node.$hash);
  }
  return out;
}
const exploration = rootHashes("CC_REQSET_PERSONAL_AGE_EXPLORATION");
const modern = rootHashes("CC_REQSET_PERSONAL_AGE_MODERN");

function inPersonalAge(playerId, ageRequirement) {
  const techs = Players.get(playerId)?.Techs;
  if (!techs) return false;
  const roots = ageRequirement === "CC_REQ_IN_MODERN" ? modern : exploration;
  return roots.some((h) => techs.isNodeUnlocked(h)) || (ageRequirement === "CC_REQ_IN_EXPLORATION" && modern.some((h) => techs.isNodeUnlocked(h)));
}

// Requirement arguments that hold the goal of a count, and ones that make it a percentage.
const GOAL_ARGS = ["Count", "Amount", "Number", "Num", "RequiredCount", "CitiesConquered", "GoldSpentThreshold",
  "VPNeeded", "MinFilled", "MinSurplusHappiness"];
const PERCENT_ARGS = ["Percent", "PercentageThreshold"];

// Gated Triumphs by type hash: their trigger set, the Age requirement and the original requirement's goal.
const gated = new Map();
for (const lm of GameInfo.LegacyModifiers) {
  if (!/^LEGACY_(EX|MO)_/.test(lm.LegacyType)) continue;
  const reqs = GameInfo.RequirementSetRequirements.filter((r) => r.RequirementSetId === lm.RequirementSetId).map((r) => r.RequirementId);
  const ageReq = reqs.find((r) => r === "CC_REQ_IN_EXPLORATION" || r === "CC_REQ_IN_MODERN");
  if (!ageReq) continue;
  const own = reqs.filter((r) => r !== ageReq);
  // goal > 0: a count (e.g. 20 relics); -100: a percentage; 0: done or not done (shown as 0/1).
  let goal = 0;
  if (own.length === 1) {
    const args = GameInfo.RequirementArguments.filter((a) => a.RequirementId === own[0]);
    const count = args.find((a) => GOAL_ARGS.includes(a.Name));
    const percent = args.find((a) => PERCENT_ARGS.includes(a.Name))
      || args.find((a) => a.Name === "PlotsRevealedIsPercentage" && /true/i.test(a.Value));
    if (percent) goal = -100;
    else if (count) goal = Number(count.Value) || 0;
  }
  const def = GameInfo.Legacies.lookup(lm.LegacyType);
  if (def) gated.set(def.$hash, { set: lm.RequirementSetId, ageReq, goal });
}

function adjust(playerId, legacyType, result) {
  const hash = typeof legacyType === "string" ? GameInfo.Legacies.lookup(legacyType)?.$hash : legacyType;
  const g = gated.get(hash);
  const p = result?.progress?.[0];
  if (!g || !p || p.total <= 1) return result;
  const inAge = inPersonalAge(playerId, g.ageReq);
  let current, total;
  if (p.total === 200) {              // percentage per requirement
    const pct = Math.max(0, Math.min(100, p.current - (inAge ? 100 : 0)));
    total = g.goal > 0 ? g.goal : g.goal < 0 ? 100 : 1;
    // The engine's percentage is rounded down (1 of 6 = 16), so round back to the nearest count (16% of 6 = 1).
    current = Math.min(total, Math.round(pct * total / 100));
  } else if (g.goal > 0 && p.total === g.goal) {
    return result;                     // raw units without the Age (e.g. the Wonders Triumphs' 2/6)
  } else {                             // raw units, the Age counted as 1
    total = p.total - 1;
    current = Math.max(0, Math.min(total, p.current - (inAge ? 1 : 0)));
  }
  const progress = result.progress.slice();
  progress[0] = Object.assign({}, p, { current, total });
  return Object.assign({}, result, { progress });
}

function install() {
  const sample = Players.get(GameContext.localPlayerID)?.Legacies;
  if (!sample) return false;
  const proto = Object.getPrototypeOf(sample);
  if (proto.__ccTriumphs) return true;
  const original = proto.__ccOriginalGetProgress || proto.getProgress;
  proto.__ccOriginalGetProgress = original;
  proto.getProgress = function (legacyType) {
    const result = original.call(this, legacyType);
    try { return adjust(this.ownerId ?? this.owner ?? GameContext.localPlayerID, legacyType, result); }
    catch (e) { return result; }
  };
  proto.__ccTriumphs = true;
  return true;
}

(function tryInstall(attempt) {
  let ok = false;
  try { ok = install(); } catch (e) { console.error("cc-triumphs: " + e); }
  if (!ok && attempt < 20) setTimeout(() => tryInstall(attempt + 1), 500);
})(0);
