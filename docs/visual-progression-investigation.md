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

## Round 19 (2026-11-14): erasing the engine's inner streets

- Dead ends first. The district and building IDs are creation-order counters and don't predict the pattern. A model's random seed can be set (`addModelAtPlot(..., {seed})`), but drawing the engine's own tile set `BIN_CTY_ANT_Layout_2HB_Full_A` gives pattern A, unturned, for every seed and on every tile; the seed only shifts the houses. So the pattern and turn are chosen by the engine's city layout step, not by the tile set. Models also take `selectionScriptParams` (the game's own UI passes `{age, civilization}` or `{player}`), worth trying later for per-player art lookup.
- **Eraser found.** `EXP_Decal_Patch_DirtRectangle_A_highPrio` is a high-priority ground decal that paints over all lower decals, including the engine's street decals that the clip can't hide. The normal-priority version doesn't cover them. Three copies turned 0, 60 and 120 degrees at scale about 2.2 clear the inside of a hex and leave the street ring along its edges, which all five engine patterns share (`sandbox-shots/20-eraser-keeps-edge-ring.png`). Scale 3 covers the whole hex.
- No decal tried draws above it (brick, flagstone and road blocks, another high-priority patch), and model group or drawing order make no difference. So our street decals inside the tile are erased too; 3D parts survive (buildings, houses, the raised kerbs and paving strips of the Modern street layout).
- In the overlay (`CCVisualOverlay.setErase(true|false)`, on by default): urban tiles get the three patches. Modern sandbox: the doubled dirt streets are gone and the blocks read as one surface, but some of our Modern paving and the grass patches go with them, and on coast tiles the patch lightens the beach edge (`sandbox-shots/19-eraser-off-vs-on.png`, left off, right on). Not yet checked in Exploration, whose streets are decals and would be erased completely.
- **Exploration** (35-district city, Cartography granted; `sandbox-shots/21-exploration-eraser-off-vs-on.png`, top off, bottom on): with the eraser the tiles lose all inner streets, since Exploration streets are ground decals with no 3D parts, and the city reads as buildings on open sand; even the edge ring is faint at normal zoom. Without it the doubled streets are dirt on dirt and hard to spot at this zoom. The eraser hurts more than it helps in Exploration.
- **Decision: eraser off by default.** The goal is to look as close to vanilla as possible. The only high-priority patches in the art are sand-coloured dirt (`ANT_Decal_Patch_DirtRandom_B_highPrio`, `EXP_Decal_Patch_DirtCircle_A_highPrio`, `EXP_Decal_Patch_DirtRectangle_A/B_highPrio`), so erasing turns blocks into sand: wrong in Modern, where vanilla ground is grey paving, and in Exploration, where it removes the streets. `CCVisualOverlay.setErase(true)` stays for testing.

## Round 20 (2026-11-14): Modern ground colour

- Vanilla Modern city tiles read as grey because the street layout's paving is wide and the blocks are almost covered by buildings; between them is ordinary terrain (grass, some sand).
- Our Modern street and house layouts drawn on a bare grass tile give grey streets and **green** blocks. On a city tile the same layouts sit on **sand**: that sand is the engine's own Antiquity city ground decals, which the clip leaves, so it isn't in our layouts and isn't the terrain.
- No asset paves over it. There are no Modern paving decals by name; `LAYOUT_CTY_MOD_Section_AB_Small_Packed` (+`_FOL`) only adds a few small sheds; large normal-priority stone and brick decals (`EXP_Decal_Block_A_Brick_Rect_A` at scale 4, `EXP_Decal_Patch_Flagstone_Puzzle_A` at scale 5) don't cover the sand; `GEN_Decal_Stone_Brick_B` and `GEN_CityKit_Decals_Stone` don't load as standalone assets; the only high-priority patches are sand-coloured dirt (round 19).
- Consequence: the way vanilla hides the ground is buildings. Closing the density gap (gap 2) is also the fix for the ground.

## Round 21 (2026-11-14): density, measured on the vanilla Modern reference city

- Method: the reference save (`CC_Visual_Reference_Modern`, global Modern Age, no mods), with the overlay scripts loaded by hand and Modern techs granted, so the same tiles can be shown as the engine draws them (`CCVisualOverlay.reset()`) and as we draw them (`rebuild()`).
- **Biggest density loss was our "rough tile" rule.** Tile (48,10) (Bank) has a cliff on its west edge and a navigable river to the south-east; the overlay counted any cliff as rough and drew only the streets plus three single houses, leaving mostly sand. The engine fills that tile with full row-house blocks, including along the river bank. Now only a house edge (north-west, south-west, south-east) facing water or a mountain makes a tile rough. Result: (48,10) shows the same three row-house blocks as the engine (`sandbox-shots/22-tile-48-10-engine-old-new.png`: engine, old, new).
- Wide view after the fix (`sandbox-shots/23-reference-engine-vs-ours.png`, engine top, ours bottom): urban tiles are now close in density. Remaining differences:
  - **Palace square:** the engine's square is turned (about 330 degrees, as measured in round 12) with gardens where we draw the palace's dome towers; we draw it at 0 degrees.
  - **Shipyard (49,9):** the engine draws a large dock on the shore; we put a smaller model in lot B, on the water.
  - **Rural tiles:** the engine adds Modern houses, lumber piles and grey roads on woodcutters, mines and farms near the city; we don't touch rural tiles.

## Round 22 (2026-11-14): the palace square, measured on the vanilla Modern reference game

- **The square isn't turned, the palace is.** `BIN_CTY_MOD_Layout_Palace_Full_A` (the engine's full palace-square set, which the overlay hadn't used) drawn at 0 degrees puts its streets, garden beds and steps exactly where the engine's are. The palace stands on the plaza at about (-0.07, -0.18) tile from the centre, turned 330 degrees. Drawn that way our Mexican palace's towers and front line up with the engine's (`sandbox-shots/24-palace-engine-old-new.png`: engine, old overlay, new overlay). The "square turned 330" of round 12 was the palace.
- **Same rule for other capitals** (`sandbox-shots/25-engine-capitals-mexico-madrid-roma-parsa.png`; the Madrid shot is blocked by a mountain): Roma has the same square, gardens and palace position and turn; Pārsa's Mughal palace stands in the same spot.
- Overlay: Modern capitals now use the full palace-square set and place the palace there (`PALACE_AT`). Exploration capitals are not measured yet and stay as before (palace at the centre, unturned).
- **Still different:**
  - The engine fills the garden beds with spiral topiary hedges, the same for every civilization. Candidates `BIN_GEN_SKU_Palace_Hedges_Splines` and `BIN_GEN_SKU_Palace_WithHB_Hedges_Splines` load but draw nothing on their own (probably spline pieces the engine lays along a path).
  - Player colours: the engine tints banners, awnings and the palace's roof stripe in the owner's colours (purple for Mexico); our models get the default colour.

## Round 23 (2026-11-14): owner colours

- The game's own UI tints models with the owner's colours by passing `tintColor1: UI.Player.getPrimaryColorValueAsHex(id)` and `tintColor2: UI.Player.getSecondaryColorValueAsHex(id)` to `addModel*` (`leader-model-manager.js`). The same options work on `addModelAtPlot` for city models.
- Overlay: every part now carries its owner, and is drawn with that player's colours. The palace's roof stripe, banners and awnings now show the owner's colour like the engine's (`sandbox-shots/26-palace-owner-colours.png`: engine, before, after; Mexico's purple).
- Tested by drawing the overlay's parts by hand with the tint on the reference game: the game's debug connection was in its fallback mode and couldn't load the updated script file. The code path itself is checked for syntax only; still to see running in a normal session (Rome sandbox).

## Round 24 (2026-11-14): rounds 21-23 checked together in the Rome sandbox

- `CC_Visual_Sandbox_Modern` with the installed mod (so the game itself loads the new overlay): the capital uses the full palace-square set with the palace at 330 degrees, every part carries its owner, and the city reads as dense Modern blocks with Roman purple banners and awnings (`sandbox-shots/27-rome-modern-all-changes.png`).
- Rough-tile rule: all drawn urban tiles now get full house rows. The only one touching water, (48,11), has it on its east edge, which the house rows don't use; from above nothing stands on the beach, and the south-east row sits on the rocks above the shore (`sandbox-shots/28-rome-shore-tile-top.png`).
- Owner colours are confirmed running from the mod itself (round 23 was tested by hand).

## Round 25 (2026-11-14): rural tiles

- The engine picks rural art the same way as buildings: generic bins with `[AGE:...]` rows. `BIN_IMP_Farms` -> `BIN_IMP_MOD_Farm_A/B/C` (Modern), `BIN_IMP_WoodCutters` -> `IMP_MOD_WoodCutter`, `BIN_IMP_ClayPits` -> `BIN_IMP_MOD_Claypit_Base` (Exploration: `BIN_IMP_Claypit_Base`), `BIN_IMP_Mine_MOD` -> `IMP_Mine_MOD` (Exploration: the Antiquity mine). Farms and woodcutters have no Exploration rows, so in vanilla Exploration rural tiles look like Antiquity; only Modern needs redrawing.
- The improvement-to-bin dispatch is not in the bins (`[IMPROVEMENT:X]` sits on a layout named after the improvement), so the extractor didn't pick improvements up; the overlay has a small fixed table instead. The extractor now also accepts `[IMPROVEMENT:X] or [IMPROVEMENT:Y]` dispatch conditions for when they do appear.
- Sandbox setup: rural improvements need a rural district first (`CREATE_ELEMENT` `{Kind: "DISTRICT", Type: "DISTRICT_RURAL"}`, then the improvement as a constructible), like the tuner does for wonders.
- Overlay: Modern rural tiles with a farm, woodcutter, mine or clay pit are clipped and redrawn with the Modern model in the owner's colours. Other improvements (plantations, pastures, camps, quarries, fishing boats) are left to the engine for now.
- Compared on the same tiles of the same map against the vanilla Modern reference (`sandbox-shots/30-rural-engine-vs-ours-mine-clay-farm.png`, engine left):
  - Clay pit: close (same pit, crane and building).
  - Farm: variant B matches the engine's house, tractor and shed. The engine's field is lusher; ours keeps the engine's Antiquity farm paths underneath (ground decals the clip can't hide), and the Antiquity crop rows are clipped with the rest. Clipping higher (4, 10) brings the Antiquity farmhouse back without the crops, so 0 stays.
  - Mine: buildings similar, but our model shows grey spoil heaps where the engine shows orange rock; the engine may choose by resource or terrain with conditions the extractor drops.
  - Woodcutter: Antiquity camp becomes a Modern lumber yard; the model has its own edge trees, so the forest tile doesn't go bare (`sandbox-shots/31-woodcutter-antiquity-vs-modern.png`).
- Whole view: `sandbox-shots/29-rural-before-after.png` (before top, after bottom).

## Round 26 (2026-11-14): the other rural improvements

- Modern art exists for camps (`IMP_MOD_CAMP`; Exploration also has `IMP_EXP_CAMP`), quarries (`IMP_MOD_Quarry`), pastures (`PROP_Pasture_MOD_Barn`, `PROP_Pasture_MOD_BldB`, `PROP_Pasture_Tractor`) and plantations (`IMP_Plantation_Bld_MOD`). Fishing boats, oil rigs and the unique improvements have no Age variants in the bins.
- **`selectionScriptParams` doesn't override the Age.** `BIN_Pasture_BldB_Finished` (Antiquity and Modern rows) drew the same Antiquity shed with no parameters, with `{age: "AGE_MODERN"}` and with `{age, civilization}`. So bins that pick by `[AGE:...]` can't be pointed at a personal Age; models have to be named directly.
- Camps and quarries are whole models and redraw cleanly (`sandbox-shots/32-...antiquity.png` engine, `33-...` ours: Modern lodges, a dump truck and machinery in the quarry).
- Pastures and plantations pick only their buildings by Age; the animals and crops come from resource bins. Drawing the top-level layout (`IMPROVEMENT_PASTURE`, `IMPROVEMENT_PLANTATION`) on the clipped tile brings back the animals and crops but with Antiquity-picked buildings. They are rebuilt from parts instead: `IMP_Pasture` + `BIN_Pasture_Resources_Finished` + the Modern barn, shed and tractor; `BIN_PROP_Plantation_RES` + `IMP_Plantation_Bld_MOD`. Building spots are hand-picked; there is no vanilla Modern reference for these two yet (`sandbox-shots/34-pasture-plantation-from-parts.png`). The plantation's crop cover comes out sparser than the engine's.
- Overlay: the rural table is now per personal Age (Exploration: camps; Modern: farms, woodcutters, mines, clay pits, camps, quarries, pastures, plantations) and allows several parts per improvement. Rome sandbox with nine rural tiles: `sandbox-shots/35-rome-modern-with-rural.png`.

## Round 27 (2026-11-14): pastures and plantations measured on the vanilla Modern reference

- Placed a pasture (48,12) and a plantation (47,12) for Mexico in the reference game (global Modern, no mods), captured the engine's tiles, then drew our parts on the same clipped tiles.
- First guess vs engine (`sandbox-shots/36-...`): the barn was on the wrong side and the plantation house covered the crops. Measured spots, in tile units (x east, y north): pasture barn (0.2, -0.11), small shed (0.04, 0.32); plantation buildings along the north edge, about (-0.13, 0.3). The engine shows no tractor on the pasture, so it is dropped. After the change (`sandbox-shots/37-...`) the buildings sit where the engine's do.
- Still different: the engine's corral has a full rail fence (ours shows only the posts; the rails are `IMP_Pasture_Fence_Spline_*` pieces that, like the palace hedges, draw nothing on their own), and the engine's plantation adds a round vat, drying racks and a market stall that our single building model doesn't include.

## Round 28 (2026-11-14): harbour tiles

- The "shipyard on the water" was the overlay treating a water urban tile (50,9, Wharf; the shipyard on 49,9 is a navigable-river tile and left to the engine) like a land tile: a street section, the wharf in building lot B at 0.68 scale and a filler house, all floating on the water.
- Harbour buildings have no Age or culture variants: `BIN_Wharf`, `BIN_Shipyard` list only an Abbasid and a Spanish model each, so the engine draws the same buildings in every Age; what differs is placement.
- Engine (reference game, and Roma's three harbour tiles): the building stands at full size on the land side of the tile with its long side along the shore, and wooden piers run out to sea. The coastal pier piece is `LAYOUT_CTY_Coastal_2Shore` (also `_1Shore`, `_2ShoreSkip`).
- Overlay: on a water urban tile it now draws no streets, houses or gap filler; each harbour building goes at full size 0.2 tile toward the land (the mean direction of land neighbours), turned land + 120 degrees, and the pier piece turned land - 90 degrees; a second or third building sits 70 degrees either side. Measured on Mexico's wharf (`sandbox-shots/38-harbour-engine-old-new.png`: engine, old, new) and checked by hand with the same rule on Roma's shipyard, fishing quay and wharf (`39-roma-harbour-engine-vs-rule.png`, engine and ours in pairs). The engine's piers are longer and more numerous.

## Round 29 (2026-11-14): sweep of the readable code for missed hooks

Checked everything the UI scripts can reach (every global engine object and its methods), every `WorldUI` call in the game's own JavaScript, every table in the game database, and the data files that define visual tables.

- **No per-player or per-city art switch exists.** Visual tables are `VisArt_CivilizationBuildingCultures`, `..UnitCultures`, `VisArt_IndependentBuildingCultures`, `..UnitCultures` and `VisArt_PlotEffectModifiers` (culture and plot-effect mapping), plus `VisualRemaps` (`base-standard/data/visual-remaps.xml`: three global options, scout, palace and fog style, with kinds UNIT, BUILDING and ART_BIN). Per-Age building cultures come from each Age's own data module (`age-*/data/civilizations-shared.xml`), loaded only in that Age.
- **`WorldUI.getAssetNames()`** returns every asset the engine knows (25,908 names), a simpler source than parsing the art packages.
- **Ground colour comes from the terrain, not the Age.** With the buildings clipped, the vanilla Modern city's own ground is sand on a desert tile and grass on a grassland tile (`sandbox-shots/40-vanilla-modern-ground-is-terrain.png`: each tile without and with `STD_CITY_Clear_Tile`). So the sand under our Modern tiles matches vanilla; only the street pattern differs.
- **`STD_CITY_Clear_Tile`** loads but has no visible effect on a clipped city tile.
- **`WorldUnits.setAgeStyle(unitId, age)`** exists (units may have per-unit Age styles), but on a Modern settler it changed nothing with the Age's hash, type name or index. Not pursued further; possibly limited to some unit types.
- Not yet tried: `addModelBetweenPlots` (edge pieces, maybe how the engine joins roads or fills gaps), and the Modern river-city ground pieces `River_City_I_*_MOD_Decal`, which might help the navigable-river tiles the overlay still leaves to the engine. `WorldBuilder.MapPlots` changes real terrain and is off limits for a display-only mod.

## Round 30 (2026-11-14): reading the engine's layout data

- The tuner panels (`Base/Platforms/Windows/Config/TunerPanels/*.ltp`) are readable. `WorldUI Models.ltp` passes `selectionScriptParams: { ageStyle: 1|2|3 }` when it places models; on `BIN_Palace` the three styles drew the same Modern palace, so `ageStyle` does not pick by Age for city art (it looks meant for independent leaders).
- **City layouts are data.** Each `LAYOUT_*` asset lists named attachment points (`Herobuilding_A/B` or `Hero_Building_A/B`, the house blocks `BIN_MOD_CityBld_6x4_A002` and so on, `Road`, trees). In the art package each attachment is a 40-byte transform record (u64 sequence, f32 0, x, y, z, 0, 0, turn in radians, scale; x, y in world units, 64 per tile) followed by a 32-byte record with the FNV-1a hash of the attachment's full name. `tools/decode_layouts.py LAYOUT_NAME` prints them. Checked: `Road` sits at (0, 0) at scale 1.
- Results (tile units, turn counter-clockwise):
  - Modern urban and city centre (`LAYOUT_CTY_MOD_Section_AB_Small_Packed`, `..._City_Center`): lot A (0.123, 0.275) turned -30, lot B (-0.215, -0.093) unturned. Hand measurement had been (0.12, 0.25) and (-0.19, -0.09), both unturned.
  - Exploration urban (`LAYOUT_CTY_EXP_Hex_Section_AB_Attatchment`): A (0.120, 0.245) turned -30, B (-0.214, -0.086). Exploration city centre: same spots, A turned 150.
  - Palace square, Exploration and Modern (`..._City_Center_Palace`): `Hero_Building_A_1` (-0.103, -0.179) turned -30, `Hero_Building_A_2` (0.129, 0.224) turned -30. Hand measurement had been (-0.07, -0.18) at 330.
- Overlay now uses these numbers: lots with their turns per Age, the palace slot for both Ages (Exploration was unmeasured), the second building on a capital in slot A_2, and city halls in lot A of the city-centre layout instead of the tile centre.
- Check on the vanilla Modern reference (`sandbox-shots/41-engine-lots-from-layout-data.png`: palace clean engine; an earlier shot that was secretly our overlay; tile 48,8 clean engine; ours): the University (turned) and Temple stand exactly where the engine's do. The houses around them differ: the engine trims its house blocks around each building (blocker attachments), we draw the whole house set.
- Method note: loading the overlay script by hand registers its event handlers, so moving the camera after `reset()` can redraw it before a capture. Check `WorldUI.modelGroupIds` for live `ccVisualOverlay:` groups before taking an "engine" shot.

## Round 31 (2026-11-14): house slots and how the engine picks a house layout

- Each attachment's 32-byte name record also holds the FNV-1a hash of the model it carries (the u32 after the name hash), and a kind (2, or 258 for most house blocks). The Modern house layout's slots carry `BIN_MOD_T2_CityBld_4X4_A`, `_3x5_A`, `_5x6_A`, `_6x4_A`, `_9x6_A`, `_Corner_A`, `_Corner_A_Mirrored`, urban trees, a market stall and baskets, `BIN_City_Road_Units`, `Hero_Building_A/B` and the street section `BIN_LAYOUT_CTY_MOD_Section_AB_Road`. Slot names don't always match their content (`4x4_A002_2` carries a 5x6 block).
- Slot markers drawn on clean engine shots (`sandbox-shots/42-engine-slots-cliff-tile.png`, `43-engine-slots-forest-tile.png`; markers sit at each block's corner or edge, the block extends from there):
  - Cliff tile (48,10): slots on the rocks (`3x5_5`, `9x6_2`) are dropped, the rest kept; the empty lot B is filled with small houses.
  - Forest tile (48,8): the bottom-right slots carry trees and the left-centre corner block is missing. That is the forest layout.
- **The house layout choice is data.** Decoded rows of the layout bins:
  - Modern houses (`BIN_CTY_MOD_Layout_2HB_Full_A`): `..._Small_Packed`, or `..._Small_Packed_FOL` when the tile has `FEATURE_FOREST`, `_SAGEBRUSH_STEPPE`, `_SAVANNA_WOODLAND`, `_TAIGA` or `_RAINFOREST`. Palace square and city centre: the same pattern (`..._FOL`).
  - Exploration houses: four unconditioned variants (`AB`, `AB_B`, `AB_B_VAR_A`, `AB_VAR_A`), `..._Attatchment_Less` (and `_B_`) for building cultures SAM, SEA, PAC, NAM, SAF (plain or `_EXP`), and `..._Less_FOL` on wooded tiles. City centre: plain, `_Less` for those cultures, `_Less_FOL` wooded.
  - Antiquity houses: four unconditioned variants (the A/B and turn of round 18) and two `_FOL` variants on wooded tiles.
  - A conditioned row that matches wins over the unconditioned ones. Drawing the bin ourselves does not apply the feature condition (we always got the plain layout).
- Overlay: picks the layout per tile like the bins do (forest version on wooded tiles, "Less" for those cultures in Exploration, otherwise a pattern-A variant by tile seed). Fixed: Exploration capitals and all city centres drew both the plain and the forest layout on top of each other. Forest tile 48,8 now shows the engine's tree and fewer houses (`sandbox-shots/44-forest-layout-engine-before-now.png`).
- Not done: dropping single house slots that fall on rocks or cliffs (the engine tests terrain per slot); the random 0/60 degree turn of Modern tiles (46,9 is turned in the engine) remains unknowable.

## Round 32 (2026-11-14): house slots on rocks and cliffs

- Rule search on the vanilla Modern reference, using unturned tiles only:
  - Height above the tile centre doesn't separate kept from dropped slots (48,10: dropped at 4.4 and 3.4, kept at 3.1; 50,27: dropped at 1.9, kept at 2.8). Slope doesn't either (the steepest slot on 48,10 is kept).
  - Distance to the edge facing the cliff does. On both cliff tiles (48,10 and 50,27, cliff on the west edge) the engine drops exactly `9x6_2` and `3x5_5`, 0.13 and 0.15 tile from that edge, and keeps `C7` at 0.22 (`sandbox-shots/46-engine-slots-second-cliff-tile.png`).
  - Roma's coast tile 20,31 couldn't be used: the engine had turned it (its random per-tile turn), so the slots don't line up.
- `tools/extract_layout_slots.py` exports the slots of the house layouts (Modern plain and forest; Exploration plain, VAR_A, Less, Less forest) to `ui/cc-layout-slots.js` (`globalThis.CCLayoutSlots`: model, x, y, z, turn, scale, kind), expanding nested layouts. Registered in the modinfo.
- Overlay: a tile with any edge facing a cliff, water or a mountain is drawn slot by slot: the street, every slot of the chosen house layout except the building lots and the street piece, each house block resolved to the owner's culture (`SAM_MEX_CityBld_*` for Mexico), and slots closer than 0.18 tile to such an edge left out. This replaces the old shore rule (street plus three guessed single houses). Other tiles still get the whole layout in one piece.
- Check on 48,10 (`sandbox-shots/45-cliff-tile-slot-by-slot.png`, engine left): no houses on the rocks; the bottom and right rows match the engine's.
- Open: the engine fills an empty building lot with `BIN_Vacant_Building` (Modern: `Vacant_Hero_Building_Plot_MOD_01` or `_02`, several small houses and palms); drawn at the slot's scale they cover the whole tile, so the right scale is still to be found (the `_Scaled` bin is untested). We still draw one small house there.

## Round 33 (2026-11-14): empty building lots

- Decoded rows of `BIN_Vacant_Building` (what the engine draws in an empty lot): `Vacant_Hero_Building_Plot_River_01` on navigable rivers, `Vacant_HeroBuilding_Coastal` on urban shallows, `Vacant_Hero_Building_Plot_MOD_01`/`_02` in Modern, otherwise one of `Vacant_Hero_Building_Plot_01`-`05` (no Age condition, so Antiquity and Exploration share them).
- Drawn at the lot's own scale the plots cover the whole tile; the engine draws them through `BIN_Vacant_Building_Scaled`, and `Vacant_Hero_Building_Plot_MOD_02` at 0.68 (the size we already use for scaled building bins) is identical to that bin on the reference game.
- Overlay: an empty lot now gets the vacant plot of the owner's personal Age (Modern 01/02, Exploration 01-05, picked by tile seed) at 0.68 and the lot's turn, instead of one filler house. Named directly, because the bin picks by the game's Age, which is Antiquity in this mod. On 48,10 the middle of the tile now shows the engine's cluster of small houses and palms (`sandbox-shots/47-empty-lot-vacant-plot.png`: engine, before, now).

## Pin (2026-11-14): where the prototype stands

Paused at this point; summary and next candidates are in `experimental/cc-visual-prototype/README.md` ("Status"). In short: buildings, lots, palace squares, house layouts (forest and culture variants, slot-by-slot next to cliffs, water and mountains), empty lots, owner colours, harbours and Modern rural tiles now follow the engine's own data or measurements on the vanilla Modern reference; estimated about 80-85% of vanilla for Modern cities. The engine's Antiquity ground streets under our art and its random per-tile turns remain the main gap and are not reachable from scripts. Code cleaned (unused helpers removed); the slot table loads from the modinfo after a game restart (checked in the Rome sandbox).

## Round 34 (2026-11-15): tinting the eraser

- Resumed after the 0.2.0 release (branch merged with main). Idea: the only decal that paints over the engine's Antiquity streets is the sand-coloured high-priority dirt patch (round 19); if `tintColor1/2` recoloured it grey, it could stand in for Modern paving.
- Result: **tint has no effect on decals.** Three patches (untinted, grey 0x505050, pure red) on bare tiles and on city tiles came out the same sand colour. Tint only reaches 3D models (banners, awnings).
- So the ground stays at round 20's conclusion: no paving asset, no recolourable cover. The street-ground gap is closed only by density (buildings covering the ground), as vanilla does.

## Round 35 (2026-11-15): visual remaps from a mod, and plot overlays as a ground repaint

Question: what is the best possible way to get per-player city art? Two engine features not tried before.

### Visual remaps added by a mod: no effect on city art
- The engine keeps each Age's city layouts in separately named bins (`BIN_CTY_ANT_Layout_2HB_Full_A`, `..._City_Center_Full_A`, `..._Palace_Full_A`, `..._Palace_Vacant_Full_A`, and the same for `EXP` and `MOD`), which is the case option D needed. Scripts can also switch remaps: `VisualRemaps.getAvailableRemaps()`, `setRemapState(id, VisualRemapSelection.Enabled|Disabled|Default)`, `saveConfiguration()`.
- Probe mod `experimental/cc-remap-test` (`UpdateVisualRemaps` in game and shell scope): 20 rows. `ART_BIN` Antiquity to Modern for the four layout bins, the two street-section bins (`BIN_LAYOUT_CTY_Hex_Section_AB_Road`, `..._AB_B_Road`) and the eleven house bins (`BIN_ANT_T2_CityBld_*`); controls `ART_BIN` `BIN_Granary(_Scaled)` to `BIN_Museum(_Scaled)` and `BUILDING` `BUILDING_BATH` to `BUILDING_FACTORY`.
- The rows load (listed by `getAvailableRemaps`, state `Default`). Set to `Enabled` in game: no change. Saved and the save reloaded: no change. Enabled at the main menu after a full restart, then the save loaded: **no change**, the city is pixel-for-pixel the Antiquity one (same-camera shots). The controls did nothing either, and `addModelAtPlot("BIN_Granary")` still drew a granary.
- Conclusion: remaps a mod adds are not applied to city art in 1.5.1 (the base game's three are tied to owned content). This closes option D (a global art era) as well as any per-player trick built on switching remaps.

### Plot overlays cover the engine's street paint
- `WorldUI.createOverlayGroup(name, priority).addPlotOverlay().addPlots([plot], { fillColor: 0xAABBGGRR })` is the fill the game uses for tile highlights. On a clipped city tile an opaque fill **covers the engine's street decals completely, in any colour**; at 60% alpha the old streets show as faint ghosts (`sandbox-shots/48-plot-overlay-covers-street-decals.png`). Unlike the decal eraser of round 19 it is not limited to sand and it reaches the tile's edges.
- It also covers what our own layouts paint on the ground: with the fill on, our houses and buildings show but our streets do not, in Modern and Exploration (`sandbox-shots/49-plot-overlay-with-our-houses.png`). The fill is one flat colour per tile.
- Open: streets on top of the fill. Candidates: a partly transparent fill that mutes the faint Antiquity paths more than our higher-contrast paving; street pieces that are real meshes (raised, so the fill does not reach them); the other overlay kinds (`addSpriteOverlay().addSpriteAtPlot`, `addBorderOverlay` styles), not yet working.
- Also listed for later: `Camera.pickWorldPos` (might hit the engine's houses, which would reveal the street pattern the engine chose on a tile).
- Tested the same day: `Camera.pickWorldPosFromPoint` (pixel coordinates) over a tile full of buildings returns the terrain height at every one of 169 sample points (difference 0.00). The pick only hits terrain, so it can't reveal where the engine put houses or which street pattern it chose.

## Round 36 (2026-11-15): looking for the street-pattern formula again

Idea: the engine's street pattern per tile is stable across reloads, so it comes from a formula; if it can be recomputed, our streets can match the engine's on every tile.

- **Measured again, automated** (`tools/street-probe.js`, `tools/street_probe_score.py`): on `CC_Visual_Streets35` the probe clips the city's tiles, draws each candidate (street A or B at six turns) over all tiles in turn and an outside script screenshots each state; the candidate that changes a tile least is the engine's. 31 tiles scored, 24 with a clear winner (`tools/street-labels-streets35.json`): A at 0 degrees 9, A at 60 7, B at 300 4, B at 0 3, B at 60 1. Same five outcomes and proportions as round 18.
- **Not the tile's terrain:** tiles with the same terrain, biome, feature and river flag got different patterns; not the building either.
- **No formula found** (`tools/street_formula_search.py`): about 1.09 million hypotheses. Inputs: plot index, x, y, district id (whole, low and high word), constructible id, simple combinations, each alone and mixed with the map seed (777123) and 777124. Functions: 25 integer hashes and generators (identity, Murmur3 finaliser, Wang, xorshift, SplitMix, PCG, MSVC and Numerical Recipes LCGs, minstd, Knuth, MT19937 first output, FNV-1/1a 32 and 64 over bytes and decimal text, Jenkins, CRC32, Adler) and six pair hashes. Tests: remainder for m = 2..12, every 1 to 3 bit field, and order when sorted by hash value. Nothing explains the labels with as many groups as there are outcomes; the best fits only appear with 7 to 12 groups for a two-way label, which is what chance gives over this many tries.
- By district order and by plot order the labels show no period.
- Conclusion: the pick is very likely drawn from a running random generator inside the engine, or hashed from data scripts can't see. Either way it can't be recomputed from a script. Closed.

## Round 37 (2026-11-15): 3D paving above the ground cover (idea from an outside review)

- Outside review of the brief suggested: after covering the engine's street paint, draw streets from true 3D meshes instead of decals, since meshes render above the cover.
- **Confirmed.** On clipped tiles with an opaque plot-overlay fill, `EAS_HAN_Palace_Floor` and `EAS_MON_Palace_Floor` draw as flat grey flagstone slabs on top of the fill (`sandbox-shots/50-mesh-floors-above-plot-overlay.png`, the two left tiles). They are real meshes with a paved top face. `MED_SPN_SpanishPlaza_road`, `MID_MUG_Grocer_Sidewalk` and `ImprStoneHeads_Patio_Large_A` drew nothing visible alone (decals or tiny); `MID_ABB_Madinat_Platforms` and `MED_SPN_SpanishPlaza` are whole building sets.
- So a paved ground under our art is possible: fill (hides the engine's Antiquity streets) + floor meshes scaled and turned as plazas and street strips + our houses and buildings on top. 339 candidate asset names matched paving-like words; only six were tried.
- Open: a floor piece that tiles cleanly (the palace floors have an irregular outline), slopes and hills (a flat mesh on rough terrain), the fill colour per terrain, seams between tiles, and whether the fill clashes with the game's own tile highlights.
- Already known from round 18: there is no street-free "safe area" inside a tile (the five patterns together cover it), so the review's fallback of avoiding all road footprints does not apply.

## Round 38 (2026-11-15): paved ground under the Modern overlay, first city

- Floor survey (top-down on covered tiles): real meshes with a paved top are `EAS_MON_Palace_Floor` and `EAS_HAN_Palace_Floor` (grey flagstone, about 0.65 tile across at scale 1, irregular outline), `Prop_Base_Tile_01` (light stone square), `WON_Great_Library_Paver_L/M` (sand stone squares) and `Mod2_Euro_Airbase_Runway(_Strip)` (metal grid). The small squares are thick: scaled up to tile size they bury the houses, so they only suit small patches. Names with `_Road` are decals and draw nothing above the cover.
- Prototype on `CC_Visual_Streets35` (35 districts, Steam Engine granted, overlay loaded): on every urban tile without a river, an opaque plot-overlay fill `0xFF9C9690` plus two `EAS_MON_Palace_Floor` at scale 1.45 (turned 0 and 180 degrees) under the overlay's own art. Result: one continuous grey flagstone surface with the Modern buildings on it; the engine's Antiquity streets are gone and nothing crosses (`sandbox-shots/51-modern-overlay-engine-ground.png` before, `52-modern-overlay-paved-ground.png` after).
- Seen in the shot: stepped floor outlines at the paved area's outer edge and next to unpaved tiles; river tiles left unpaved stand out; the layout's grass patches are covered, so the city is all stone; no distinct street lines (the ground is plaza-like).
- Not yet done: built into `cc-visual-overlay.js`; hills and slopes; coast edges; Exploration (needs a warmer floor); interaction with the game's tile highlights (placement, lenses); cost on large maps (2 extra models per tile).

## Round 39 (2026-11-15): scripts can't read pixels; models carry a settable seed

- **No pixel readback from scripts.** No global or method named like screenshot, capture, pixel, snapshot or thumbnail exists; a 2D canvas context can be created but has no `getImageData`. So an in-game script can't look at the ground to recognise the street pattern (an outside program can, which is how the patterns were measured).
- **Model objects are inspectable.** `addModelAtPlot` returns (and `group.getModelByIndex(i)` gives) an object `{id, possibleStates, assetName, seed, alpha}` with `setSeed`, `setState`, `setAlpha`, `setAssetName`, `setAssetNameAndParams`, `setSelectionScriptParams`, `updateSelectionScriptParams`. The engine's own city art is not in any model group (`WorldUI.modelGroupIds` lists only UI groups and ours), so its models can't be reached this way.
- **The seed picks the layout variant.** `BIN_CTY_ANT_Layout_2HB_Full_A` drawn on the same bare tile with `{ seed: 987654321 }` gives a clearly different house and street layout than with seed 1 or 2 (which looked alike). A new model gets a random-looking seed (412803410). So the engine's per-tile pick is a seed-driven bin selection, and scripts can reproduce any variant by seed.
- **The engine's seed per tile is still unknown.** Seed probe (`tools/seed-probe.js`, `tools/seed_probe_score.py`): the engine's layout bin drawn over the engine's untouched city with seed = plot index, plot index + 1, district id (whole, low, high word), constructible id (whole, low, high), x, y, x<<16|y, y<<16|x; 31 tiles. No candidate coincides with the engine's art on any tile (lowest change 1.9 against a per-tile median of about 10; an exact match would be near 0), and no candidate stands out per tile. This scoring is noisy (houses dominate the picture) and does not model the engine's 60-degree turns.
- Untested and promising for the overlay itself: `setSelectionScriptParams` may let a script-drawn bin resolve `[AGE]`, `[BUILDING_CULTURE]` or `[CIV]` to chosen values, which would replace the hand-decoded model tables.

## Round 40 (2026-11-15): the seed-to-pattern rule, measured

- Default seeds of script models are a running counter (412803422, ...423, ...) that only advances for models drawn without a `seed`; it is not tied to the tile or the asset. Districts, constructibles and cities expose no seed.
- **Seed to street pattern, measured** (`tools/seed-map-probe.js`: the Antiquity layout bin drawn on 31 empty land tiles, one seed each, then scored like the street probe). Seeds 1-11, 100, 101, 65537, 131073, 412803410-12: A at 0 degrees. 1000000, 1000001: B at 300. Powers of two: only 2^14 and 2^15 give B at 300 (clear margins); multiples of 16384 cycle A, B, B, A with period 4.
- So **variant = bits 14-15 of the seed**: 0 -> street A, 1 -> B, 2 -> B, 3 -> A (the bin's four variants `AB`, `AB_B`, `AB_B_VAR_A`, `AB_VAR_A` in some order). A script-drawn B layout sits at what the street probe calls 300 degrees; script-drawn bins never came out turned by 60.
- That fits the engine's tiles as "variant from the seed, plus a whole-tile turn of 0 or 60 degrees": A0 and B300 unturned, A60 and B0 turned by 60 (as Modern tiles turn 0 or 60, round 14).
- **The engine's seed is not a simple function of the tile** (`tools/street_seed_search.py`): with the exact rule (bit 14 xor bit 15 = street B) over the 24 measured tiles, 5,199 candidate seed rules (plot, x, y, district and constructible ids and combinations, alone and with the map seed, through 25 hashes and six pair hashes) reach at most 21 of 24, the same as control bit positions (22 of 24). District ids and plot numbers themselves are too small to set bits 14-15 at all, so the engine's seed is a hashed or random 32-bit value.
- Next diagnostic: is the seed drawn at creation (random, then saved) or derived from game state? Build the same district twice from one save and compare; build two districts in both orders.

## Round 41 (2026-11-15): build-order test for the engine's seed

Setup (`tools/order-test.js`): from `CC_Visual_Streets35`, two new urban districts on Roma's free tiles (32,10) and (32,9) with the debug `CREATE_ELEMENT` operation, then the street probe on Roma. Three runs, each from a fresh load of the same save.

| Run | Order | District id at (32,9) | (32,9) pattern | (32,10) pattern |
|---|---|---|---|---|
| 1 | (32,10) first | 3211312 | B at 60 (margin 1.7) | unclear (1.1) |
| 2 | (32,10) first | 3211312 | B at 60 (3.0; one weak reading) | A at 60 (2.8 and 2.2) |
| 3 | (32,9) first | 3145775 | B at 60 (2.0) | unclear (1.1, 1.0) |

- **(32,9) got the same pattern in all three runs, although its district id and constructible id differ between the orders.** So the engine's seed does not come from creation order or from the ids; it is tied to the tile (and survives reloads, round 18). One tile only, the second was not readable in runs 1 and 3.
- Measurement notes: this 13-tile coastal city scores less clearly than the 35-district inland one (water and shore in the discs); the zoomed view (height 250, radius 140) gave the clearest margins. Two captures of the same game differ by 3-10 grey levels per tile on the bare ground (moving cloud shadows and water), so raw screenshots can't be compared between runs directly. A clip set in the same frame as `restoreAllHexHeight` is lost: `street-probe.js` now clips 0.7 s after its reset.
- Consequence: the seed is a function of the location (plot, coordinates or world position, possibly with the map or game seed) through a hash not in the tested list. Deterministic, so in principle findable; and if it depends on the coordinates alone it could be measured once and shipped as a table.

## Round 42 (2026-11-15): same coordinates on fresh maps, the pattern belongs to the map

Question: does a tile's street pattern depend on its coordinates alone (then one measured table could ship), or also on the map? All three maps were made fresh on the current game build (the older test saves no longer load: they ask for mod versions that are gone). Setup from the main menu by script: `GameSetup.setGameParameterValue` for `Map` (`pangaea-voronoi.js`), `MapSize` (`MAPSIZE_TINY`, 60 x 38), `MapRandomSeed`, `GameRandomSeed`, then `engine.call("startGame")`. On each map a Founder was spawned at (19,22), the city founded, the second ring bought, and the same 14 Antiquity buildings placed on the same 14 tiles in the same order (`CREATE_ELEMENT`). Mods active: continuous-civ and cc-remap-test (no effect on city art, round 35).

| Tile | Map A (map seed 1001, game seed 2001) | Map C (map seed 1001, game seed 9999) | Map B (map seed 1966606283) |
|---|---|---|---|
| 18,20 | A at 60 | A at 60 | **B at 0** |
| 20,20 | B at 0 | B at 0 | B at 0 |
| 17,21 | A at 60 | A at 60 | A at 60 |
| 18,21 | B at 0 | B at 0 | **A at 60** |
| 19,21 | A at 60 | A at 60 | A at 60 |
| 20,21 | B at 0 | B at 0 | **A at 0** |
| 18,22 | A at 0 | A at 0 | A at 0 |
| 20,22 | B at 0 | B at 0 | B at 0 |
| 17,23 | B at 60 | B at 60 | **A at 60** |
| 18,23 | A at 60 | A at 60 | A at 60 |
| 19,23 | B at 0 | B at 0 | B at 0 |
| 18,24 | B at 0 | B at 0 | B at 0 |
| 19,24 | B at 300 | B at 300 | **B at 0** |
| 20,24 | B at 0 | B at 0 | B at 0 |

- **Same map seed, other game seed: 14 of 14 tiles identical** (including the rare "B at 60" and "B at 300"). The game seed, start positions and unit/city ids play no part.
- **Other map seed: 9 of 14 identical, 5 differ.** So the coordinates alone do not decide the pattern, and one table for all maps is not possible. The pattern is a property of the map: its seed, or something made from it (terrain, heights).
- 9 of 14 is more than chance would give if all patterns were equally likely, but the patterns are far from equally likely: 23 of the 28 readings are "A at 60" or "B at 0" (the same engine turn, since script-drawn B sits 300 degrees off). With that skew about 5 matches are expected by chance; 9 is suggestive, not proof, of a part that depends on the coordinates.
- Terrain of the tiles on map A/C, for a later search (terrain, biome, elevation, rainfall, ground height z): 19,23 flat plains 927/100/26.91; 18,22 hill plains 993/70/29.09; 19,21 flat tropical 652/80/17.84; 18,21 flat tropical 727/90/19.69; 20,22 flat plains 527/50/13.48; 18,23 hill plains 1023/100/29.92; 20,24 flat plains 678/100/18.47; 19,24 flat plains 799/100/22.22; 17,21 hill tropical 905/100/26.81; 20,20 hill tropical 449/100/10.90; 20,21 flat tropical 463/70/11.55; 18,20 flat tropical 701/100/19.47; 18,24 flat plains 773/100/21.27; 17,23 flat plains 1100/100/32.97.
- Measurement: every reading had a margin of 3.5 or more (most 6-20) after a scorer fix. A passing cloud haze darkens a whole screenshot and had made the old score (mean brightness difference) unreadable; `street_probe_score.py` now compares fine detail only (window minus its own blur, 100 x (1 - correlation)). Camera height 300, radius 140, three views per city. Any window in front of the game spoils the shots (it happened twice).
- Saves: `CC_Seed_MapA`, `CC_Seed_MapA_city`, `CC_Seed_MapB`, `CC_Seed_MapB_city`, `CC_Seed_MapA_gameseed9999_city`. Labels: `experimental/cc-visual-prototype/tools/street-labels-seedmaps.json`.
- Consequence: a mod can't ship a lookup table, but because the pattern is fixed by the map seed, the open question narrows to "seed + location -> pattern". Next cheap tests: two map seeds that differ by 1 (does everything change?), and the same seed with another map script or size (is it the seed number or the terrain?).

## Round 43 (2026-11-15): the pattern is fixed by the coordinates, except on tiles with vegetation

Two more fresh maps and a second site on map A (all tiny, 60 x 38). New helper `tools/seed-city.js` (`CCSeedCity`) builds the same test city on any map and gives the probe rows for the scorer.

- Map D: map seed 1002, Pangaea. (19,22) is ocean there, so the city went to (43,13), where 10 radius-2 tiles are buildable on both A and D; map A got a second city on the same spot.
- Map E: map seed 1001 again, but the Continents script. The game refused a city on (19,22) ("no valid constructions"), so the centre is (19,23); 9 of its tiles were already measured on A and B.

Site (19,22), pattern and feature of the tile on each map:

| Tile | Map A (1001 Pangaea) | Map B (1966606283 Pangaea) | Map E (1001 Continents) |
|---|---|---|---|
| 18,20 | A at 60, rainforest | B at 0, none | |
| 20,20 | B at 0, none | B at 0, none | |
| 17,21 | A at 60, none | A at 60, none | |
| 18,21 | B at 0, none | A at 60, savanna woodland | A at 60, rainforest |
| 19,21 | A at 60, none | A at 60, none | |
| 20,21 | B at 0, rainforest | A at 0, none (mountain) | A at 0, mangrove |
| 18,22 | A at 0, none | A at 0, none | A at 0, none |
| 20,22 | B at 0, watering hole | B at 0, watering hole | B at 0, none |
| 17,23 | B at 60, savanna woodland | A at 60, floodplain | A at 60, none |
| 18,23 | A at 60, none | A at 60, savanna woodland | A at 60, savanna woodland |
| 19,23 | B at 0, none | B at 0, none | (centre) |
| 18,24 | B at 0, none | B at 0, none | B at 0, none |
| 19,24 | B at 300, none | B at 0, savanna woodland | B at 300, none |
| 20,24 | B at 0, none | B at 0, floodplain | B at 0, none |

Site (43,13):

| Tile | Map A (1001) | Map D (1002) |
|---|---|---|
| 42,11 | B at 60, forest | B at 0, none |
| 42,12 | B at 300, oasis | B at 300, none |
| 43,12 | A at 0, none | A at 0, none |
| 44,12 | A at 0, oasis | A at 0, savanna woodland |
| 45,12 | A at 60, none | A at 60, none |
| 44,13 | A at 0, none | A at 0, oasis |
| 43,14 | A at 0, none | A at 0, watering hole |
| 44,14 | A at 60, none | B at 60, savanna woodland |
| 45,14 | A at 60, oasis | A at 60, none |
| 44,15 | B at 0, none | B at 0, none |

- **Whenever neither map has vegetation on the tile (forest, rainforest, savanna woodland), the pattern is the same: 16 of 16 tile pairs, across four map seeds and two map scripts.** Oasis, watering hole, floodplain, hills and a mountain made no difference. E agrees with B (another seed) on 8 of 9 tiles and with A (same seed) on only 6 of 9: the map seed itself is not an input.
- **Every disagreement (7) has vegetation on at least one side.** Of the 9 tile pairs with vegetation on a side, 7 differ and 2 agree (18,23 and 44,12), which is about what a re-rolled pattern would give by chance.
- Round 42 read this as "the pattern belongs to the map"; the map only matters through where its vegetation is. That also explains 14 of 14 with another game seed: same terrain.
- So for tiles without vegetation the engine's seed is a pure function of the coordinates (not found by the hash search, but measurable): **a table measured once could ship with the mod**, at least for this map size. Open: whether the table depends on the map size; what vegetated tiles get (a second fixed table, per feature type, or something else: 18,21 has savanna on B and rainforest on E and both read A at 60; mangrove may not count as vegetation); the turn. The readings here are mostly "A at 60" and "B at 0" at one site and "A at 0" at the other, so the turn is not independent of the place either.
- Measurement cost: about 5 minutes per 14 tiles, so a full 60 x 38 table (2,280 tiles) by this method would take about 14 hours of captures; a faster reader (many tiles per screenshot from higher up, or a formula fitted to a few hundred tiles) is the next thing to build.
- Engine notes: the game's `localStorage` returns one stored value for every key (it made map D's land check wrong; masks now stay in memory). A load sent while the "Begin Game" screen of another load is up is ignored, and a third one crashed the game. Right after a restart, loading these saves fails with "missing ownership entitlements: Napoleon" (linked-account content not registered); making the map again from its seed works.
- Saves: `CC_Seed_MapD_1002_city`, `CC_Seed_MapE_continents1001_city`, `CC_Seed_MapA_two_cities`.

## Round 44 (2026-11-16): wooded tiles follow a second fixed table; the feature type doesn't matter

The game's map-editor calls work from the debug console: `WorldBuilder.MapPlots.setFeature(featureIndex, {x, y})` (also `setTerrain`, `setBiome`, `setResource`, `setOwnership`, ...; `FeatureTypes.NO_FEATURE` removes). So vegetation can be added and removed on the same tiles of the same map, no second map needed. Map seed 1001 (map A) regenerated from its seed, same city and buildings at (19,22).

Swap 1 (features changed before building): the three wooded tiles of map A cleared, seven bare tiles given rainforest, forest, savanna woodland or taiga. Swap 2 (features changed after building, the art refreshed at once): the type changed on four tiles, and the tiles that were wooded on maps A, B and E given vegetation again.

| Tile | Bare (table of rounds 42-43) | Wooded, swap 1 | Wooded, swap 2 | Wooded on maps A/B/E |
|---|---|---|---|---|
| 18,20 | B at 0 | | A at 60 (rainforest) | A at 60 (A, rainforest) |
| 20,20 | B at 0 | A at 60 (rainforest) | A at 60 (forest) | |
| 17,21 | A at 60 | B at 60 (taiga) | B at 60 (savanna) | |
| 18,21 | B at 0 | | A at 60 (savanna) | A at 60 (B savanna, E rainforest) |
| 19,21 | A at 60 | A at 60 (rainforest) | A at 60 (rainforest) | |
| 20,21 | A at 0 | | B at 0 (rainforest) | B at 0 (A, rainforest) |
| 18,22 | A at 0 | B at 0 (forest) | B at 0 (rainforest) | |
| 17,23 | A at 60 | | B at 60 (savanna) | B at 60 (A, savanna) |
| 18,23 | A at 60 | | A at 60 (rainforest) | A at 60 (B, E savanna) |
| 19,23 | B at 0 | B at 60 (forest) | B at 60 (forest) | |
| 18,24 | B at 0 | A at 60 (savanna) | A at 60 (forest) | |
| 19,24 | B at 300 | | B at 0 (savanna) | B at 0 (B, savanna) |
| 20,24 | B at 0 | B at 60 (savanna) | B at 60 (savanna) | |

- Clearing the vegetation gave the bare-table value on all three tiles; untouched tiles kept their pattern.
- **Wooded tiles are a second fixed table**: 6 of 6 agree with the readings of the same coordinates on other maps, with other wooded feature types. The type (forest, rainforest, savanna woodland, taiga) changed nothing on 4 of 4 tiles.
- This matches the layout bins (round 31): Antiquity houses have four plain variants and two `_FOL` variants used on tiles with forest, sagebrush steppe, savanna woodland, taiga or rainforest. Mangrove is not in that list, and the mangrove tile of map E read the bare value. Same seed, other variant list, so a different pick.
- The art follows feature changes live, so the overlay can read features each time it redraws.
- Consequence: per coordinate the mod needs two values (bare and wooded). Both can be measured on one city by toggling vegetation. Save `CC_Seed_VegSwap`.

## Round 45 (2026-11-16): a whole map measured; the street choice is three bits per tile

New whole-map rig, so the table no longer needs one test city at a time:
- `tools/table-map.js` (`CCTable`): founds cities over the whole map with the tuner's `CREATE_ELEMENT` `CITY` (no distance rule), buys every land tile within 3 (`city.purchasePlot` reaches distance 3), and puts an empty urban district on each (`CREATE_ELEMENT` `DISTRICT`, `DISTRICT_URBAN`). Empty urban districts get the street decal like built ones. Such districts are missing from `city.Districts.getIds()`, so the rig and the probe scan the map instead. `CCTable.wood(on)` makes every urban tile forest or bare (`WorldBuilder.MapPlots.setFeature`); `CCTable.views(h)` lists camera spots; `CCTable.pack()` exports each tile's screen position in its most central view.
- `street-probe.js` takes `cityIndex -1` (every district of the local player) and counts past 60 states (marker green channel = state / 60).
- Camera height 900 instead of 300: one view covers about 200 tiles, scored with a 46-pixel disc. Checked first on the 14-tile test city: heights 600 and 900 both gave 14 of 14 the same labels as the close-up, margins 4-14.
- `tools/table_score.py` scores a whole-map run from the packed positions.
- Converting water to land with `WorldBuilder.MapPlots.setTerrain` changes the game data but not the drawn terrain, so the table can only cover land.

Map seed 1001 (tiny Pangaea, 60 x 38): 65 cities, 600 urban tiles, 24 camera views, 13 states each at 6 s: 31 minutes per pass, one pass bare and one wooded.

- **600 of 600 tiles labelled; 25 of 25 known bare tiles and 15 of 15 known wooded tiles (rounds 42-44) agree.** Margins: median 5, 6 tiles under 2 per pass.
- Bare tiles: four labels in almost equal shares, A at 0: 151, A at 60: 149, B at 0: 159, B at 300: 135 (plus 3 stray readings). Wooded tiles: A at 0: 138, A at 60: 149, B at 0: 151, B at 60: 161.
- **Structure**: script-drawn B sits 300 degrees off (round 40), so A at 0 and B at 300 are one engine turn, A at 60 and B at 0 the other (bare); wooded, A0/B0 and A60/B60. On all 593 tiles with both readings clear, **the bare and the wooded pattern share the turn**; the A/B pick of the two is independent (each pair of bare/wooded labels occurs 63-85 times). So per coordinate the engine decides a turn bit, a bare A/B bit and a wooded A/B bit.
- No pattern in space: neighbouring tiles have the same label 24% of the time (chance 25%), and no x/y modulus helps. `street_formula_search.py` on the 594 clear tiles (939,120 hash hypotheses, map and game seed included) explains at best 219: chance level. The engine's hash stays unknown; a measured table is the way.
- Table: `experimental/cc-visual-prototype/tools/street-table-tiny-1001.json` (per tile: bare label, margin, wooded label, margin).
- Open: the map-size check (does a small or standard map give the same bits at the same x, y?), coverage of the coordinates that are water on this map, the city-centre tiles (palace layouts, not measured).

## Round 46 (2026-11-16): the A/B pick depends on the map size, the turn does not

Map seed 1001 again, Pangaea, but **small** (74 x 46) instead of tiny. The rig filled the part with x < 60 and y < 38 (84 cities, 721 urban tiles, `CCTable.bounds`); one bare pass, 24 views. 225 of those tiles are coordinates measured on the tiny map in round 45 (only those were exported: the tiny table's coordinates were sent to the console as a script file, so the export stays small).

- **Turn: 210 of 219 clear tiles agree** with the tiny table (the 9 others have margins 4-7, so probably real; not explained yet).
- **A/B pick: 113 of 219 agree: chance.** The differences are almost all A at 0 against B at 300, or B at 0 against A at 60: same turn, other street layout.
- The plot index (y * width + x) doesn't carry it over either: comparing small (x, y) with the tiny tile of the same plot index gives chance for both bits (26 and 32 of 61), the swapped coordinates too.
- So the engine's A/B pick uses the map size (or something that changes with it), while maps of the same size agree (four seeds and two map scripts in rounds 42-44). A shipped table needs one A/B layer per map size, plus one turn layer that may be shared.
- The game's setup screen had Small selected when this session started, so the user's usual size is probably Small; it is measured next.

## Round 47 (2026-11-16): the small map measured

Map seed 1001, Pangaea, small (74 x 46): 111 cities, 1,001 urban tiles, 35 views, one bare and one wooded pass of 46 minutes each. `CCTable.pack64()` exports the positions in 9 characters per tile (`table_score.py` reads both formats).

- 1,001 of 1,001 tiles labelled in both passes; median margin 5.1 (bare) and 4.9 (wooded), 2 and 0 tiles under 2.
- Bare: A at 0: 272, B at 300: 263, B at 0: 241, A at 60: 225. Wooded: B at 0: 274, A at 0: 261, B at 60: 242, A at 60: 224.
- Bare and wooded share the turn on **999 of 999** clear tiles, as on the tiny map.
- Against the tiny table at the same coordinates (224 tiles): turn 215 the same, A/B 119 (chance), as in round 46.
- Table: `experimental/cc-visual-prototype/tools/street-table-small-1001.json`. Coordinates that are water, mountains or city centres on this map are still missing (1,001 of 3,404).
- The capture script now reads state markers past 420 (green channel up to 21).

## Round 48 (2026-11-16): a second small map; river tiles take their own turn

Map seed 2002, **Continents** script, small: 101 cities, 860 urban tiles (634 coordinates new, the rest shared with round 47), 40 views, bare and wooded passes of 52 minutes. The first capture missed state 0, so view 0's 19 tiles were dropped from the bare pass (`table_score.py` now skips an incomplete view instead of failing).

- 841 + 860 tiles labelled, median margin 5.2 / 5.0, at most 1 under 2.
- Against the small table of round 47: **A/B the same on every shared tile**; 318 of 352 bare and 330 of 364 wooded the same in full. All differences are the turn alone (A at 0 vs A at 60, B at 0 vs B at 300, and so on), and on the same tiles in both layers.
- **Every flipped tile is a river tile on one of the two maps** (map seed 1001 regenerated to check: 18 river only there, 12 only on 2002, 4 on both). Of the 268 shared tiles with no river on either map, 268 agree. River tiles flip about 40% of the time (34 of 83), so a river tile gets a turn from the river instead of the coordinate; the A/B pick is unaffected. Bare and wooded still share the turn on river tiles (91 of 91).
- Earlier "turn mismatches" between tiny and small (round 46, 9 tiles) are probably the same thing; the tiny map's rivers were not recorded.
- Each table file now lists its map's river tiles (`rivers`); `build_street_table.py` leaves them out when merging. Merged small table: **0 conflicts** between the two maps, 1,349 of 3,404 plots known (bare), 1,357 (wooded). `CCStreetTable.lookup` flags river tiles (`river: true`: the angle is unsure).
- Next: the river turn rule (which way the river runs through the tile is the likely input), more small maps for coverage, then the other sizes.

## Round 49 (2026-11-16): a third small map (Archipelago); summary of the night

Map seed 3003, **Archipelago** script, small: 81 cities, 486 urban tiles, 33 views (only views with 6 or more urban tiles), bare and wooded passes of 43 minutes. 482 labelled per pass, median margin 5.2 / 5.0, none under 2.

- Against the merged small table (two maps): **bare 252 of 253, wooded 253 of 254 the same**; the one difference in both is 59,18, a river tile on this map. Three map scripts and three seeds now agree on every non-river tile.
- Merged small table: 1,574 of 3,404 plots known (bare), 1,581 (wooded); tiny: 589 / 592 of 2,280. 0 conflicts.
- River turn rule: on map seed 1001 (small) the river tiles' turn matches the coordinate's turn 27 of 45 times, and no test on which neighbours are river or water tiles explains it (each about 50/50). The game's `Rivers` API (river course) is not available to UI scripts. River tiles stay flagged as unsure.

Where this leaves the overlay: `ui/cc-street-table.js` (`CCStreetTable.lookup(x, y, wooded)`) gives, for a measured coordinate, the street layout (A or B) and angle that match the engine's Antiquity decal. The overlay can then draw its Exploration or Modern street to line up with the decal underneath instead of fighting it. Unknown coordinates, river tiles (angle unsure) and other map sizes need the paved fill (round 38). The lookup is not yet registered in the modinfo or used by `cc-visual-overlay.js`.

Open: the remaining small coordinates (mostly ocean on these maps: more maps, or other scripts), the other map sizes (standard, large, huge), the river turn, whether the Exploration/Modern street sections line up with the Antiquity A/B decals at the same angles (to check visually), the city-centre tiles.

## Round 50 (2026-11-16): river tiles

- **The river course is readable**: the tuner's Rivers panel uses `MapRivers` (UI context): `numRivers`, `getRiverIDByIndex(i)`, `getRiver(id)` (`type`, `isFloodable`, `isFlooded`), `getRiverPlots(id)` (plot indices, from the mouth upstream; side branches are appended after the main stem), `isRiverConnectedToOcean`. Hex directions of `GameplayMap.getAdjacentPlotLocation(plot, d)`: 0 = (x + odd, y + 1), 1 = (x + 1, y), 2 = (x + odd, y - 1), 3 = (x - 1 + odd, y - 1), 4 = (x - 1, y), 5 = (x - 1 + odd, y + 1), odd = y & 1.
- **The river turn is deterministic**: map seed 1001 (small) generated again and its eastern half re-measured: 141 of 141 tiles the same as in round 47, 86 river tiles included. So it depends on the map, not on chance.
- Minor rivers are drawn as streams winding through the middle of tiles on open land; inside urban tiles the engine doesn't draw them at all. River tiles still match the ordinary A/B street decals clearly (median margin 4.3 against 5.3 elsewhere); only the turn changes.
- What predicts the flip (turn different from the coordinate's own turn, known from another map where the coordinate has no river; 87 such tiles on maps 1001 and 2002): **river sources keep the coordinate's turn (11 of 11), tiles next to the sea or a navigable river mostly flip (7 of 8)**, tiles in the middle of a river are mixed (6 flip, 9 same). Overall 38% flip.
- Not explained by: which neighbours are river or water tiles, flow direction from elevation, position along the river, or the river's entry and exit sides relative to the layout (best rule of the form "flip when the river crosses these sides of layout A/B", searched over all side sets: 67 of 87; predicting "no flip" gives 54). Even a free lookup on (layout, entry/exit sides) can explain at most 153 of 216 river tiles, so the sides alone don't decide it. Likely the engine tests its house/blocker attachments against the river's actual curve (round 9: fitting around rivers happens in engine code), which scripts can't read.
- For the overlay: river sources can use the table's turn; other river tiles (about 8% of urban tiles) need the paved fill or a best guess. Tools: the river course export and the rule search are in the session scratchpad (`riverdump.js`, `riverrule.py`); a repo copy can follow if this is taken further.

## Round 51 (2026-11-16): a fourth small map (Shattered Seas); river sources are safe

Map seed 5005, **Shattered Seas** script, small: 103 cities, 848 urban tiles, 370 of them new coordinates. Only views with 4 or more new coordinates were run (31 views, 40 minutes per pass), and only new coordinates, river tiles and every sixth known tile were exported.

- 479 tiles labelled per pass, median margin 4.9 / 4.8. Against the merged small table: bare 103 of 110, wooded 88 of 93 the same; **every difference is a river tile on this map**.
- Merged small table: **1,900 of 3,404 plots** (bare), 1,903 (wooded); 0 conflicts over four maps and four map scripts.
- River dataset now 297 river tiles on maps 1001, 2002 and 5005, 157 of them with the coordinate's own turn known from another map. Flip (turn 60 degrees off the table):
  - **river sources (one river neighbour, not at a mouth): 0 of 71**;
  - mouths (first tile of a river, or next to its navigable part): 29 of 43 (layout A 15 of 26, B 14 of 17);
  - middles: 17 of 43 (sharp bends 0 of 5, gentle 12 of 21, straight 5 of 15).
  Side rules fitted separately to mouths and middles gain only 4-6 tiles over always guessing the majority on about 40 tiles each, so they are not trusted.
- `CCStreetTable.lookup` now returns `river` as false, "source", "mouth", "middle" or "navigable" (worked out from `MapRivers` and cached per map) and `sure` (true off rivers and on sources). The overlay can trust `sure` tiles and pave the rest.

## Round 52 (2026-11-16): a fifth small map (Fractal); sharp river bends are safe too

Map seed 6006, **Fractal** script, small: 97 cities, 835 urban tiles, 228 new coordinates, 25 views (33 minutes per pass). 349 tiles labelled per pass, median margin 4.9 / 4.8.

- Against the merged small table: bare 110 of 123, wooded 110 of 123 the same; **all 13 differences are river tiles on this map** (the same tiles in both layers).
- Merged small table: **2,098 of 3,404 plots** (bare), 2,103 (wooded); 0 conflicts over five maps and five map scripts. New coordinates per extra map are falling (634, 321, 462, 228), as the rest are mostly sea on every script.
- River dataset: 385 river tiles on four maps, 254 with the coordinate's own turn known. Flips: **sources 1 of 113**, **sharp 60-degree bends 0 of 11**, gentle bends 12 of 24, straight runs 8 of 20, mouths 45 of 82 (into the sea on one, two or three sides, short or long rivers: all near 50/50). So mouths and the other middles look like a coin flip from what scripts can see.
- `CCStreetTable.riverKind` now also returns "bend" for a sharp bend, and `lookup(...).sure` is true off rivers, on sources and on sharp bends. On map 6006 that leaves 46 mouth/middle tiles unsure out of about 830 urban tiles (5.5%).

## Round 53 (2026-11-16): the Standard map size

Map seed 7007, **Pangaea** script, **standard (84 x 54)**: 141 cities, 1,394 urban tiles (every usable land tile), 50 views, about 65 minutes per pass. All 1,394 tiles labelled in both passes, median margin 5.1 (bare) / 4.9 (wooded).

- **The turn is shared across map sizes, the A/B layout is not.** Against the merged small table on the 889 shared coordinates: the turn agrees on 859 (the misses are mostly river tiles on one of the maps), while the A/B layout agrees on 467 (chance). Same picture for the wooded layer (431 of 890 the same, and almost every difference keeps the turn). Bare and wooded share the turn on all 1,394 tiles, as on small.
- So each map size needs its own measured A/B table; the turn of a new size can be seeded from any measured size.
- River tiles on this map, judged against the small table's turn: sources 50 the same / 2 flipped, sharp bends 4 / 0, middles 26 / 10, mouths 23 / 18. Same rule as round 52: sources and sharp bends are safe, mouths and the other middles are not.
- `tools/street-table-standard-7007.json` added; `ui/cc-street-table.js` now covers **standard: 1,191 of 4,536 plots** (river tiles of this map left out), small 2,098 of 3,404, tiny 589 of 2,280.

## Round 54 (2026-11-16): a second Standard map (Continents)

Map seed 8008, **Continents** script, standard: 135 cities, 1,245 urban tiles, 783 of them at coordinates not yet in the Standard table. Only views with 4 or more new coordinates were run (41 views, about 55 minutes per pass); new coordinates, river tiles and every sixth known tile were exported.

- 917 tiles labelled per pass, median margin 5.0 (bare) / 4.8 (wooded). Bare and wooded share the turn on all 917.
- Against map 7007 on the 206 shared coordinates: bare 163 the same, wooded 163 the same; **all 43 differences are river tiles on one of the two maps**. So the per-coordinate table holds at Standard size as on small (0 conflicts off rivers over two maps and two scripts).
- Standard table now **1,878 of 4,536 plots** (bare), 1,875 (wooded).

## Round 55 (2026-11-16): a third Standard map (Fractal)

Map seed 9009, **Fractal** script, standard: every usable land tile urban; 47 views with 4 or more new coordinates (about 62 minutes per pass). New coordinates, river tiles and every sixth known tile exported: 695 tiles labelled per pass, median margin 5.0 (bare) / 4.9 (wooded).

- Bare and wooded keep the same pairing as on maps 7007 and 8008 (bare A0/B300 with wooded A0/B0, bare A60/B0 with wooded A60/B60) on every tile.
- Against map 7007 (96 shared coordinates) and map 8008 (103): **all 28 differences are river tiles on one of the maps**. 0 conflicts off rivers over three Standard maps and three scripts (Pangaea, Continents, Fractal).
- Standard table now **2,392 of 4,536 plots** (bare), 2,391 (wooded); 117 river tiles on this map left out.

## Round 56 (2026-11-16): sea turned into land keeps the coordinate's streets

On map 9009, a 9 x 5 patch of open ocean (x 46-54, y 23-27) was turned into flat grassland from the console (`WorldBuilder.MapPlots.setTerrain/setBiome/setFeature`), saved and reloaded (the terrain art only rebuilds on load; before that the patch still draws as sea). The patch was then filled with cities and empty urban districts and probed like a normal map: 40 tiles labelled, median margin 4.6.

- **36 of the 40 tiles have a coordinate measured on maps 7007/8008/9009 (land there): all 36 match.** The other 4 had nothing to compare against.
- So the street choice follows the coordinate even where this map had water: the remaining unknown plots (mostly sea on every measured map) can be measured by turning the sea into land on one test map, instead of hoping a new map script puts land there.

## Round 57 (2026-11-17): the Tiny street table from an all-land map

Map seed 4004, Pangaea, **tiny**, every water and mountain plot turned into grassland (`tools/all-land.js`), then 137 cities and 2,028 urban tiles (`CCTable.run`). 35 views with 4 or more new coordinates, bare and wooded passes of about 46 minutes each.

- 1,616 tiles labelled per pass (new coordinates, river tiles and every 6th known one), median margin 4.7; bare and wooded share the turn on all 1,616.
- Against the earlier Tiny table (map 1001, 120 shared coordinates): every difference is a river tile on this map or a weak reading (margin under 1.3) on the old one.
- Tiny table now **2,031 of 2,280 plots** (bare), 2,029 (wooded), 0 conflicts. The rest are this map's city centres and river tiles.
- New tools: `CCAllLand.rivers()`, `merge_passes.py` (both passes plus rivers into one table file), `table_score.py` writes every candidate's score (`*.all.json`) and takes `CC_STREETS=1` for single-street runs, `street-probe.js` takes other street models (`globalThis.CCStreetProbeStreets`), `CCTable.skip`, `CCTable.preferCentre`, `CCTable.centres()`.

## Round 58 (2026-11-17): each later Age turns its streets by its own bit

Question: the overlay drew Exploration and Modern streets in the Antiquity table's pattern and turn, so they line up with the Antiquity paint underneath. Is that where vanilla puts them?

- **The roads themselves line up**: on the all-land Tiny map (mod on, Antiquity paint), the probe drawing the Exploration A/B roads picked the Antiquity label's own pattern and turn on 162 of 188 tiles (looser fits, median margin 1.3). The Modern road fits best 60 degrees off on most tiles.
- **Vanilla reference games** (both mods parked outside the Mods folder; Augustus with Spain in Exploration, with Mexico in Modern; continents-voronoi tiny, map seed 265426227, the same map in both Ages, checked plot by plot): saves `CC_Vanilla_Exp_Tiny`, `CC_Vanilla_Mod_Tiny`, layouts and top-down shots in `C:\Users\imzth\CivStreetShots\cmp_exp` and `cmp_mod`. The probe with the Modern road on the Modern capital's tiles reads the engine's own Modern street clearly (ratios 3-18), and its turn agreed with the Antiquity table on only 10 of 14 tiles.
- **Vanilla all-land runs**: map seed 4004 tiny again, started in Modern (Mexico) and in Exploration (Spain), the only player (`Configuration.editMap().setMaxMajorPlayers(1)`, other slots `SS_CLOSED`). Founding more than about 95 cities crashed the vanilla Modern game three times (the city count stops rising, then the game closes), so each map was done in two halves of about 80 cities (`CCTable.bounds`), each half from a fresh load. Modern probed with its one road at six turns (7 states per view), Exploration with its A and B roads.
- **Modern**: 2,039 tiles, median margin 7. The turn is 0 or 60 degrees (about half each), **the same on bare and wooded tiles (1,030 of 1,030)**, and **unrelated to the Antiquity table** (each Antiquity label splits about evenly between the two).
- **Exploration**: west half 1,020 tiles, median margin 5.0 / 4.9. **The A/B pick is the Antiquity one (A on A, B on B, 994 of 994)**, wooded and bare pair like Antiquity's, but **the turn is again an independent bit** (about 50/50 against the Antiquity turn).
- So per coordinate the engine keeps one street-layout pick for every Age, and draws a separate turn for each Age. The overlay can't match vanilla and the Antiquity paint at once: on about half the tiles one of them is off by 60 degrees.
- Change: `build_street_table.py` merges `street-table-<size>-<seed>-<age>.json` into per-Age layers, `CCStreetTable.lookupAge(age, x, y, wooded)`; the overlay's `streetPick` uses the owner's own Age layer first (streets, houses and lots where vanilla puts them), the Antiquity table only where that layer has no entry.
- **Exploration east half**: 1,002 tiles bare (median margin 5.1), 929 wooded (one view lost a state). Same result: A/B the Antiquity pick on 859 of 859, turn independent. Exploration layer on Tiny: 1,924 plots (bare), 1,849 (wooded); Modern: 1,939.
- **Overlay vs vanilla, same map** (modded game: Augustus with Rome, both layouts rebuilt with `CCLayout.apply`, Cartography then Academics granted; save `CC_Visual_Tiny_Compare`; `sandbox-shots/58-exploration-vanilla-vs-ours.png`, `59-modern-vanilla-vs-ours.png`, vanilla left): the palace squares match vanilla in both Ages once a bug was fixed (a capital that also held a City Hall drew the City Hall in the palace slot). Still different: the Granary resolves to `MED_ROM_Granary`, a large grey paved block, where vanilla shows gardens and houses; harbour buildings stand further out to sea with a longer pier; vanilla paves more of its streets; some tiles carry fewer houses; the Guildhall resolves to a Mongolian model for Rome. `compare_tiles.py` scores were high on every tile, rural ones included (lighting and the Antiquity rural art), so the side-by-side pictures were judged by eye.

## Round 59 (2026-11-17): Tiny gaps filled; engine variant picks

- **Gap runs** (vanilla, map seed 5005 pangaea tiny turned all land, one game per Age): `tools/gap_mask.js` lists the Tiny plots still missing from an Age's layer; `CCTable.targetFilter` makes only those urban and picks city centres greedily among the other land tiles (49-55 cities, under the vanilla Modern founding limit). Modern 292 tiles (one pass), Exploration 388, Antiquity 230 (bare and wooded); median margins 4.8-7.1.
- Every tile that read differently from the 4004 tables was a river tile on map 4004 (Modern 33 of 76 such tiles flipped, Exploration 22 of 85, Antiquity 21 of 59); plain tiles agreed 6 of 6, 69 of 70 and 6 of 6. So river tiles also turn the later Ages' streets, as in Antiquity, and the per-coordinate tables hold across maps for every Age.
- **Tiny now: Antiquity 2,257, Exploration 2,242 (bare) / 2,232 (wooded), Modern 2,225 of 2,280 plots**, 0 conflicts. The rest were a river or a city centre on every map measured.
- **Which variant the engine draws** among a bin's unconditioned rows (`tools/variant-check.js`: candidates drawn on free tiles next to the vanilla Exploration city, close-ups at the same camera height): Spain's Arena is `MID_ABB_Arena` (the overlay drew `MED_ROM_Arena`, the large grey block in shot 58), but Spain's Kiln is `MED_SPN_Kiln` (not `MID_PER_Kiln`). Neither "first row" nor "own region" explains both, so the engine picks among equal variants per tile; the Guildhall's Mongolian model is the same case. Matching it would need a measured per-building table (like the street table), not a rule.

## Round 60 (2026-11-17): street turns are the same on every map size, in every Age

Vanilla **Small** maps (map seed 6006, pangaea, the only player), cities only on coordinates already measured on Tiny (`CCTable.bounds` 60 x 38, every other tile), probed with each Age's own roads.

- **Modern**: 476 of 476 tiles the same street and turn as the Tiny Modern layer (median margin 7.3).
- **Exploration**: the turn agrees with the Tiny Exploration layer on 438 of 440 tiles; the A/B pick differs from Tiny's on 211 (as Antiquity's does between sizes) but **equals Small's Antiquity A/B on 368 of 368**.
- With rounds 46 and 53 (Antiquity turn shared by Tiny, Small and Standard): per urban tile the engine picks **an A/B street layout per map size** (bare and wooded separately, the same in every Age) and **a turn per Age that depends on the coordinate only**.
- `build_street_table.py` rebuilt on this: one A/B layer pair per map size (from every Antiquity and Exploration table of that size) and one turn layer per Age on a 106 x 66 grid (the Huge map). Where maps disagree the majority wins with at least twice the votes, else the value stays unknown (15 Antiquity turn disagreements, all involving the oldest Tiny table, which has no river list; 3 left unknown). Against the previous table: identical on every Exploration and Modern value and on Small and Standard; 23 Tiny Antiquity turns now follow the majority of the other maps.
- Coverage gained without new measuring: Small now has Exploration streets on 3,160 and Modern streets on 4,450 tile readings (bare plus wooded), Standard 2,715 and 4,450 (before: none). Still needed per size: the A/B layer for its unmeasured coordinates, and the turns outside 60 x 38 for Exploration and Modern (one all-land run on the largest map measures them for every size).

## Round 61 (2026-11-17): a full AI game with the overlay

Modded game (continuous-civ and the prototype), **Small** pangaea, map seed 7777, six civs, the local player's map revealed, AI autoplay for 300 turns (`CCDev.autoplay(300)`, observing as player 0). Logged every 2 minutes: turn, each civ's personal Age and city count, tiles drawn, time of a full `CCVisualOverlay.rebuild()`, overlay errors in UI.log.

- **No crash and no overlay error** in 300 turns.
- Personal Ages diverged as intended: first Exploration city at turn ~130; at turn 226 America Modern while the others were in Exploration; all surviving civs Modern by turn 260.
- **Cost**: a full rebuild (every tile cleared and drawn again) took 6 ms for 12 tiles, 38 ms for 103, 65 ms for 248, 83 ms for 345: about 0.25 ms per tile, so redrawing is not a performance problem on a Small map. (Normal turns only redraw changed tiles.)
- Shot `sandbox-shots/60-autoplay-modern-ai-city.png` (America at turn 301): Modern buildings, squares and palace area in place; walls and wonders left to the engine; the known gaps (sandy unpaved ground, thinner house blocks on some tiles) show here too. Save `CC_Visual_Autoplay_Small_T301`.
- The deployed street table during this game was the one before round 60's restructure (same Tiny values; Small had no Exploration/Modern layer yet), so on this map most tiles used the Antiquity fallback.

## Round 62 (2026-11-17): the game's art files, for paving and walls

New read-only tools: `tools/extract/asset_names.py` (every asset name in Civ VII's art packages, 397,273 in 388 packages) and `tools/extract/bin_rows.py` (every row of an art bin with its condition, unfiltered).

- **Streets are not the paving problem.** The Antiquity, Exploration and Modern street sections (`LAYOUT_CTY_Hex_Section_AB_Road_ANT/_EXP`, `LAYOUT_CTY_MOD_Section_AB_Road`) each carry only `BIN_LAYOUT_CTY_Hex_Section_All_Road_PIL` as an attachment, whose one row is the pillaged look (`[CONSTRUCTIBLE_STATE:PILLAGED]`); the street paint itself is part of each layout, so the overlay's later-Age streets are the real ones (as the probes showed). Modern has no separate paving decal: its asphalt is its street section.
- **Ground pieces in the art** (candidates for the sandy gaps, to test in game): block fills `ANT_Decal_Block_A_Mud*`, `ANT_Decal_Block_A_LimestonePacked*`, `ANT_Decal_Block_A_Road*` (Antiquity) and `EXP_Decal_Block_A_Brick`, `_Brick_Rect_A`, `_Brick_Circle_A`, `_Brick_Organic_A` (Exploration); patches `EXP_Decal_Patch_Flagstone_Puzzle_A`, `EXP_Decal_Patch_Square_Puzzle_A`, `EXP_Decal_Patch_SquareClusters_*`, `EXP_Decal_Patch_Border*`; the only high-priority patches are dirt (`*_DirtRandom_B_highPrio`, `EXP_*_Dirt*_highPrio`). No layout lists these as named attachments, so they are probably carried by the house and building models; the sandy ground in our tiles is likely the Antiquity block fills of the engine's own (clipped) houses, which clipping can't hide. To check in game: which pieces paint the sand, and whether drawing `EXP_Decal_Block_A_Brick*` or the flagstone patches over it reaches vanilla's look.
- **Walls follow the wall building, not the Age**: `BIN_Wall_Segments` / `BIN_Wall_Towers_Static` pick Antiquity segments for `BUILDING_ANCIENT_WALLS` (mud or stone by culture), Exploration for `BUILDING_MEDIEVAL_WALLS`, Modern for `BUILDING_DEFENSIVE_FORTIFICATIONS`. Vanilla does the same, so a later-Age city keeps the walls it actually built; the engine-drawn walls need no overlay work.

## Round 63 (2026-11-17): the sandy ground and the house layouts, in game

**Sand.** On the reference map (continents tiny, map seed 265426227) with the vanilla Exploration city rebuilt in a modded game, tiles were clipped while the player was still in Antiquity: under every city tile the engine paints a flat orange-dirt ground plus its grey Antiquity cobble streets (a farm tile next to it stays green). So the sand is the engine's city ground of the game's Age, not decals of the clipped houses. Vanilla Exploration shows grey cobbles there instead.
- Candidates drawn over clipped ground at a close camera (height 140): `EXP_Decal_Patch_Flagstone_Puzzle_A` and `_Square_Puzzle_A` are small stone patches; `EXP_Decal_Block_A_Brick` at scale 8 fills block interiors with large grey slabs; **`Decal_SpanishPlaza_Floor`** (the floor of Spain's plaza) at scale 2.5 is grey cobblestone close to vanilla's.
- With the overlay on (Cartography granted) and the cobble floor under all 14 city tiles: no visible change from the comparison camera (height 300; the only changed pixels were water), and none either at height 140 (`sandbox-shots/61-paving-vanilla-ours-floor.png`: vanilla, ours, ours with floor). So ground decals drawn under the overlay's tiles don't show; the same decal shows on clipped tiles without the overlay. Open: why (decal priority against the overlay's street and house pieces, or the group's draw order); a model rather than a decal may be needed.

**House layouts** (vanilla Exploration all-land save `CC_Vanilla_AllLand_Exp_West`, mods parked). `street-probe.js` takes per-tile candidates (`globalThis.CCProbeCands`) and can leave tiles unclipped (`CCProbeNoClip`); `tools/analysis/house_score.py` compares each clipped candidate with the engine's own picture from an unclipped run of the same views.
- Candidates per tile: the two plain house layouts of the tile's street pattern (`..._AB` / `_AB_VAR_A`, B: `_AB_B` / `_AB_B_VAR_A`) at the street's turn and turned 180 degrees. From height 900 (1,020 tiles) and 300 (142 tiles): no candidate reproduces the engine's picture (distances about 80-90 out of 100); the houses follow the street's turn on about 80% of tiles (114 of 142), the variant stays unresolved.
- Cause (`sandbox-shots/62-houses-engine-vs-layout-only.png`): the engine fills every lot of these empty urban tiles, while a layout drawn alone leaves its two building lots as grass. The engine's own house-layout bin (`tools/extract/bin_rows.py BIN_CTY_EXP_Layout_2HB_Full_A`) has no building-count condition: four plain variants (A, A_VAR_A, B, B_VAR_A), the "Less" layouts for SAM/SEA/PAC/NAM/SAF cultures, the `_FOL` layouts on forest, sagebrush steppe, savanna woodland, taiga and rainforest. This is the rule the overlay already follows (`pickLayout`); the empty lots get the vacant-plot pieces, which the overlay draws and the probe candidates did not. Modern's bin has only `LAYOUT_CTY_MOD_Section_AB_Small_Packed` and its `_FOL` version: nothing to pick.
- Still open: the engine's per-tile pick between a layout and its `_VAR_A` (a probe with the vacant-plot pieces in the candidates), and whether "Less" or `_FOL` wins for a SAM/SEA/PAC/NAM/SAF owner on a wooded tile (the bin lists the culture rows first).

## Round 64 (2026-11-17): paving pieces drawn by the overlay itself

`CCVisualOverlay.setGround(age, model, scale, last)` (test switch) adds a paving piece to every tile of that personal Age, first or last among the tile's parts, in the tile's own model group. Reference map and rebuilt Exploration city as in round 63, camera at height 140, orange-ness of the city measured as mean red minus blue:

| Piece | Effect |
|---|---|
| none | 36.9 |
| `Decal_SpanishPlaza_Floor` at 2.5, first | 36.2 (slightly greyer around streets) |
| same, last | 35.2 |
| same at 4.5, last | lighter, still mostly orange |
| `EXP_Decal_Block_A_Brick` at 8, last | no visible change |
| `MED_ROM_Arena_Decal` at 1, last | no visible change (the same decal shows fully opaque under a real Arena) |

So ground decals drawn on the overlay's tiles barely show, whatever their order or size, while the same decals show on clipped tiles without the overlay and under the engine's own buildings. The engine's city ground of the game's Age seems to win over script-drawn decals on city tiles. Paving needs something other than a decal (a flat model, or a building whose own ground decal the engine draws); left open. Other ground decals found on the way: `Decal_RomanForum_Floor_Pattern`, `MED_SPN_Temple_Decal`, `MED_SPN_Bank_Decal`, `EEU_EXP_Palace_Decal`, `GEN_MOD_Vacant_02_Decal`.

## Round 65 (2026-11-17): the Exploration house variant follows the tile's second street bit

House-layout probe again (round 63), on the vanilla Exploration all-land save, 12 close views (height 300), with each candidate now drawn as the overlay draws it: the house layout at the street's turn plus the vacant-plot piece in both building lots (`street-probe.js` candidates may be several pieces). Candidates: the plain layout and its `_VAR_A`.

- Absolute match is still weak (distances about 94; the house slots are themselves bins with per-slot variants), but the decision is stable: the same winner at window radius 120 and 90 on 181 of 204 tiles (47 of 47 where both are clear), and on 43 of 52 tiles shared with round 63's run.
- **Street pattern A: the variant equals the tile's wooded-street A/B pick** (the second A/B bit of `CCStreetTable`): wooded A -> the plain `LAYOUT_CTY_EXP_Hex_Section_AB`, wooded B -> `_AB_VAR_A`, on **104 of 104** tiles (no ratio threshold needed). The Exploration turn, the Antiquity and Modern turns and coordinate parity each split about 50/50.
- Pattern B: no signal (its two layouts look alike from above); the overlay keeps its own pick there.
- So the engine reuses one per-tile bit for the street layout of wooded tiles and the house variant of bare tiles. The overlay now picks Exploration pattern-A house layouts this way (deployed, not yet looked at in game).
