// Rural test map (debug console, TEST GAMES ONLY: it founds cities and places improvements). Fills a map, best an
// all-land one (tools/game/all-land.js), with cities whose every other tile is a rural district with an improvement,
// cycling farm, mine, woodcutter, clay pit and quarry by coordinate, so tools/pipeline/probe.mjs with
// tools/game/cands/rural-mod.js can read which variant and turn the engine draws on each (round 66).
//   CCRural.bounds = [x0, y0, x1, y1]   optional (vanilla Modern crashes past about 95 founded cities: use halves)
//   CCRural.plan()     -> centres and tiles
//   CCRural.run()      found, buy, place (async; CCRural.status() until done)
//   CCRural.tiles()    [[x, y, improvement], ...] of the local player's rural tiles with an improvement
//   CCRural.views(h, dx, dy)   camera views over those tiles (for the probe)
(function () {
  const me = () => GameContext.localPlayerID;
  const W = () => GameplayMap.getGridWidth(), H = () => GameplayMap.getGridHeight();
  const TYPES = ["IMPROVEMENT_FARM", "IMPROVEMENT_MINE", "IMPROVEMENT_WOODCUTTER", "IMPROVEMENT_CLAY_PIT", "IMPROVEMENT_QUARRY"];
  const typeAt = (x, y) => TYPES[((x * 7 + y * 3) % TYPES.length + TYPES.length) % TYPES.length];
  const dist = (a, b) => GameplayMap.getPlotDistance(a[0], a[1], b[0], b[1]);
  const usable = (x, y) => !GameplayMap.isWater(x, y) && !GameplayMap.isMountain(x, y) && !GameplayMap.isNaturalWonder(x, y)
    && !(GameplayMap.isNavigableRiver && GameplayMap.isNavigableRiver(x, y));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const create = (args) => Game.PlayerOperations.sendRequest(me(), "CREATE_ELEMENT", { ...args, Owner: me() });
  let log = [], busy = false, targets = [], centres = [];

  function plan() {
    const b = globalThis.CCRural.bounds;
    targets = [];
    for (let y = 0; y < H(); y++) for (let x = 0; x < W(); x++) {
      if (b && (x < b[0] || y < b[1] || x > b[2] || y > b[3])) continue;
      if (usable(x, y) && (GameplayMap.getOwner(x, y) == -1 || GameplayMap.getOwner(x, y) == me())) targets.push([x, y]);
    }
    centres = Players.get(me()).Cities.getCities().map((c) => [c.location.x, c.location.y]);
    for (const t of targets) if (!centres.some((c) => dist(c, t) <= 3)) centres.push(t);
    return JSON.stringify({ targets: targets.length, centres: centres.length });
  }

  async function run() {
    if (busy) return "busy";
    busy = true; log = [];
    try {
      plan();
      const cities = () => Players.get(me()).Cities.getCities();
      for (const c of centres) {
        if (cities().some((k) => k.location.x == c[0] && k.location.y == c[1])) continue;
        create({ Kind: "CITY", Location: { x: c[0], y: c[1] } });
        await wait(400);
      }
      await wait(2000);
      log.push("cities " + cities().length);
      for (const t of targets) {
        if (GameplayMap.getOwner(t[0], t[1]) == me()) continue;
        let best = null, bd = 99;
        for (const c of cities()) { const d = dist([c.location.x, c.location.y], t); if (d < bd) { bd = d; best = c; } }
        if (best && bd <= 3) { best.purchasePlot({ x: t[0], y: t[1] }); await wait(30); }
      }
      await wait(2000);
      const rural = GameInfo.Districts.lookup("DISTRICT_RURAL").$index;
      let placed = 0;
      for (const city of cities()) {
        for (const i of city.getPurchasedPlots()) {
          const l = GameplayMap.getLocationFromIndex(i);
          if (!usable(l.x, l.y)) continue;
          const d = Districts.getAtLocation(l);
          if (d && d.type !== DistrictTypes.RURAL) continue;   // the city centre
          if (MapConstructibles.getConstructibles(l.x, l.y).length) continue;
          if (!d) { create({ Kind: "DISTRICT", Type: rural, Location: l }); await wait(100); }
          const def = GameInfo.Constructibles.lookup(typeAt(l.x, l.y));
          if (!def) continue;
          create({ Kind: "CONSTRUCTIBLE", Type: def.$index, Location: l, Parent: city.id });
          placed++;
          await wait(120);
        }
      }
      await wait(2000);
      log.push("improvements sent " + placed, "done");
    } catch (e) { log.push("error " + e); }
    busy = false;
  }

  function tiles() {
    const out = [];
    for (let y = 0; y < H(); y++) for (let x = 0; x < W(); x++) {
      if (GameplayMap.getOwner(x, y) != me()) continue;
      const d = Districts.getAtLocation({ x, y });
      if (!d || d.type !== DistrictTypes.RURAL) continue;
      for (const id of MapConstructibles.getConstructibles(x, y)) {
        const t = GameInfo.Constructibles.lookup(Constructibles.getByComponentID(id)?.type)?.ConstructibleType;
        if (t && TYPES.includes(t)) { out.push([x, y, t]); break; }
      }
    }
    return out;
  }

  function views(h = 300, dx = 6, dy = 2) {
    const u = tiles();
    if (!u.length) return [];
    const xs = u.map((t) => t[0]), ys = u.map((t) => t[1]), out = [];
    for (let y = Math.min(...ys) + 1; y <= Math.max(...ys) + dy - 1; y += dy) {
      for (let x = Math.min(...xs) + 3; x <= Math.max(...xs) + dx - 1; x += dx) {
        const vy = Math.min(y, Math.max(...ys)), vx = Math.min(x, Math.max(...xs));
        if (u.some((t) => Math.abs(t[0] - vx) <= dx / 2 + 1 && Math.abs(t[1] - vy) <= dy / 2 + 1)) out.push([vx, vy, 0, h]);
      }
    }
    return out;
  }

  globalThis.CCRural = { bounds: null, plan, run: () => { run(); return "started"; }, tiles, views,
    status: () => JSON.stringify({ busy, log, targets: targets.length, centres: centres.length, rural: tiles().length }) };
  return "CCRural ready";
})();
