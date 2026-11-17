// Builds a balance report from the snapshots of a balance run (tools/balance-run.mjs): one CCDev.balance() result per
// line of a .jsonl file. Writes report.md and balance.csv next to it. Runs without the game.
//
//   node tools/balance-report.mjs RUN_DIR|FILE.jsonl [--ratio 2] [--from 20]
//     --ratio R   flag a yield when the leader makes R times the median or more (default 2)
//     --from T    ignore turns before T for the flags (early-game numbers are tiny and noisy; default 20)
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const YIELDS = ["sci", "cul", "gold", "prod", "food", "infl", "happy"];
const TRENDS = [["cul", "Culture per turn"], ["sci", "Science per turn"], ["techs", "Techs researched"],
  ["civics", "Civics researched"], ["cities", "Cities"], ["pop", "Population"]];
const VPS = [["vpC", "Culture"], ["vpS", "Science"], ["vpE", "Economic"], ["vpM", "Military"]];
const FIELDS = ["turn", "world", "id", "civ", "age", "cities", "pop", "techs", "civics", "units", ...YIELDS, ...VPS.map(([k]) => k)];

export function readSnapshots(file) {
  // A crash can leave a half-written last line: skip lines that don't parse.
  return fs.readFileSync(file, "utf8").split(/\r?\n/).filter((l) => l.trim())
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((s) => Array.isArray(s?.civs)).sort((a, b) => a.turn - b.turn);
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const fmt = (v) => v == null ? "–" : typeof v === "number" && !Number.isInteger(v) ? v.toFixed(1) : String(v);
const table = (head, rows) => [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.map(fmt).join(" | ")} |`)].join("\n");

/** Flags: per checkpoint and yield, the leader's multiple of the median when it reaches the ratio. */
export function findFlags(snaps, { ratio = 2, from = 20 } = {}) {
  const flags = [];
  for (const s of snaps) {
    if (s.turn < from || s.civs.length < 3) continue;
    for (const k of YIELDS) {
      const vals = s.civs.map((c) => c[k]).filter((v) => typeof v === "number");
      if (vals.length < 3) continue;
      const med = median(vals), top = s.civs.reduce((a, c) => (c[k] ?? -Infinity) > (a[k] ?? -Infinity) ? c : a);
      if (med > 0 && top[k] / med >= ratio) flags.push({ turn: s.turn, yield: k, civ: top.civ, value: top[k], median: med, x: top[k] / med });
    }
  }
  return flags;
}

/** First turn each civ was seen in each personal Age, and when the world Age changed. */
export function ageTimeline(snaps) {
  const civs = {}, world = [];
  for (const s of snaps) {
    if (s.world && world.at(-1)?.age !== s.world) world.push({ age: s.world, turn: s.turn });
    for (const c of s.civs) {
      const e = civs[c.id] ??= { civ: c.civ, EX: null, MO: null, last: null };
      if (c.age === "EX" && e.EX == null) e.EX = s.turn;
      if (c.age === "MO") { if (e.EX == null) e.EX = s.turn; if (e.MO == null) e.MO = s.turn; }
      e.last = s.turn;
    }
  }
  return { civs, world };
}

export function buildReport(snaps, opts = {}) {
  if (!snaps.length) return "# Balance report\n\nNo snapshots.\n";
  const ids = [...new Set(snaps.flatMap((s) => s.civs.map((c) => c.id)))].sort((a, b) => a - b);
  const names = Object.fromEntries(snaps.flatMap((s) => s.civs.map((c) => [c.id, c.civ])));
  const head = ids.map((id) => `${names[id]} (${id})`);
  const last = snaps.at(-1), first = snaps[0];
  const out = [`# Balance report`, ``,
    `Turns ${first.turn}–${last.turn}, ${snaps.length} snapshots, ${ids.length} civs. World Age at the end: ${last.world ?? "?"}.`];
  if (opts.meta) out.push(``, opts.meta);

  const flags = findFlags(snaps, opts);
  out.push(``, `## Flags`, ``);
  if (!flags.length) out.push(`No yield where the leader made ${opts.ratio ?? 2}× the median or more (from turn ${opts.from ?? 20}).`);
  else {
    // One line per civ and yield: when it started, how long, and the peak multiple.
    const groups = {};
    for (const f of flags) (groups[`${f.civ}|${f.yield}`] ??= []).push(f);
    const rows = Object.values(groups).map((g) => { const peak = g.reduce((a, f) => f.x > a.x ? f : a);
      return [g[0].civ, g[0].yield, g[0].turn, g.at(-1).turn, g.length, `${peak.x.toFixed(1)}× (turn ${peak.turn}: ${peak.value} vs median ${fmt(peak.median)})`]; })
      .sort((a, b) => b[4] - a[4]);
    out.push(`Leader at ${opts.ratio ?? 2}× the median or more:`, ``, table(["civ", "yield", "first turn", "last turn", "snapshots", "peak"], rows));
  }

  const tl = ageTimeline(snaps);
  out.push(``, `## Ages`, ``, `World Age: ${tl.world.map((w) => `${w.age} from turn ${w.turn}`).join(", ") || "?"}.`, ``,
    table(["civ", "Exploration from", "Modern from"], ids.map((id) => [head[ids.indexOf(id)], tl.civs[id]?.EX, tl.civs[id]?.MO])));

  out.push(``, `## At turn ${last.turn}`, ``,
    table(["civ", "Age", "cities", "pop", "techs", "civics", "sci", "cul", "gold", "prod", "infl", "happy", ...VPS.map(([, n]) => `VP ${n}`)],
      last.civs.map((c) => [`${c.civ} (${c.id})`, c.age, c.cities, c.pop, c.techs, c.civics, c.sci, c.cul, c.gold, c.prod, c.infl, c.happy, ...VPS.map(([k]) => c[k])])));

  for (const [k, title] of [...TRENDS, ...VPS.map(([k, n]) => [k, `Victory points: ${n}`])]) {
    if (!snaps.some((s) => s.civs.some((c) => c[k] != null))) continue;
    out.push(``, `## ${title}`, ``, table(["turn", ...head, "median"], snaps.map((s) => {
      const row = ids.map((id) => s.civs.find((c) => c.id === id)?.[k] ?? null);
      const vals = row.filter((v) => typeof v === "number");
      return [s.turn, ...row, vals.length ? median(vals) : null];
    })));
  }
  return out.join("\n") + "\n";
}

export function toCsv(snaps) {
  const esc = (v) => v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  return [FIELDS.join(","), ...snaps.flatMap((s) => s.civs.map((c) => FIELDS.map((f) => esc(f === "turn" ? s.turn : f === "world" ? s.world : c[f])).join(",")))].join("\n") + "\n";
}

/** Writes report.md and balance.csv into dir from dir/snapshots.jsonl (or the given file); returns the paths. */
export function writeReport(fileOrDir, opts = {}) {
  const file = fs.statSync(fileOrDir).isDirectory() ? path.join(fileOrDir, "snapshots.jsonl") : fileOrDir;
  const dir = path.dirname(file), snaps = readSnapshots(file);
  const md = path.join(dir, "report.md"), csv = path.join(dir, "balance.csv");
  fs.writeFileSync(md, buildReport(snaps, opts));
  fs.writeFileSync(csv, toCsv(snaps));
  return { md, csv, snapshots: snaps.length, flags: findFlags(snaps, opts).length };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const argv = process.argv.slice(2);
  const opt = (n, d) => { const i = argv.indexOf("--" + n); return i < 0 ? d : argv[i + 1]; };
  const target = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
  if (!target) { console.error("usage: node tools/balance-report.mjs RUN_DIR|FILE.jsonl [--ratio 2] [--from 20]"); process.exit(2); }
  const r = writeReport(target, { ratio: Number(opt("ratio", 2)), from: Number(opt("from", 20)) });
  console.log(`${r.snapshots} snapshots, ${r.flags} flag(s)\n${r.md}\n${r.csv}`);
}
