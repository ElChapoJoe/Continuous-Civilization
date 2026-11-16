// Run every CC.* check suite (tests/cc-tests.js must be loaded first) and summarise: pass per suite, failing checks.
(function () {
  const suites = ["db", "gating", "resources", "civics", "personalAge", "modernRules", "batchA", "batchB", "exRules",
    "distantLands", "modernTrees", "modernContent", "modernSystems", "parkLinks", "victories", "triumphs", "dedications",
    "diplomacy", "worldAge", "civTrees", "ageScaling", "missingContent", "overbuild"];
  const out = { pass: true, suites: {}, failing: {} };
  for (const s of suites) {
    let r;
    try { r = CC[s](0); } catch (e) { r = { pass: false, error: String(e) }; }
    const ok = r && (r.pass === true || (r.pass === undefined && r.error === undefined));
    out.suites[s] = r?.pass ?? "n/a";
    if (r?.pass === false) {
      out.pass = false;
      const bad = {};
      if (r.checks) for (const [k, v] of Object.entries(r.checks)) if (!v.pass) bad[k] = v;
      out.failing[s] = r.error ? r.error : (Object.keys(bad).length ? bad : JSON.stringify(r).slice(0, 400));
    }
  }
  return JSON.stringify(out);
})();
