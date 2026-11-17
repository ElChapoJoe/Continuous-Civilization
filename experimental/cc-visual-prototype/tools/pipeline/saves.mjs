// Lists the test saves by role (tools/data/saves.json) and whether each save file exists on this PC.
//   node tools/pipeline/saves.mjs
import fs from "node:fs";
import path from "node:path";
import * as C from "./civ.mjs";

const lib = JSON.parse(fs.readFileSync(C.SAVE_LIBRARY, "utf8"));
for (const [role, s] of Object.entries(lib)) {
  if (role.startsWith("_")) continue;
  const ok = fs.existsSync(path.join(C.SAVES, s.save + ".Civ7Save"));
  console.log(`${ok ? "ok     " : "MISSING"} ${role.padEnd(32)} ${s.save}${s.vanilla ? "  (vanilla: park the mods)" : ""}`);
  console.log(`        ${s.about}`);
}
