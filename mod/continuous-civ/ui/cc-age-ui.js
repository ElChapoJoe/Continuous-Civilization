// Continuous Civilization - interface parts that vanilla switches by the game Age (UI side; audit #17).
// The game Age never leaves Antiquity here, so these screens stayed in Antiquity mode all game. This script makes
// them follow the local player's personal Age (same root techs as data/70-personal-age.sql) or, where the information
// is about other players, show it whenever it exists:
//   * Diplomacy ribbon: shows each civ's religion (vanilla: Exploration only) and ideology (vanilla: Modern only)
//     whenever they have one.
//   * Naval units open the discovery lens while you are in Exploration, as in vanilla's Exploration.
//   * Unlocks screen: shows only the Ageless tab, as vanilla does in the final Age. Its Civilizations and Rewards
//     tabs are for Age transitions, which never happen here.
// Left alone on purpose:
//   * The trade route chooser's Modern mode also changes how routes are made; the engine runs Antiquity's trade rules
//     here, so its Antiquity mode matches what the game does.
//   * The continent lens: its Exploration view is about Treasure resources and its Modern view about researching
//     ruins left by earlier Ages; this mod has neither (no Treasure resources, no Age transitions to leave ruins).
// Display only.
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
