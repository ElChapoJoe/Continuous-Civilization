// Seed probe for the city-art prototype (debug console; display only). The engine picks a tile's layout variant from
// a per-model seed, and script-drawn models take a seed too (addModelAtPlot(..., { seed })). For each candidate
// "seed = f(tile)" this draws the engine's own Antiquity layout bin with that seed over every urban tile of a city,
// on top of the engine's untouched art, while an outside script screenshots each state (same marker and timing as
// street-probe.js). The candidate whose drawing changes a tile least coincides with what the engine drew there.
//   CCSeedProbe.start(cityIndex, views, seconds, candidates?)   CCSeedProbe.info()   CCSeedProbe.stop()
(function () {
  const old = globalThis.CCSeedProbe;
  if (old) old.stop();
  const T = PlacementMode.TERRAIN;
  const BIN = "BIN_CTY_ANT_Layout_2HB_Full_A";
  const W = GameplayMap.getGridWidth();
  const DEFAULT = {
    plot: (t) => t.y * W + t.x, "plot+1": (t) => t.y * W + t.x + 1, did: (t) => t.did, did_lo: (t) => t.did & 0xffff,
    did_hi: (t) => t.did >> 16, cid: (t) => t.cid, cid_lo: (t) => t.cid & 0xffff, cid_hi: (t) => t.cid >> 16,
    x: (t) => t.x, y: (t) => t.y, "x<<16|y": (t) => (t.x << 16) | t.y, "y<<16|x": (t) => (t.y << 16) | t.x,
  };
  let timer = null, group = null, marker = null, hidden = [], cam = false, tiles = [], state = -1, names = [], lastError = null;

  function start(cityIndex, views, seconds = 5, candidates = DEFAULT) {
    stop();
    names = Object.keys(candidates);
    const per = names.length + 1;
    const city = Players.get(GameContext.localPlayerID).Cities.getCities()[cityIndex];
    tiles = [];
    for (const id of city.Districts.getIds()) {
      const d = Districts.get(id);
      if (!d || d.type !== DistrictTypes.URBAN) continue;
      tiles.push({ x: d.location.x, y: d.location.y, did: id.id, cid: d.getConstructibleIds()[0]?.id ?? 0 });
    }
    WorldUI.setUnitVisibility(false);
    group = WorldUI.createModelGroup("ccSeedProbe");
    for (const el of document.body.children) { hidden.push([el, el.style.visibility]); el.style.visibility = "hidden"; }
    marker = document.createElement("div");
    marker.style.cssText = "position:fixed;left:0;top:0;width:160px;height:160px;z-index:99999;visibility:visible";
    document.body.appendChild(marker);
    const show = (k) => {
      state = k;
      const view = views[Math.floor(k / per)], c = k % per;
      if (c === 0) {
        if (cam) Camera.popCamera();
        const w = WorldUI.getPlotLocation({ x: view[0], y: view[1] }, { x: 0, y: view[2] || 0, z: 0 }, T);
        Camera.pushCamera({ x: w.x, y: w.y - 1, z: w.z + (view[3] || 380) }, { x: w.x, y: w.y, z: w.z });
        cam = true;
      }
      group.clear();
      if (c > 0) {
        const f = candidates[names[c - 1]];
        for (const t of tiles) group.addModelAtPlot(BIN, { x: t.x, y: t.y }, { x: 0, y: 0, z: 0 }, { placement: T, seed: f(t) >>> 0 });
      }
      marker.style.backgroundColor = `rgb(${10 + k * 4}, 0, 255)`;
    };
    const total = views.length * per;
    let k = 0;
    lastError = null;
    show(0);
    timer = setInterval(() => {
      try {
        k++;
        if (k >= total) { stop(true); return; }
        show(k);
      } catch (e) { lastError = String(e && e.stack || e); }
    }, seconds * 1000);
    return `started: ${tiles.length} tiles, ${total} states (${names.join(", ")}), ${total * seconds} s`;
  }

  function stop(done) {
    if (timer) clearInterval(timer);
    timer = null;
    if (group) group.clear();
    if (marker) marker.remove();
    marker = null;
    for (const [el, v] of hidden) el.style.visibility = v;
    hidden = [];
    if (cam) Camera.popCamera();
    cam = false;
    WorldUI.setUnitVisibility(true);
    if (done) state = "done";
  }

  globalThis.CCSeedProbe = { start, stop, info: () => JSON.stringify({ state, lastError, names, tiles }) };
  return "CCSeedProbe ready";
})();
