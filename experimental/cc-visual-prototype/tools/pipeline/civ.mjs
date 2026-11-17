// Shared pieces for the run scripts in this folder: talking to the game through its UI debugger (port 9444),
// pressing its buttons, waiting, saving and loading, starting a test game, parking the mods for vanilla runs, and
// running outside tools. Node 22+ (global fetch and WebSocket).
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROTO = path.resolve(HERE, "..", "..");          // experimental/cc-visual-prototype
export const REPO = path.resolve(PROTO, "..", "..");
export const GAME = path.join(PROTO, "tools", "game");
export const ANALYSIS = path.join(PROTO, "tools", "analysis");
export const DATA = path.join(PROTO, "tools", "data");
export const UI = path.join(PROTO, "ui");
export const MODS = path.join(process.env.LOCALAPPDATA || "", "Firaxis Games", "Sid Meier's Civilization VII", "Mods");
export const PARK = path.join(os.homedir(), "CivModsParked");
export const SAVES = path.join(os.homedir(), "Documents", "My Games", "Sid Meier's Civilization VII", "Saves", "Single");
export const SHOTS = path.join(os.homedir(), "CivStreetShots");
export const PY = process.env.CC_PYTHON || "G:/SteamLibrary/steamapps/common/Blender/5.2/python/bin/python.exe";
export const SIZES = { tiny: [60, 38], small: [74, 46], standard: [84, 54], large: [96, 60], huge: [106, 66] };
const OUR_MODS = ["continuous-civ", "cc-visual-prototype"];

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);

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
      if (d.result?.exceptionDetails) reject(new Error(d.result.exceptionDetails.exception?.description || "exception"));
      else resolve(d.result?.result?.value);
    };
    ws.onerror = (e) => { clearTimeout(t); reject(new Error("socket " + (e.message || ""))); };
  });
}
/** evalJs with retries: the debugger refuses connections for a moment after loads. */
export async function js(expr, timeoutMs) {
  let last;
  for (let i = 0; i < 6; i++) {
    try { return await evalJs(expr, timeoutMs); } catch (e) { last = e; if (/exception|Error:/.test(e.message)) throw e; await sleep(3000); }
  }
  throw last;
}
export const jsFile = (file) => js(fs.readFileSync(file, "utf8"));
/** Polls a JS expression until it is truthy. */
export async function until(expr, what, timeoutMs = 600000, everyMs = 4000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try { if (await evalJs(expr)) return; } catch { /* game busy or loading */ }
    await sleep(everyMs);
  }
  throw new Error("timed out waiting for " + what);
}

// Buttons: the game ignores synthetic clicks; an engine-input START/FINISH pair on the element works (as the civ7 tool).
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
export const IN_GAME = `(location.href.includes('root-game') && typeof Players !== 'undefined' && Players.get(0) && (Players.get(0).Units.getUnits().length > 0 || Players.get(0).Cities.getCities().length > 0)) ? 1 : 0`;

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
export const restartGame = () => ps(path.join(REPO, "tools", "restart-civ.ps1"), "-Kill", "-TimeoutSec", "400");
/** Closes the game if it is running. */
export async function quitGame() {
  try { await evalJs(`(engine.call('exitToDesktop'), 'bye')`); } catch { return; }
  await sleep(15000);
}

/** Moves both mods out of the Mods folder (vanilla runs); unpark() puts them back. */
export function park() {
  fs.mkdirSync(PARK, { recursive: true });
  for (const m of OUR_MODS) if (fs.existsSync(path.join(MODS, m))) fs.renameSync(path.join(MODS, m), path.join(PARK, m));
  log("mods parked in", PARK);
}
export function unpark() {
  for (const m of OUR_MODS) if (fs.existsSync(path.join(PARK, m)) && !fs.existsSync(path.join(MODS, m))) fs.renameSync(path.join(PARK, m), path.join(MODS, m));
  log("mods restored");
}
/** Runs fn with the mods parked when vanilla is true, and always restores them and closes the game afterwards. */
export async function withSetup(vanilla, fn) {
  if (vanilla) park();
  try { return await fn(); } finally { await quitGame(); if (vanilla) unpark(); }
}

/** From the main menu: a one-player game (pangaea-voronoi) of that size, Age, civ and seed; waits until it is up. */
export async function startGame({ size, age, civ, seed, gameSeed = seed, map = "{base-standard}maps/pangaea-voronoi.js" }) {
  await js(`(() => {
    GameSetup.setGameParameterValue("Age", "AGE_${age.toUpperCase()}");
    GameSetup.setGameParameterValue("Map", ${JSON.stringify(map)});
    GameSetup.setGameParameterValue("MapSize", "MAPSIZE_${size.toUpperCase()}");
    GameSetup.setGameParameterValue("MapRandomSeed", ${seed});
    GameSetup.setGameParameterValue("GameRandomSeed", ${gameSeed});
    GameSetup.setPlayerParameterValue(0, "PlayerLeader", "LEADER_AUGUSTUS");
    GameSetup.setPlayerParameterValue(0, "PlayerCivilization", ${JSON.stringify(civ)});
    Configuration.editMap().setMaxMajorPlayers(1);
    for (let i = 1; i < 8; i++) Configuration.editPlayer(i).setSlotStatus(SlotStatus.SS_CLOSED);
    engine.call("startGame"); return "starting";
  })()`);
  await sleep(20000);
  await until(IN_GAME, "the new game");
  await dismissStart();
}

/** Starts tools/game/capture-states.ps1 for n states, then calls begin(); resolves when the screenshots are taken. */
export async function capture(dir, states, begin, done = `JSON.parse(CCStreetProbe.info()).state === 'done' ? 1 : 0`) {
  const cap = ps(path.join(GAME, "capture-states.ps1"), "-Out", dir, "-States", String(states), "-TimeoutSec", String(states * 10 + 300));
  await sleep(3000);
  log(await begin());
  await cap;
  await until(done, "the shots", 600000);
  return dir;
}
/** Reveals the whole map for player 0 (as the Firaxis tuner's map panel does). */
export const revealMap = () => js(`(() => { if (typeof Visibility !== 'undefined' && Visibility.revealAllPlots) Visibility.revealAllPlots(0); else WorldBuilder.MapPlots.setAllRevealed(0, true); return 'revealed'; })()`);

// ---- crash recovery
/** True while the game process exists. */
export async function gameRunning() {
  const out = await run("tasklist", ["/FI", "IMAGENAME eq Civ7_Win64_DX12_FinalRelease.exe", "/NH"]).catch(() => "");
  return /Civ7_Win64/i.test(out);
}
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

// ---- run journal: one JSON file per run in CivStreetShots/runs, plus runs/latest.json while it runs
const RUNS = path.join(SHOTS, "runs");
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

// ---- fast capture: the screenshot side drives the probe (tools/game/capture-server.ps1)
/**
 * Like capture(), but the probe waits for each shot: a PowerShell helper samples the screen until the picture
 * settles (moving water allowed), saves it, and the probe is told to go on (CCStreetProbe.next). Needs the probe
 * started with globalThis.CCProbeManual = true.
 */
export async function captureFast(dir, states, begin, { minMs = 700, maxMs = 9000, still = 1.2 } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const srv = spawn("powershell", ["-ExecutionPolicy", "Bypass", "-File", path.join(GAME, "capture-server.ps1")], { stdio: ["pipe", "pipe", "inherit"] });
  let buf = "", waiters = [];
  srv.stdout.on("data", (d) => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); waiters.shift()?.(line); } });
  const ask = (cmd) => new Promise((r) => { waiters.push(r); srv.stdin.write(cmd + "\n"); });
  try {
    if ((await ask("hello")) !== "ready") throw new Error("capture server did not start");
    await js(`(globalThis.CCProbeManual = true, 'manual')`);
    log(await begin());
    for (let k = 0; k < states; k++) {
      await until(`(() => { const i = JSON.parse(CCStreetProbe.info()); return i.state === ${k} ? 1 : 0; })()`, `probe state ${k}`, 60000, 150);
      const t0 = Date.now();
      let prev = null;
      while (true) {
        const sig = (await ask("sample")).split(",").map(Number);
        if (prev && Date.now() - t0 >= minMs) {
          let d = 0; for (let j = 0; j < sig.length; j++) d += Math.abs(sig[j] - prev[j]);
          if (d / sig.length < still || Date.now() - t0 > maxMs) break;
        }
        prev = sig;
        await sleep(250);
      }
      await ask(`save ${path.join(dir, "s" + String(k).padStart(2, "0") + ".bmp")}`);
      await js(`CCStreetProbe.next()`);
    }
    await until(`JSON.parse(CCStreetProbe.info()).state === 'done' ? 1 : 0`, "the probe", 60000, 500);
  } finally {
    try { srv.stdin.write("quit\n"); } catch { /* gone */ }
    await js(`(globalThis.CCProbeManual = false, 'timer mode')`).catch(() => {});
  }
  return dir;
}

// ---- save library (tools/data/saves.json)
export const SAVE_LIBRARY = path.join(DATA, "saves.json");
/** { save, vanilla, about } for a role in tools/data/saves.json; throws if the role or its save file is missing. */
export function saveFor(role) {
  const lib = JSON.parse(fs.readFileSync(SAVE_LIBRARY, "utf8"));
  const s = lib[role];
  if (!s) throw new Error(`no save role "${role}" (roles: ${Object.keys(lib).filter((k) => !k.startsWith("_")).join(", ")})`);
  if (!fs.existsSync(path.join(SAVES, s.save + ".Civ7Save"))) throw new Error(`save ${s.save} for "${role}" is missing from ${SAVES}`);
  return s;
}

/** --name value / --flag arguments. */
export function args(argv = process.argv.slice(2)) {
  const opt = (name, def) => { const i = argv.indexOf("--" + name); return i < 0 ? def : argv[i + 1]; };
  const flag = (name) => argv.includes("--" + name);
  return { opt, flag };
}
