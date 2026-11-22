// Continuous Civilization - the "new Age" banner, per player.
// In vanilla, when the Age changes everyone sees the "The <Age> Age Has Begun" banner (age-transition-banner,
// "age-start"). Here the game Age never changes, so nobody saw it. This shows that banner to the local player when
// they research into their personal Exploration or Modern Age, with their Age in the text (the banner itself reads the
// game Age, always Antiquity here). Shown through vanilla's display queue, after the tech-complete popup (priority
// 8500); never during autoplay or multiplayer; once per Age (not again after a load). When another civilization
// enters a new personal Age, a short notice shows instead ("An unmet civilization" if not met). Personal Age uses the
// root techs of data/3-merge/70-personal-age.sql, like ui/cc-triumphs.js.
import ContextManager from '/core/ui/context-manager/context-manager.js';
import { DisplayHandlerBase } from '/core/ui/context-manager/display-handler.js';
import { DisplayQueueManager } from '/core/ui/context-manager/display-queue-manager.js';

const AGES = ["AGE_ANTIQUITY", "AGE_EXPLORATION", "AGE_MODERN"];
const CATEGORY = "CCAgeScene";

function rootHashes(setId) {
  const out = [];
  for (const row of GameInfo.RequirementSetRequirements) {
    if (row.RequirementSetId !== setId) continue;
    const arg = GameInfo.RequirementArguments.find((a) => a.RequirementId === row.RequirementId && a.Name === "ProgressionTreeNodeType");
    const node = arg && GameInfo.ProgressionTreeNodes.lookup(arg.Value);
    if (node) out.push(node.$hash);
  }
  return out;
}
const roots = [null, rootHashes("CC_REQSET_PERSONAL_AGE_EXPLORATION"), rootHashes("CC_REQSET_PERSONAL_AGE_MODERN")];

/** 0 Antiquity, 1 Exploration, 2 Modern. */
function personalAge(playerId) {
  const techs = Players.get(playerId)?.Techs;
  if (!techs) return 0;
  const has = (h) => { try { return techs.isNodeUnlocked(h); } catch (e) { return false; } };
  return roots[2].some(has) ? 2 : roots[1].some(has) ? 1 : 0;
}

// ---- the banner: vanilla's, with the personal Age in its text
function showBanner(newAge, done) {
  const ageDef = GameInfo.Ages.lookup(AGES[newAge]);
  const banner = ContextManager.push("age-transition-banner", { singleton: true, createMouseGuard: true, attributes: { "age-transition-type": "age-start" } });
  let tries = 120;
  const setText = () => {
    const text = banner?.querySelector?.("#at-age-ending_age-text");
    if (text && ageDef) text.innerHTML = Locale.stylize("LOC_AGE_BANNER_START_TEXT", ageDef.Name);
    else if (tries-- > 0) requestAnimationFrame(setText);
  };
  setText();
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    banner?.removeEventListener?.("animationend", onAnim);
    try { ContextManager.pop(banner); } catch (e) { /* already gone */ }
    done();
  };
  // As vanilla's age-start banner (notification-handlers.js): fade out after its first animation part.
  const onAnim = (event) => {
    if (event.animationName !== "age-ending-end-part-1") return;
    const panel = banner.querySelector("#age-ending-panel");
    panel?.classList.add("age-ending__panel--fade-out-banner", "age-ending__panel--fade-out");
    setTimeout(close, 4250);
  };
  banner?.addEventListener?.("animationend", onAnim);
  banner?.addEventListener?.("age-transition-banner-faded-out", close);
  setTimeout(close, 15000);   // safety net
}

// ---- the queue handler
class AgeSceneHandler extends DisplayHandlerBase {
  constructor() { super(CATEGORY, 8500); }
  show(request) {
    showBanner(request.newAge, () => DisplayQueueManager.close(request));
  }
  hide() {
    if (ContextManager.hasInstanceOf("age-transition-banner")) ContextManager.pop("age-transition-banner");
  }
}
const handler = new AgeSceneHandler();
DisplayQueueManager.registerHandler(handler);

// ---- other civilizations: a short notice when one enters a new personal Age (no scene, nothing blocking)
function notice(text) {
  const el = document.createElement("div");
  el.className = "cc-age-notice absolute font-title text-lg text-secondary text-center";
  el.style.cssText = "top: 9rem; left: 50%; transform: translateX(-50%); padding: 0.6rem 1.6rem; z-index: 100;"
    + "background-color: rgba(15, 18, 24, 0.85); border: 1px solid rgba(200, 170, 110, 0.6); pointer-events: none;"
    + "transition: opacity 1s; opacity: 0;";
  el.innerHTML = text;
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = "1"; });
  setTimeout(() => { el.style.opacity = "0"; }, 6000);
  setTimeout(() => el.remove(), 7200);
}
function rivalText(pid, age) {
  const local = Players.get(GameContext.localPlayerID);
  let met = false;
  try { met = !!local?.Diplomacy?.hasMet(pid); } catch (e) { /* unknown: treat as unmet */ }
  const ageName = Locale.compose(GameInfo.Ages.lookup(AGES[age])?.Name ?? "");
  const who = met ? Locale.compose(GameInfo.Civilizations.lookup(Players.get(pid).civilizationType)?.Name ?? "") : Locale.compose("LOC_CC_AGE_NOTICE_UNMET");
  return Locale.stylize("LOC_CC_AGE_NOTICE_RIVAL", who, ageName);
}

// ---- watching personal Ages: the local player gets the banner, the others a notice
const known = new Map();
let noticeQueue = [];
function check() {
  const localId = GameContext.localPlayerID;
  if (localId == null || localId < 0 || !Players.get(localId)) return;
  const quiet = (typeof Autoplay !== "undefined" && Autoplay.isActive) || Configuration.getGame().isAnyMultiplayer;
  for (const pid of Players.getAliveMajorIds()) {
    const age = personalAge(pid);
    const before = known.get(pid);
    known.set(pid, age);
    if (before === undefined || age <= before || quiet) continue;   // first look after a load: nothing to show
    if (pid === localId) {
      for (let a = before + 1; a <= age; a++) handler.addDisplayRequest({ newAge: a });
    } else {
      noticeQueue.push(rivalText(pid, age));
    }
  }
  // One notice at a time, a few seconds apart.
  if (noticeQueue.length && !check.showing) {
    check.showing = true;
    const next = () => {
      const t = noticeQueue.shift();
      if (!t) { check.showing = false; return; }
      notice(t);
      setTimeout(next, 7500);
    };
    next();
  }
}
try {
  engine.on("TechNodeCompleted", check);
  engine.on("LocalPlayerTurnBegin", check);
  engine.whenReady.then(check);
} catch (e) {
  console.error("cc-age-scene: " + e);
}
