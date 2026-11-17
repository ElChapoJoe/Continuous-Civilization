// Generic candidate probe: which of several candidates did the engine draw on each tile? (house layouts, rural
// improvements, building variants ...). Loads a save, shoots the engine's own picture of each camera view (pass 1,
// nothing clipped), then clips the city tiles and shoots each tile's candidates in turn (pass 2), and scores every
// candidate against the engine's picture (tools/analysis/house_score.py).
//
//   node tools/pipeline/probe.mjs --save CC_Vanilla_AllLand_Exp_West --cands tools/game/cands/houses-exp.js [options]
//     --save NAME        the game to probe (Saves/Single/NAME.Civ7Save)
//     --cands FILE       debug-console script that sets globalThis.CCProbeCands = { n, labels?, of(tile) } (see
//                        tools/game/street-probe.js) and does any setup; it can use CCStreetTable and CCTable
//     --vanilla          park both mods for the run (restored at the end)
//     --views close:12   N close views (camera height 300) spread over the city tiles; "wide" = the whole-map views
//                        at height 900 (default close:12)
//     --seconds 8        per state (models need a moment to load)
//     --radius R         scoring window in pixels (default 120 close, 46 wide)
//     --out DIR          default CivStreetShots/probe-<cands>-<save>
//     --fast             screenshots drive the probe (shot when the picture settles; untested)
//     --dry              print the plan only
// Writes a journal to CivStreetShots/runs; a game crash restarts the game and repeats the passes from the save.
// Writes <out>/result.json ({"x,y": [best, ratio, [distance per candidate]]}) and prints how often each candidate won.
import fs from "node:fs";
import path from "node:path";
import * as C from "./civ.mjs";

const { opt, flag } = C.args();
const saveName = opt("save"), candsFile = opt("cands");
if (!saveName || !candsFile) {
  console.log("usage: node probe.mjs --save NAME --cands FILE [--vanilla] [--views close:N|wide] [--seconds S] [--radius R] [--out DIR] [--dry]");
  process.exit(1);
}
const vanilla = flag("vanilla"), seconds = Number(opt("seconds", 8));
const viewsSpec = opt("views", "close:12"), wide = viewsSpec === "wide";
const radius = Number(opt("radius", wide ? 46 : 120));
const OUT = opt("out", path.join(C.SHOTS, `probe-${path.basename(candsFile, ".js")}-${saveName}`));

const VIEWS = wide ? `JSON.parse(CCTable.views(900, 16, 6))`
  : `(() => { const all = JSON.parse(CCTable.views(300, 6, 2)), n = ${Number(viewsSpec.split(":")[1] || 12)}, out = [];
      for (let i = 0; i < all.length && out.length < n; i += Math.max(1, Math.floor(all.length / n))) out.push(all[i]);
      return out; })()`;

async function prepare() {
  for (const f of [path.join(C.UI, "cc-street-table.js"), path.join(C.GAME, "table-map.js")]) C.log(await C.jsFile(f));
  C.log(await C.jsFile(path.resolve(candsFile)));
  return await C.js(`(globalThis._views = ${VIEWS}, JSON.stringify({ views: _views.length, n: CCProbeCands.n, labels: CCProbeCands.labels || null }))`);
}

async function main() {
  C.log(`probe ${saveName} with ${candsFile}${vanilla ? " (vanilla)" : ""}, views ${viewsSpec}, ${seconds} s per state, radius ${radius} -> ${OUT}`);
  if (flag("dry")) return;
  fs.mkdirSync(OUT, { recursive: true });
  const shoot = (dir, states) => (flag("fast") ? C.captureFast : C.capture)(dir, states, () => C.js(`CCStreetProbe.start(-1, _views, ${seconds})`));
  await C.journalStart(`probe-${path.basename(candsFile, ".js")}`, process.argv.slice(2));
  try {
    await C.withSetup(vanilla, async () => {
      await C.restartGame();
      // A crash restarts the game and repeats the passes from the save (they don't change the game).
      await C.withRecovery("probe", async () => {
        await C.load(saveName);
        const info = JSON.parse(await prepare());
        C.log("views", info.views, "candidates", info.n, info.labels ? info.labels.join(", ") : "");
        C.journalNote(`views ${info.views}, candidates ${info.n}`);
        // pass 1: the engine's own picture, one state per view
        await C.js(`(globalThis.CCProbeNoClip = true, globalThis.CCProbeBaseOnly = true, 'engine pass')`);
        C.log(await C.jsFile(path.join(C.GAME, "street-probe.js")));
        const eng = await shoot(path.join(OUT, "engine"), info.views);
        // pass 2: city tiles clipped, each candidate alone
        await C.js(`(globalThis.CCProbeNoClip = false, globalThis.CCProbeBaseOnly = false, 'candidate pass')`);
        C.log(await C.jsFile(path.join(C.GAME, "street-probe.js")));
        const per = info.n + 1;
        const cand = await shoot(path.join(OUT, "candidates"), info.views * per);
        const pack = path.join(OUT, "pack.txt");
        fs.writeFileSync(pack, await C.js(`CCTable.pack()`, 60000));
        const result = path.join(OUT, "result.json");
        const line = (await C.run(C.PY, [path.join(C.ANALYSIS, "house_score.py"), eng, cand, pack, String(radius), String(per), result, "1"])).trim();
        C.log(line); C.journalResult("score", line);
        fs.writeFileSync(path.join(OUT, "info.json"), JSON.stringify({ save: saveName, cands: candsFile, vanilla, ...info, radius, seconds }, null, 1));
      }, async () => {});
    });
    C.journalEnd("done");
  } catch (e) { C.journalEnd("failed: " + e.message); throw e; }
}
main().catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; });
