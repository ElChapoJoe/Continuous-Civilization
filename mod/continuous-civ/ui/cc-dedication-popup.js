// Continuous Civilization - Dedication picker popup (UI side).
// Vanilla offers Dedications on the Age-transition screen; that screen can't run mid-game (the advanced-start deck is
// closed after turn 1). data/83-dedications.sql turns Dedications into a Dedications attribute tree with 3 points per
// new personal Age. This popup is the vanilla-like front end: when the local player has Dedication points and
// earned Dedications they haven't taken, it lists them as cards and they pick up to as many as they have points.
// Picking buys the node (BUY_ATTRIBUTE_TREE_NODE, a normal operation). "Later" closes it; the Dedications tab of
// the attribute screen stays available, and the popup comes back at the start of a turn when something new is on
// offer (a newly earned Dedication or new points).
// Eligibility comes from ui/cc-dedications.js (globalThis.CCDedications).

const POPUP_ID = "cc-dedication-popup";
let dismissedKey = null;   // what was on offer when the player chose "Later"
let busy = false;
let retry = null;
let viewManager = null;       // the game's ViewManager: map input is switched off while the popup is open
let worldInputBefore = null;
import("/core/ui/views/view-manager.js").then((m) => { viewManager = m.default; }).catch(() => {});

/** The game shows its own popups and screens as <screen-*> elements (tech complete, natural wonder, ...). */
function gameScreenOpen() {
  const root = document.querySelector("#root") || document.body;
  for (const el of root.getElementsByTagName("*")) {
    if (el.tagName.startsWith("SCREEN-")) return true;
  }
  return false;
}

function offerFor(playerId) {
  const api = globalThis.CCDedications;
  const player = Players.get(playerId);
  if (!api || !player?.Identity) return null;
  const points = player.Identity.getAvailableAttributePoints("ATTRIBUTE_CC_DEDICATION");
  if (points <= 0) return null;
  const cards = api.available(playerId);
  if (!cards.length) return null;
  return { points, cards, key: points + ":" + cards.map((c) => c.index).join(",") };
}

function text(tag, ...args) {
  return Locale.stylize(tag, ...args);
}

function close() {
  document.getElementById(POPUP_ID)?.remove();
  if (viewManager && worldInputBefore !== null) viewManager.isWorldInputAllowed = worldInputBefore;
  worldInputBefore = null;
}

function show(playerId, offer) {
  close();
  const picks = new Set();
  const max = Math.min(offer.points, offer.cards.length);

  const root = document.createElement("div");
  root.id = POPUP_ID;
  root.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;z-index:900;display:flex;" +
    "align-items:center;justify-content:center;background-color:rgba(0,0,0,0.55);pointer-events:auto;";

  const frame = document.createElement("fxs-frame");
  frame.style.cssText = "width:78rem;max-width:92%;max-height:86%;display:flex;flex-direction:column;";

  const header = document.createElement("fxs-header");
  header.setAttribute("title", "LOC_CC_DEDICATION_POPUP_TITLE");
  header.setAttribute("filigree-style", "h3");
  frame.appendChild(header);

  const intro = document.createElement("div");
  intro.classList.add("font-body", "text-base", "text-accent-2", "text-center", "mb-3", "mx-6");
  frame.appendChild(intro);

  const scroll = document.createElement("fxs-scrollable");
  scroll.style.cssText = "flex:1 1 auto;min-height:20rem;max-height:46rem;";
  const grid = document.createElement("div");
  grid.style.cssText = "display:flex;flex-wrap:wrap;justify-content:center;padding:0.5rem;";
  scroll.appendChild(grid);
  frame.appendChild(scroll);

  const buttons = document.createElement("div");
  buttons.style.cssText = "display:flex;flex-direction:row;justify-content:center;margin-top:1rem;";
  const confirm = document.createElement("fxs-button");
  confirm.classList.add("mx-4");
  const later = document.createElement("fxs-button");
  later.classList.add("mx-4");
  later.setAttribute("caption", "LOC_CC_DEDICATION_POPUP_LATER");
  buttons.appendChild(confirm);
  buttons.appendChild(later);
  frame.appendChild(buttons);
  root.appendChild(frame);

  const tiles = [];
  const refresh = () => {
    intro.innerHTML = text("LOC_CC_DEDICATION_POPUP_INTRO", max - picks.size);
    confirm.setAttribute("caption", picks.size ? "LOC_CC_DEDICATION_POPUP_CONFIRM" : "LOC_CC_DEDICATION_POPUP_CONFIRM_NONE");
    confirm.setAttribute("disabled", picks.size ? "false" : "true");
    for (const t of tiles) {
      const on = picks.has(t.card.index);
      t.el.style.borderColor = on ? "#e5d2ac" : "rgba(133,127,112,0.6)";
      t.el.style.backgroundColor = on ? "rgba(120,96,48,0.55)" : "rgba(20,24,32,0.85)";
      t.mark.textContent = on ? "✓" : "";
    }
  };

  for (const card of offer.cards) {
    const el = document.createElement("fxs-activatable");
    el.style.cssText = "width:22rem;min-height:11rem;margin:0.5rem;padding:1rem;border-width:0.15rem;" +
      "border-style:solid;display:flex;flex-direction:column;";
    const top = document.createElement("div");
    top.style.cssText = "display:flex;flex-direction:row;justify-content:space-between;";
    const name = document.createElement("div");
    name.classList.add("font-title", "text-sm", "uppercase", "text-secondary");
    name.innerHTML = text(card.name);
    const mark = document.createElement("div");
    mark.classList.add("font-title", "text-lg", "text-secondary");
    top.appendChild(name);
    top.appendChild(mark);
    const source = document.createElement("div");
    source.classList.add("font-body", "text-xs", "text-accent-3", "mb-2");
    if (Locale.compose(card.triumphName) !== Locale.compose(card.name))   // usually the same name
      source.innerHTML = text("LOC_CC_DEDICATION_POPUP_FROM", card.triumphName);
    const desc = document.createElement("div");
    desc.classList.add("font-body", "text-sm", "text-accent-1");
    desc.innerHTML = text(card.description);
    el.appendChild(top);
    el.appendChild(source);
    el.appendChild(desc);
    el.addEventListener("action-activate", () => {
      if (picks.has(card.index)) picks.delete(card.index);
      else if (picks.size < max) picks.add(card.index);
      refresh();
    });
    tiles.push({ card, el, mark });
    grid.appendChild(el);
  }

  confirm.addEventListener("action-activate", () => {
    if (!picks.size) return;
    for (const index of picks) {
      const args = { ProgressionTreeNodeType: index };
      if (Game.PlayerOperations.canStart(playerId, PlayerOperationTypes.BUY_ATTRIBUTE_TREE_NODE, args, false).Success)
        Game.PlayerOperations.sendRequest(playerId, PlayerOperationTypes.BUY_ATTRIBUTE_TREE_NODE, args);
    }
    dismissedKey = null;
    close();
  });
  later.addEventListener("action-activate", () => {
    dismissedKey = offer.key;
    close();
  });

  refresh();
  (document.querySelector("#root") || document.body).appendChild(root);
  if (viewManager) {
    worldInputBefore = viewManager.isWorldInputAllowed;
    viewManager.isWorldInputAllowed = false;
  }
}

function check() {
  if (busy) return;
  busy = true;
  try {
    const playerId = GameContext.localPlayerID;
    if (playerId == null || playerId < 0 || (typeof Autoplay !== "undefined" && Autoplay.isActive)) return;
    if (document.getElementById(POPUP_ID)) return;
    const offer = offerFor(playerId);
    if (!offer || offer.key === dismissedKey) return;
    if (gameScreenOpen()) {        // wait until the game's own popups at turn start are closed
      if (!retry) retry = setTimeout(() => { retry = null; check(); }, 2000);
      return;
    }
    show(playerId, offer);
  } catch (e) {
    console.error("cc-dedication-popup: " + e);
  } finally {
    busy = false;
  }
}

globalThis.CCDedicationPopup = { check, close, reset: () => { dismissedKey = null; } };
engine.on("LocalPlayerTurnBegin", check);
setTimeout(check, 4000);   // a loaded game that already has points to spend
