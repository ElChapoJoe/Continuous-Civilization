# Visual progression: investigation

Goal: city art progresses gradually and per player as they research, instead of staying Antiquity's for the whole game. That covers buildings, town houses and filler, roads and bridges.

Branch: `feature/visual-progression`. Status: investigation in progress (started 2026-11-12).

## How the game chooses city art

- **Art data exists for every Age, for every civilization.** `VisArt_CivilizationBuildingCultures` (in each Age's `civilizations-shared.xml`, loaded in every game) gives each civilization art cultures for all three Ages. Rome has `BUILDING_CULTURE_MED`, `_MED_ANT`, `_MED_EXP`, `_SAM_MOD` and `ANT_STONE`, `EXP_STONE`, `MOD_STONE`.
- **The assets are all loaded.** The single art package (`Civ7`, loaded by base-standard) holds 25,908 named assets (`WorldUI.getAssetNames()`), with Age variants for the things this goal is about:
  - city tile layouts: `ANT_URBAN_*` (7), `EXP_URBAN_*` (4), `MOD_URBAN_*` (5);
  - bridges: `ANT_Bridge_Wooden_C`, `BIN_EXP_Bridge_Wooden_B`, a Modern one;
  - road decals (`ANT_..._Road_*`) and railroad decals.
- **No per-Age art loading in the modinfos.** The Age modules' art action groups only load icons. So which Age's variant gets drawn is decided inside the renderer, presumably from the game's current Age, which in this mod is always Antiquity.

## Runtime hooks found

| Hook | What it does | Use for this goal |
|---|---|---|
| `WorldUnits.setAgeStyle(unit, style)` | Changes one **unit's** Age look (used by Firaxis's WorldUnits tuner panel) | Units could look like their owner's personal Age. Not tested yet. |
| `WorldUI.createModelGroup(name)` and `group.addModelAtPlot(asset, plot, offset, params)` | Draws any named asset on a map plot, client-side (used by the WorldUI Models tuner panel and cinematics) | Newer-Age models could be drawn per city for the viewing player. Verified the call succeeds; the visual check is pending (camera would not zoom in the post-victory test game). Cannot hide the engine's own Antiquity art underneath. |
| `VisualRemaps` (`UpdateVisualRemaps`, `visual-remaps.xml`) | Swaps one unit, building or art bin for another. Toggled in Options, main menu only | Global and fixed for the whole game: not per player, not gradual. |
| `Constructibles` | Only `setDamaged` among visual-related calls | No building art control. |

No hook was found for a building's, city's or route's Age style.

## Next steps

1. In a fresh early game: test `WorldUnits.setAgeStyle` on a unit, and `addModelAtPlot` with a city layout and a bridge, with screenshots before and after.
2. Check whether districts' or buildings' visual style follows the building's own Age (newer buildings already look newer) and whether filler or urban layouts react to anything per player.
3. Write up the realistic options (per-player unit styles; client-side overlays; a global art step) with how each would look, before building anything.
