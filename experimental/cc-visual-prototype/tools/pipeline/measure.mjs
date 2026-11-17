// One-command street-table run: a test game of one map size and Age, every water and mountain plot turned into land,
// cities and empty urban districts over the map, the street probe (bare and wooded), scoring and merging into
// tools/data/street-table-<size>-<seed>[-<age>].json, then build_street_table.py. See the runbook in
// tools/game/all-land.js for what each step does by hand.
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
//     --out DIR                               screenshots and intermediate files (default CivStreetShots/run-<size>-<age>-<seed>)
//     --fast                                  screenshots drive the probe (shot when the picture settles; untested)
//     --dry                                   print the plan only
// Every run writes a journal to CivStreetShots/runs (arguments, git commit, notes, results); a game crash during a
// part restarts the game and resumes from the part's last save (founding is not repeated once its save exists).
// Needs the game, Node 22+, and Blender's Python (numpy) or CC_PYTHON. Nothing may cover the game window meanwhile.
import fs from "node:fs";
import path from "node:path";
import * as C from "./civ.mjs";

const ROADS = {
  antiquity: ["LAYOUT_CTY_Hex_Section_AB_Road_ANT", "LAYOUT_CTY_Hex_Section_AB_B_Road_ANT"],
  exploration: ["LAYOUT_CTY_Hex_Section_AB_Road_EXP", "LAYOUT_CTY_Hex_Section_AB_B_Road_EXP"],
  modern: ["LAYOUT_CTY_MOD_Section_AB_Road"],
};
const CIV = { antiquity: "CIVILIZATION_ROME", exploration: "CIVILIZATION_SPAIN", modern: "CIVILIZATION_MEXICO" };

const { opt, flag } = C.args();
const size = opt("size"), age = opt("age"), seed = Number(opt("seed"));
if (!C.SIZES[size] || !ROADS[age] || !seed) {
  console.log("usage: node measure.mjs --size tiny|small|standard|large|huge --age antiquity|exploration|modern --seed N [--vanilla] [--halves] [--gaps] [--wood] [--out DIR] [--dry]");
  process.exit(1);
}
const vanilla = flag("vanilla"), halves = flag("halves"), gaps = flag("gaps"), fast = flag("fast");
const woodPass = age !== "modern" || flag("wood");
const OUT = opt("out", path.join(C.SHOTS, `run-${size}-${age}-${seed}`));
const tag = `${size}-${seed}${gaps ? "g" : ""}`;
const tableFile = path.join(C.DATA, `street-table-${tag}${age === "antiquity" ? "" : "-" + age}.json`);
const landSave = `CC_Run_${tag}_${age}_Land`;

const citiesSaved = new Set();
const shoot = (dir, states) => (fast ? C.captureFast : C.capture)(dir, states, () => C.js(`CCStreetProbe.start(-1, _views, 6)`));

/** One part of the map: found the cities (or resume from their save), probe bare (and wooded), score. */
async function part(bounds, i) {
  const citiesSave = `CC_Run_${tag}_${age}_Cities${i}`;
  const resume = citiesSaved.has(i);
  await C.load(resume ? citiesSave : landSave);
  for (const f of ["table-map.js", "all-land.js"]) C.log(await C.jsFile(path.join(C.GAME, f)));
  if (gaps) {
    await C.run("node", [path.join(C.ANALYSIS, "gap_mask.js"), age, path.join(OUT, "gaps.js"), size]);
    C.log(await C.jsFile(path.join(OUT, "gaps.js")));
    await C.js(`(CCTable.targetFilter = (x, y) => _gaps.has(x + ',' + y) && !GameplayMap.isRiver(x, y), 'filter set')`);
  } else await C.js(`(globalThis._have = new Set(), 'all new')`);
  if (bounds) await C.js(`(CCTable.bounds = ${JSON.stringify(bounds)}, 'bounds')`);
  if (!resume) {
    C.log(await C.js(`CCTable.plan()`));
    await C.js(`CCTable.run()`);
    await C.until(`JSON.parse(CCTable.status()).busy ? 0 : 1`, "the cities", 3600000, 10000);
    const st = await C.js(`CCTable.status()`);
    C.log(st); C.journalNote(`part ${i} founded: ${st}`);
    await C.save(citiesSave);
    citiesSaved.add(i);
  } else C.journalNote(`part ${i} resumed from ${citiesSave}`);
  await C.js(`(globalThis.CCStreetProbeStreets = ${JSON.stringify(ROADS[age])}, 'roads')`);
  C.log(await C.jsFile(path.join(C.GAME, "street-probe.js")));
  C.log(await C.js(`CCTable.wood(false) + ' | ' + CCAllLand.views(1)`));
  const views = await C.js(`_views.length`), states = views * (ROADS[age].length * 6 + 1);
  const bare = await shoot(path.join(OUT, `part${i}_bare`), states);
  fs.writeFileSync(path.join(OUT, `part${i}_pack.txt`), await C.js(`CCAllLand.pack()`, 60000));
  fs.writeFileSync(path.join(OUT, `part${i}_rivers.json`), await C.js(`CCAllLand.rivers()`));
  let wood = null;
  if (woodPass) {
    C.log(await C.js(`CCTable.wood(true)`));
    wood = await shoot(path.join(OUT, `part${i}_wood`), states);
  }
  const env = age === "modern" ? { CC_STREETS: "1" } : {};
  const score = async (d) => {
    const o = d + ".json";
    const line = (await C.run(C.PY, [path.join(C.ANALYSIS, "table_score.py"), d, path.join(OUT, `part${i}_pack.txt`), "46", o], env)).trim().split(/\n/).pop();
    C.log(line); C.journalResult(path.basename(d), line);
    return o;
  };
  const b = await score(bare), w = wood ? await score(wood) : b;
  return { bare: b, wood: w, rivers: path.join(OUT, `part${i}_rivers.json`) };
}

async function main() {
  const [W] = C.SIZES[size];
  const parts = halves ? [[0, 0, Math.floor(W / 2) - 1, 99], [Math.floor(W / 2), 0, W - 1, 99]] : [null];
  C.log(`run ${size} ${age} seed ${seed}${vanilla ? " vanilla" : ""}${halves ? " halves" : ""}${gaps ? " gaps" : ""}, ${woodPass ? "bare + wooded" : "bare"} -> ${tableFile}`);
  if (flag("dry")) return;
  fs.mkdirSync(OUT, { recursive: true });
  await C.journalStart(`measure-${size}-${age}-${seed}`, process.argv.slice(2));
  try { await C.withSetup(vanilla, async () => {
    await C.restartGame();
    await C.startGame({ size, age, civ: CIV[age], seed });
    C.log(await C.jsFile(path.join(C.GAME, "all-land.js")));
    C.log(await C.js(`CCAllLand.convert()`));
    await C.save(landSave);
    const results = [];
    for (let i = 0; i < parts.length; i++) {
      results.push(await C.withRecovery(`part ${i}`, () => part(parts[i], i), async () => {}));
    }
    const merged = { note: `measure.mjs run (${new Date().toISOString().slice(0, 10)}): ${vanilla ? "vanilla" : "modded"} ${age} game, ${size}, map seed ${seed} pangaea-voronoi turned all land${gaps ? ", only coordinates missing from the layer" : ""}${halves ? ", in two halves" : ""}. Value = [bare label, margin, wooded label, margin].`, rivers: [], tiles: {} };
    for (const [i, r] of results.entries()) {
      const one = path.join(OUT, `part${i}_table.json`);
      C.log((await C.run("python", [path.join(C.ANALYSIS, "merge_passes.py"), r.bare, r.wood, r.rivers, one, "part"])).trim());
      const t = JSON.parse(fs.readFileSync(one, "utf8"));
      merged.rivers.push(...t.rivers); Object.assign(merged.tiles, t.tiles);
    }
    fs.writeFileSync(tableFile, JSON.stringify(merged, null, 0));
    C.log("wrote", tableFile, Object.keys(merged.tiles).length, "tiles");
    const built = (await C.run("python", [path.join(C.ANALYSIS, "build_street_table.py")])).trim().split("\n").slice(-6).join("\n");
    C.log(built);
    C.journalResult("table", { file: tableFile, tiles: Object.keys(merged.tiles).length, build: built });
  }); C.journalEnd("done"); } catch (e) { C.journalEnd("failed: " + e.message); throw e; }
}
main().catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; });
