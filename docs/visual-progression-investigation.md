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
| `WorldUnits.setAgeStyle(unit, style)` | Changes one **unit's** Age look (used by Firaxis's WorldUnits tuner panel) | Units could look like their owner's personal Age. Verified (see below). |
| `WorldUI.createModelGroup(name)` and `group.addModelAtPlot(asset, plot, offset, params)` | Draws any named asset on a map plot, client-side (used by the WorldUI Models tuner panel and cinematics) | Newer-Age models could be drawn per city for the viewing player. Verified visually (see below). Cannot hide the engine's own Antiquity art underneath. |
| `VisualRemaps` (`UpdateVisualRemaps`, `visual-remaps.xml`) | Swaps one unit, building or art bin for another. Toggled in Options, main menu only | Global and fixed for the whole game: not per player, not gradual. |
| `Constructibles` | Only `setDamaged` among visual-related calls | No building art control. |

No hook was found for a building's, city's or route's Age style.

## Visual tests (2026-11-12, fresh game, Rome, turn 1)

- **Unit Age style: works at runtime.** `WorldUnits.setAgeStyle({owner: 0, id}, n)` on the Founder changed it immediately. Styles 1, 2 and 3 each gave a different cart and different clothing (style 3: dark cart, white robes; style 2: green-covered cart, robed figures). Not yet checked: whether a style survives the unit moving, a turn ending or a save/load, and whether military units have visible per-Age variants.
- **Client-side models: work, but only add.** `addModelAtPlot("EXP_URBAN_Basic_City_Layout", ...)` on an empty tile drew a full Exploration-era city block (tiled roofs, plastered houses, a dome) at proper scale. On the capital's tile, `EXP_URBAN_City_Center_Palace_Layout` only mixed a few later buildings into the engine's own Antiquity city. The engine's art stays underneath and cannot be hidden.

## Options

| Option | Per player | Gradual | What it would look like | Feasibility |
|---|---|---|---|---|
| A. Units take their owner's personal Age style | Yes | By Age step | A civilization's units, including civilians, look Exploration-era once that civilization is in Exploration, Modern once in Modern | Works in test; needs a UI script that sets each unit's style on creation and when its owner changes Age |
| B. Overlay newer models on cities | Visually yes (client side) | Yes | New houses drawn among the old ones; old Antiquity houses, roads and bridges stay visible | Technically works; looks cluttered on existing city tiles |
| C. Replace city houses, roads and bridges per player | Yes | Yes | The goal as stated | No hook found: the renderer picks this art from the game's single Age |
| D. Swap one building's art for another (`VisualRemaps`) | No (everyone) | No | A fixed art swap for the whole game, chosen at the main menu | Exists, but not what this goal is about |

Buildings, wonders and units from later Ages already have their own art, so a city that builds Exploration or Modern buildings does look newer where those stand.

## Recommendation

Build A (per-player unit looks) as the first, achievable piece. Keep C open as an engine limitation unless a hook turns up; B could be tried for empty space (for example new outer districts) but not as a replacement for existing art.
