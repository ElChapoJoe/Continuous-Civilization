// Continuous Civilization - the "new Age" scene, per player.
// In vanilla, when an Age ends everyone sees their civilization's legacy movie for that Age (chosen by the legacy
// path they completed last), then the "<Age> begins" banner. Here the game Age never changes, so nobody saw either.
// This plays the same scene for the local player when they enter their personal Exploration or Modern Age:
//   1. the legacy movie of the Age they leave: their civilization's own (EndGameMovies: CivilizationType +
//      LastCompletedLegacyPath), else the generic movie of that legacy path (MOVIE_VICTORY_<AGE>_<CLASS>); none when
//      they completed no legacy path of that Age, or the movie isn't in the database;
//   2. vanilla's age-transition-banner ("age-start"), with the personal Age in its text (it reads the game Age).
// Shown through vanilla's display queue (after the tech-complete popup, priority 8500), skippable like any movie,
// never during autoplay. Only the local human player; AI players get nothing. The Exploration and Modern movie rows
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

/** The legacy movie for leaving `endedAge` (0/1), or null. */
export function chooseLegacyMovie(playerId, endedAge) {
  const player = Players.get(playerId);
  if (!player) return null;
  const ageType = AGES[endedAge];
  let last = null;
  for (const p of player.LegacyPaths?.getCompletedLegacyPaths?.() ?? []) {
    const def = GameInfo.LegacyPaths.lookup(p);
    if (def && (def.Age ?? def.AgeType) === ageType) last = def;
  }
  if (!last) return null;
  const civ = GameInfo.Civilizations.lookup(player.civilizationType)?.CivilizationType;
  const exists = (type) => GameInfo.Movies.some((m) => m.MovieType === type);
  const own = GameInfo.EndGameMovies
    .filter((m) => m.CivilizationType === civ && m.LastCompletedLegacyPath === last.LegacyPathType && !m.DefeatType && !m.VictoryType && exists(m.MovieType))
    .sort((a, b) => b.Priority - a.Priority)[0];
  if (own) return own.MovieType;
  const cls = (last.LegacyPathClassType || "").replace("LEGACY_PATH_CLASS_", "");
  const generic = `MOVIE_VICTORY_${ageType.replace("AGE_", "")}_${cls}`;
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

// ---- watching the local player's personal Age
let known = -1;
function check() {
  const pid = GameContext.localPlayerID;
  if (pid == null || pid < 0 || !Players.get(pid)) return;
  const age = personalAge(pid);
  if (known < 0) { known = age; return; }   // first look after a load: no scene for an Age reached before
  if (age <= known) return;
  const from = known;
  known = age;
  if (typeof Autoplay !== "undefined" && Autoplay.isActive) return;
  if (Configuration.getGame().isAnyMultiplayer) return;   // as vanilla's tech popup: no blocking screens in multiplayer
  for (let a = from + 1; a <= age; a++) {
    handler.addDisplayRequest({ newAge: a, movie: chooseLegacyMovie(pid, a - 1) });
  }
}
try {
  engine.on("TechNodeCompleted", (data) => { if (data?.player === GameContext.localPlayerID) check(); });
  engine.on("LocalPlayerTurnBegin", check);
  engine.whenReady.then(check);
} catch (e) {
  console.error("cc-age-scene: " + e);
}
