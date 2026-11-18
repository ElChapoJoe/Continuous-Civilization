// Visual regression check: rebuilds the vanilla reference cities in a modded game, lets the overlay draw them in
// Exploration and Modern, shoots the same views as the vanilla reference shots, scores every tile against vanilla
// (tools/analysis/compare_tiles.py) and writes a review page (tools/analysis/review_page.py). Each run is compared
// with the previous one, so a change to the overlay shows which tiles moved closer to vanilla or further away.
//
//   node tools/pipeline/compare.mjs [--ages exploration,modern] [--out DIR] [--dry]
// Needs: the vanilla reference shots in CivStreetShots/reference/<age>/ (shots/, pack.txt; kept outside the repo),
// the layouts and views in tools/data/reference/, both mods installed and deployed (tools/deploy.ps1, prototype
// ui/ copied). Writes CivStreetShots/compare/<time>/<age>/ (shots, tiles.json, index.html) and a journal.
import fs from "node:fs";
import path from "node:path";
import * as C from "./civ.mjs";

const { opt, flag } = C.args();
const ages = opt("ages", "exploration,modern").split(",");
const REF = path.join(C.SHOTS, "reference");
const REFDATA = path.join(C.DATA, "reference");
const COMPARE = path.join(C.SHOTS, "compare");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
const OUT = opt("out", path.join(COMPARE, stamp));
const TECH = { exploration: ["NODE_TECH_EX_CARTOGRAPHY", 1], modern: ["NODE_TECH_MO_ACADEMICS", 2] };
const views = JSON.parse(fs.readFileSync(path.join(REFDATA, "views.json"), "utf8"));

/** The newest earlier run of this Age, for the before/after comparison. */
function previous(age) {
  if (!fs.existsSync(COMPARE)) return null;
  const runs = fs.readdirSync(COMPARE).filter((d) => d !== stamp && fs.existsSync(path.join(COMPARE, d, age, "tiles.json"))).sort();
  return runs.length ? path.join(COMPARE, runs[runs.length - 1], age, "tiles.json") : null;
}

async function main() {
  for (const age of ages) {
    if (!TECH[age]) throw new Error("unknown Age " + age);
    for (const f of [path.join(REF, age, "pack.txt"), path.join(REF, age, "shots", "s00.bmp"), path.join(REFDATA, `${age}-city.json`)]) {
      if (!fs.existsSync(f)) throw new Error("missing reference file " + f);
    }
  }
  C.log(`compare ${ages.join(", ")} -> ${OUT}`);
  if (flag("dry")) return;
  await C.journalStart("compare", process.argv.slice(2));
  try {
    await C.withSetup(false, async () => {
      await C.restartGame();
      await C.startGame({ size: "tiny", age: "antiquity", civ: "CIVILIZATION_ROME", seed: 265426227, gameSeed: 265426226,
        map: "{base-standard}maps/continents-voronoi.js" });
      C.log(await C.revealMap());
      C.log(await C.jsFile(path.join(C.GAME, "layout-copy.js")));
      for (const age of ages) {
        const layout = fs.readFileSync(path.join(REFDATA, `${age}-city.json`), "utf8");
        C.log(await C.js(`CCLayout.apply(${JSON.stringify(layout)})`));
        await C.until(`JSON.parse(CCLayout.status()).busy ? 0 : 1`, "the layout", 300000, 3000);
        C.journalNote(`${age} layout: ${await C.js(`CCLayout.check(${JSON.stringify(layout)})`)}`);
        const [node, n] = TECH[age];
        await C.js(`(Game.PlayerOperations.sendRequest(0, PlayerOperationTypes.GRANT_TREE_NODE, { ProgressionTreeNodeType: GameInfo.ProgressionTreeNodes.lookup(${JSON.stringify(node)}).$index, FullyUnlock: 1 }), 'granted')`);
        await C.until(`CCVisualOverlay.personalAge(Players.get(0)) === ${n} ? 1 : 0`, `personal Age ${age}`, 60000, 2000);
        C.log("overlay tiles", await C.js(`CCVisualOverlay.rebuild()`));
        await C.sleep(5000);
        const dir = path.join(OUT, age);
        const shots = await C.capture(path.join(dir, "shots"), views[age].length,
          () => C.js(`CCLayout.shoot(${JSON.stringify(views[age])}, 10)`), `JSON.parse(CCLayout.info()).state === 'done' ? 1 : 0`);
        const pack = path.join(dir, "pack.txt");
        fs.writeFileSync(pack, await C.js(`CCLayout.pack()`));
        const ref = path.join(REF, age);
        const line = (await C.run(C.PY, [path.join(C.ANALYSIS, "compare_tiles.py"), path.join(ref, "shots"), path.join(ref, "pack.txt"), shots, pack, dir, "46", "16"])).trim().split(/\n/)[0];
        C.log(age, line); C.journalResult(age, line);
        const prev = previous(age);
        const page = (await C.run(C.PY, [path.join(C.ANALYSIS, "review_page.py"), path.join(ref, "shots"), path.join(ref, "pack.txt"), shots, pack, dir, "46", prev || "-",
          `${age[0].toUpperCase() + age.slice(1)}: vanilla vs overlay (${stamp})`])).trim();
        C.log(page); C.journalResult(age + " page", path.join(dir, "index.html"));
        if (prev) C.journalNote(`${age} compared with ${prev}`);
      }
      // the overlay's own rule checks, in the same game
      C.log(await C.jsFile(path.join(C.GAME, "overlay-tests.js")));
      const checks = await C.js(`CCOverlayTests.run()`);
      C.log("overlay checks:", checks); C.journalResult("overlay checks", checks);
    });
    C.journalEnd("done");
  } catch (e) { C.journalEnd("failed: " + e.message); throw e; }
}
main().catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; });
