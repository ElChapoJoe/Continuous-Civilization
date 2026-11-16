// Whole-map street-table rig (debug console, TEST GAMES ONLY: it founds cities and districts everywhere).
// Turns every usable land tile of the map into an urban district of the local player, so tools/street-probe.js can
// read the street pattern of every coordinate from a high camera.
//   CCTable.plan()          land tiles, chosen city centres (every land tile within 3 of a centre)
//   CCTable.run()           founds the cities, buys the tiles, places an empty urban district on each (async)
//   CCTable.status()        progress
//   CCTable.wood(on)        all target tiles wooded (FEATURE_FOREST) or bare (no feature); art refreshes at once
//   CCTable.views(h, dx, dy)  camera list covering the urban tiles at height h (for CCStreetProbe.start(-1, views))
//   CCTable.pack()          after a probe run: "x,y,view,px,py;..." with each tile's most central view
// Tiles that can't be urban stay out: water, mountains, natural wonders, navigable rivers.
(function () {
  const me = () => GameContext.localPlayerID;
  const W = () => GameplayMap.getGridWidth(), H = () => GameplayMap.getGridHeight();
  let log = [], busy = false, targets = [], centres = [];
  const usable = (x, y) => !GameplayMap.isWater(x, y) && !GameplayMap.isMountain(x, y) &&
    !GameplayMap.isNaturalWonder(x, y) && !(GameplayMap.isNavigableRiver && GameplayMap.isNavigableRiver(x, y));
  const dist = (a, b) => GameplayMap.getPlotDistance(a[0], a[1], b[0], b[1]);
  function plan() {
    targets = [];
    for (let y = 0; y < H(); y++) for (let x = 0; x < W(); x++) {
      if (usable(x, y) && (GameplayMap.getOwner(x, y) == -1 || GameplayMap.getOwner(x, y) == me())) targets.push([x, y]);
    }
    centres = Players.get(me()).Cities.getCities().map((c) => [c.location.x, c.location.y]);
    for (const t of targets) if (!centres.some((c) => dist(c, t) <= 3)) centres.push(t);
    return JSON.stringify({ targets: targets.length, centres: centres.length });
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function run() {
    if (busy) return "busy";
    busy = true; log = [];
    try {
      plan();
      const have = () => Players.get(me()).Cities.getCities();
      for (const c of centres) {
        if (have().some((k) => k.location.x == c[0] && k.location.y == c[1])) continue;
        Game.PlayerOperations.sendRequest(me(), "CREATE_ELEMENT", { Kind: "CITY", Location: { x: c[0], y: c[1] }, Owner: me() });
        await wait(400);
      }
      await wait(2000);
      log.push("cities " + have().length);
      const cities = have();
      for (const t of targets) {
        if (GameplayMap.getOwner(t[0], t[1]) == me()) continue;
        let best = null, bd = 99;
        for (const c of cities) { const d = dist([c.location.x, c.location.y], t); if (d < bd) { bd = d; best = c; } }
        if (best && bd <= 3) { best.purchasePlot({ x: t[0], y: t[1] }); await wait(30); }
      }
      await wait(2000);
      log.push("owned " + targets.filter((t) => GameplayMap.getOwner(t[0], t[1]) == me()).length);
      const urban = GameInfo.Districts.lookup("DISTRICT_URBAN").$index;
      for (const t of targets) {
        if (GameplayMap.getOwner(t[0], t[1]) != me() || Districts.getAtLocation({ x: t[0], y: t[1] })) continue;
        Game.PlayerOperations.sendRequest(me(), "CREATE_ELEMENT", { Kind: "DISTRICT", Type: urban, Location: { x: t[0], y: t[1] }, Owner: me() });
        await wait(120);
      }
      await wait(2000);
      log.push("done");
    } catch (e) { log.push("error " + e); }
    busy = false;
  }
  function urbanTiles() {   // a scan: districts made by CREATE_ELEMENT DISTRICT are missing from city.Districts
    const out = [];
    for (let y = 0; y < H(); y++) for (let x = 0; x < W(); x++) {
      const d = Districts.getAtLocation({ x, y });
      if (d && d.type === DistrictTypes.URBAN && GameplayMap.getOwner(x, y) == me()) out.push([x, y]);
    }
    return out;
  }
  function status() {
    const u = urbanTiles();
    return JSON.stringify({ busy, log, targets: targets.length, centres: centres.length,
      cities: Players.get(me()).Cities.getCities().length, urban: u.length });
  }
  function wood(on) {
    const f = on ? GameInfo.Features.lookup("FEATURE_FOREST").$index : FeatureTypes.NO_FEATURE;
    let n = 0;
    for (const [x, y] of urbanTiles()) { WorldBuilder.MapPlots.setFeature(f, { x, y }); n++; }
    return n + " tiles " + (on ? "wooded" : "bare");
  }
  function views(h = 900, dx = 16, dy = 6) {
    const u = urbanTiles();
    const xs = u.map((t) => t[0]), ys = u.map((t) => t[1]);
    const out = [];
    for (let y = Math.min(...ys) + 2; y <= Math.max(...ys) + dy - 1; y += dy) {
      for (let x = Math.min(...xs) + 6; x <= Math.max(...xs) + dx - 1; x += dx) {
        const vy = Math.min(y, Math.max(...ys)), vx = Math.min(x, Math.max(...xs));
        if (u.some((t) => Math.abs(t[0] - vx) <= dx / 2 + 2 && Math.abs(t[1] - vy) <= dy / 2 + 2)) out.push([vx, vy, 0, h]);
      }
    }
    return JSON.stringify(out);
  }
  function pack() {
    const i = JSON.parse(CCStreetProbe.info()), per = i.cands.length, nv = Object.keys(i.pos).length / per;
    const parts = [];
    i.tiles.forEach((t, k) => {
      if (t.centre) return;
      let best = null, bd = 9;
      for (let v = 0; v < nv; v++) {
        const p = i.pos[v * per][k];
        if (!p) continue;
        const d = Math.hypot(p[0] - 0.5, (p[1] - 0.5) * 0.4);
        if (p[0] > 0.03 && p[0] < 0.97 && p[1] > 0.06 && p[1] < 0.94 && d < bd) { bd = d; best = [v, p]; }
      }
      if (best) parts.push([t.x, t.y, best[0], Math.round(best[1][0] * i.w), Math.round(best[1][1] * i.h)].join(","));
    });
    return parts.join(";");
  }
  globalThis.CCTable = { plan, run: () => { run(); return "started"; }, status, wood, views, pack, urbanTiles };
  return "CCTable ready";
})();
