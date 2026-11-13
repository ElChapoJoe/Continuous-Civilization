// Continuous Civilization - city-state bonus choices by personal Age (UI side).
// The mod loads the city-state bonuses of all three Ages, and the engine offers any of them: vanilla only ever
// has the current Age's set loaded. The bonus chooser lists every bonus for which
// Game.CityStates.canHaveBonus() is true, and nothing else calls that function, so this script narrows it to
// the bonuses of the player's personal Age (the Age is in the type name: CITY_STATE_BONUS_MODERN_3,
// CITY_STATE_SCIENTIFIC_BONUS_MODERN_6).
// Personal Age uses the same root techs as data/70-personal-age.sql.
// If no bonus of that Age is available for the city-state (all taken), every bonus the engine allows is offered,
// so the choice can never be empty.
// Display only: the selection is still the normal player operation and the engine still validates it. The AI
// picks its bonuses inside the engine and is not affected.
const AGES = ["ANTIQUITY", "EXPLORATION", "MODERN"];

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

function personalAge(playerId) {
  const techs = Players.get(playerId)?.Techs;
  if (!techs) return 0;
  if (modern.some((h) => techs.isNodeUnlocked(h))) return 2;
  if (exploration.some((h) => techs.isNodeUnlocked(h))) return 1;
  return 0;
}

/** Age index of a bonus from its type name, or -1 if the name doesn't say. */
function bonusAge(bonus) {
  const def = typeof bonus === "string"
    ? GameInfo.CityStateBonuses.lookup(bonus)
    : GameInfo.CityStateBonuses.find((b) => b.$hash === bonus);
  // CITY_STATE_BONUS_MODERN_3 and CITY_STATE_SCIENTIFIC_BONUS_MODERN_6 both occur.
  const m = def?.CityStateBonusType.match(/BONUS_(ANTIQUITY|EXPLORATION|MODERN)_/);
  return m ? AGES.indexOf(m[1]) : -1;
}

const cityStates = Game.CityStates;
const base = cityStates.__ccBaseCanHaveBonus ?? cityStates.canHaveBonus;
Object.defineProperty(cityStates, "__ccBaseCanHaveBonus", { value: base, configurable: true, writable: true });

let cache = { key: "", time: 0, any: false };
/** True if the engine allows at least one bonus of this Age for the player and city-state. */
function anyOfAge(player, cityState, age) {
  const key = player + "/" + cityState + "/" + age;
  const now = Date.now();
  if (cache.key === key && now - cache.time < 1000) return cache.any;
  let any = false;
  for (const b of GameInfo.CityStateBonuses) {
    if (bonusAge(b.CityStateBonusType) === age && base.call(cityStates, player, cityState, b.CityStateBonusType)) {
      any = true;
      break;
    }
  }
  cache = { key, time: now, any };
  return any;
}

cityStates.canHaveBonus = function (player, cityState, bonus) {
  const allowed = base.call(cityStates, player, cityState, bonus);
  if (!allowed) return false;
  try {
    const age = personalAge(player);
    const own = bonusAge(bonus);
    if (own < 0 || own === age) return true;
    return !anyOfAge(player, cityState, age);
  } catch (e) {
    console.error("cc-city-state-bonuses: " + e);
    return true;
  }
};
