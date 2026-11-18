// Continuous Civilization - the "new Age" scene, per player.
// In vanilla, when an Age ends everyone sees their civilization's legacy movie for that Age (chosen by the legacy
// path they completed last), then the "<Age> begins" banner. Here the game Age never changes, so nobody saw either.
// This plays the same scene for the local player when they enter their personal Exploration or Modern Age:
//   1. the legacy movie of the Age they leave: their civilization's own (EndGameMovies: CivilizationType +
//      LastCompletedLegacyPath), else the generic movie of that legacy path (MOVIE_VICTORY_<AGE>_<CLASS>); none when
//      they completed no legacy path of that Age, or the movie isn't in the database;
//   2. vanilla's age-transition-banner ("age-start"), with the personal Age in its text (it reads the game Age).
// Shown through vanilla's display queue (after the tech-complete popup, priority 8500), skippable like any movie,
// never during autoplay. Only the local human player gets the scene; when another civilization enters a new personal
// Age, a short notice shows instead ("unmet civilization" if not met). The Exploration and Modern movie rows
// come from {age-exploration}/{age-modern} data/movies.xml (imported in the .modinfo). Personal Age uses the root
// techs of data/3-merge/70-personal-age.sql, like ui/cc-triumphs.js.
import ContextManager from '/core/ui/context-manager/context-manager.js';
import { DisplayHandlerBase } from '/core/ui/context-manager/display-handler.js';
import { DisplayQueueManager } from '/core/ui/context-manager/display-queue-manager.js';

const AGES = ["AGE_ANTIQUITY", "AGE_EXPLORATION", "AGE_MODERN"];
const CATEGORY = "CCAgeScene";
const SCREEN = "cc-age-scene";

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

// Legacy path classes that have movies, and the Triumph subtypes that count for them.
const CLASS_OF_SUBTYPE = { LEGACY_CULTURAL: "CULTURE", LEGACY_ECONOMIC: "ECONOMIC", LEGACY_MILITARISTIC: "MILITARY", LEGACY_SCIENTIFIC: "SCIENCE" };

/**
 * The legacy path class (CULTURE, ECONOMIC, MILITARY, SCIENCE) that sums up a player's `endedAge` (0/1), or null:
 *   1. the legacy path of that Age they completed last (what vanilla's Age-end movie uses);
 *   2. else the class with the most Triumphs they triggered in that Age (1.5's Legacies table);
 *   3. else the legacy path of that Age with the highest score.
 */
export function legacyClass(playerId, endedAge) {
  const player = Players.get(playerId);
  if (!player) return null;
  const ageType = AGES[endedAge];
  const ageOf = (def) => def?.Age ?? def?.AgeType;
  const cls = (def) => (def?.LegacyPathClassType || "").replace("LEGACY_PATH_CLASS_", "") || null;
  let last = null;
  try {
    for (const p of player.LegacyPaths?.getCompletedLegacyPaths?.() ?? []) {
      const def = GameInfo.LegacyPaths.lookup(p);
      if (def && ageOf(def) === ageType) last = def;
    }
  } catch (e) { /* no legacy paths in this version */ }
  if (last && cls(last)) return { cls: cls(last), path: last.LegacyPathType, how: "completed" };
  const counts = {};
  try {
    for (const t of GameInfo.Legacies ?? []) {
      const c = CLASS_OF_SUBTYPE[t.LegacySubtype];
      if (c && t.Age === ageType && player.Legacies?.isTriggered?.(t.LegacyType)) counts[c] = (counts[c] || 0) + 1;
    }
  } catch (e) { /* no Triumphs in this version */ }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (best) return { cls: best[0], path: null, how: "triumphs" };
  let top = null, topScore = 0;
  for (const def of GameInfo.LegacyPaths ?? []) {
    if (ageOf(def) !== ageType || !cls(def)) continue;
    let score = 0;
    try { score = player.LegacyPaths?.getScore?.(def.LegacyPathType) ?? 0; } catch (e) { /* none */ }
    if (score > topScore) { top = def; topScore = score; }
  }
  return top ? { cls: cls(top), path: top.LegacyPathType, how: "score" } : null;
}

/** The legacy movie for leaving `endedAge` (0/1): the civilization's own for that class, else the generic one. */
export function chooseLegacyMovie(playerId, endedAge) {
  const lc = legacyClass(playerId, endedAge);
  if (!lc) return null;
  const ageType = AGES[endedAge];
  const civ = GameInfo.Civilizations.lookup(Players.get(playerId).civilizationType)?.CivilizationType;
  const exists = (type) => GameInfo.Movies.some((m) => m.MovieType === type);
  const pathsOfClass = new Set(GameInfo.LegacyPaths.filter((d) => (d.Age ?? d.AgeType) === ageType && d.LegacyPathClassType === "LEGACY_PATH_CLASS_" + lc.cls).map((d) => d.LegacyPathType));
  if (lc.path) pathsOfClass.add(lc.path);
  const own = GameInfo.EndGameMovies
    .filter((m) => m.CivilizationType === civ && pathsOfClass.has(m.LastCompletedLegacyPath) && !m.DefeatType && !m.VictoryType && exists(m.MovieType))
    .sort((a, b) => b.Priority - a.Priority)[0];
  if (own) return own.MovieType;
  const generic = `MOVIE_VICTORY_${ageType.replace("AGE_", "")}_${lc.cls}`;
  return exists(generic) ? generic : null;
}

// ---- the movie screen
class CCAgeScene extends Component {
  movie = null;
  inputListener = this.onEngineInput.bind(this);
  onAttach() {
    super.onAttach();
    this.Root.addEventListener("engine-input", this.inputListener);
    const movieId = this.Root.getAttribute("data-movie-id");
    this.movie = document.createElement("fxs-movie");
    this.movie.classList.add("absolute", "inset-0");
    this.movie.addEventListener("movie-ended", () => this.Root.dispatchEvent(new CustomEvent("cc-age-scene-done")));
    this.Root.appendChild(this.movie);
    this.movie.setAttribute("data-movie-id", movieId);
  }
  onDetach() {
    this.Root.removeEventListener("engine-input", this.inputListener);
    super.onDetach();
  }
  onEngineInput(event) {
    if (event.detail.status !== InputActionStatuses.FINISH) return;
    const n = event.detail.name;
    if (n === "accept" || n === "mousebutton-left" || n === "cancel" || n === "keyboard-escape" || n === "sys-menu") {
      this.movie?.setAttribute("data-movie-id", "");   // ends the movie: fxs-movie dispatches movie-ended
    }
    event.stopPropagation();
    event.preventDefault();
  }
}
Controls.define(SCREEN, {
  createInstance: CCAgeScene,
  description: "Continuous Civilization: legacy movie when a player enters a new personal Age",
  classNames: ["fullscreen", "absolute", "inset-0", "bg-black"],
});

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
    const finish = () => DisplayQueueManager.close(request);
    const banner = () => showBanner(request.newAge, finish);
    if (!request.movie) { banner(); return; }
    const screen = ContextManager.push(SCREEN, { singleton: true, createMouseGuard: true, attributes: { "data-movie-id": request.movie } });
    let ended = false;
    const end = () => { if (ended) return; ended = true; try { ContextManager.pop(SCREEN); } catch (e) { /* gone */ } banner(); };
    screen?.addEventListener?.("cc-age-scene-done", end);
    setTimeout(end, 180000);   // safety net: no movie is that long
  }
  hide() {
    if (ContextManager.hasInstanceOf(SCREEN)) ContextManager.pop(SCREEN);
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

// ---- watching personal Ages: the local player gets the scene, the others a notice
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
      for (let a = before + 1; a <= age; a++) handler.addDisplayRequest({ newAge: a, movie: chooseLegacyMovie(pid, a - 1) });
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
