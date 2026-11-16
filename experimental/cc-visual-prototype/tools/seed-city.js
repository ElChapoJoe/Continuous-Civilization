// Same-coordinates test city for the street-pattern seed hunt (debug console, TEST GAMES ONLY: changes the game).
//   CCSeedCity.mask(name)            keeps this map's buildable-land mask under name, returns counts
//   CCSeedCity.get(name) / .set(name, text)   read a mask out and put it back on another map (masks live in memory
//                                    and are lost on a load; the game's localStorage returns one value for every key)
//   CCSeedCity.best(names, n)        centres whose radius-2 tiles are buildable on all the named masks
//   CCSeedCity.build(cx, cy, names)  spawns a Founder at the centre, founds a city, buys the second ring and puts one
//                                    Antiquity building on every radius-2 tile that is buildable on all named masks
//   CCSeedCity.status()              tiles and what stands on them
// The building of a tile depends only on its offset from the centre, so two maps get the same layout.
(function () {
  const B = ["GRANARY", "SAW_PIT", "BRICKYARD", "BARRACKS", "LIBRARY", "MONUMENT", "ALTAR", "MARKET", "GARDEN",
    "BLACKSMITH", "ACADEMY", "AMPHITHEATER", "TEMPLE", "VILLA", "ARENA", "BATH", "ANCIENT_BRIDGE", "LIGHTHOUSE"];
  const W = () => GameplayMap.getGridWidth(), H = () => GameplayMap.getGridHeight();
  const masks = (globalThis.CCSeedCity && globalThis.CCSeedCity.masks) || {};
  let tiles = [];
  function mask(name) {
    let m = "";
    for (let y = 0; y < H(); y++) for (let x = 0; x < W(); x++) {
      m += !GameplayMap.isWater(x, y) && !GameplayMap.isMountain(x, y) && !GameplayMap.isNaturalWonder(x, y) &&
        !GameplayMap.isRiver(x, y) && GameplayMap.getResourceType(x, y) == ResourceTypes.NO_RESOURCE &&
        GameplayMap.getOwner(x, y) == -1 ? "1" : "0";
    }
    masks[name] = m;
    return JSON.stringify({ w: W(), h: H(), land: m.split("1").length - 1, mapSeed: Configuration.getMap().mapSeed,
      gameSeed: Configuration.getGame().gameSeed });
  }
  const ok = (names, x, y) => x >= 0 && y >= 0 && x < W() && y < H() &&
    names.every((n) => (masks[n] || "")[y * W() + x] == "1");
  const ring = (cx, cy) => GameplayMap.getPlotIndicesInRadius(cx, cy, 2).map((i) => [i % W(), Math.floor(i / W())])
    .filter((p) => !(p[0] == cx && p[1] == cy)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  function best(names, n = 8) {
    const out = [];
    for (let y = 3; y < H() - 3; y += 2) for (let x = 3; x < W() - 3; x++) {   // even rows only: same offsets
      if (!ok(names, x, y)) continue;
      out.push([ring(x, y).filter((p) => ok(names, p[0], p[1])).length, x, y]);
    }
    return JSON.stringify(out.sort((a, b) => b[0] - a[0]).slice(0, n));
  }
  function build(cx, cy, names) {
    const me = GameContext.localPlayerID;
    tiles = ring(cx, cy).map((p, i) => [p[0], p[1], B[i]]).filter((t) => ok(names, t[0], t[1]));
    Game.PlayerOperations.sendRequest(me, "CREATE_ELEMENT", { Kind: "UNIT", Type: Database.makeHash("UNIT_FOUNDER"),
      Location: { x: cx, y: cy }, Owner: me, IndependentIndex: -1 });
    setTimeout(() => {
      for (const u of Players.get(me).Units.getUnits()) {
        if (u.location.x == cx && u.location.y == cy) Game.UnitOperations.sendRequest(u.id, UnitOperationTypes.FOUND_CITY, {});
      }
    }, 2500);
    setTimeout(() => {
      const city = Players.get(me).Cities.getCities().find((c) => c.location.x == cx && c.location.y == cy);
      for (const t of tiles) if (GameplayMap.getOwner(t[0], t[1]) != me) city.purchasePlot({ x: t[0], y: t[1] });
      tiles.forEach((t, i) => setTimeout(() => {
        const def = GameInfo.Constructibles.lookup("BUILDING_" + t[2]);
        Game.PlayerOperations.sendRequest(me, "CREATE_ELEMENT", { Kind: "CONSTRUCTIBLE", Type: def.$index,
          Location: { x: t[0], y: t[1] }, Parent: city.id, Owner: me });
      }, 1000 + i * 1200));
    }, 6000);
    return `building ${tiles.length} tiles, ready in ${Math.round(8 + tiles.length * 1.2)} s`;
  }
  function status() {
    return JSON.stringify(tiles.map((t) => {
      const d = Districts.getAtLocation({ x: t[0], y: t[1] });
      return [t[0], t[1], d ? d.getConstructibleIds().length : "-"];
    }));
  }
  // Probe rows for street_probe_score.py from the last CCStreetProbe run (pixel positions per view).
  function rows() {
    const i = JSON.parse(CCStreetProbe.info()), per = i.cands.length, nv = Object.keys(i.pos).length / per;
    return JSON.stringify(i.tiles.map((t, k) => {
      const r = [t.x, t.y, t.did, t.cons[0] || 0, t.centre ? 1 : 0];
      for (let v = 0; v < nv; v++) {
        const p = i.pos[v * per][k];
        r.push(p && p[0] > 0 && p[0] < 1 && p[1] > 0 && p[1] < 1 ? [Math.round(p[0] * i.w), Math.round(p[1] * i.h)] : 0);
      }
      return r;
    }));
  }
  globalThis.CCSeedCity = { mask, best, build, status, rows, masks, get: (n) => masks[n], set: (n, t) => { masks[n] = t; return t.length; } };
  return "CCSeedCity ready";
})();
