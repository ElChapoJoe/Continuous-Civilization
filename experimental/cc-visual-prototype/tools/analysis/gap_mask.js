// node tools/analysis/gap_mask.js <age: antiquity|exploration|modern> <out.js>
// Writes a console script that sets globalThis._gaps (Set of "x,y" Tiny plots with no bare or no wooded reading in
// that Age's street layer) and globalThis._have (the measured ones), for a targeted all-land run.
const fs = require("fs");
const [age, out] = process.argv.slice(2);
globalThis.GameplayMap = { getGridWidth: () => 60, getGridHeight: () => 38, isRiver: () => false };
eval(fs.readFileSync(__dirname + "/../../ui/cc-street-table.js", "utf8"));
const gaps = [], have = [];
for (let y = 0; y < 38; y++) for (let x = 0; x < 60; x++) {
  const look = (w) => age === "antiquity" ? CCStreetTable.lookup(x, y, w) : CCStreetTable.lookupAge(age === "exploration" ? 1 : 2, x, y, w);
  (look(false) && look(true) ? have : gaps).push(x + "," + y);
}
fs.writeFileSync(out, `globalThis._gaps = new Set(${JSON.stringify(gaps)}); globalThis._have = new Set(${JSON.stringify(have)}); "gaps ${gaps.length}, have ${have.length}"`);
console.log(age, "gaps", gaps.length, "have", have.length);
