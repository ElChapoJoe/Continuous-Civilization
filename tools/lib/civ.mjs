// Shared pieces for the Node run scripts in tools/: talking to the game through its UI debugger (port 9444),
// pressing its buttons, waiting, saving and loading, starting a test game, parking the mods for vanilla runs,
// crash recovery, and a journal per run. Node 22+ (global fetch and WebSocket). The PowerShell scripts in tools/
// (restart-civ.ps1, deploy.ps1 ...) are called from here where they already do the job.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const REPO = path.resolve(TOOLS, "..");
export const MODS = path.join(process.env.LOCALAPPDATA || "", "Firaxis Games", "Sid Meier's Civilization VII", "Mods");
export const LOGS = path.join(process.env.LOCALAPPDATA || "", "Firaxis Games", "Sid Meier's Civilization VII", "Logs");
export const SAVES = path.join(os.homedir(), "Documents", "My Games", "Sid Meier's Civilization VII", "Saves", "Single");
export const PARK = path.join(os.homedir(), "CivModsParked");
export const RUNS = process.env.CC_RUNS || path.join(os.homedir(), "CivRuns");
const OUR_MODS = ["continuous-civ", "cc-visual-prototype"];

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);

// ---- the game's UI debugger
/** One evaluation in the game's UI page; rejects on an exception, a closed socket or after timeoutMs. */
export async function evalJs(expr, timeoutMs = 20000) {
  const pages = await (await fetch("http://127.0.0.1:9444/json")).json();
  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
    const t = setTimeout(() => { try { ws.close(); } catch { /* closed */ } reject(new Error("timeout")); }, timeoutMs);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression: expr, returnByValue: true } }));
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id !== 1) return;
      clearTimeout(t); ws.close();
      if (d.result?.exceptionDetails) reject(new Error("game: " + (d.result.exceptionDetails.exception?.description || "exception")));
      else resolve(d.result?.result?.value);
    };
    ws.onerror = (e) => { clearTimeout(t); reject(new Error("socket " + (e.message || ""))); };
  });
}
/** evalJs with retries for connection trouble (the debugger refuses connections for a moment after loads). */
export async function js(expr, timeoutMs) {
  let last;
  for (let i = 0; i < 6; i++) {
    try { return await evalJs(expr, timeoutMs); } catch (e) { last = e; if (e.message.startsWith("game:")) throw e; await sleep(3000); }
  }
  throw last;
}
export const jsFile = (file, timeoutMs) => js(fs.readFileSync(file, "utf8"), timeoutMs);
/** Polls a JS expression until it is truthy. */
export async function until(expr, what, timeoutMs = 600000, everyMs = 4000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try { if (await evalJs(expr)) return; } catch { /* game busy or loading */ }
    await sleep(everyMs);
  }
  throw new Error("timed out waiting for " + what);
}

// Buttons: the game ignores synthetic clicks; an engine-input START/FINISH pair on the element works.
const PRESS = `(cap) => {
  const els = Array.from(document.querySelectorAll('div.hero-button-2, [data-activatable="true"], fxs-text-button, fxs-button, .fxs-button'))
    .map((el) => ({ el, t: (el.textContent || '').trim() })).filter((c) => c.t);
  const hit = els.find((c) => c.t.toLowerCase() === cap) || els.find((c) => c.t.toLowerCase().includes(cap));
  if (!hit) return false;
  const mk = (status) => new CustomEvent('engine-input', { bubbles: true, cancelable: true,
    detail: { name: 'mousebutton-left', status, x: -1, y: -1, isTouch: false, isMouse: true } });
  hit.el.dispatchEvent(mk(InputActionStatuses.START)); hit.el.dispatchEvent(mk(InputActionStatuses.FINISH));
  return true;
}`;
export const press = (caption) => js(`(${PRESS})(${JSON.stringify(caption.toLowerCase())})`);
/** Clicks through "Begin Game" (twice on a fresh game) and the "Confirm" after it, until nothing is left to press. */
export async function dismissStart() {
  let quiet = 0;
  for (let i = 0; i < 40 && quiet < 3; i++) {
    const r = await js(`(() => { const p = ${PRESS}; return p('begin game') ? 'begin' : (p('confirm') ? 'confirm' : 'none'); })()`);
    quiet = r === "none" ? quiet + 1 : 0;
    await sleep(2500);
  }
}
export const IN_GAME = `(location.href.includes('root-game') && typeof Players !== 'undefined' && Players.get(GameContext.localPlayerID >= 0 ? GameContext.localPlayerID : 0) && (Players.getAliveMajorIds().length > 0)) ? 1 : 0`;

// ---- saves
const saveInfo = (name) => `{Location: SaveLocations.LOCAL_STORAGE, LocationCategories: SaveLocationCategories.NORMAL, Type: SaveTypes.SINGLE_PLAYER, ContentType: SaveFileTypes.GAME_STATE, FileName: ${JSON.stringify(name)}, DisplayName: ${JSON.stringify(name)}}`;
/** Saves the game and waits until the file is written. */
export async function save(name) {
  const file = path.join(SAVES, name + ".Civ7Save");
  const before = fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0;
  await js(`(Network.saveGame(${saveInfo(name)}), 'ok')`);
  for (let i = 0; i < 60; i++) { if (fs.existsSync(file) && fs.statSync(file).mtimeMs > before) return; await sleep(1000); }
  throw new Error("save not written: " + name);
}
/** Loads a save (from the menu or a running game), waits for it and clicks through its start dialogs. */
export async function load(name) {
  if (!fs.existsSync(path.join(SAVES, name + ".Civ7Save"))) throw new Error("no save " + name);
  await js(`(() => { const i = ${saveInfo(name)}; i.FileName += '.Civ7Save'; Network.loadGame(i, ServerType.SERVER_TYPE_NONE); return 'ok'; })()`);
  await sleep(15000);
  await until(IN_GAME, "the loaded game");
  await dismissStart();
}

// ---- outside programs and the game process
/** Runs a program, resolves with its output; rejects with the output's end if it fails. */
export function run(cmd, argv, env = {}) {
  return new Promise((resolve, reject) => {
    log(">", path.basename(cmd), argv.map((a) => path.basename(String(a))).join(" "));
    const p = spawn(cmd, argv, { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => { out += d; });
    p.stderr.on("data", (d) => { out += d; });
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${path.basename(cmd)} exited ${code}: ${out.slice(-600)}`))));
  });
}
export const ps = (file, ...a) => run("powershell", ["-ExecutionPolicy", "Bypass", "-File", file, ...a]);
/** (Re)starts the game and waits for its main menu (tools/restart-civ.ps1). */
export const restartGame = () => ps(path.join(TOOLS, "restart-civ.ps1"), "-Kill", "-TimeoutSec", "400");
/** Mirrors the mod into the Mods folder (tools/deploy.ps1, which runs the mod check first). */
export const deploy = () => ps(path.join(TOOLS, "deploy.ps1"));
/** Closes the game if it is running. */
export async function quitGame() {
  try { await evalJs(`(engine.call('exitToDesktop'), 'bye')`); } catch { return; }
  await sleep(15000);
}
/** True while the game process exists. */
export async function gameRunning() {
  const out = await run("tasklist", ["/FI", "IMAGENAME eq Civ7_Win64_DX12_FinalRelease.exe", "/NH"]).catch(() => "");
  return /Civ7_Win64/i.test(out);
}

// ---- mods
/** Moves the mods out of the Mods folder (vanilla runs); unpark() puts them back. */
export function park() {
  fs.mkdirSync(PARK, { recursive: true });
  for (const m of OUR_MODS) if (fs.existsSync(path.join(MODS, m))) fs.renameSync(path.join(MODS, m), path.join(PARK, m));
  log("mods parked in", PARK);
}
export function unpark() {
  for (const m of OUR_MODS) if (fs.existsSync(path.join(PARK, m)) && !fs.existsSync(path.join(MODS, m))) fs.renameSync(path.join(PARK, m), path.join(MODS, m));
  log("mods restored");
}
/** Runs fn with the mods parked when vanilla is true; always restores them and closes the game afterwards. */
export async function withSetup(vanilla, fn) {
  if (vanilla) park();
  try { return await fn(); } finally { await quitGame(); if (vanilla) unpark(); }
}

// ---- test games
/** From the main menu: a game of that size, Age, civ and seeds (one player unless players > 1); waits until it is up. */
export async function startGame({ size = "small", age = "antiquity", civ = "CIVILIZATION_ROME", leader = "LEADER_AUGUSTUS", seed = 1,
  gameSeed = seed, players = 1, map = "{base-standard}maps/pangaea-voronoi.js" }) {
  await js(`(() => {
    GameSetup.setGameParameterValue("Age", "AGE_${age.toUpperCase()}");
    GameSetup.setGameParameterValue("Map", ${JSON.stringify(map)});
    GameSetup.setGameParameterValue("MapSize", "MAPSIZE_${size.toUpperCase()}");
    GameSetup.setGameParameterValue("MapRandomSeed", ${seed});
    GameSetup.setGameParameterValue("GameRandomSeed", ${gameSeed});
    GameSetup.setPlayerParameterValue(0, "PlayerLeader", ${JSON.stringify(leader)});
    GameSetup.setPlayerParameterValue(0, "PlayerCivilization", ${JSON.stringify(civ)});
    if (${players} === 1) { Configuration.editMap().setMaxMajorPlayers(1); for (let i = 1; i < 8; i++) Configuration.editPlayer(i).setSlotStatus(SlotStatus.SS_CLOSED); }
    engine.call("startGame"); return "starting";
  })()`);
  await sleep(20000);
  await until(IN_GAME, "the new game");
  await dismissStart();
}
/** Reveals the whole map for player 0 (as the Firaxis tuner's map panel does). */
export const revealMap = () => js(`(() => { if (typeof Visibility !== 'undefined' && Visibility.revealAllPlots) Visibility.revealAllPlots(0); else WorldBuilder.MapPlots.setAllRevealed(0, true); return 'revealed'; })()`);

// ---- crash recovery
/**
 * Runs step(attempt); if it fails because the game crashed (the process is gone), restarts the game, calls
 * restore(attempt) (load a checkpoint save) and tries again, up to `tries` times. Other failures are not retried.
 */
export async function withRecovery(name, step, restore, tries = 3) {
  for (let attempt = 0; ; attempt++) {
    try { return await step(attempt); } catch (e) {
      const crashed = !(await gameRunning());
      if (!crashed || attempt + 1 >= tries) throw new Error(`${name}: ${e.message}${crashed ? " (game crashed, out of retries)" : ""}`);
      log(`${name}: the game crashed (${e.message}); restarting and resuming, try ${attempt + 2} of ${tries}`);
      journalNote(`crash during ${name}, resumed`);
      await restartGame();
      await restore(attempt + 1);
    }
  }
}

// ---- run journal: one JSON file per run in RUNS (~/CivRuns, or CC_RUNS), plus latest.json while it runs
let current = null;
function writeJournal() {
  if (!current) return;
  fs.mkdirSync(RUNS, { recursive: true });
  fs.writeFileSync(current.file, JSON.stringify(current.data, null, 1));
  fs.writeFileSync(path.join(RUNS, "latest.json"), JSON.stringify(current.data, null, 1));
}
/** Starts the journal of a run: arguments, git commit, start time. */
export async function journalStart(kind, argv) {
  const commit = (await run("git", ["-C", REPO, "rev-parse", "--short", "HEAD"]).catch(() => "?")).trim();
  const dirty = (await run("git", ["-C", REPO, "status", "--porcelain"]).catch(() => "")).trim().split("\n").filter(Boolean).length;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  current = { file: path.join(RUNS, `${stamp}-${kind}.json`),
    data: { kind, argv, commit, uncommitted: dirty, start: new Date().toISOString(), status: "running", notes: [], results: {} } };
  writeJournal();
  return current.file;
}
export function journalNote(text) { if (current) { current.data.notes.push(`${new Date().toTimeString().slice(0, 8)} ${text}`); writeJournal(); } }
export function journalResult(key, value) { if (current) { current.data.results[key] = value; writeJournal(); } }
/** Ends the journal: "done" or "failed: <reason>", end time, minutes taken. */
export function journalEnd(status) {
  if (!current) return;
  current.data.status = status; current.data.end = new Date().toISOString();
  current.data.minutes = Math.round((Date.parse(current.data.end) - Date.parse(current.data.start)) / 60000);
  writeJournal();
  log("journal:", current.file, status);
}

/** --name value / --flag arguments. */
export function args(argv = process.argv.slice(2)) {
  const opt = (name, def) => { const i = argv.indexOf("--" + name); return i < 0 ? def : argv[i + 1]; };
  const flag = (name) => argv.includes("--" + name);
  return { opt, flag };
}
