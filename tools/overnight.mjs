// The overnight run in one command: setup check, in-game tests and experiments, the log baseline (saved only when the
// test game's logs have no new mod errors), the new-Age banner, and a long balance run, in that order. Each step is its own process with a time limit; a failed step is written
// down and the next one still runs. Everything ends up in one summary.md (in ~/CivRuns/<time>-overnight/).
//
//   node tools/overnight.mjs [--only a,b] [--skip a,b] [--balance-turns 200] [--dry]
//   steps: doctor, deploy, tests, baseline, banner, balance   (the order they run in; banner also rescans the logs)
//
// Run it from the branch (or local test branch) whose mod should be tested: "deploy" mirrors this checkout's mod
// into the game's Mods folder first. Takes the screen for hours; nobody should use the PC meanwhile.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import * as C from "./lib/civ.mjs";

const { opt, flag } = C.args();
const list = (s) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : null);
const only = list(opt("only")), skip = list(opt("skip")) || [];
const balanceTurns = Number(opt("balance-turns", 200));
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dir = path.join(C.RUNS, `${stamp}-overnight`);
const NODE = process.execPath;
const PS = (f, ...a) => ["powershell", ["-ExecutionPolicy", "Bypass", "-File", path.join(C.TOOLS, f), ...a]];
const MIN = 60000;

/** Runs a program, streams its output to the console and to dir/<name>.log; resolves {code, out}. */
function runStep(name, [cmd, argv], timeoutMs) {
  return new Promise((resolve) => {
    const logFile = fs.createWriteStream(path.join(dir, `${name}.log`));
    const p = spawn(cmd, argv, { cwd: C.REPO, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const take = (d) => { out += d; logFile.write(d); process.stdout.write(d); };
    p.stdout.on("data", take); p.stderr.on("data", take);
    const timer = setTimeout(() => { take(`\n[overnight] ${name}: time limit (${Math.round(timeoutMs / MIN)} min), stopped\n`); p.kill(); }, timeoutMs);
    p.on("close", (code) => { clearTimeout(timer); logFile.end(); resolve({ code, out }); });
  });
}
/** The newest run journal of a kind written since `since` (ms), or null. */
function journalSince(kind, since) {
  if (!fs.existsSync(C.RUNS)) return null;
  const f = fs.readdirSync(C.RUNS).filter((n) => n.endsWith(`-${kind}.json`))
    .map((n) => path.join(C.RUNS, n)).filter((p) => fs.statSync(p).mtimeMs >= since)
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
  try { return f ? { file: f, data: JSON.parse(fs.readFileSync(f, "utf8")) } : null; } catch { return null; }
}
const lastLines = (s, n) => s.trim().split(/\r?\n/).slice(-n).join("\n");

// ---- the new-Age banner: grant Cartography outside autoplay, close the tech popup, read the banner's text
const BANNER_TEXT = `(() => { const t = document.querySelector('age-transition-banner #at-age-ending_age-text'); return t ? t.textContent.replace(/\\s+/g, ' ').trim() : ''; })()`;
async function bannerCheck() {
  const r = { steps: [] };
  await C.restartGame();
  await C.startGame({ size: "small", seed: 7, players: 2 });
  r.steps.push(await C.jsFile(path.join(C.REPO, "tests", "cc-dev.js")));
  r.scriptLoaded = await C.js(`typeof Controls !== 'undefined' ? 'ui up' : 'no ui'`);
  r.grant = await C.js(`CCDev.grant(GameContext.localPlayerID, 'NODE_TECH_EX_CARTOGRAPHY')`);
  const end = Date.now() + 90000;
  while (Date.now() < end) {
    const text = await C.js(BANNER_TEXT).catch(() => "");
    if (text) { r.bannerText = text; break; }
    // The tech-complete popup comes first (the banner is queued after it): close it like a player would.
    if (await C.js(`!!document.querySelector('screen-tech-civic-complete')`).catch(() => false)) {
      for (const cap of ["continue", "close", "ok"]) if (await C.press(cap).catch(() => false)) { r.steps.push("pressed " + cap); break; }
    }
    await C.sleep(1500);
  }
  r.pass = /exploration/i.test(r.bannerText || "");
  if (!r.bannerText) r.note = "no banner within 90 s of the grant";
  const shot = path.join(dir, "banner.png");
  await C.ps(path.join(C.TOOLS, "screenshot.ps1"), shot).then(() => { r.screenshot = shot; }).catch(() => {});
  await C.quitGame();
  return r;
}

const STEPS = [
  { name: "doctor", run: () => runStep("doctor", PS("doctor.ps1"), 5 * MIN),
    judge: (res) => ({ ok: res.code === 0, detail: lastLines(res.out, 1) }) },
  { name: "deploy", run: () => runStep("deploy", PS("deploy.ps1"), 10 * MIN),
    judge: (res) => ({ ok: res.code === 0, detail: lastLines(res.out, 2) }) },
  { name: "tests", kind: "test-game",
    run: () => runStep("tests", [NODE, [path.join(C.TOOLS, "test-game.mjs"), "--turns", "30", "--probes"]], 120 * MIN),
    judge: (res, j) => {
      const r = j?.data?.results || {};
      const probes = Object.entries(r.probes || {}).map(([k, v]) => `  - ${k}: ${v.skipped ? "skipped" : v.pass ? "yes" : "NO"}: ${v.answer ?? v.error ?? ""}`);
      const failing = Object.keys(r.failing || {});
      return { ok: res.code === 0, detail: `turn ${r.turn ?? "?"}; failing suites: ${failing.join(", ") || "none"}`
        + (r.suites?.missingContent !== undefined ? `; missingContent (wonders): ${r.suites.missingContent}` : "")
        + (probes.length ? `\n  experiments:\n${probes.join("\n")}` : "") };
    } },
  { name: "baseline",
    run: async () => {
      const scan = await runStep("baseline-scan", PS("scan-logs.ps1"), 5 * MIN);
      if (scan.code !== 0) return { code: 1, out: scan.out + "\n[overnight] new mod or database errors: baseline NOT saved" };
      const save = await runStep("baseline-save", PS("scan-logs.ps1", "-SaveBaseline"), 5 * MIN);
      return { code: save.code, out: scan.out + save.out };
    },
    judge: (res) => ({ ok: res.code === 0, detail: lastLines(res.out, 2) }) },
  { name: "banner",
    run: async () => {
      try { const r = await bannerCheck(); fs.writeFileSync(path.join(dir, "banner.json"), JSON.stringify(r, null, 1)); return { code: r.pass ? 0 : 1, out: JSON.stringify(r) }; }
      catch (e) { await C.quitGame().catch(() => {}); return { code: 1, out: "error: " + e.message }; }
    },
    judge: (res) => { let r = {}; try { r = JSON.parse(res.out); } catch { /* error text */ }
      return { ok: res.code === 0, detail: r.bannerText ? `banner: "${r.bannerText}"` : res.out.slice(0, 300) }; } },
  { name: "logs-after-banner", run: () => runStep("logs-after-banner", PS("scan-logs.ps1"), 5 * MIN),
    judge: (res) => ({ ok: res.code === 0, detail: lastLines(res.out, 6) }) },
  { name: "balance", kind: "balance",
    run: () => runStep("balance", [NODE, [path.join(C.TOOLS, "balance-run.mjs"), "--turns", String(balanceTurns), "--every", "10"]], (balanceTurns * 1.5 + 30) * MIN),
    judge: (res, j) => {
      const r = j?.data?.results || {};
      return { ok: res.code === 0, detail: `turns ${r.turns?.start ?? "?"} -> ${r.reached ?? "?"}; report: ${r.report?.md ?? "none"}; flags: ${r.report?.flags ?? "?"}` };
    } },
];

async function main() {
  const steps = STEPS.filter((s) => (!only || only.includes(s.name) || (s.name === "logs-after-banner" && only.includes("banner"))) && !skip.includes(s.name));
  C.log(`overnight: ${steps.map((s) => s.name).join(" -> ")}; output ${dir}`);
  if (flag("dry")) return;
  fs.mkdirSync(dir, { recursive: true });
  const branch = (await C.run("git", ["-C", C.REPO, "rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "?")).trim();
  const commit = (await C.run("git", ["-C", C.REPO, "rev-parse", "--short", "HEAD"]).catch(() => "?")).trim();
  const rows = [], started = Date.now();
  const write = () => fs.writeFileSync(path.join(dir, "summary.md"), [
    `# Overnight run ${stamp}`, ``, `Branch ${branch} (${commit}). ${Math.round((Date.now() - started) / MIN)} min so far.`, ``,
    `| step | result | minutes |`, `|---|---|---|`, ...rows.map((r) => `| ${r.name} | ${r.ok ? "ok" : "**FAILED**"} | ${r.min} |`), ``,
    ...rows.map((r) => `## ${r.name}\n\n${r.detail}\n`)].join("\n"));
  for (const s of steps) {
    const t0 = Date.now();
    C.log(`=== ${s.name}`);
    let res;
    try { res = await s.run(); } catch (e) { res = { code: 1, out: "error: " + e.message }; }
    const j = s.kind ? journalSince(s.kind, t0) : null;
    let judged;
    try { judged = s.judge(res, j); } catch (e) { judged = { ok: false, detail: "could not read the result: " + e.message }; }
    rows.push({ name: s.name, ...judged, min: Math.round((Date.now() - t0) / MIN), journal: j?.file });
    if (j?.file) rows.at(-1).detail += `\n\njournal: ${j.file}`;
    write();
    C.log(`=== ${s.name}: ${judged.ok ? "ok" : "FAILED"}`);
  }
  // Leave the game closed and the mods unparked, whatever happened.
  await C.quitGame().catch(() => {});
  C.unpark();
  write();
  C.log(`summary: ${path.join(dir, "summary.md")}`);
}
main().catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; });
