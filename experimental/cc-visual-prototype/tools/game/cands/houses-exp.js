// Candidates for tools/pipeline/probe.mjs: the Exploration house layout of each bare urban tile (round 65).
// Per tile: the plain layout and its _VAR_A for the tile's street pattern, at the street's turn, each with the
// vacant-plot piece in both building lots (as the overlay draws an empty tile). Needs CCStreetTable and CCTable.
(function () {
  const H = { A: ["LAYOUT_CTY_EXP_Hex_Section_AB", "LAYOUT_CTY_EXP_Hex_Section_AB_VAR_A"],
    B: ["LAYOUT_CTY_EXP_Hex_Section_AB_B", "LAYOUT_CTY_EXP_Hex_Section_AB_B_VAR_A"] };
  const LOTS = { A: [{ x: 0.120, y: 0.245, turn: 330 }, { x: -0.214, y: -0.086, turn: 0 }],
    B: [{ x: 0.033, y: -0.196, turn: 300 }, { x: -0.133, y: 0.236, turn: 30 }] };
  const rot = (p, deg) => { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: 0 }; };
  const norm = (d) => ((Math.round(d) % 360) + 360) % 360;
  CCTable.wood(false);   // bare tiles: wooded ones use the single _FOL layout
  globalThis.CCProbeCands = {
    n: 2,
    labels: ["plain", "VAR_A"],
    of: (t) => {
      const s = CCStreetTable.lookupAge(1, t.x, t.y, false);
      if (!s || !s.sure) return null;
      const lots = LOTS[s.street].map((l) => ["Vacant_Hero_Building_Plot_01", rot(l, s.angle), 0.68, norm(l.turn + s.angle)]);
      return H[s.street].map((m) => [[m, { x: 0, y: 0, z: 0 }, 1, s.angle], ...lots]);
    },
  };
  return "house candidates ready";
})();
