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

## Round 5 (2026-11-13): missing and mis-oriented buildings

The user reported main buildings missing or facing the wrong way.

### Causes found (verified)
- **Missing:** the overlay used one model group and redrew all 241 tiles whenever any tile changed. A newly added model shows its paved base first and the building once its mesh loads, so during busy turns buildings kept restarting their load. 383 of 391 buildings were resolved, so resolution was not the main cause. Fix: one model group per tile, redraw only changed tiles. The 8 unresolved buildings (airfield, launch pad, rail station) now fall back to the game's own bin.
- **Orientation:** every model faced south. `addModelAtPlot` honours `angle` in degrees (0 faces south, positive turns toward east). Earlier tests that "hid" models with `angle` were screenshots taken before the models had loaded. Buildings now face the tile centre.
- **Wrong regional style for region-only conditions:** the decoder paired conditions such as `[BUILDING_CULTURE:BUILDING_CULTURE_MED]` with the model one place over (`MED` gave the Mughal Modern block, `EAS` the American one). Both indexes in a bin record point into the package's length-prefixed string table, which runs in order locally but skips entries; reading a condition index relative to the nearest model anchor (a model name whose hash matches exactly one table string) gives the correct pairs (`MED` to the Mexican set, `EAS` to the Japanese set, as the Age-specific rows already did).
- **Unconditioned variants:** the game offers two generic variants for barracks, kilns, dungeons and granaries (Middle Eastern or Mediterranean). The overlay now prefers the owner's region when one matches.

### Checked on screen
- Rome (turn 451): buildings draw on every tile and face their tile's centre; kiln Spanish, library Roman, museum and palace Mexican Modern.
- Mexico City: Mexican Modern palace square, Modern blocks, wonders untouched. A dark patch nearby was unexplored fog, not the overlay.

## Round 6 (2026-11-13): engine layout measured on a test bench

The user still saw buildings inside each other and at odd angles, and suggested a sandbox instead of reading the live game.

- **Test bench** (`experimental/cc-visual-prototype/tools/bench.js`): clears a row of tiles (`clipHexHeight`), hides units (`WorldUI.setUnitVisibility(false)`) and pushes a straight-down camera (`Camera.pushCamera(position, target)`), with a pip grid every 0.1 tile. `WorldUI.getScreenPos(worldPos)` converts positions to screen pixels.
- **Units:** `addModelAtPlot` offsets are in tile spacings (1 = 64 world units), so 0.5 is the tile's inner edge.
- **Engine tiles, from above:** a two-building urban tile puts its buildings about 0.25 tile from the centre on roughly opposite sides; two Rome tiles showed the same pair of lots turned 60 degrees apart, with the buildings turned to match.
- **Engine layout parts:** the street section (`LAYOUT_CTY_MOD_Section_AB_Road`) plus the two-building house layout (`BIN_CTY_MOD_Layout_2HB_Full_A`), whose houses sit on the north-west, south and south-east edges. Lots: A (-0.19, -0.09), B (0.12, 0.25). The earlier overlay assumed houses on the west side and put buildings on top of them.
- **Size:** `BIN_Museum_Scaled` draws the museum at about 0.46 tile across, the full model at 0.62, so buildings are drawn at 0.68. The previous 0.45-0.55 scales were guesses.
- **Rotation:** `angle` turns counter-clockwise (x east, y north); rotating the lots by the same angle keeps buildings on their streets.
- **Centres:** palace and city hall at (0, 0), full size, fill the plaza layouts exactly.
- Result: Rome's tiles show buildings in their lots between streets and houses, with no overlaps seen from above or at an angle.

## Round 7 (2026-11-13): sandbox game and the palace square

- **Sandbox:** a new tiny-map game with Rome as the only player (no AI civs, no city-states), set up by script with `Configuration.editMap().setMaxMajorPlayers(1)`, the other slots closed and `Network.hostGame`. Buildings are placed with the debug `CREATE_ELEMENT` operation the Firaxis tuner's city panel uses (`experimental/cc-visual-prototype/tools/sandbox.js`); tiles are added with `city.purchasePlot`. Saves: `CC_Visual_Sandbox_Antiquity`, `CC_Visual_Sandbox_Modern`.
- **Engine art coming back (verified):** the engine redraws a city's tiles when the city changes (a building added, a tile bought), which undoes `clipHexHeight`. The overlay only re-clipped changed tiles, so the engine's Antiquity palace (and other buildings) reappeared underneath the overlay's models. This was the main cause of buildings drawn inside each other. Fix: re-clip every replaced tile on each rebuild, listen to more city events, and re-clip all replaced tiles every 3 seconds as a safety net.
- **Palace layout:** the `*_City_Center_Palace` layout is only the square, streets and houses; the palace at (0, 0), full size, fills it.

## Round 8 (2026-11-13): shore and cliff tiles

- The engine keeps its houses off rocks and beaches by placing them piece by piece; the overlay's two-building layout is one fixed model and spilled onto them.
- `LAYOUT_CTY_Coastal_1Shore` is a dock and waterfront piece, not a city block; the engine did not draw it on the sandbox shore tile, so it isn't used.
- Measured at angle 0: the layout fills the NW, SW and SE edges with houses and puts building lots toward W and NE; only E stays open. `GameplayMap.isCliffCrossing(x, y, dir)` reports cliff edges.
- The overlay now picks each urban tile's 60-degree turn to keep houses and buildings off edges facing water or mountains (weight 3) and cliffs (weight 1), buildings counting double, and on any shore, cliff or mountain tile draws only the street section and the two buildings, without the house rows.
- Sandbox: the coastal factory and museum tile now stands on its streets with nothing on the beach or rocks.

## Round 9 (2026-11-13): why redraws don't follow the engine's rules

- The engine's city layout bins hold no terrain variants: `BIN_CTY_MOD_Layout_2HB_Full_A` is the packed houses plus a forest-only tree layer; `BIN_LAYOUT_CTY_*_Road` only switch by `[AGE:...]`. Fitting houses around rivers, coasts, cliffs and the central square happens in engine code (blocker and attachment points such as `*_BlockerAttachment_*`), which mods can't call or read. So a per-player redraw can only approximate it.
- No per-player or per-city art Age exists in the executable (searched: only start Age, age transition data and the unit `setAgeStyle`).
- `clipHexHeight` does not hide the engine's houses on navigable-river tiles. Redrawing them stacked new models on the old ones; the overlay now leaves navigable-river tiles to the engine.
- Bridges: in the base game all three bridge buildings use one bin that picks wood or stone by the game Age, so in this mod bridges stay wooden. Since bridges sit on navigable rivers, they stay engine-drawn.

## Round 10 (2026-11-13): side by side with the engine's own Modern city

- **Reference game:** same map seed (265426227, game seed 265426226, continents-voronoi, tiny), Modern start, Mexico (Rome's Modern art set is Mexico's), both mods disabled, city on the same tile (47,9), same districts and buildings placed (four tiles differ slightly: the Modern start pre-placed buildings there). Shots: `sandbox-shots/8-modern-prototype.png` (ours) and `9-modern-engine-reference.png`, `10-modern-engine-capital-top.png` (engine). The layout is in `tools/sandbox-city.json`.
- **Matches:** the palace model, Modern houses, old buildings keeping their own Age's look (Antiquity granaries stay Antiquity in the engine's Modern city too).
- **Differences:**
  - **Street ground:** `clipHexHeight` hides only what stands above ground. The engine's street and paving decals stay, so every replaced tile shows the engine's streets plus ours. The engine turns each tile so its streets join the neighbouring tiles' streets into one network (the palace square was at about 330 degrees here); ours pick a turn per tile, so the two street layers cross. This is the "underlayment doesn't follow the street" problem, on every tile, not only the capital. No negative clip height removes the decals.
  - **Palace:** the engine's square has hedge gardens in the corners and the palace turned with the square.
  - **River tiles:** the engine draws Modern buildings along the river; ours stay Antiquity (round 9).
  - **Countryside:** farms, woodcutters, rural houses and props are Modern in the engine's game (trucks, lumber yards); the prototype doesn't touch rural tiles, so they stay Antiquity.
- **Next step that would fix the streets:** find the engine's per-tile turn. Since the engine's street decals stay visible under our models in every Age, reading the turn the engine chose (for example from a top-down screenshot per tile, or a rule if one can be found) and drawing ours at the same turn would make both layers line up.

## Round 11 (2026-11-13): reading the engine's street turns

- With every city tile clipped and no overlay drawn, the engine's ground shows one connected street network across the city (`sandbox-shots/11-engine-street-ground.png`). Streets run straight through several tiles, so the turn of a tile depends on its neighbours, not on the tile alone. The art data has road-style decal pieces chosen by connection shape (`BIN_TER_Decal_Route_Layout_Straight`, `Bend60`, `Bend120`, `YLeft`, `YRight`, `YSplit`, `Trident`, `X`, `Adjacent3` to `Adjacent6`), which fits a rule of "connect each city tile's streets to its neighbouring city tiles".
- The capital's square was turned about 330 degrees both in the Antiquity sandbox and in the Modern reference game: the turn is stable across Ages.
- Matching a single tile by drawing our street layout at each 60-degree turn over the engine's ground was inconclusive: the engine's ground streets are faint dirt paths that our paved model covers.
- `WorldUI.hash` is a string hash (the same family as `Database.makeHash`), not a per-tile seed.
- Not found: the rule itself. Next candidates: derive turns from which neighbours are city tiles (the road-network idea above), checked tile by tile against top-down shots of the engine's own buildings in the Modern reference game.

## Round 12 (2026-11-13): the engine doesn't turn city tiles

Measured by drawing each street layout over the engine's own ground on every Rome tile, one 60-degree turn at a time, and comparing image structure per tile against the engine-only ground (scripts in the session scratchpad; method: clip all city tiles, top-down camera, mean difference of brightness gradients in a disc around each tile centre):

- Every urban tile matched a street layout at **angle 0**: `LAYOUT_CTY_Hex_Section_AB_Road_ANT` (variant A) on four tiles, `LAYOUT_CTY_Hex_Section_AB_B_Road_ANT` (variant B) on one, and variant B turned 60 degrees on one (the weakest match).
- The capital's palace square also matched best at angle 0. The earlier "330 degrees" was a misreading: the square is modelled on a diagonal.
- Antiquity and Exploration each have A and B street variants; Modern has one (`LAYOUT_CTY_MOD_Section_AB_Road`), so in Modern every tile uses the same piece unturned, which is why the engine's Modern streets join up.
- Which tiles get variant B is still unknown.
- The prototype now draws every tile at angle 0 (the shore turning of round 8 is removed; shore and cliff tiles still skip the house rows). Result: one continuous street network across the sandbox city (`sandbox-shots/12-streets-aligned.png`).

## Round 13 (2026-11-13): Modern streets and gap fillers, first measurements

Reference: the same-seed Modern game (Mexico, no mods), saved as `CC_Visual_Reference_Modern`.

- **Correction to round 12:** in Modern the engine *does* turn tiles. Drawing `LAYOUT_CTY_MOD_Section_AB_Road` over the engine's clipped ground at each 60-degree step: (48,10) and (48,8) match at 0 degrees, (46,9) and (47,8) at 60 degrees (clear minima). These four fit "(x + y) even: 0, odd: 60", but four tiles are not enough to call it a rule; Antiquity tiles did not follow it (they choose between street variants A and B instead).
- **Gap filler belongs to tiles:** clipping all city tiles also removes the engine's in-between buildings, so they are drawn as part of a city tile, not on their own.
- **`LAYOUT_CTY_MOD_Wedge`** drawn on a tile at angle 0 puts a row of Modern buildings along the tile's east edge (into the gap toward the eastern neighbour), with a short street. So a wedge is an edge piece, turned to face one neighbour.
- Open: which edges get a wedge (only between two city tiles? only in Modern? only when the neighbour is not water?), and the Modern turn rule. Both can be measured the same way: draw candidates over the reference city's clipped ground and score per tile.

## Round 14 (2026-11-13): Modern turn rule and wedges

- **Modern street turns, 9 tiles** (reference city grown to 18 urban tiles, same scoring method): 0 degrees on (48,10), (48,8), (45,8), (50,8); 60 degrees on (46,9), (44,9), (47,8), (45,10); (50,9) unclear (riverside). (45,8) breaks the "(x + y) even/odd" guess, and no other coordinate rule fits; the choice may be a per-tile random pick.
- **Why it doesn't matter for this mod:** the game Age stays Antiquity, so the engine's ground streets under our art are always the unturned Antiquity ones. Our Modern streets stay unturned to line up with them.
- **Wedges:** at angle 0 the `LAYOUT_CTY_MOD_Wedge` piece fills the tile's east edge, which is exactly the edge our two-building layout leaves open. The prototype now draws it on every Modern urban tile whose eastern neighbour is a city tile (not water, not a navigable river). Sandbox result: tall Modern blocks between districts, closer to the engine's density (`sandbox-shots/13-modern-wedges.png`).
- Not reproduced: the engine's wedge versions of real buildings (`*_Factory_Wedge` and so on), and wedges on other edges.

## Round 15 (2026-11-13): building lots checked against the engine

Reference city (`CC_Visual_Reference_Modern`, no mods), top-down, positions converted with `WorldUI.getScreenPos` (1 tile = 624 px at that height):

- Tile (48,8), University + Temple: the engine's buildings sit at about (0.13, 0.29) and (-0.22, -0.06), within 0.04 tile of our lots B (0.12, 0.25) and A (-0.19, -0.09). Drawing our street section, the two-building house layout and both buildings at 0.68 on the engine's clipped tile reproduced the engine's tile closely (`sandbox-shots/14-lots-engine-tile.png` engine, `15-lots-ours-on-engine-tile.png` ours). Sizes agree within about 10%.
- **Order:** the first building in the tile's list goes to lot B (north-east), the second to lot A. Tile (48,10) with only a Bank: the bank in lot B, lot A filled with small houses. The prototype had the order reversed; fixed.
- The `_HB` models are larger hero versions (about twice the size); the engine uses the scaled bins in cities.

## Round 16 (2026-11-13): shore, cliff and mountain tiles

- Reference city grown with 14 rough tiles (16 measured: water, cliff or mountain on at least one edge). On its own art the engine still fills these tiles with houses, keeping them on the land side.
- Scoring our two options against it per tile (street section only vs street section plus the two-building house layout) was inconclusive: the scores were within a few percent of each other and split both ways, because the house layout is one fixed piece. With it, houses spill onto rocks and water; without it, the tile is too empty.
- Change: on rough tiles the prototype now places single filler house blocks (the Age's `BIN_*_T2_CityBld_*`, resolved to the owner's style) 0.3 tile out toward each house edge (north-west, south-west, south-east) that faces land, and skips edges facing water, mountains or cliffs. Sandbox: shore districts are populated on the land side with nothing on the beach (`sandbox-shots/16-shore-single-houses.png`). Not scored against the reference.

## Round 17 (2026-11-13): Antiquity street pattern A or B, and a second map

- **A or B is chosen at random.** The engine's Antiquity layout set `BIN_CTY_ANT_Layout_2HB_Full_A` lists four variants (`AB`, `AB_B`, `AB_VAR_A`, `AB_B_VAR_A`) with no condition, so the engine picks one per tile in its own code. Measured tiles: sandbox map 1 had one clear B tile out of six; map 2 (seed 777123) had one clear B out of five. Both B tiles had a barracks, but a direct test (six new districts, four with a barracks) gave no clear answer: close-up scores were within 1% between A and B. Without the engine's random seed this can't be reproduced, so the prototype keeps pattern A. Effect: on roughly one tile in five the engine's Antiquity ground streets under our art differ slightly from ours.
- **Second map** (`CC_Visual_Sandbox2_Antiquity`, `CC_Visual_Sandbox2_Modern`): fresh tiny map, Rome alone, 16 districts mostly on a coast. Exploration (Cartography) and Modern (Steam Engine) both render cleanly: palace in the right style, buildings in their lots, joined streets, gap filler in Modern, nothing on the water (`sandbox-shots/17-map2-exploration.png`, `18-map2-modern.png`).

## Round 18 (2026-11-14): 35-district street test (corrects round 17)

- Setup: inland city founded at (19,18) on map 2, every land tile within 3 bought and given one Antiquity building (35 urban districts, save `CC_Visual_Streets35`). Engine buildings hidden with the clip, so only the ground streets show; each tile scored against our pattern A and B street layouts at all six turns, 27 tiles in view.
- **Antiquity tiles are turned after all.** Every tile had one clear winner: A at 0° on 8 tiles, A at 60° on 9, B at 0° on 5, B at 300° on 4, B at 60° on 1. Only 8 of 27 (30%) match what the prototype assumes (A at 0°). Round 17's "one in five differs" was based on too few tiles.
- **No rule found.** Neither the building on the tile, the coordinates, the plot index nor some 50 standard hash functions of plot index, coordinates and the map seed (FNV, MurmurHash3, xxHash, CRC32, Jenkins, LCGs, with and without seed 777123/777124) predict the pattern better than chance (best 23 of 27 on A/B alone, out of thousands of tries).
- **It is fixed per tile.** After saving and reloading, all 27 tiles came back with the same pattern and turn. So the engine draws it from something stable (probably a per-model seed; `addModelAtPlot` returns one, and ours were consecutive numbers) inside compiled code. The UI script API exposes nothing about it: `WorldUI` has no decal, variant or seed functions, and `GameplayMap.getRandomSeed()` only returns the map seed.
- **The engine's streets can't be covered.** The clip leaves decals, and drawing the Modern city-centre plaza on top doesn't hide them either.
- **No safe spot inside a tile.** All five street patterns drawn on one bare grass tile, one at a time: together they cover essentially the whole hex (largest street-free circle about 0.02 tile). Weighting by how often each pattern was seen, the best spot for a building of radius 0.09 tile is clear only 48% of the time.
- Consequence: on about 70% of urban tiles our Exploration/Modern street layout lies over different engine streets (doubled, crossing streets), and our building lots can sit on an engine street.
