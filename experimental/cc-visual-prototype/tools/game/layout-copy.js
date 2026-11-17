// Same cities in two games, for comparing our overlay with vanilla tile by tile (debug console, TEST GAMES ONLY:
// apply() founds cities and places districts, buildings and improvements).
//
//   CCLayout.record()            JSON of the local player's cities on this map: every owned plot with its district,
//                                buildings and improvement (save it to a file: it is the layout to copy)
//   CCLayout.apply(json)         rebuilds that layout for the local player in another game on the SAME map (same map
//                                script, size and map seed): cities, bought plots, districts, finished buildings and
//                                improvements, all with the debug CREATE_ELEMENT operation (async; CCLayout.status())
//   CCLayout.check(json)         tiles where this game differs from the layout (after apply, to prove the copy)
//   CCLayout.shoot(views, s)     top-down shot of each view in turn ([[x, y, 0, height], ...], as CCTable.views),
//                                with the same corner marker as street-probe.js, so tools/game/capture-states.ps1 saves one
//                                screenshot per view; units and the interface hidden, nothing clipped or drawn
//   CCLayout.pack()              after shoot(): "x,y,view,px,py;..." per city tile (its most central view), for
//                                tools/analysis/compare_tiles.py
//
// Comparison recipe (one Age; see the prototype README "Current state"):
//   1. Vanilla game (mods off) started in that Age on a Tiny map with a fixed map seed; build or play a few cities;
//      CCLayout.record() -> layout.json.
//   2. Modded game, same map script, size and map seed, Antiquity start; CCLayout.apply(layout); research the techs
//      that put the local player in that personal Age (the overlay redraws its cities).
//   3. In each game: reveal the map, the same views, capture-states.ps1 + CCLayout.shoot(views, 6), then
//      CCLayout.pack(). compare_tiles.py ranks the tiles by how much the two pictures differ.
// The vanilla civ must share the building culture the overlay uses for ours (Rome's Exploration art is Spain's,
// its Modern art Mexico's), or buildings differ for that reason alone.
(function () {
  const me = () => GameContext.localPlayerID;
  const W = () => GameplayMap.getGridWidth(), H = () => GameplayMap.getGridHeight();
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const dist = (a, b) => GameplayMap.getPlotDistance(a.x, a.y, b.x, b.y);
  const T = PlacementMode.TERRAIN;
  let log = [], busy = false;

  const districtName = (d) => d ? (GameInfo.Districts.lookup(d.type)?.DistrictType || String(d.type)) : null;
  function plotItems(x, y) {
    return MapConstructibles.getConstructibles(x, y).map((id) => {
      const c = Constructibles.getByComponentID(id);
      const def = c && GameInfo.Constructibles.lookup(c.type);
      return def ? { type: def.ConstructibleType, cls: def.ConstructibleClass, complete: c.complete !== false } : null;
    }).filter(Boolean);
  }

  function record() {
    const cfg = Configuration.getMap();
    const cities = Players.get(me()).Cities.getCities().map((city) => ({
      x: city.location.x, y: city.location.y, capital: !!city.isCapital, name: city.name,
      plots: city.getPurchasedPlots().map((i) => {
        const l = GameplayMap.getLocationFromIndex(i);
        return { x: l.x, y: l.y, district: districtName(Districts.getAtLocation(l)), items: plotItems(l.x, l.y) };
      }),
    }));
    cities.sort((a, b) => (b.capital ? 1 : 0) - (a.capital ? 1 : 0));
    return JSON.stringify({ map: { seed: cfg.mapSeed, w: W(), h: H(), script: cfg.script }, cities });
  }

  function cityAt(x, y) {
    return Players.get(me()).Cities.getCities().find((c) => c.location.x === x && c.location.y === y);
  }
  const create = (args) => Game.PlayerOperations.sendRequest(me(), "CREATE_ELEMENT", { ...args, Owner: me() });

  async function apply(json) {
    if (busy) return "busy";
    busy = true; log = [];
    try {
      const L = typeof json === "string" ? JSON.parse(json) : json;
      if (L.map.w !== W() || L.map.h !== H()) throw new Error(`map size ${W()}x${H()}, layout ${L.map.w}x${L.map.h}`);
      if (L.map.seed !== Configuration.getMap().mapSeed) log.push("WARNING: other map seed, terrain may differ");
      // 1. Cities, capital first
      for (const c of L.cities) {
        if (!cityAt(c.x, c.y)) { create({ Kind: "CITY", Location: { x: c.x, y: c.y } }); await wait(500); }
      }
      await wait(1500);
      log.push("cities " + L.cities.filter((c) => cityAt(c.x, c.y)).length + " of " + L.cities.length);
      // 2. Plots, each bought by the city that owned it in the layout
      for (const c of L.cities) {
        const city = cityAt(c.x, c.y);
        if (!city) continue;
        for (const p of c.plots) if (GameplayMap.getOwner(p.x, p.y) !== me()) { city.purchasePlot({ x: p.x, y: p.y }); await wait(40); }
      }
      await wait(1500);
      // 3. Districts and constructibles. Buildings make their urban district themselves; an empty urban tile needs
      //    the district; an improvement needs a rural district first (round 25).
      const urban = GameInfo.Districts.lookup("DISTRICT_URBAN").$index, rural = GameInfo.Districts.lookup("DISTRICT_RURAL").$index;
      let placed = 0;
      for (const c of L.cities) {
        const city = cityAt(c.x, c.y);
        if (!city) continue;
        for (const p of c.plots) {
          const loc = { x: p.x, y: p.y };
          const have = new Set(plotItems(p.x, p.y).map((i) => i.type));
          const todo = p.items.filter((i) => !have.has(i.type));
          if (p.district === "DISTRICT_URBAN" && !Districts.getAtLocation(loc) && !todo.some((i) => i.cls !== "IMPROVEMENT")) {
            create({ Kind: "DISTRICT", Type: urban, Location: loc }); await wait(120);
          }
          if (p.district === "DISTRICT_RURAL" && !Districts.getAtLocation(loc) && todo.length) {
            create({ Kind: "DISTRICT", Type: rural, Location: loc }); await wait(120);
          }
          for (const i of todo) {
            const def = GameInfo.Constructibles.lookup(i.type);
            if (!def) { log.push("unknown " + i.type); continue; }
            create({ Kind: "CONSTRUCTIBLE", Type: def.$index, Location: loc, Parent: city.id }); placed++;
            await wait(150);
          }
        }
      }
      await wait(2000);
      log.push("constructibles sent " + placed, "done");
    } catch (e) { log.push("error " + e); }
    busy = false;
  }

  function check(json) {
    const L = typeof json === "string" ? JSON.parse(json) : json;
    const diffs = [];
    for (const c of L.cities) {
      if (!cityAt(c.x, c.y)) { diffs.push(`${c.x},${c.y}: no city`); continue; }
      for (const p of c.plots) {
        const loc = { x: p.x, y: p.y };
        if (GameplayMap.getOwner(p.x, p.y) !== me()) { diffs.push(`${p.x},${p.y}: not owned`); continue; }
        const d = districtName(Districts.getAtLocation(loc));
        if (d !== p.district) diffs.push(`${p.x},${p.y}: district ${d} (layout ${p.district})`);
        const want = p.items.map((i) => i.type).sort().join("+"), got = plotItems(p.x, p.y).map((i) => i.type).sort().join("+");
        if (want !== got) diffs.push(`${p.x},${p.y}: ${got || "nothing"} (layout ${want || "nothing"})`);
      }
    }
    return JSON.stringify({ differences: diffs.length, list: diffs.slice(0, 60) });
  }

  // --- shots: one state per view, marker colour = view index (same coding as street-probe.js) ---
  let timer = null, marker = null, hidden = [], cam = false, views = [], tiles = [], pos = {}, state = -1;
  function cityTiles() {
    const out = [];
    for (let y = 0; y < H(); y++) for (let x = 0; x < W(); x++) {
      if (GameplayMap.getOwner(x, y) !== me()) continue;
      const d = Districts.getAtLocation({ x, y });
      if (d) out.push({ x, y, kind: districtName(d) });
    }
    return out;
  }
  function show(k) {
    state = k;
    const v = views[k];
    if (cam) Camera.popCamera();
    const w = WorldUI.getPlotLocation({ x: v[0], y: v[1] }, { x: 0, y: v[2] || 0, z: 0 }, T);
    Camera.pushCamera({ x: w.x, y: w.y - 1, z: w.z + (v[3] || 380) }, { x: w.x, y: w.y, z: w.z });
    cam = true;
    marker.style.backgroundColor = `rgb(${10 + (k % 60) * 4}, ${Math.floor(k / 60) * 3}, 255)`;
  }
  function recordPos() {
    pos[state] = tiles.map((t) => {
      const s = WorldUI.getScreenPos(WorldUI.getPlotLocation({ x: t.x, y: t.y }, { x: 0, y: 0, z: 0 }, T));
      return s ? [s.x, s.y] : null;
    });
  }
  function shoot(viewList, seconds = 6) {
    stopShoot();
    views = viewList; tiles = cityTiles(); pos = {};
    WorldUI.setUnitVisibility(false);
    for (const el of document.body.children) { hidden.push([el, el.style.visibility]); el.style.visibility = "hidden"; }
    marker = document.createElement("div");
    marker.style.cssText = "position:fixed;left:0;top:0;width:160px;height:160px;z-index:99999;visibility:visible";
    document.body.appendChild(marker);
    let k = 0;
    show(0);
    timer = setInterval(() => {
      recordPos();
      k++;
      if (k >= views.length) { stopShoot(); state = "done"; return; }
      show(k);
    }, seconds * 1000);
    return `shooting ${views.length} views of ${tiles.length} city tiles, ${views.length * seconds} s`;
  }
  function stopShoot() {
    if (timer) clearInterval(timer);
    timer = null;
    if (marker) marker.remove();
    marker = null;
    for (const [el, v] of hidden) el.style.visibility = v;
    hidden = [];
    if (cam) Camera.popCamera();
    cam = false;
    WorldUI.setUnitVisibility(true);
  }
  function pack() {
    const out = [];
    tiles.forEach((t, i) => {
      let best = null, bd = 9;
      for (const v of Object.keys(pos)) {
        const p = pos[v][i];
        if (!p) continue;
        const d = Math.hypot(p[0] - 0.5, (p[1] - 0.5) * 0.4);
        if (p[0] > 0.03 && p[0] < 0.97 && p[1] > 0.06 && p[1] < 0.94 && d < bd) { bd = d; best = [v, p]; }
      }
      if (best) out.push([t.x, t.y, best[0], Math.round(best[1][0] * window.innerWidth), Math.round(best[1][1] * window.innerHeight), t.kind].join(","));
    });
    return out.join(";");
  }

  globalThis.CCLayout = {
    record, apply: (j) => { apply(j); return "started"; }, check, status: () => JSON.stringify({ busy, log }),
    shoot, stop: stopShoot, pack, info: () => JSON.stringify({ state, views: views.length, tiles: tiles.length }),
  };
  return "CCLayout ready";
})();
