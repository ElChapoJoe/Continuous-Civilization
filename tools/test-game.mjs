// Runs the in-game test suites (tests/cc-tests.js + tests/run-all-suites.js) from the command line: starts the game,
// opens a fresh test game or a save, optionally plays some AI turns, runs every CC.* suite and reports failing
// checks. Exit code 1 when a suite fails that is not expected to (see --allow).
//
//   node tools/test-game.mjs [--save NAME | --size small --seed 1 --players 6] [--turns N] [--deploy] [--allow a,b] [--keep]
//     --save NAME     load Saves/Single/NAME.Civ7Save instead of starting a new game
//     --size, --seed, --players   the new game (default small, seed 1, 6 players: a normal game with AIs)
//     --turns N       AI autoplay for N turns first (tests/cc-dev.js CCDev.autoplay), e.g. to reach later Ages
//     --deploy        run tools/deploy.ps1 first (mod check, then mirror the mod into the Mods folder)
//     --allow LIST    suites whose failure is expected (default: distantLands before turn 60, as nobody can cross
//                     the Ocean yet)
//     --keep          leave the game running afterwards
//     --probes [FILE] afterwards run the in-game experiments (tests/cc-probes.js, or FILE): they change the game, one
//                     AI turn per phase; their answers are reported, not counted as failures. Best with --turns 30
// Writes the full result to the run journal (~/CivRuns, or CC_RUNS). Needs Node 22+ and the game.
import fs from "node:fs";
import path from "node:path";
import * as C from "./lib/civ.mjs";

const { opt, flag } = C.args();
const probeArg = opt("probes");
const probeFile = flag("probes") ? path.resolve(probeArg && !probeArg.startsWith("--") ? probeArg : path.join(C.REPO, "tests", "cc-probes.js")) : null;
const saveName = opt("save"), turns = Number(opt("turns", 0));
const game = { size: opt("size", "small"), seed: Number(opt("seed", 1)), players: Number(opt("players", 6)) };
const TESTS = path.join(C.REPO, "tests");

/** The experiments of tests/cc-probes.js: per phase prepare, one AI turn, check. */
async function runProbes() {
  if (!fs.existsSync(probeFile)) { C.log(`probes: ${probeFile} not found`); C.journalNote("probes file missing"); return; }
  C.log(await C.jsFile(path.join(TESTS, "cc-dev.js")));
  C.log(await C.jsFile(probeFile));
  const phases = await C.js(`CCProbe.phases`);
  for (let i = 0; i < phases; i++) {
    C.log(`probe phase ${i + 1}/${phases}: ${await C.js(`CCProbe.prepare(${i})`)}`);
    const t = await C.js(`Game.turn`);
    await C.js(`CCDev.autoplay(1)`);
    await C.until(`(!Autoplay.isActive && Game.turn > ${t}) ? 1 : 0`, "one AI turn", 600000, 5000);
    await C.js(`CCProbe.check(${i})`);
  }
  const res = JSON.parse(await C.js(`CCProbe.results()`));
  C.journalResult("probes", res);
  for (const [name, r] of Object.entries(res)) C.log(`probe ${name}: ${r.skipped ? "skipped (" + r.skipped + ")" : r.pass ? "yes" : "NO"} - ${r.answer ?? r.error ?? ""}`);
}

async function main() {
  C.log(`test game: ${saveName ? "save " + saveName : `new ${game.size} game, seed ${game.seed}, ${game.players} players`}${turns ? `, ${turns} AI turns` : ""}`);
  if (flag("dry")) return;
  await C.journalStart("test-game", process.argv.slice(2));
  let failed = false;
  try {
    if (flag("deploy")) C.log((await C.deploy()).trim().split(/\n/).slice(-3).join(" | "));
    const body = async () => {
      await C.restartGame();
      if (saveName) await C.load(saveName); else await C.startGame(game);
      if (turns) {
        C.log(await C.jsFile(path.join(TESTS, "cc-dev.js")));
        const start = await C.js(`Game.turn`);
        await C.js(`CCDev.autoplay(${turns})`);
        await C.until(`(!Autoplay.isActive && Game.turn >= ${start + turns}) ? 1 : 0`, `${turns} AI turns`, turns * 120000, 15000);
        C.journalNote(`autoplay to turn ${await C.js(`Game.turn`)}`);
      }
      C.log(await C.jsFile(path.join(TESTS, "cc-tests.js")));
      const turn = await C.js(`Game.turn`);
      const raw = await C.jsFile(path.join(TESTS, "run-all-suites.js"), 300000);
      const r = JSON.parse(raw);
      const allow = new Set((opt("allow") ?? (turn < 60 ? "distantLands" : "")).split(",").filter(Boolean));
      const bad = Object.entries(r.suites).filter(([s, ok]) => ok === false && !allow.has(s)).map(([s]) => s);
      const expected = Object.entries(r.suites).filter(([s, ok]) => ok === false && allow.has(s)).map(([s]) => s);
      C.journalResult("turn", turn);
      C.journalResult("suites", r.suites);
      C.journalResult("failing", r.failing);
      const n = Object.keys(r.suites).length;
      C.log(`turn ${turn}: ${n - bad.length - expected.length} of ${n} suites pass${expected.length ? `, expected failures: ${expected.join(", ")}` : ""}`);
      for (const s of bad) C.log(`FAIL ${s}: ${JSON.stringify(r.failing[s]).slice(0, 400)}`);
      failed = bad.length > 0;
      if (probeFile) await runProbes();
    };
    if (flag("keep")) await body(); else await C.withSetup(false, body);
    C.journalEnd(failed ? "done: failures" : "done: all pass");
  } catch (e) { C.journalEnd("failed: " + e.message); throw e; }
  process.exitCode = failed ? 1 : 0;
}
main().catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; });
