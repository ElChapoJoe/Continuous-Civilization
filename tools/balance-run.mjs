// Balance run: AI autoplay with a per-civ snapshot every few turns (tests/cc-dev.js CCDev.balance), then a report
// (tools/balance-report.mjs): Ages reached, yields, techs, civics, victory points, and flags where one civ runs away
// from the rest (e.g. Culture at 2x the median).
//
//   node tools/balance-run.mjs [--save NAME | --size small --seed 1 --players 6] [--turns 200] [--every 10]
//                              [--deploy] [--keep] [--ratio 2] [--from 20] [--dry]
//     --turns N    AI turns to play (default 200)        --every K   snapshot every K turns (default 10)
//     --ratio, --from   report flags (see balance-report.mjs)
// Output: ~/CivRuns/<time>-balance/ (snapshots.jsonl, report.md, balance.csv), plus the usual run journal.
// After a crash it restarts the game, loads the newest autosave and carries on (up to 3 times). A partial run still
// gets a report. Needs Node 22+ and the game; takes the screen for the whole run.
import fs from "node:fs";
import path from "node:path";
import * as C from "./lib/civ.mjs";
import { writeReport } from "./balance-report.mjs";

const { opt, flag } = C.args();
const saveName = opt("save"), turns = Number(opt("turns", 200)), every = Number(opt("every", 10));
const game = { size: opt("size", "small"), seed: Number(opt("seed", 1)), players: Number(opt("players", 6)) };
const reportOpts = { ratio: Number(opt("ratio", 2)), from: Number(opt("from", 20)) };
const DEV = path.join(C.REPO, "tests", "cc-dev.js");
const STALL_MS = 15 * 60000;   // no new turn for this long: the game waits on something (a dialog) or hangs

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dir = path.join(C.RUNS, `${stamp}-balance`);
const snapFile = path.join(dir, "snapshots.jsonl");

const ensureDev = async () => { if (await C.js(`typeof CCDev === 'object' && !!CCDev.balance ? 1 : 0`) !== 1) await C.jsFile(DEV); };
let lastSnapTurn = -1;
async function snapshot() {
  await ensureDev();
  const s = JSON.parse(await C.js(`CCDev.balance()`, 60000));
  if (s.turn === lastSnapTurn) return s;
  fs.appendFileSync(snapFile, JSON.stringify(s) + "\n");
  lastSnapTurn = s.turn;
  C.log(`snapshot turn ${s.turn}: world ${s.world}, ${s.civs.map((c) => `${c.civ}:${c.age}`).join(" ")}`);
  return s;
}

/** Autoplay until the target turn, snapshotting every `every` turns; throws on a stall or a lost game. */
async function playTo(target) {
  await ensureDev();
  let turn = await C.js(`Game.turn`), lastChange = Date.now(), restarts = 0;
  let next = Math.ceil((turn + 1) / every) * every;
  await C.js(`CCDev.autoplay(${target - turn})`);
  for (;;) {
    await C.sleep(15000);
    if (!(await C.gameRunning())) throw new Error("game process gone");
    const st = JSON.parse(await C.js(`JSON.stringify({ turn: Game.turn, active: Autoplay.isActive })`));
    if (st.turn !== turn) { turn = st.turn; lastChange = Date.now(); }
    if (turn >= next) { await snapshot(); next = (Math.floor(turn / every) + 1) * every; }
    if (turn >= target && !st.active) return turn;
    if (!st.active) {
      // Autoplay stopped early: a victory, the local player died, or a dialog. Try once more, then stop.
      if (restarts++ >= 1) { C.journalNote(`autoplay stopped at turn ${turn}`); return turn; }
      C.log(`autoplay stopped at turn ${turn}; starting it again`);
      await C.js(`CCDev.autoplay(${target - turn})`);
    }
    if (Date.now() - lastChange > STALL_MS) throw new Error(`stalled at turn ${turn}`);
  }
}

async function main() {
  C.log(`balance run: ${saveName ? "save " + saveName : `new ${game.size} game, seed ${game.seed}, ${game.players} players`}, ${turns} turns, snapshot every ${every}`);
  C.log(`output: ${dir}`);
  if (flag("dry")) return;
  fs.mkdirSync(dir, { recursive: true });
  await C.journalStart("balance", process.argv.slice(2));
  C.journalResult("dir", dir);
  let status = "done";
  const body = async () => {
    if (flag("deploy")) C.log((await C.deploy()).trim().split(/\n/).slice(-3).join(" | "));
    await C.restartGame();
    if (saveName) await C.load(saveName); else await C.startGame(game);
    const start = (await snapshot()).turn, target = start + turns;
    C.journalResult("turns", { start, target });
    let reached = start;
    for (let attempt = 0; ; attempt++) {
      try { reached = await playTo(target); break; } catch (e) {
        const crashed = !(await C.gameRunning());
        const auto = C.newestAutosave();
        C.journalNote(`${e.message}${crashed ? " (crash)" : ""}`);
        if (attempt >= 2 || !auto) { status = `stopped: ${e.message}`; break; }
        C.log(`${e.message}; restarting from autosave ${auto} (try ${attempt + 2} of 3)`);
        await C.restartGame();
        await C.load(auto, { auto: true });
      }
    }
    C.journalResult("reached", reached);
  };
  try {
    if (flag("keep")) await body(); else await C.withSetup(false, body);
  } catch (e) { status = "failed: " + e.message; }
  if (fs.existsSync(snapFile)) {
    const r = writeReport(snapFile, reportOpts);
    C.journalResult("report", r);
    C.log(`report: ${r.md} (${r.snapshots} snapshots, ${r.flags} flag(s))`);
  }
  C.journalEnd(status);
  process.exitCode = status === "done" ? 0 : 1;
}
main().catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; });
