// node tools/analysis/gap_mask.js <age: antiquity|exploration|modern> <out.js> [size: tiny|small|standard|large|huge]
// Writes a console script that sets globalThis._gaps (Set of "x,y" plots of that map size with no bare or no wooded
// reading in that Age's street layer) and globalThis._have (the measured ones), for a targeted all-land run.
const fs = require("fs");
const SIZES = { tiny: [60, 38], small: [74, 46], standard: [84, 54], large: [96, 60], huge: [106, 66] };
const [age, out, size = "tiny"] = process.argv.slice(2);
const [W, H] = SIZES[size];
globalThis.GameplayMap = { getGridWidth: () => W, getGridHeight: () => H, isRiver: () => false, isNavigableRiver: () => false };
globalThis.Configuration = { getMap: () => ({ mapSeed: 0 }) };
eval(fs.readFileSync(__dirname + "/../../ui/cc-street-table.js", "utf8"));
const gaps = [], have = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const look = (w) => CCStreetTable.lookupAge(age === "antiquity" ? 0 : age === "exploration" ? 1 : 2, x, y, w);
  (look(false) && look(true) ? have : gaps).push(x + "," + y);
}
fs.writeFileSync(out, `globalThis._gaps = new Set(${JSON.stringify(gaps)}); globalThis._have = new Set(${JSON.stringify(have)}); "gaps ${gaps.length}, have ${have.length}"`);
console.log(size, age, "gaps", gaps.length, "have", have.length);
