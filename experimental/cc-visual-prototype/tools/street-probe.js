// Street-pattern measurement for the city-art prototype (debug console; display only, nothing in the game state
// changes). For every urban tile of a city it finds which Antiquity street layout the engine painted: the tiles are
// clipped so only ground paint shows, then each candidate (street A or B at six turns) is drawn over all tiles in
// turn while an outside script screenshots the window; the candidate that changes a tile's picture least is the
// engine's own. A coloured square in the corner tells the screenshot script which state is on screen.
//   CCStreetProbe.start(cityIndex, views, seconds)   views: [[x, y, dy], ...] tile to centre each camera on
//   CCStreetProbe.info()                              tiles, their screen positions per state, the candidate list
//   CCStreetProbe.stop()
(function () {
  const old = globalThis.CCStreetProbe;
  if (old) old.stop();
  const T = PlacementMode.TERRAIN;
  const STREETS = ["LAYOUT_CTY_Hex_Section_AB_Road_ANT", "LAYOUT_CTY_Hex_Section_AB_B_Road_ANT"];
  const CANDS = [null];
  for (let s = 0; s < STREETS.length; s++) for (let a = 0; a < 360; a += 60) CANDS.push([s, a]);
  let lastError = null;
  let timer = null, group = null, marker = null, hidden = [], cam = false, tiles = [], pos = {}, state = -1, views = [];

  function show(k) {
    state = k;
    const view = views[Math.floor(k / CANDS.length)], cand = CANDS[k % CANDS.length];
    if (k % CANDS.length === 0) {
      if (cam) Camera.popCamera();
      const w = WorldUI.getPlotLocation({ x: view[0], y: view[1] }, { x: 0, y: view[2] || 0, z: 0 }, T);
      Camera.pushCamera({ x: w.x, y: w.y - 1, z: w.z + (view[3] || 380) }, { x: w.x, y: w.y, z: w.z });
      cam = true;
    }
    group.clear();
    if (cand) for (const t of tiles) group.addModelAtPlot(STREETS[cand[0]], { x: t.x, y: t.y }, { x: 0, y: 0, z: 0 }, { placement: T, angle: cand[1] });
    marker.style.backgroundColor = `rgb(${10 + k * 4}, 0, 255)`;
  }

  function record() {
    pos[state] = tiles.map((t) => {
      const s = WorldUI.getScreenPos(WorldUI.getPlotLocation({ x: t.x, y: t.y }, { x: 0, y: 0, z: 0 }, T));
      const e = WorldUI.getScreenPos(WorldUI.getPlotLocation({ x: t.x, y: t.y }, { x: 0.5, y: 0, z: 0 }, T));
      return s && e ? [s.x, s.y, e.x - s.x] : null;   // null: the tile is off screen in this view
    });
  }

  function start(cityIndex, viewList, seconds = 5) {
    stop();
    views = viewList;
    const city = Players.get(GameContext.localPlayerID).Cities.getCities()[cityIndex];
    tiles = [];
    for (const id of city.Districts.getIds()) {
      const d = Districts.get(id);
      if (!d || (d.type !== DistrictTypes.URBAN && d.type !== DistrictTypes.CITY_CENTER)) continue;
      tiles.push({ x: d.location.x, y: d.location.y, did: id.id, centre: d.type === DistrictTypes.CITY_CENTER,
        cons: d.getConstructibleIds().map((c) => c.id) });
    }
    // Clip a moment later: stop() above restores all clips, and a restore in the same frame also undoes new clips.
    setTimeout(() => { for (const t of tiles) WorldUI.clipHexHeight({ x: t.x, y: t.y }, 0); }, 700);
    WorldUI.setUnitVisibility(false);
    group = WorldUI.createModelGroup("ccStreetProbe");
    for (const el of document.body.children) { hidden.push([el, el.style.visibility]); el.style.visibility = "hidden"; }
    marker = document.createElement("div");
    marker.style.cssText = "position:fixed;left:0;top:0;width:160px;height:160px;z-index:99999;visibility:visible";
    document.body.appendChild(marker);
    pos = {};
    const total = views.length * CANDS.length;
    let k = 0;
    show(0);
    lastError = null;
    timer = setInterval(() => {
      try {
        record();
        k++;
        if (k >= total) { stop(true); return; }
        show(k);
      } catch (e) {
        lastError = String(e && e.stack || e);
      }
    }, seconds * 1000);
    return `started: ${tiles.length} tiles, ${total} states, ${total * seconds} s`;
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
    WorldUI.restoreAllHexHeight();
    WorldUI.setUnitVisibility(true);
    if (done) state = "done";
  }

  globalThis.CCStreetProbe = {
    start, stop,
    info: () => JSON.stringify({ state, lastError, w: window.innerWidth, h: window.innerHeight, cands: CANDS, tiles, pos }),
  };
  return "CCStreetProbe ready";
})();
