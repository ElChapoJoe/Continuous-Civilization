// Continuous Civilization - hide Modern resources from a player until they research the activating tech.
// Gameplay side: data/65-modern-resources.sql (the resources are inactive until then). This file is display
// only: it runs in the local UI, so every client hides what its own player has not unlocked, and nothing
// here touches the game simulation (multiplayer-safe).
//
// Every UI screen reads a tile's resource through GameplayMap.getResourceType (map icons, tile tooltip,
// map search, resource screens), so wrapping it hides the resource everywhere in the UI. Map icons that
// were already drawn are cleared or re-drawn on the resource layer. The 3D models on the map are drawn by
// the engine and stay visible.
import { ResourceLensLayer } from '/base-standard/ui/lenses/layer/resource-layer.js';

const GATE = "CC_GATE_";
const HAS = "CC_REQSET_HAS_";
const PLOT = "CC_REQSET_PLOT_";

/** resource index -> tech node hash, read from the wrapper modifiers 65-modern-resources.sql creates. */
function readGates() {
  const args = new Map();
  for (const a of GameInfo.ModifierArguments) {
    if (a.ModifierId.startsWith("CC_") && (a.Name == "ModifierId" || a.Name == "ResourceType")) {
      args.set(a.ModifierId + "|" + a.Name, a.Value);
    }
  }
  const gates = new Map();
  for (const m of GameInfo.Modifiers) {
    if (!m.ModifierId.startsWith(GATE) || !m.SubjectRequirementSetId?.startsWith(HAS)) continue;
    const inner = args.get(m.ModifierId + "|ModifierId");
    let res = args.get(inner + "|ResourceType");
    if (!res) {
      const set = GameInfo.Modifiers.lookup(inner)?.SubjectRequirementSetId;
      if (set?.startsWith(PLOT)) res = set.slice(PLOT.length);
    }
    const resource = res && GameInfo.Resources.lookup(res);
    const node = GameInfo.ProgressionTreeNodes.lookup(m.SubjectRequirementSetId.slice(HAS.length));
    if (resource && node) gates.set(resource.$index, node.$hash);
  }
  return gates;
}

const gates = readGates();
let hidden = new Set();

/** Whose techs decide what is shown: the local player; with no local player (autoplay, observer mode)
 *  the observed player; failing that, every alive major (shown once anyone has unlocked it). */
function viewers() {
  for (const id of [GameContext.localPlayerID, GameContext.localObserverID]) {
    const p = id >= 0 ? Players.get(id) : null;
    if (p?.Techs) return [p];
  }
  return Players.getAliveMajorIds().map(id => Players.get(id)).filter(p => p?.Techs);
}

function computeHidden() {
  const players = viewers();
  const next = new Set();
  for (const [res, node] of gates) {
    if (!players.some(p => p.Techs.isNodeUnlocked(node))) next.add(res);
  }
  return next;
}

const original = GameplayMap.__ccOriginalGetResourceType ?? GameplayMap.getResourceType;
GameplayMap.__ccOriginalGetResourceType = original;
GameplayMap.getResourceType = function (...args) {
  const r = original.apply(GameplayMap, args);
  return hidden.has(r) ? ResourceTypes.NO_RESOURCE : r;
};

/** Clear or re-draw resource-layer icons for resources whose visibility changed. */
function redraw(changed) {
  if (changed.size == 0) return;
  const layer = ResourceLensLayer.instance;
  const player = viewers()[0];
  const w = GameplayMap.getGridWidth(), h = GameplayMap.getGridHeight();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = original.call(GameplayMap, x, y);
      if (!changed.has(r)) continue;
      const location = { x, y };
      layer.clearResourceSpritesFromPlot(location);
      if (!hidden.has(r)) {
        const def = GameInfo.Resources.lookup(r);
        layer.addResourceSprites({
          location, resource: def.ResourceType, class: def.ResourceClassType,
          isDistantLands: player ? player.isDistantLands(location) : false
        });
      }
    }
  }
}

function update(force) {
  const next = computeHidden();
  const changed = new Set();
  for (const r of gates.keys()) {
    if (force || next.has(r) != hidden.has(r)) changed.add(r);
  }
  hidden = next;
  redraw(changed);
}

hidden = computeHidden();
// The resource layer may already have drawn its icons before this script loaded.
// (If the UI is reloaded while there is no local player, e.g. mid-autoplay, the base game's layer draws no
// icons at all until the next load; that is vanilla behaviour, not this script.)
update(true);
engine.on("TechNodeCompleted", () => update(false));
engine.on("LocalPlayerChanged", () => update(true));
engine.on("PlayerTurnActivated", () => update(false));
