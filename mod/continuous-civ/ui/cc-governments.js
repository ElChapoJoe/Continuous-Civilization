// Continuous Civilization - Exploration governments in a permanent Antiquity (UI side).
// Gameplay side: data/35-governments.sql. The engine accepts a government change at any time after Chiefdom;
// vanilla only offers it through the government chooser at the start of an Age. This script:
//   * adds the Exploration governments the local player has unlocked (by civic) to the chooser's list;
//   * opens the chooser when the local player completes a civic that unlocks one;
//   * adds a "Change Government" button to the policies screen once any has been unlocked.
// Display only: the change itself is the normal CHANGE_GOVERNMENT player operation (multiplayer-safe).
// The AI keeps the government it picks at Chiefdom.
import ContextManager from '/core/ui/context-manager/context-manager.js';

const SET = "CC_GOVUNLOCK_";
const CHOOSER = "screen-government-chooser";

/** [{ gov: "GOVERNMENT_X", node: hash }] from the requirement sets 35-governments.sql creates. */
function readUnlocks() {
  const out = [];
  for (const s of GameInfo.RequirementSets) {
    if (!s.RequirementSetId.startsWith(SET)) continue;
    const gov = s.RequirementSetId.slice(SET.length);
    const arg = GameInfo.RequirementArguments.find(
      (a) => a.RequirementId == "CC_REQ_GOVUNLOCK_" + gov && a.Name == "ProgressionTreeNodeType");
    const node = arg && GameInfo.ProgressionTreeNodes.lookup(arg.Value);
    if (node && GameInfo.Governments.lookup(gov)) out.push({ gov, node: node.$hash });
  }
  return out;
}
const unlocks = readUnlocks();
const unlockNodes = new Set(unlocks.map((u) => u.node));

function unlockedGovernments() {
  const culture = Players.get(GameContext.localPlayerID)?.Culture;
  return culture ? unlocks.filter((u) => culture.isNodeUnlocked(u.node)).map((u) => u.gov) : [];
}

// The chooser lists GameInfo.StartingGovernments (read each time it opens). Append unlocked ones.
const table = GameInfo.StartingGovernments;
const baseIterator = table.__ccBaseIterator ?? table[Symbol.iterator];
Object.defineProperty(table, "__ccBaseIterator", { value: baseIterator, configurable: true });
Object.defineProperty(table, Symbol.iterator, {
  configurable: true,
  value: function* () {
    const seen = new Set();
    for (const row of baseIterator.call(this)) { seen.add(row.GovernmentType); yield row; }
    for (const gov of unlockedGovernments()) {
      if (!seen.has(gov)) yield { AgeType: "AGE_ANTIQUITY", GovernmentType: gov };
    }
  }
});

function openChooser() {
  if (!ContextManager.hasInstanceOf(CHOOSER)) {
    ContextManager.push(CHOOSER, { singleton: true, createMouseGuard: true });
  }
}

// A civic just unlocked a government: open the chooser once the civic-complete popup(s) are closed.
let pendingChooser = false;
engine.on("CultureNodeCompleted", (data) => {
  if (data.player != GameContext.localPlayerID || Autoplay.isActive) return;
  const node = GameInfo.ProgressionTreeNodes.lookup(data.activeNode);
  if (node && unlockNodes.has(node.$hash)) pendingChooser = true;
});

const BUTTON_ID = "cc-change-government";
let clearTicks = 0;   // several civic popups can be queued: wait until none has shown for 2 ticks
setInterval(() => {
  clearTicks = ContextManager.hasInstanceOf("screen-tech-civic-complete") ? 0 : clearTicks + 1;
  if (pendingChooser && clearTicks >= 2 && !Autoplay.isActive) {
    pendingChooser = false;
    openChooser();
  }
  // "Change Government" button on the policies screen.
  const screen = document.querySelector("screen-policies");
  if (!screen || screen.querySelector("#" + BUTTON_ID) || unlockedGovernments().length == 0) return;
  const button = document.createElement("fxs-button");
  button.id = BUTTON_ID;
  button.setAttribute("caption", "LOC_CC_CHANGE_GOVERNMENT");
  button.style.position = "absolute";
  button.style.top = "1.5rem";
  button.style.right = "6rem";
  button.style.zIndex = "10";
  button.addEventListener("action-activate", openChooser);
  screen.appendChild(button);
}, 1000);
