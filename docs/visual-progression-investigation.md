# Visual progression: investigation

Goal: city art progresses gradually and per player as they research, instead of staying Antiquity's for the whole game. That covers buildings, town houses and filler, roads and bridges.

Branch: `feature/visual-progression`. Status: investigation done (2026-11-12). Conclusion: the engine picks this art from one global Age, and no exposed hook changes it per player or at runtime. See [Conclusion](#conclusion).

## How the game chooses city art

- **Art data exists for every Age.** The art packages (`Base/Platforms/Windows/BLPs/StandardAsset*.blp`) hold Antiquity, Exploration and Modern variants of city layouts (`ANT_URBAN_*`, `EXP_URBAN_*`, `MOD_URBAN_*`), buildings, bridges and roads. All are loaded in every game: `WorldUI.getAssetNames()` lists 25,908 assets.
- **Variants are chosen by conditions inside art bins.** Each bin (`BIN_Kiln`, `BIN_Lighthouse`, the city layout bins and so on) lists variants with a condition such as:
  - `[CONSTRUCTIBLE_STATE:COMPLETED] and [BUILDING_CULTURE:BUILDING_CULTURE_MED_ANT]`
  - `[AGE:AGE_MODERN] and [CONSTRUCTIBLE_STATE:CONSTRUCTION]`

  Condition keys found in the packages, by number of uses:

  | Key | Uses | Notes |
  |---|---|---|
  | `BUILDING_CULTURE` | 944 | Region and Age art set (`MED`, `MED_ANT`, `EAS_MOD`, `ANT_STONE` ...) |
  | `AGE` | 682 | `AGE_ANTIQUITY` 173, `AGE_EXPLORATION` 184, `AGE_MODERN` 297 |
  | `CONSTRUCTIBLE_STATE` | 652 | Construction, completed, pillaged |
  | `CIV` | 635 | Per civilization |
  | `UNIT_CULTURE` | 495 | |
  | `AGE_STYLE` | 136 | Unit cosmetics only (see below) |
  | `ROUTE` | 105 | Road, railroad |
  | others | | Feature, building, resource, district, terrain, improvement, biome, plot, wonder, river |

- **`AGE` is the game's single Age.** There is no per-player or per-city Age for art. In this mod the game Age is always Antiquity, so city filler, roads and bridges always pick Antiquity variants.
- **`AGE_STYLE` is a variant within an Age, not a later Age.** It appears only together with an Age, as in `[AGE:AGE_ANTIQUITY] and [AGE_STYLE:STYLE_2]`, and only in unit-related bins: hair, armor tints, backpacks, quivers, dogs and camp props. None of it is city art.
- **The `VisArt_CivilizationBuildingCultures` table in the gameplay database does not drive the city art in a loaded game** (tests below).

## Runtime hooks found

Everything the scripting side exposes for world art (searched in the executable and by listing every `World*`, `Visual*`, `Camera`, `Districts` and `Constructibles` object in game):

| Hook | What it does | Use for this goal |
|---|---|---|
| `WorldUnits.setAgeStyle(unit, 1\|2\|3)` | Picks one of three cosmetic variants of a unit **within the current Age** | Not an Age change. In this mod it only varies Antiquity looks. |
| `WorldUI.createModelGroup(name)` and `group.addModelAtPlot(asset, plot, offset, params)` | Draws any named asset on a map plot, client-side | Can add newer-Age models; cannot hide the engine's own art underneath |
| `VisualRemaps` (`UpdateVisualRemaps` action) | Swaps a unit, building or art bin for another (`Kind` = `UNIT`, `BUILDING` or `ART_BIN`). A mod can add its own remap file. The player toggles remaps in Options, at the main menu | Global and fixed for the whole game: not per player, not gradual |
| `Database.query('gameplay', sql)` | Runs SQL, including writes, on the live gameplay database | The renderer doesn't re-read the art tables (tests below) |
| `Constructibles` | Only `setDamaged` among visual-related calls | No art control |
| `WorldBuilder.MapPlots` | Map editing | No art functions |

No hook was found that sets the Age, culture or style of a city, district, building or route.

## Tests (2026-11-12)

All on a turn-1 save, Rome, founding the capital at (59,14) and comparing the result with the normal Rome capital.

| Test | Change | Result |
|---|---|---|
| Unit style | `WorldUnits.setAgeStyle` on the Founder, styles 1 to 3 | Changes live (cart and clothing differ). Per the art data, these are three Antiquity variants. |
| Client-side models | `addModelAtPlot("EXP_URBAN_Basic_City_Layout", ...)` on an empty tile; `EXP_URBAN_City_Center_Palace_Layout` on the capital | Empty tile: a full Exploration city block at proper scale. Capital: a few later buildings mixed into the engine's Antiquity city, which stays visible. |
| Runtime culture change | Deleted Rome's Antiquity and Exploration art cultures with `Database.query`, then founded the city | No change: Antiquity Mediterranean city. `GameInfo` also kept the cached rows. |
| Load-time culture change (1) | A mod SQL file left Rome with only its Modern cultures (`BUILDING_CULTURE_SAM_MOD`, `MOD_STONE`). Full game restart, save loaded | No change |
| Load-time culture change (2) | Rome given only East Asian Modern tags (`BUILDING_CULTURE_EAS_MOD`, `MOD_STONE`). Save reloaded; the new rows were confirmed in the database | No change: the same Mediterranean houses and palace. The renderer takes building culture from somewhere else (stored in the save or loaded with the art) |

Not tested: a brand-new game with changed culture rows. Even if that worked, it would set one fixed look per civilization at game start, which is not progression.

## Options

| Option | Per player | Gradual | What it would look like | Feasibility |
|---|---|---|---|---|
| A. Units take their owner's personal Age look | | | | **Not possible:** `setAgeStyle` only picks variants within the game's Age |
| B. Overlay newer models on cities | Yes (drawn for the viewing player) | Yes | Newer city blocks drawn on empty or new tiles; the old Antiquity houses, roads and bridges stay | Works technically. Cluttered on existing city tiles; models are cosmetic only (no click or tooltip), must be redrawn on load, and add a UI script cost |
| C. Replace city houses, roads and bridges per player | Yes | Yes | The goal as stated | **Not possible with the exposed engine:** art follows the single game Age |
| D. Global art-era remap (`VisualRemaps`, `ART_BIN`) | No (everyone) | No | One art era for the whole game (for example Exploration city filler from turn 1), switched in Options | Possible in principle, if the Antiquity and later-Age variants sit in separate named bins. Needs a bin-by-bin check |
| E. Do nothing extra | | | Later-Age buildings, wonders and units already use their own art, so a city that builds Exploration or Modern buildings looks newer where those stand | Already in the mod |

## Conclusion

True per-player, gradual city art (C) needs engine support Firaxis hasn't exposed: the art system reads one global Age. The per-player unit idea (A) is also out, since unit styles are variants within an Age.

What remains:
- **E** is what players get today, and it already shows progress building by building.
- **B** is the only per-player visual route, best limited to empty or new tiles.
- **D** would be a global, menu-chosen art era, not progression.

**Decision (2026-11-12):** accepted as a known limitation for now (listed in the README). Ideas kept for later, both untested:
- a world-wide "artificial Age change" for art only: change the game's Age value in a save and reload, triggered when most players reach a new personal Age;
- per-player road art: roads that become railroads after a Modern tech, and possibly their bridges.

Revisit if Firaxis exposes art Age per player or per city (for example in a future modding update or SDK), or if a later patch adds an art hook.
