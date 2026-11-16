// Continuous Civilization - interface parts that vanilla switches by the game Age (UI side; audit #17).
// The game Age never leaves Antiquity here, so these screens stayed in Antiquity mode all game. This script makes
// them follow the local player's personal Age (same root techs as data/3-merge/70-personal-age.sql) or, where the information
// is about other players, show it whenever it exists:
//   * Diplomacy ribbon: shows each civ's religion (vanilla: Exploration only) and ideology (vanilla: Modern only)
//     whenever they have one.
//   * Naval units open the discovery lens while you are in Exploration, as in vanilla's Exploration.
//   * Unlocks screen: shows only the Ageless tab, as vanilla does in the final Age. Its Civilizations and Rewards
//     tabs are for Age transitions, which never happen here.
//   * Victories screen, Culture tab: the bars span the turns played so far (they were scaled to the Age meter,
//     which never fills here, so every point sat at 0%). Summary tab: the Science goal shows (vanilla hides it in
//     Antiquity).
//   * Purchases: a town can't buy a building whose tech or civic you lack (the engine allows it for tag-purchase
//     towns; local player only).
// Left alone on purpose:
//   * The trade route chooser's Modern mode also changes how routes are made; the engine runs Antiquity's trade rules
//     here, so its Antiquity mode matches what the game does.
//   * The continent lens: its Exploration view is about Treasure resources and its Modern view about researching
//     ruins left by earlier Ages; this mod has neither (no Treasure resources, no Age transitions to leave ruins).
// Display only, except the purchase check (see below).
import { DiploRibbonData } from '/base-standard/ui/diplo-ribbon/model-diplo-ribbon.js';
import { registerUnitLensSelector } from '/core/ui/lenses/lens-manager.js';

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
const explorationRoots = rootHashes("CC_REQSET_PERSONAL_AGE_EXPLORATION");
const modernRoots = rootHashes("CC_REQSET_PERSONAL_AGE_MODERN");

/** The local player's personal Age: 0 Antiquity, 1 Exploration, 2 Modern. */
function localAge() {
  const techs = Players.get(GameContext.localPlayerID)?.Techs;
  if (!techs) return 0;
  if (modernRoots.some((h) => techs.isNodeUnlocked(h))) return 2;
  if (explorationRoots.some((h) => techs.isNodeUnlocked(h))) return 1;
  return 0;
}

function defineGetter(proto, name, get) {
  Object.defineProperty(proto, name, { get, configurable: true });
}

// Diplomacy ribbon: religion and ideology whenever a civ has them.
try {
  const proto = Object.getPrototypeOf(DiploRibbonData);
  if (proto && !proto.__ccAgeUi) {
    defineGetter(proto, "isExplorationAge", () => true);
    defineGetter(proto, "isModernAge", () => true);
    Object.defineProperty(proto, "__ccAgeUi", { value: true });
  }
  // The ribbon may have built its player data before this script loaded: rebuild it once the game is running.
  const refresh = () => { try { DiploRibbonData.updateAll?.(); } catch (e) { /* not ready yet */ } };
  setTimeout(refresh, 3000);
  engine.on("LocalPlayerTurnBegin", refresh);
} catch (e) {
  console.error("cc-age-ui: diplomacy ribbon: " + e);
}

// Naval units open the discovery lens in your Exploration (vanilla adds them to its auto-explore list in Exploration).
registerUnitLensSelector((unit) => {
  const def = GameInfo.Units.lookup(unit.type);
  return def?.FormationClass == "FORMATION_CLASS_NAVAL" && localAge() === 1 ? "fxs-discovery-lens" : void 0;
});

// Victories screen, Culture tab: each civ's bar places its points by the turn they were earned, divided by the Age
// progress maximum. This mod keeps the Age meter at 0 of a huge maximum (data/3-merge/10-age-clock.sql) so the Age never
// ends, which put every point at 0% of the bar. For calls from the victories screen only, the Age progress reads as
// "turns played so far", so the bar spans the whole game. Everywhere else the engine's values are unchanged.
try {
  const apm = Game.AgeProgressManager;
  const proto = Object.getPrototypeOf(apm);
  if (!proto.__ccAgeUi) {
    const fromVictoriesScreen = () => /victories-screen-model\.js/.test(new Error().stack || "");
    const getMax = proto.getMaxAgeProgressionPoints, getCurrent = proto.getCurrentAgeProgressionPoints;
    proto.getMaxAgeProgressionPoints = function () {
      return fromVictoriesScreen() ? Math.max(1, Game.turn) : getMax.call(this);
    };
    proto.getCurrentAgeProgressionPoints = function () {
      return fromVictoriesScreen() ? Math.max(1, Game.turn) : getCurrent.call(this);
    };
    Object.defineProperty(proto, "__ccAgeUi", { value: true });
  }
} catch (e) {
  console.error("cc-age-ui: victories screen: " + e);
}

// Victories screen, Summary tab: vanilla hides the Science goal (shows -1 and a "locked" tooltip) while the game Age
// is Antiquity, where the space race can't happen. Here it can, so that one check (victories-screen-model.js line 563
// as of Nov 2026: `GameInfo.Ages.lookup(Game.age)?.AgeType === "AGE_ANTIQUITY"` for the Science class) gets the
// Modern Age instead. Matched by its line in the call stack: if a game patch moves it, the card just shows -1 again.
try {
  const ages = GameInfo.Ages;
  if (!ages.__ccAgeUi) {
    const lookup = ages.lookup;
    ages.lookup = function (key) {
      if (key === Game.age && /victories-screen-model\.js:563:/.test(new Error().stack || "")) {
        return lookup.call(this, "AGE_MODERN");
      }
      return lookup.call(this, key);
    };
    Object.defineProperty(ages, "__ccAgeUi", { value: true });
  }
} catch (e) {
  console.error("cc-age-ui: victories summary: " + e);
}

// Town purchases of locked buildings. A town that may buy buildings of a tag (Augustus's Culture buildings, Factory and
// Fort Town focuses, the Carthage, England, Gaul and Joseon abilities) is allowed by the engine to buy such a building
// before its tech or civic: the answer is Locked, with the missing unlock named, but Success. Vanilla has this within
// one Age; here every Age's buildings are loaded, so a town could buy Modern buildings in Antiquity (seen: an Opera
// House before Urbanization). The engine has no per-player block, so the purchase screen and the purchase request
// treat a locked building as not purchasable, for the local player. The AI is not affected. Same issue in the
// Continuous Ages mod (U-TOWN-PURCHASE).
try {
  const cc = Game.CityCommands;
  if (!cc.__ccAgeUi) {
    const isLockedPurchase = (r) => r && r.Success && r.Locked && r.NeededUnlock != null && r.NeededUnlock != -1;
    const block = (r) => Object.assign({}, r, { Success: false });
    const canStart = cc.canStart, canStartQuery = cc.canStartQuery, sendRequest = cc.sendRequest;
    cc.canStart = function (cityId, command, args, test) {
      const r = canStart.call(this, cityId, command, args, test);
      return command === CityCommandTypes.PURCHASE && args?.ConstructibleType != null && isLockedPurchase(r) ? block(r) : r;
    };
    cc.canStartQuery = function (cityId, command, queryType) {
      const results = canStartQuery.call(this, cityId, command, queryType);
      if (command !== CityCommandTypes.PURCHASE || !Array.isArray(results)) return results;
      return results.map((e) => (isLockedPurchase(e?.result) ? Object.assign({}, e, { result: block(e.result) }) : e));
    };
    cc.sendRequest = function (cityId, command, args) {
      if (command === CityCommandTypes.PURCHASE && args?.ConstructibleType != null) {
        const r = canStart.call(this, cityId, command, args, false);
        if (isLockedPurchase(r)) { console.warn("cc-age-ui: refused purchase of a locked building"); return; }
      }
      return sendRequest.call(this, cityId, command, args);
    };
    Object.defineProperty(cc, "__ccAgeUi", { value: true });
  }
} catch (e) {
  console.error("cc-age-ui: town purchases: " + e);
}

/** Unlocks screen: patch its class once it is defined. */
function patchUnlocks() {
  const proto = Controls.getDefinition?.("screen-unlocks")?.createInstance?.prototype;
  if (!proto) return false;
  if (!proto.__ccAgeUi) {
    const onAttach = proto.onAttach;
    proto.onAttach = function () {
      this.curAgeChrono = this.lastAgeChrono;
      return onAttach.call(this);
    };
    Object.defineProperty(proto, "__ccAgeUi", { value: true });
  }
  return true;
}
let tries = 0;
const timer = setInterval(() => {
  let done = false;
  try { done = patchUnlocks(); } catch (e) { console.error("cc-age-ui: " + e); }
  if (done || ++tries > 120) clearInterval(timer);
}, 500);
