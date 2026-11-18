// Visual test bench for the city-art prototype (run on the debug console; nothing here changes the game state).
// CCBench.open(x, y) clears a row of tiles starting at (x, y) of everything the engine draws above ground, hides
// units, and points a free camera straight down at it. CCBench.tile(i, parts) draws a list of
// [asset, {x, y}, scale, angle] on bench tile i; CCBench.grid(i) adds a measuring grid (pips every 0.1 tile,
// larger every 0.5). CCBench.close() undoes everything.
(function () {
  const old = globalThis.CCBench;
  if (old) old.close();
  const T = PlacementMode.TERRAIN;
  let tiles = [], groups = [], cam = false;

  function world(p) { return WorldUI.getPlotLocation(p, { x: 0, y: 0, z: 0 }, T); }

  function open(x, y, count = 3, height = 160) {
    close();
    for (let i = 0; i < count; i++) {
      const p = { x: x + i, y };
      tiles.push(p);
      WorldUI.clipHexHeight(p, 0);
      groups.push(WorldUI.createModelGroup("ccBench" + i));
    }
    WorldUI.setUnitVisibility(false);
    view(Math.floor(count / 2), height);
    return tiles;
  }

  /** Straight-down camera over bench tile i. */
  function view(i = 0, height = 160) {
    const w = world(tiles[i]);
    if (cam) Camera.popCamera();
    Camera.pushCamera({ x: w.x, y: w.y - 1, z: w.z + height }, { x: w.x, y: w.y, z: w.z });
    cam = true;
  }

  function tile(i, parts) {
    const g = groups[i];
    g.clear();
    for (const [asset, off, scale = 1, angle = 0] of parts) {
      g.addModelAtPlot(asset, tiles[i], { x: off?.x || 0, y: off?.y || 0, z: 0 }, { placement: T, scale, angle });
    }
  }

  function grid(i) {
    const g = groups[i];
    for (let x = -5; x <= 5; x++) {
      for (let y = -5; y <= 5; y++) {
        const big = x % 5 === 0 && y % 5 === 0;
        g.addModelAtPlot("UI_Movement_Pip", tiles[i], { x: x / 10, y: y / 10, z: 0 }, { placement: T, scale: big ? 0.5 : 0.2 });
      }
    }
  }

  function close() {
    for (const g of groups) g.clear();
    for (const p of tiles) WorldUI.restoreHexHeight(p);
    if (cam) Camera.popCamera();
    WorldUI.setUnitVisibility(true);
    tiles = []; groups = []; cam = false;
  }

  globalThis.CCBench = { open, close, view, tile, grid, tiles: () => tiles };
  return "CCBench ready";
})();
