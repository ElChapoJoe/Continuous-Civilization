// Visual sandbox helpers (debug console, test games only: these DO change the game state).
// CCSandbox.build(tiles) places completed buildings with the debug CREATE_ELEMENT operation, the same one the
// Firaxis tuner's city panel uses. tiles: { "x,y": ["BUILDING_LIBRARY", ...] }. Urban districts are created by the
// engine when the first building goes on a tile.
// CCSandbox.grant(node) researches a tech for the local player. CCSandbox.shot(x, y, mode) frames a view:
// mode "top" (straight down) or "angle" (the usual game tilt), with units hidden.
(function () {
  const me = () => GameContext.localPlayerID;
  const city = () => Players.get(me()).Cities.getCapital() || Players.get(me()).Cities.getCities()[0];

  function build(tiles) {
    const c = city();
    const out = [];
    for (const [key, types] of Object.entries(tiles)) {
      const [x, y] = key.split(",").map(Number);
      for (const t of types) {
        const def = GameInfo.Constructibles.lookup(t);
        if (!def) { out.push("unknown " + t); continue; }
        Game.PlayerOperations.sendRequest(me(), "CREATE_ELEMENT",
          { Kind: "CONSTRUCTIBLE", Type: def.$index, Location: { x, y }, Parent: c.id, Owner: me() });
        out.push(key + " " + t);
      }
    }
    return out;
  }

  function contents() {
    const out = {};
    for (const i of city().getPurchasedPlots()) {
      const l = GameplayMap.getLocationFromIndex(i);
      const list = MapConstructibles.getConstructibles(l.x, l.y).map((id) =>
        GameInfo.Constructibles.lookup(Constructibles.getByComponentID(id).type)?.ConstructibleType);
      if (list.length) out[l.x + "," + l.y] = list;
    }
    return out;
  }

  function grant(node) {
    Game.PlayerOperations.sendRequest(me(), PlayerOperationTypes.GRANT_TREE_NODE,
      { ProgressionTreeNodeType: GameInfo.ProgressionTreeNodes.lookup(node).$index, FullyUnlock: 1 });
    return node;
  }

  let pushed = false;
  function shot(x, y, mode = "angle", dist = 160) {
    if (pushed) Camera.popCamera();
    const w = WorldUI.getPlotLocation({ x, y }, { x: 0, y: 0, z: 0 }, PlacementMode.TERRAIN);
    const back = mode === "top" ? 1 : dist * 0.9;
    const up = mode === "top" ? dist : dist * 0.8;
    Camera.pushCamera({ x: w.x, y: w.y - back, z: w.z + up }, { x: w.x, y: w.y, z: w.z });
    pushed = true;
    WorldUI.setUnitVisibility(false);
  }
  function release() {
    if (pushed) Camera.popCamera();
    pushed = false;
    WorldUI.setUnitVisibility(true);
  }

  globalThis.CCSandbox = { build, contents, grant, shot, release, city };
  return "CCSandbox ready";
})();
