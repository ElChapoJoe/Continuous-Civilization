// Debug console: fingerprint of the gameplay database (row count and hash per table). Compare two runs to prove a
// refactor changed no data, e.g. before and after a reorganization (cc_* working tables are dropped by 99-cleanup).
// Fingerprint of the gameplay database: per table, row count and a hash of the sorted rows (cc_* working tables skipped).
(function () {
  const h = s => { let a = 5381, b = 52711; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = (a * 33) ^ c; b = (b * 33) ^ c; } return ((a >>> 0) * 4096 + (b >>> 0) % 4096).toString(36); };
  const tables = Database.query("gameplay", "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").map(r => r.name);
  const out = {};
  for (const t of tables) {
    try {
      const rows = Database.query("gameplay", `SELECT * FROM "${t}"`).map(r => { const o = {}; for (const k of Object.keys(r).sort()) if (k !== "$index" && k !== "$hash") o[k] = r[k]; return JSON.stringify(o); }).sort();
      out[t] = rows.length + ":" + h(rows.join("\n"));
    } catch (e) { out[t] = "ERR"; }
  }
  return JSON.stringify(out);
})()
