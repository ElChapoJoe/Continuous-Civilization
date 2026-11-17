// Street-pattern measurement for the city-art prototype (debug console; display only, nothing in the game state
// changes). For every urban tile of a city it finds which Antiquity street layout the engine painted: the tiles are
// clipped so only ground paint shows, then each candidate (street A or B at six turns) is drawn over all tiles in
// turn while an outside script screenshots the window; the candidate that changes a tile's picture least is the
// engine's own. A coloured square in the corner tells the screenshot script which state is on screen.
//   CCStreetProbe.start(cityIndex, views, seconds)   views: [[x, y, dy, height], ...] tile to centre each camera on;
//                                                     cityIndex -1 = every city of the local player
//   CCStreetProbe.info()                              tiles, their screen positions per state, the candidate list
//   CCStreetProbe.stop()
(function () {
  const old = globalThis.CCStreetProbe;
  if (old) old.stop();
  const T = PlacementMode.TERRAIN;
  // Candidate street sections A and B; set globalThis.CCStreetProbeStreets before loading to test other Ages' roads
  // against the engine's Antiquity paint (do they line up at the same turns?).
  const STREETS = globalThis.CCStreetProbeStreets || ["LAYOUT_CTY_Hex_Section_AB_Road_ANT", "LAYOUT_CTY_Hex_Section_AB_B_Road_ANT"];
  const CANDS = [null];
  // Per-tile candidates instead (house-layout probe, round 63): globalThis.CCProbeCands = { n, of(tile) -> [[model,
  // angle], ...] with n entries }. State k draws each tile's entry k - 1. With globalThis.CCProbeNoClip the engine's
  // own art stays visible, so the candidate that changes the picture least is the one the engine drew.
  const PER = globalThis.CCProbeCands;
  if (PER) for (let i = 0; i < PER.n; i++) CANDS.push([-1, i]);
  else for (let s = 0; s < STREETS.length; s++) for (let a = 0; a < 360; a += 60) CANDS.push([s, a]);
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
    if (cand && PER) for (const t of tiles) {
      const c = t.cands && t.cands[cand[1]];
      if (c) group.addModelAtPlot(c[0], { x: t.x, y: t.y }, { x: 0, y: 0, z: 0 }, { placement: T, angle: c[1] });
    } else if (cand) for (const t of tiles) group.addModelAtPlot(STREETS[cand[0]], { x: t.x, y: t.y }, { x: 0, y: 0, z: 0 }, { placement: T, angle: cand[1] });
    marker.style.backgroundColor = `rgb(${10 + (k % 60) * 4}, ${Math.floor(k / 60) * 3}, 255)`;   // state = (r - 10) / 4 + 60 * g / 3
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
    const me = GameContext.localPlayerID, all = Players.get(me).Cities.getCities();
    let list;
    if (cityIndex < 0) {   // scan the map: districts made by CREATE_ELEMENT DISTRICT are missing from city.Districts
      list = [];
      for (let y = 0; y < GameplayMap.getGridHeight(); y++) for (let x = 0; x < GameplayMap.getGridWidth(); x++) {
        const d = GameplayMap.getOwner(x, y) == me && Districts.getAtLocation({ x, y });
        if (d) list.push(d);
      }
    } else list = all[cityIndex].Districts.getIds().map((id) => Districts.get(id));
    tiles = [];
    for (const d of list) {
      const id = d && d.id;
      if (!d || (d.type !== DistrictTypes.URBAN && d.type !== DistrictTypes.CITY_CENTER)) continue;
      tiles.push({ x: d.location.x, y: d.location.y, did: id.id, centre: d.type === DistrictTypes.CITY_CENTER,
        cons: d.getConstructibleIds().map((c) => c.id) });
    }
    if (PER) for (const t of tiles) t.cands = t.centre ? null : PER.of(t);
    // Clip a moment later: stop() above restores all clips, and a restore in the same frame also undoes new clips.
    if (!globalThis.CCProbeNoClip) setTimeout(() => { for (const t of tiles) WorldUI.clipHexHeight({ x: t.x, y: t.y }, 0); }, 700);
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
