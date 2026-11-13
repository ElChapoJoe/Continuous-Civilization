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

## Second round (2026-11-13): looking for a native per-player switch

Goal: two neighbouring civilizations with fully different architectural Ages, chosen by their own research, while the game Age stays Antiquity. Tested on a turn-42 playtest save (not saved afterwards).

### Verified

| Question | Result | Evidence |
|---|---|---|
| Does a player have its own Age? | **Yes**: `Players.get(id).Ages.age` | All six players read `AGE_ANTIQUITY` (hash 2077444219). The object also has `getLastAge()` and `getNumStartCities()` |
| Can a mod change it mid-game? | **No** | Assigning it from script is silently ignored. No effect type sets it (searched all `KIND_EFFECT` types; `EFFECT_PLAYER_ADJUST_AGE_PROGRESS` only moves the Age meter). The only per-player Age operation is `SET_AGE_TRANSITION_DATA`, the choice screen of a real Age transition |
| Does architecture follow the civilization's own Age? | **No** | This game has Russia and the French Empire (Modern civs) and Abbasid, Inca, Normans (Exploration civs) since turn 1. Russia's Kazan is drawn in Eastern European **Antiquity** timber: the civilization picks the regional style, the game Age picks the era |
| Is the per-civilization art table re-read? | **No** (third check) | Russia's style matches its `VisArt_CivilizationBuildingCultures` rows, so the table is used when cities are created, but changing it later had no effect (round 1) |
| Can scripts hide or replace engine-drawn city art? | **Yes, per tile** (see round 3) | First try: `WorldUI.clipHexHeight(plot)` without a height crashed the game. With a height it works |
| Do overlays on a whole city look like a later-Age city? | **No, mixed** | Modern city-block models on Rome's centre and both urban tiles draw at the right scale, but the Antiquity houses stay and the new blocks intersect them |
| Per-player overlay prototype | Works as designed | `experimental/cc-visual-prototype`: Rome in personal Modern drew 4 models across 2 cities, its Antiquity neighbours none; after an interface reload the models were gone and the script rebuilt them |

### Not verified (speculation)
- Whether the renderer's `[AGE]` condition reads the player's Age or the game's Age. They are always equal, and neither can be changed mid-game, so this can't be tested.
- What `clipHexHeight` does (likely terrain clipping for cinematics, by its name).

### What blocks complete replacement
1. The era of city filler, roads and bridges comes from an `[AGE:...]` condition in the art bins. Its value only changes with a real Age transition, which is game-wide.
2. No script API removes, hides or swaps the art the engine draws for a plot. Scripts can only add models on top.
3. The per-civilization art table is read when cities are created, and it chooses the regional style, not the era.

### Best achievable
- **Kept (already in the mod):** later-Age buildings, wonders and units use their own art, so cities do modernize building by building, per player.
- **Optional, experimental:** the overlay prototype gives each owner's cities later-Age blocks by personal Age, per player and without touching gameplay, at the cost of a mixed look. Not recommended for the main mod.
- **Would need Firaxis:** a per-player or per-city art Age (for example, the renderer honouring a player Age that mods can set). Worth a feature request to Firaxis.

## Round 3 (2026-11-13): hiding the engine's own city art

The user asked not to settle for overlays on top of Antiquity buildings, so the crashed call was retried correctly.

### Verified
- **`WorldUI.clipHexHeight(plot, height)` hides engine art on a tile.** Everything the engine draws above `height` on that tile disappears: houses, temples, the palace, markets, walls on the tile. At `0` only ground-level paving stays; at `5` building stumps stay; at `30` most of the building stays. Terrain, units, unit flags, yield icons and city banners are unaffected. Called without the height it crashes the game.
- **It is undone with `restoreHexHeight(plot)` or `restoreAllHexHeight()`.**
- **It persists:** a clipped tile stayed clipped through a full AI turn while the engine added art elsewhere.
- **Clip plus a later-Age city block is a real replacement.** On Rome's 16 city tiles (turn-451 save) the Antiquity city disappeared and Modern blocks stood in its place.
- **Two neighbours in different Ages, same game Age.** Turn-42 game: Rome in personal Modern showed Modern blocks, neighbouring Russia (Antiquity) kept its timber city.
- **Per-player prototype rebuilt** (`experimental/cc-visual-prototype`): uses clip plus blocks by personal Age, updates on research, applies automatically when a save loads (241 tiles on the turn-451 save) and is display only.

### What still limits it
- The `*_URBAN_*_Layout` blocks are one European style: every civ's later-Age city looks alike.
- Replaced tiles show generic blocks instead of the player's actual buildings; walls on tile edges keep engine art; large cities look tiled.
- Ownership changes and multiplayer are not tested.

### Possible next steps
- Use the art bins for individual later-Age buildings (`BIN_*`, for example `BIN_Museum`) per actual building on the tile, instead of one generic block, so tiles keep showing what was built.
- Pick regional variants where the art data has them (`EAS_`, `MID_`, `NAF_` ... prefixes) by the civ's building culture.

## Round 4 (2026-11-13): real buildings in the owner's style

Both "next steps" above are done: replaced tiles now show the buildings actually on them, in the owner's regional style.

### How the engine picks a building's model (verified by decoding the art packages)
- **Building type to bin:** a dispatch bin pairs `[BUILDING:BUILDING_MUSEUM]` with `BIN_Museum_Scaled`, and so on for 95 building types.
- **Bin to model:** each bin entry is a 32-byte record holding the FNV-1a hash of the model name and a condition index. The conditions (`[BUILDING_CULTURE:BUILDING_CULTURE_SAM_MOD]`, `[AGE:AGE_MODERN]`, `[CONSTRUCTIBLE_STATE:COMPLETED]` ...) follow the records; a new condition takes the next index, a reused one points back. Decoded examples:
  - `BIN_Museum`: Modern cultures only (Mediterranean and South American Modern use the Mexican museum, East Asian Meiji, Northern European French ...).
  - `BIN_University`: Exploration cultures only. `BIN_Library`: Antiquity cultures only. So a building keeps the style of the Age it belongs to, as in the base game.
  - `BIN_Palace` and `BIN_Cityhall`: region plus `[AGE:...]`, the one place the game Age picks a building's look (Rome: Roman palace in Antiquity, Spanish in Exploration, Mexican in Modern).
  - `BIN_MOD_T2_CityBld_*` and `BIN_EXP_T2_CityBld_*`: the Age's filler houses per culture.
- **Each civ's cultures** come from `VisArt_CivilizationBuildingCultures` (Rome: `MED`, `MED_ANT`, `MED_EXP`, `SAM_MOD`, ...). Earlier rounds showed that editing this table doesn't change the engine's own art, but it is the right input for choosing models ourselves.
- **Drawing a bin directly** with `addModelAtPlot("BIN_Museum", ...)` does **not** use the tile owner's culture (it gave the French museum on a Roman tile), so the overlay resolves bins itself. Sub-bins such as `BIN_SAM_MEX_Palace` draw correctly.

### Drawing (verified)
- `addModelAtPlot(asset, plot, offset, { placement: PlacementMode.TERRAIN, scale })`: `scale` works; `offset` is in tile units (x east, y north, ±0.5 is the tile edge). An `angle` key made the model disappear.
- The urban road layouts (`LAYOUT_CTY_MOD_Section_AB_Road`, `LAYOUT_CTY_Hex_Section_AB_Road_EXP`) have the same lots in both Ages. The packed house layouts put houses on the west side of the tile, leaving room for two buildings at about (0.15, ±0.2) at scale 0.55. The palace layouts leave a plaza at about (0, -0.1).

### Prototype results
- Turn-451 Rome (personal Modern): every tile shows its own buildings: amphitheater (Roman) and museum (Mexican Modern) on (8,38); the Mexican Modern palace with the Spanish Exploration bank on the capital; Modern brick houses around them. Walls and wonders untouched.
- Turn-42 game: granting Steam Engine rebuilt Rome's 4 city tiles at once; neighbouring Russia kept its Antiquity city.
- After a full game restart the installed prototype rebuilt 241 tiles on load by itself.
- Speculation, not checked on screen: other civs resolve to their own regional sets (the tables say so: Meiji Japan to `EAS_MJI_*`, Mughals to `MID_MUG_*` ...).

### Still open
- Lot positions are measured by eye, not read from the engine's building slots; all buildings face one way.
- 28 building types (walls, monuments, observatories, some uniques) have no per-culture table and use one default look.
- Ownership changes and multiplayer remain untested.
