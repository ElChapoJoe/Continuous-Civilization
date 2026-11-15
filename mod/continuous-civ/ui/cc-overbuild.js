// Continuous Civilization - building over older buildings by personal Age (audit #8).
// In vanilla, a new Age makes the previous Age's buildings obsolete and you can build over them. The engine decides
// that by the game Age, which never leaves Antiquity here, so no building ever became replaceable and cities had to
// grow outward for every new building. This script adds it per player, in the building placement screen:
//   * A tile whose two building slots are full shows as a placement spot when the building you place is from a later
//     Age than one of the buildings there (by its vanilla Age, data/30-buildings.sql tags) and that building's Age is
//     behind you (personal Age, same root techs as data/70-personal-age.sql). Exploration players can build over
//     Antiquity buildings, Modern players over Antiquity and Exploration ones.
//   * Ageless buildings (which includes every civilization's unique buildings), walls and the Palace are never
//     replaced, as in vanilla. Buildings with special placement (water, river, bridge) aren't placed this way.
//   * When both buildings on the tile are older, you first choose which one goes; the side panel then shows that
//     choice before the usual confirmation.
//   * Confirming asks first, then removes the old building and places the new one (queued or bought). The engine
//     only accepts a building on a free slot, so the old building goes when the new one is queued, not when it is
//     finished. If the new one can't be placed after all, the old building is put back.
// Old buildings are never forced out: they keep their yields and adjacency until you replace them (vanilla takes the
// adjacency away at the Age change), so advancing never costs you anything.
// Local player only: the AI doesn't use the placement screen and keeps building outward.
import { BuildingPlacementManager } from '/base-standard/ui/building-placement/building-placement-manager.js';
import { InterfaceMode } from '/core/ui/interface-modes/interface-modes.js';
import { DialogBoxManager } from '/core/ui/dialog-box/manager-dialog-box.js';
import NavTray from '/core/ui/navigation-tray/model-navigation-tray.js';

const all = (table) => { const out = []; if (table) for (const row of table) out.push(row); return out; };

function rootHashes(setId) {
  const out = [];
  for (const row of all(GameInfo.RequirementSetRequirements)) {
    if (row.RequirementSetId !== setId) continue;
    const arg = all(GameInfo.RequirementArguments).find(
      (a) => a.RequirementId === row.RequirementId && a.Name === "ProgressionTreeNodeType");
    const node = arg && GameInfo.ProgressionTreeNodes.lookup(arg.Value);
    if (node) out.push(node.$hash);
  }
  return out;
}
const explorationRoots = rootHashes("CC_REQSET_PERSONAL_AGE_EXPLORATION");
const modernRoots = rootHashes("CC_REQSET_PERSONAL_AGE_MODERN");

/** A player's personal Age: 0 Antiquity, 1 Exploration, 2 Modern. */
function personalAge(playerId) {
  const techs = Players.get(playerId)?.Techs;
  if (!techs) return 0;
  if (modernRoots.some((h) => techs.isNodeUnlocked(h))) return 2;
  if (explorationRoots.some((h) => techs.isNodeUnlocked(h))) return 1;
  return 0;
}

// Vanilla Age of each constructible (0/1/2), and the ones never replaced or never placed this way.
const vanillaAge = new Map();
const ageless = new Set();
for (const t of all(GameInfo.TypeTags)) {
  if (t.Tag === "CC_AGE_EXPLORATION") vanillaAge.set(t.Type, 1);
  else if (t.Tag === "CC_AGE_MODERN") vanillaAge.set(t.Type, 2);
  else if (t.Tag === "AGELESS") ageless.add(t.Type);
}
const ageOf = (type) => vanillaAge.get(type) ?? 0;
const specialPlacement = new Set(all(GameInfo.Constructible_ValidTerrains).map((r) => r.ConstructibleType));
for (const c of all(GameInfo.Constructibles)) {
  if (c.AdjacentDistrict || c.AdjacentLake || c.AdjacentRiver || c.AdjacentTerrain || c.NoFeature || c.NoRiver
    || c.RiverPlacement || c.RequiresDistantLands || c.RequiresHomeland || c.RequiresAppealPlacement) {
    specialPlacement.add(c.ConstructibleType);
  }
}
const baseYields = new Map();
for (const r of all(GameInfo.Constructible_YieldChanges)) {
  const list = baseYields.get(r.ConstructibleType) ?? [];
  list.push(r);
  baseYields.set(r.ConstructibleType, list);
}

/** Can this building be replaced? Its Age must be before both the new building's Age and the owner's personal Age. */
function isReplaceable(def, newAge, ownerAge) {
  const age = ageOf(def.ConstructibleType);
  return def.ConstructibleClass === "BUILDING" && !def.ExistingDistrictOnly && !ageless.has(def.ConstructibleType)
    && age < newAge && age < ownerAge;
}

/** plotIndex -> { id, def } of the building that placing on that plot would replace (current placement only). */
let overbuildPlots = new Map();

/** Full tiles of the city where the constructible being placed could replace an older building. */
function findOverbuildPlots(city, newDef) {
  const plots = new Map();
  if (!city || newDef.ConstructibleClass !== "BUILDING" || specialPlacement.has(newDef.ConstructibleType)) return plots;
  const newAge = ageOf(newDef.ConstructibleType);
  const ownerAge = personalAge(city.owner);
  if (newAge === 0 || ownerAge === 0) return plots;
  const taken = new Set([...BuildingPlacementManager.urbanPlots, ...BuildingPlacementManager.developedPlots,
    ...BuildingPlacementManager.expandablePlots]);
  const byPlot = new Map();
  for (const id of city.Constructibles.getIds()) {
    const con = Constructibles.getByComponentID(id);
    const def = con && GameInfo.Constructibles.lookup(con.type);
    if (!def || def.ConstructibleClass !== "BUILDING" || def.ExistingDistrictOnly) continue;
    const plot = GameplayMap.getIndexFromLocation(con.location);
    const list = byPlot.get(plot) ?? [];
    list.push({ id, con, def });
    byPlot.set(plot, list);
  }
  for (const [plot, list] of byPlot) {
    if (taken.has(plot) || list.length < 2) continue;
    if (list.some((b) => b.def.ConstructibleType === newDef.ConstructibleType)) continue;
    const district = Districts.getAtLocation(GameplayMap.getLocationFromIndex(plot));
    if (!district || district.type === DistrictTypes.WONDER) continue;
    // Buildings that can be replaced (never one still being built). The panel previews the first (oldest Age, then
    // cheapest); when there are two, the dialog lets the player choose.
    const victims = list.filter((b) => b.con.complete && isReplaceable(b.def, newAge, ownerAge))
      .sort((a, b) => ageOf(a.def.ConstructibleType) - ageOf(b.def.ConstructibleType) || a.def.Cost - b.def.Cost);
    if (victims.length) {
      plots.set(plot, { id: victims[0].id, def: victims[0].def, choices: victims.map((v) => ({ id: v.id, def: v.def })) });
    }
  }
  return plots;
}

/** Placement data the panel shows for a replaced tile: base yields of the new building minus the old one's. */
function placementEntry(plot, newDef, oldDef) {
  const yields = all(GameInfo.Yields);
  const change = yields.map(() => 0);
  const add = (type, sign) => {
    for (const r of baseYields.get(type) ?? []) {
      const i = yields.findIndex((y) => y.YieldType === r.YieldType);
      if (i >= 0) change[i] += sign * (r.YieldChange ?? 0);
    }
  };
  add(newDef.ConstructibleType, 1);
  add(oldDef.ConstructibleType, -1);
  return { plotID: plot, yieldChanges: change, changeDetails: [], overbuiltConstructibleID: oldDef.$index };
}

const vanillaSelect = BuildingPlacementManager.selectPlacementData.bind(BuildingPlacementManager);
BuildingPlacementManager.selectPlacementData = function (cityID, operationResult, constructible) {
  vanillaSelect(cityID, operationResult, constructible);
  overbuildPlots = new Map();
  patchInterfaceMode();
  try {
    // Not for repairs, other players' cities, or a building already queued or under way here (the engine only
    // accepts its existing spot then).
    if (operationResult?.RepairDamaged || operationResult?.InProgress || operationResult?.InQueue
      || Cities.get(cityID)?.owner !== GameContext.localPlayerID) return;
    overbuildPlots = findOverbuildPlots(Cities.get(cityID), constructible);
    for (const [plot, victim] of overbuildPlots) {
      this._developedPlots.push(plot);
      this.selectedPlacementData?.placements?.push(placementEntry(plot, constructible, victim.def));
    }
  } catch (e) {
    console.error("cc-overbuild: " + e);
    overbuildPlots = new Map();
  }
};
const vanillaReset = BuildingPlacementManager.reset.bind(BuildingPlacementManager);
BuildingPlacementManager.reset = function () {
  overbuildPlots = new Map();
  return vanillaReset();
};

/** Waits (a few frames at most) until the removed building is gone from its tile, then calls done(gone). */
function whenRemoved(cityID, location, id, done, tries = 60) {
  const city = Cities.get(cityID);
  const still = city?.Constructibles.getIdsAtLocation(location).some((x) => x.id === id.id && x.owner === id.owner);
  if (!still) { done(true); return; }
  if (tries <= 0) { done(false); return; }
  requestAnimationFrame(() => whenRemoved(cityID, location, id, done, tries - 1));
}

function overbuild(cityID, args, isPurchasing, victim, newDef) {
  const con = Constructibles.getByComponentID(victim.id);
  if (!con) return false;
  const location = { x: con.location.x, y: con.location.y };
  const owner = con.owner;
  const destroy = { Kind: "CONSTRUCTIBLE", Owner: owner, LocalID: con.localId };
  if (!Game.PlayerOperations.canStart(owner, "DESTROY_ELEMENT", destroy, false)?.Success) return false;
  // Nothing is removed unless the city can build or buy the new building at all (gold, limits, unlocks).
  const { X, Y, ...cityArgs } = args;
  const cityCheck = isPurchasing ? Game.CityCommands.canStart(cityID, CityCommandTypes.PURCHASE, cityArgs, false)
    : Game.CityOperations.canStart(cityID, CityOperationTypes.BUILD, cityArgs, false);
  if (!cityCheck?.Success) return false;
  Game.PlayerOperations.sendRequest(owner, "DESTROY_ELEMENT", destroy);
  whenRemoved(cityID, location, victim.id, (gone) => {
    const place = () => {
      if (isPurchasing) {
        if (Game.CityCommands.canStart(cityID, CityCommandTypes.PURCHASE, args, false)?.Success) {
          Game.CityCommands.sendRequest(cityID, CityCommandTypes.PURCHASE, args);
          return true;
        }
      } else if (Game.CityOperations.canStart(cityID, CityOperationTypes.BUILD, args, false)?.Success) {
        Game.CityOperations.sendRequest(cityID, CityOperationTypes.BUILD, args);
        return true;
      }
      return false;
    };
    if (gone && place()) {
      engine.trigger("CommitPlotBuildingPlacement");
      return;
    }
    // Put the old building back, finished, where it was.
    const restore = { Kind: "CONSTRUCTIBLE", Type: victim.def.$index, Location: location, Parent: cityID, Owner: owner };
    if (gone) Game.PlayerOperations.sendRequest(owner, "CREATE_ELEMENT", restore);
    console.warn(`cc-overbuild: could not place ${newDef.ConstructibleType} over ${victim.def.ConstructibleType}; restored`);
    DialogBoxManager.createDialog_Confirm({
      title: "LOC_BUILDING_PLACEMENT_REPLACE_BUILDING",
      body: Locale.compose("LOC_CC_OVERBUILD_FAILED", newDef.Name, victim.def.Name)
    });
  });
  return true;
}

/** Shows the chosen building in the side panel: its placement entry, then a re-select of the tile to redraw. */
function previewChoice(plotIndex, newDef, oldDef) {
  const placements = BuildingPlacementManager.selectedPlacementData?.placements;
  const entry = placements?.find((p) => p.plotID == plotIndex);
  if (!entry) return;
  Object.assign(entry, placementEntry(plotIndex, newDef, oldDef));
  BuildingPlacementManager.selectedPlotIndex = null;
  BuildingPlacementManager.selectedPlotIndex = plotIndex;
}

let patched = false;
function patchInterfaceMode() {
  if (patched) return;
  const mode = InterfaceMode.getInterfaceModeHandler("INTERFACEMODE_PLACE_BUILDING");
  if (!mode) return;
  patched = true;
  const vanillaPropose = mode.proposePlot.bind(mode);
  mode.proposePlot = function (plot, accept, reject) {
    const victim = overbuildPlots.get(GameplayMap.getIndexFromLocation(plot));
    const newDef = BuildingPlacementManager.currentConstructible;
    if (!victim || !newDef) return vanillaPropose(plot, accept, reject);
    NavTray.clear();
    const plotIndex = GameplayMap.getIndexFromLocation(plot);
    const cancel = { actions: ["cancel", "keyboard-escape", "mousebutton-right"], label: "LOC_GENERIC_CANCEL",
      callback: () => { this.setMapFocused?.(true); reject(); } };
    const confirm = () => DialogBoxManager.createDialog_MultiOption({
      title: "LOC_BUILDING_PLACEMENT_REPLACE_BUILDING",
      body: Locale.compose("LOC_CC_OVERBUILD_BODY", victim.def.Name, newDef.Name),
      options: [{ actions: ["accept"], label: "LOC_GENERIC_OK", callback: () => accept() }, cancel],
      canClose: false
    });
    if (victim.choices.length > 1) {
      // Both buildings on the tile are from an earlier Age: first choose which one (one button per building), then
      // the side panel shows that choice's result and the usual confirmation follows.
      const options = victim.choices.map((choice, i) => ({
        actions: i === 0 ? ["accept"] : [],
        label: Locale.compose("LOC_CC_OVERBUILD_REPLACE", choice.def.Name),
        callback: () => {
          victim.id = choice.id;
          victim.def = choice.def;
          previewChoice(plotIndex, newDef, choice.def);
          confirm();
        }
      }));
      DialogBoxManager.createDialog_MultiOption({
        title: "LOC_BUILDING_PLACEMENT_REPLACE_BUILDING",
        body: Locale.compose("LOC_CC_OVERBUILD_CHOOSE_BODY", newDef.Name),
        options: [...options, cancel],
        canClose: false
      });
      return;
    }
    confirm();
  };
  const vanillaCommit = mode.commitPlot.bind(mode);
  mode.commitPlot = function (plot) {
    const victim = overbuildPlots.get(GameplayMap.getIndexFromLocation(plot));
    const newDef = BuildingPlacementManager.currentConstructible;
    if (!victim || !newDef) return vanillaCommit(plot);
    const context = this.Context;
    const args = { ...context.OperationArguments, X: plot.x, Y: plot.y };
    if (!overbuild(context.CityID, args, this.isPurchasing, victim, newDef)) this.isPlotProposed = false;
  };
}
engine.whenReady.then(patchInterfaceMode);
