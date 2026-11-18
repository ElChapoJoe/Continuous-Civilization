// Which variant of an art bin does the engine draw? (debug console, any game; display only, nothing changes)
// Draws candidate models one per tile on a row of plots next to a tile where the engine shows the building, in the
// owner's colours, so a top-down shot shows the engine's own model and every candidate side by side.
//   CCVariant.show(owner, [[model, x, y], ...], scale)   clips each target plot and draws the model there
//   CCVariant.frame(x, y, height)                         top-down camera over (x, y), interface and units hidden
//   CCVariant.clear()                                     removes the models, restores clips, camera and interface
(function () {
  const old = globalThis.CCVariant;
  if (old) old.clear();
  const T = PlacementMode.TERRAIN;
  let group = null, clipped = [], hidden = [], cam = false;
  function show(owner, list, scale = 0.68) {
    group = group || WorldUI.createModelGroup("ccVariantCheck");
    group.clear();
    let tint = {};
    try { tint = { tintColor1: UI.Player.getPrimaryColorValueAsHex(owner), tintColor2: UI.Player.getSecondaryColorValueAsHex(owner) }; } catch (e) { /* no colours */ }
    for (const [model, x, y] of list) {
      WorldUI.clipHexHeight({ x, y }, 0);
      clipped.push({ x, y });
      group.addModelAtPlot(model, { x, y }, { x: 0, y: 0, z: 0 }, { placement: T, scale, angle: 0, ...tint });
    }
    return `drew ${list.length}`;
  }
  function frame(x, y, height = 160) {
    if (cam) Camera.popCamera();
    const w = WorldUI.getPlotLocation({ x, y }, { x: 0, y: 0, z: 0 }, T);
    Camera.pushCamera({ x: w.x, y: w.y - 1, z: w.z + height }, { x: w.x, y: w.y, z: w.z });
    cam = true;
    if (!hidden.length) for (const el of document.body.children) { hidden.push([el, el.style.visibility]); el.style.visibility = "hidden"; }
    WorldUI.setUnitVisibility(false);
    return "framed";
  }
  function clear() {
    if (group) group.clear();
    for (const p of clipped) WorldUI.restoreHexHeight(p);
    clipped = [];
    if (cam) Camera.popCamera();
    cam = false;
    for (const [el, v] of hidden) el.style.visibility = v;
    hidden = [];
    WorldUI.setUnitVisibility(true);
    return "cleared";
  }
  globalThis.CCVariant = { show, frame, clear };
  return "CCVariant ready";
})();
