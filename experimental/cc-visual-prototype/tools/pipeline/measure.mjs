// One-command street-table run: a test game of one map size and Age, every water and mountain plot turned into land,
// cities and empty urban districts over the map, the street probe (bare and wooded), scoring and merging into
// tools/data/street-table-<size>-<seed>[-<age>].json, then build_street_table.py. Drives the game through its UI
// debugger (port 9444); see the runbook in tools/game/all-land.js for what each step does by hand.
//
//   node tools/pipeline/measure.mjs --size tiny --age modern --seed 5005 [options]
//     --size tiny|small|standard|large|huge
//     --age antiquity|exploration|modern     the Age the game starts in (the probe draws that Age's roads)
//     --seed N                                map and game seed (pangaea-voronoi)
//     --vanilla                               park both mods outside the Mods folder for the run (restored at the end)
//     --halves                                found and probe the map in two halves from fresh loads (vanilla Modern
//                                             crashes past about 95 founded cities, round 58)
//     --gaps                                  only coordinates still missing from that Age's layer (analysis/gap_mask.js)
//     --wood                                  also a wooded pass (default for Antiquity and Exploration; Modern's turn
//                                             is the same on wooded tiles)
//     --out DIR                               screenshots and intermediate files (default C:\Users\<you>\CivStreetShots\run-<size>-<age>-<seed>)
//     --dry                                   print the steps only
// Needs: the game installed, Node 22+, Blender's Python (numpy) or CC_PYTHON pointing at a Python with numpy.
// Nothing may cover the game window while the screenshots run.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROTO = path.resolve(HERE, "..", "..");            // experimental/cc-visual-prototype
const REPO = path.resolve(PROTO, "..", "..");
const GAME = path.join(PROTO, "tools", "game");
const ANALYSIS = path.join(PROTO, "tools", "analysis");
const DATA = path.join(PROTO, "tools", "data");
const MODS = path.join(process.env.LOCALAPPDATA || "", "Firaxis Games", "Sid Meier's Civilization VII", "Mods");
const PARK = path.join(os.homedir(), "CivModsParked");
const OUR_MODS = ["continuous-civ", "cc-visual-prototype"];
const PY = process.env.CC_PYTHON || "G:/SteamLibrary/steamapps/common/Blender/5.2/python/bin/python.exe";
const SIZES = { tiny: [60, 38], small: [74, 46], standard: [84, 54], large: [96, 60], huge: [106, 66] };
const ROADS = {
  antiquity: ["LAYOUT_CTY_Hex_Section_AB_Road_ANT", "LAYOUT_CTY_Hex_Section_AB_B_Road_ANT"],
  exploration: ["LAYOUT_CTY_Hex_Section_AB_Road_EXP", "LAYOUT_CTY_Hex_Section_AB_B_Road_EXP"],
  modern: ["LAYOUT_CTY_MOD_Section_AB_Road"],
};
const CIV = { antiquity: "CIVILIZATION_ROME", exploration: "CIVILIZATION_SPAIN", modern: "CIVILIZATION_MEXICO" };

// ---- arguments
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf("--" + name); return i < 0 ? def : args[i + 1]; };
const flag = (name) => args.includes("--" + name);
const size = opt("size"), age = opt("age"), seed = Number(opt("seed"));
if (!SIZES[size] || !ROADS[age] || !seed) {
  console.log("usage: node measure.mjs --size tiny|small|standard|large|huge --age antiquity|exploration|modern --seed N [--vanilla] [--halves] [--gaps] [--wood] [--out DIR] [--dry]");
  process.exit(1);
}
const vanilla = flag("vanilla"), halves = flag("halves"), gaps = flag("gaps"), dry = flag("dry");
const woodPass = age !== "modern" || flag("wood");
const OUT = opt("out", path.join(os.homedir(), "CivStreetShots", `run-${size}-${age}-${seed}`));
const tag = `${size}-${seed}${gaps ? "g" : ""}`;
const tableFile = path.join(DATA, `street-table-${tag}${age === "antiquity" ? "" : "-" + age}.json`);
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- the game's UI debugger
async function evalJs(expr, timeoutMs = 20000) {
  const pages = await (await fetch("http://127.0.0.1:9444/json")).json();
  const page = pages[0];
  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(page.webSocketDebuggerUrl);
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
async function js(expr, timeoutMs) {   // retried: the debugger refuses connections for a moment after loads
  let last;
  for (let i = 0; i < 6; i++) {
    try { return await evalJs(expr, timeoutMs); } catch (e) { last = e; await sleep(3000); }
  }
  throw last;
}
const jsFile = (file) => js(fs.readFileSync(file, "utf8"));
async function until(expr, what, timeoutMs = 600000, everyMs = 4000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try { if (await evalJs(expr)) return; } catch { /* game busy or loading */ }
    await sleep(everyMs);
  }
  throw new Error("timed out waiting for " + what);
}
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
/** Click through "Begin Game" (shown twice on a fresh game) and the "Confirm" after it. */
async function dismissStart() {
  let quiet = 0;
  for (let i = 0; i < 40 && quiet < 3; i++) {
    const r = await js(`(() => { const p = ${PRESS}; return p('begin game') ? 'begin' : (p('confirm') ? 'confirm' : 'none'); })()`);
    quiet = r === "none" ? quiet + 1 : 0;
    await sleep(2500);
  }
}
const inGame = `(location.href.includes('root-game') && typeof Players !== 'undefined' && Players.get(0) && (Players.get(0).Units.getUnits().length > 0 || Players.get(0).Cities.getCities().length > 0)) ? 1 : 0`;
const saveInfo = (name) => `{Location: SaveLocations.LOCAL_STORAGE, LocationCategories: SaveLocationCategories.NORMAL, Type: SaveTypes.SINGLE_PLAYER, ContentType: SaveFileTypes.GAME_STATE, FileName: ${JSON.stringify(name)}, DisplayName: ${JSON.stringify(name)}}`;
const SAVES = path.join(os.homedir(), "Documents", "My Games", "Sid Meier's Civilization VII", "Saves", "Single");
async function save(name) {
  const file = path.join(SAVES, name + ".Civ7Save");
  const before = fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0;
  await js(`(Network.saveGame(${saveInfo(name)}), 'ok')`);
  for (let i = 0; i < 60; i++) { if (fs.existsSync(file) && fs.statSync(file).mtimeMs > before) return; await sleep(1000); }
  throw new Error("save not written: " + name);
}
async function load(name) {
  await js(`(() => { const i = ${saveInfo(name)}; i.FileName += '.Civ7Save'; Network.loadGame(i, ServerType.SERVER_TYPE_NONE); return 'ok'; })()`);
  await sleep(15000);
  await until(inGame, "the loaded game");
  await dismissStart();
}

// ---- outside steps
function run(cmd, argv, env = {}) {
  return new Promise((resolve, reject) => {
    log(">", cmd, argv.join(" "));
    const p = spawn(cmd, argv, { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => { out += d; });
    p.stderr.on("data", (d) => { out += d; });
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${out.slice(-600)}`))));
  });
}
const ps = (file, ...a) => run("powershell", ["-ExecutionPolicy", "Bypass", "-File", file, ...a]);
function park() {
  fs.mkdirSync(PARK, { recursive: true });
  for (const m of OUR_MODS) if (fs.existsSync(path.join(MODS, m))) fs.renameSync(path.join(MODS, m), path.join(PARK, m));
  log("mods parked in", PARK);
}
function unpark() {
  for (const m of OUR_MODS) if (fs.existsSync(path.join(PARK, m)) && !fs.existsSync(path.join(MODS, m))) fs.renameSync(path.join(PARK, m), path.join(MODS, m));
  log("mods restored");
}

// ---- the run
async function setupAndStart() {
  await ps(path.join(REPO, "tools", "restart-civ.ps1"), "-Kill", "-TimeoutSec", "400");
  await js(`(() => {
    GameSetup.setGameParameterValue("Age", "AGE_${age.toUpperCase()}");
    GameSetup.setGameParameterValue("Map", "{base-standard}maps/pangaea-voronoi.js");
    GameSetup.setGameParameterValue("MapSize", "MAPSIZE_${size.toUpperCase()}");
    GameSetup.setGameParameterValue("MapRandomSeed", ${seed});
    GameSetup.setGameParameterValue("GameRandomSeed", ${seed});
    GameSetup.setPlayerParameterValue(0, "PlayerLeader", "LEADER_AUGUSTUS");
    GameSetup.setPlayerParameterValue(0, "PlayerCivilization", "${CIV[age]}");
    Configuration.editMap().setMaxMajorPlayers(1);
    for (let i = 1; i < 8; i++) Configuration.editPlayer(i).setSlotStatus(SlotStatus.SS_CLOSED);
    engine.call("startGame"); return "starting";
  })()`);
  await sleep(20000);
  await until(inGame, "the new game");
  await dismissStart();
}

async function probePass(label, views) {
  const dir = path.join(OUT, label);
  const states = views * (ROADS[age].length * 6 + 1);
  const cap = ps(path.join(GAME, "capture-states.ps1"), "-Out", dir, "-States", String(states), "-TimeoutSec", String(states * 9 + 300));
  await sleep(3000);
  log(await js(`CCStreetProbe.start(-1, _views, 6)`));
  await cap;
  await until(`JSON.parse(CCStreetProbe.info()).state === 'done' ? 1 : 0`, "the probe", 600000);
  return dir;
}

async function part(bounds, i) {
  await load(`CC_Run_${tag}_${age}_Land`);
  for (const f of ["table-map.js", "all-land.js"]) log(await jsFile(path.join(GAME, f)));
  if (gaps) {
    await run("node", [path.join(ANALYSIS, "gap_mask.js"), age, path.join(OUT, "gaps.js")]);
    log(await jsFile(path.join(OUT, "gaps.js")));
    await js(`(CCTable.targetFilter = (x, y) => _gaps.has(x + ',' + y) && !GameplayMap.isRiver(x, y), 'filter set')`);
  } else await js(`(globalThis._have = new Set(), 'all new')`);
  if (bounds) await js(`(CCTable.bounds = ${JSON.stringify(bounds)}, 'bounds')`);
  log(await js(`CCTable.plan()`));
  await js(`CCTable.run()`);
  await until(`JSON.parse(CCTable.status()).busy ? 0 : 1`, "the cities", 3600000, 10000);
  log(await js(`CCTable.status()`));
  await save(`CC_Run_${tag}_${age}_Cities${i}`);
  await js(`(globalThis.CCStreetProbeStreets = ${JSON.stringify(ROADS[age])}, 'roads')`);
  log(await jsFile(path.join(GAME, "street-probe.js")));
  log(await js(`CCTable.wood(false) + ' | ' + CCAllLand.views(1)`));
  const views = await js(`_views.length`);
  const bare = await probePass(`part${i}_bare`, views);
  fs.writeFileSync(path.join(OUT, `part${i}_pack.txt`), await js(`CCAllLand.pack()`, 60000));
  fs.writeFileSync(path.join(OUT, `part${i}_rivers.json`), await js(`CCAllLand.rivers()`));
  let wood = null;
  if (woodPass) { log(await js(`CCTable.wood(true)`)); wood = await probePass(`part${i}_wood`, views); }
  const env = age === "modern" ? { CC_STREETS: "1" } : {};
  const score = async (d) => { const o = d + ".json"; log((await run(PY, [path.join(ANALYSIS, "table_score.py"), d, path.join(OUT, `part${i}_pack.txt`), "46", o], env)).trim().split("\n").pop()); return o; };
  const b = await score(bare), w = wood ? await score(wood) : b;
  return { bare: b, wood: w, rivers: path.join(OUT, `part${i}_rivers.json`) };
}

async function main() {
  const [W] = SIZES[size];
  const parts = halves ? [[0, 0, Math.floor(W / 2) - 1, 99], [Math.floor(W / 2), 0, W - 1, 99]] : [null];
  log(`run ${size} ${age} seed ${seed}${vanilla ? " vanilla" : ""}${halves ? " halves" : ""}${gaps ? " gaps" : ""}, ${woodPass ? "bare + wooded" : "bare"} -> ${tableFile}`);
  if (dry) return;
  fs.mkdirSync(OUT, { recursive: true });
  if (vanilla) park();
  try {
    await setupAndStart();
    log(await jsFile(path.join(GAME, "all-land.js")));
    log(await js(`CCAllLand.convert()`));
    await save(`CC_Run_${tag}_${age}_Land`);
    const results = [];
    for (let i = 0; i < parts.length; i++) results.push(await part(parts[i], i));
    // merge each part's passes, then all parts into one table file
    const merged = { note: `measure.mjs run (${new Date().toISOString().slice(0, 10)}): ${vanilla ? "vanilla" : "modded"} ${age} game, ${size}, map seed ${seed} pangaea-voronoi turned all land${gaps ? ", only coordinates missing from the layer" : ""}${halves ? ", in two halves" : ""}. Value = [bare label, margin, wooded label, margin].`, rivers: [], tiles: {} };
    for (const [i, r] of results.entries()) {
      const one = path.join(OUT, `part${i}_table.json`);
      log((await run("python", [path.join(ANALYSIS, "merge_passes.py"), r.bare, r.wood, r.rivers, one, "part"])).trim());
      const t = JSON.parse(fs.readFileSync(one, "utf8"));
      merged.rivers.push(...t.rivers); Object.assign(merged.tiles, t.tiles);
    }
    fs.writeFileSync(tableFile, JSON.stringify(merged, null, 0));
    log("wrote", tableFile, Object.keys(merged.tiles).length, "tiles");
    log((await run("python", [path.join(ANALYSIS, "build_street_table.py")])).trim().split("\n").slice(-6).join("\n"));
  } finally {
    try { await js(`(engine.call('exitToDesktop'), 'bye')`); } catch { /* already closed */ }
    await sleep(15000);
    if (vanilla) unpark();
  }
}
main().catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; });
