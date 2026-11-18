// Modern rural run: prepares a vanilla Modern rural test map and probes which farm variant and which turn the engine
// draws on each rural tile (round 66). Two steps, each its own game session:
//   1. load the empty all-land vanilla Modern map (save role vanilla-alland-modern-empty), fill one half with cities
//      and improvements (tools/game/rural-map.js), save it as CC_Vanilla_Rural_Mod_<half>;
//   2. tools/pipeline/probe.mjs on that save with tools/game/cands/rural-mod.js.
//   node tools/pipeline/rural.mjs [--half west|east] [--views close:16] [--fast] [--dry]
import path from "node:path";
import fs from "node:fs";
import * as C from "./civ.mjs";

const { opt, flag } = C.args();
const half = opt("half", "west");
const bounds = half === "east" ? [30, 0, 59, 37] : [0, 0, 29, 37];
const saveName = `CC_Vanilla_Rural_Mod_${half === "east" ? "East" : "West"}`;
const base = C.saveFor("vanilla-alland-modern-empty").save;

async function prepare() {
  await C.withSetup(true, async () => {
    await C.restartGame();
    await C.load(base);
    C.log(await C.jsFile(path.join(C.GAME, "rural-map.js")));
    await C.js(`(CCRural.bounds = ${JSON.stringify(bounds)}, 'bounds')`);
    C.log(await C.js(`CCRural.plan()`));
    await C.js(`CCRural.run()`);
    await C.until(`JSON.parse(CCRural.status()).busy ? 0 : 1`, "the rural map", 3600000, 10000);
    const st = await C.js(`CCRural.status()`);
    C.log(st); C.journalNote(`rural map: ${st}`);
    await C.save(saveName);
  });
}

async function main() {
  C.log(`rural run, ${half} half: ${base} -> ${saveName} -> probe`);
  if (flag("dry")) return;
  await C.journalStart(`rural-${half}`, process.argv.slice(2));
  try {
    if (!fs.existsSync(path.join(C.SAVES, saveName + ".Civ7Save")) || flag("fresh")) await prepare();
    else C.journalNote(`reusing ${saveName}`);
    C.journalEnd("prepared; probe follows in its own journal");
  } catch (e) { C.journalEnd("failed: " + e.message); throw e; }
  const argv = [path.join(C.PROTO, "tools", "pipeline", "probe.mjs"),
    "--save", saveName, "--vanilla", "--pre", path.join(C.GAME, "rural-map.js"), "--cands", path.join(C.GAME, "cands", "rural-mod.js"),
    "--views", opt("views", "close:16"), ...(flag("fast") ? ["--fast"] : [])];
  C.log(await C.run("node", argv));
}
main().catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; });
