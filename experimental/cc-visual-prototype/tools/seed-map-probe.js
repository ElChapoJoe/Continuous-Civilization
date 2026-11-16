// Seed-to-pattern probe (debug console; display only). Draws the engine's Antiquity layout bin on empty land tiles,
// one seed per tile, then cycles the 12 candidate street layouts (A or B at six turns) over all of them while an
// outside script screenshots each state (marker and timing as street-probe.js). The candidate that changes a tile
// least is the street pattern that seed produced, which gives the seed -> pattern function by measurement.
//   CCSeedMap.start(tiles [[x, y], ...], seeds [...], centre [x, y, dy, height], seconds)   .info()   .stop()
(function () {
  const old = globalThis.CCSeedMap;
  if (old) old.stop();
  const T = PlacementMode.TERRAIN;
  const BIN = "BIN_CTY_ANT_Layout_2HB_Full_A";
  const STREETS = ["LAYOUT_CTY_Hex_Section_AB_Road_ANT", "LAYOUT_CTY_Hex_Section_AB_B_Road_ANT"];
  const CANDS = [null];
  for (let s = 0; s < STREETS.length; s++) for (let a = 0; a < 360; a += 60) CANDS.push([s, a]);
  let timer = null, base = null, group = null, marker = null, hidden = [], cam = false, tiles = [], seeds = [], pos = [], state = -1, lastError = null;

  function start(tileList, seedList, centre, seconds = 5) {
    stop();
    tiles = tileList.slice(0, seedList.length);
    seeds = seedList.slice(0, tiles.length);
    for (const [x, y] of tiles) WorldUI.clipHexHeight({ x, y }, 0);
    WorldUI.setUnitVisibility(false);
    base = WorldUI.createModelGroup("ccSeedMapBase");
    group = WorldUI.createModelGroup("ccSeedMap");
    tiles.forEach(([x, y], i) => base.addModelAtPlot(BIN, { x, y }, { x: 0, y: 0, z: 0 }, { placement: T, seed: seeds[i] >>> 0 }));
    const w = WorldUI.getPlotLocation({ x: centre[0], y: centre[1] }, { x: 0, y: centre[2] || 0, z: 0 }, T);
    Camera.pushCamera({ x: w.x, y: w.y - 1, z: w.z + (centre[3] || 380) }, { x: w.x, y: w.y, z: w.z });
    cam = true;
    for (const el of document.body.children) { hidden.push([el, el.style.visibility]); el.style.visibility = "hidden"; }
    marker = document.createElement("div");
    marker.style.cssText = "position:fixed;left:0;top:0;width:160px;height:160px;z-index:99999;visibility:visible";
    document.body.appendChild(marker);
    const show = (k) => {
      state = k;
      group.clear();
      const c = CANDS[k];
      if (c) for (const [x, y] of tiles) group.addModelAtPlot(STREETS[c[0]], { x, y }, { x: 0, y: 0, z: 0 }, { placement: T, angle: c[1] });
      marker.style.backgroundColor = `rgb(${10 + k * 4}, 0, 255)`;
    };
    let k = 0;
    lastError = null;
    show(0);
    timer = setInterval(() => {
      try {
        if (k === 0) pos = tiles.map(([x, y]) => { const s = WorldUI.getScreenPos(WorldUI.getPlotLocation({ x, y }, { x: 0, y: 0, z: 0 }, T)); return s ? [Math.round(s.x * window.innerWidth), Math.round(s.y * window.innerHeight)] : 0; });
        k++;
        if (k >= CANDS.length) { stop(true); return; }
        show(k);
      } catch (e) { lastError = String(e && e.stack || e); }
    }, seconds * 1000);
    return `started: ${tiles.length} tiles, ${CANDS.length} states`;
  }

  function stop(done) {
    if (timer) clearInterval(timer);
    timer = null;
    if (group) group.clear();
    if (base) base.clear();
    if (marker) marker.remove();
    marker = null;
    for (const [el, v] of hidden) el.style.visibility = v;
    hidden = [];
    if (cam) Camera.popCamera();
    cam = false;
    WorldUI.restoreAllHexHeight();
    WorldUI.setUnitVisibility(true);
    if (done) state = "done";
  }

  // tiles.json rows in the layout street_probe_score.py reads: [x, y, seed, 0, 0, [px, py]]
  globalThis.CCSeedMap = { start, stop, info: () => JSON.stringify({ state, lastError, rows: tiles.map(([x, y], i) => [x, y, seeds[i], 0, 0, pos[i] || 0]) }) };
  return "CCSeedMap ready";
})();
