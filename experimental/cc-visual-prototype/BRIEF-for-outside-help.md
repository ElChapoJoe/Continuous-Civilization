# Brief: per-player city architecture in a Civilization VII mod

I'm looking for new ideas on a modding problem in Civilization VII (version 1.5.1, PC). Everything below has been tested in the running game unless marked otherwise. Please suggest approaches I have not tried; the "already ruled out" list is long on purpose.

## The goal

My mod ("Continuous Civilization") removes Age transitions. The game Age stays Antiquity forever, and each player moves through "personal Ages" (Antiquity, Exploration, Modern) by their own research. I want each player's cities to look like their personal Age: Modern Rome next to Antiquity Russia, at the same time, in the same game. It is display only; gameplay already works.

## Constraints

- Must ship as a normal Steam Workshop mod: SQL/XML data and UI JavaScript only. No new compiled code.
- No reverse engineering, memory reading or patching of the game executable.
- Display only: nothing may change the game simulation (multiplayer must stay in sync).
- Must work on random maps and survive save and reload.
- Firaxis has not released art-package tools, so a mod cannot add or replace models, textures or art bins.

## How the game draws cities

- City art comes from art packages (`Base/Platforms/Windows/BLPs/StandardAsset.*.blp`). They hold "bins": lists of model variants, each with a condition such as `[AGE:AGE_MODERN]`, `[BUILDING_CULTURE:BUILDING_CULTURE_MED_ANT]`, `[CIV:...]` or `[CONSTRUCTIBLE_STATE:COMPLETED]`. Other condition keys exist for per-tile state: `DISTRICT`, `BUILDING`, `IMPROVEMENT`, `ROUTE`, `FEATURE`, `TERRAIN`, `BIOME`, `RESOURCE`, `RIVER`, `WONDER`.
- `[AGE:...]` is the single game-wide Age. It decides the era of city layouts (streets, filler houses), the palace, bridges and countryside props. Individual buildings already use their own Age's model, so only the filler, streets, palace and rural art are stuck in Antiquity.
- Each Age's city layouts are separate named bins: `BIN_CTY_ANT_Layout_2HB_Full_A`, `..._City_Center_Full_A`, `..._Palace_Full_A`, `..._Palace_Vacant_Full_A`, and the same with `EXP` and `MOD`. House bins: `BIN_ANT_T2_CityBld_*`, `BIN_EXP_T2_CityBld_*`, `BIN_MOD_T2_CityBld_*`. Street sections: `BIN_LAYOUT_CTY_Hex_Section_AB_Road`, `..._AB_B_Road`, `BIN_LAYOUT_CTY_MOD_Section_AB_Road`.
- A layout piece bundles a painted street texture (a ground decal) with attachment slots for houses and the tile's real buildings. For an Antiquity urban tile the engine picks one of four layout variants and a turn. Measured outcomes: street pattern A at 0 degrees, A at 60, B at 0, B at 300, rarely B at 60.
- The engine's placement is compiled C++: it fits houses around rivers, coasts and cliffs and fills gaps between tiles (Modern only).
- Building culture (regional style) is per civilization, from the database table `VisArt_CivilizationBuildingCultures`. The renderer reads it once; changing it later has no effect.

## What scripts can do (UI JavaScript API)

- `WorldUI.createModelGroup(name)`, then `group.addModelAtPlot(assetName, {x, y}, {x, y, z} offset, {placement, scale, angle, tintColor1, tintColor2})`: draws any asset, layout or bin at a tile, client-side. Also `addModelBetweenPlots`, `addModelAtPos`, `addModelsOnPlots`. Bins drawn this way resolve `[AGE]` to the game Age and do not use the tile owner's culture.
- `WorldUI.clipHexHeight(plot, height)`: hides everything the engine draws on a tile above that height (`restoreHexHeight` undoes it). It does NOT hide ground decals (painted streets). It does not hide riverside houses on navigable-river tiles.
- `WorldUI.createOverlayGroup(name, priority)` with `addPlotOverlay().addPlots([plot], {fillColor})`: the flat colour fill used for tile highlights. Also `addBorderOverlay`, `addHexGridOverlay`, `addLandmarkOverlay`, `addSpriteOverlay` (`addSpriteAtPlot`, `addSpriteAtPos`, `addTextAtPlot`; I could not get a sprite to draw).
- `WorldUI.createSpriteGrid` (camera-facing icons), `triggerVFXAtPlot`, `addBackgroundLayer`, `pushRegionColorFilter`, `loadAsset`, `getAssetNames()` (25,908 names), `getPlotLocation`, `getScreenPos`.
- `Camera.pickWorldPos`, `pickWorldPosFromPoint`, `pushCamera`.
- `VisualRemaps` (`getAvailableRemaps`, `setRemapState`, `saveConfiguration`) and the modinfo action `UpdateVisualRemaps` with rows of Kind `UNIT`, `BUILDING` or `ART_BIN` (From, To).
- `Database.query('gameplay', sql)` can write the gameplay database at runtime.
- `Players.get(id).Ages.age` exists per player but cannot be set.
- There is no function that reports which models, layout variant or decal the engine placed on a tile.

## What I built

An overlay, per tile of every player in a later personal Age:
1. `clipHexHeight(tile, 0)` hides the engine's buildings and houses.
2. Redraw the tile from the game's own models: that Age's street layout and house layout, each real building as the model the engine would choose for the owner's culture and Age (decoded from the art bins), in the engine's own lots (decoded from layout data), with owner colours.

It works: it is per player, updates on research, survives reloads, and is display only. By eye it is about 80-85% of a vanilla Modern city and 60-65% of a vanilla Exploration city.

## The main remaining flaw

The engine's Antiquity street decal stays painted on the ground under my art. On about 70% of tiles its pattern or turn differs from the one I draw, so two street networks cross, and my building lots can sit on an engine street. Fixing this needs ONE of:
- knowing which pattern the engine picked for a tile (then I draw the same one), or
- removing or covering the engine's street decal, or
- making the engine draw a different Age's layout itself.

## Already ruled out (tested)

Engine-native art:
- Setting a player's Age from script: ignored. No game effect sets it.
- Changing `VisArt_CivilizationBuildingCultures` at runtime or at load: no effect.
- Visual remaps from a mod: I added 20 rows (`ART_BIN` Antiquity to Modern for the four layout bins, both street-section bins and all eleven house bins; controls `BIN_Granary` to `BIN_Museum` and `BUILDING_BATH` to `BUILDING_FACTORY`). The game lists them, but enabling them changes nothing, in game, after a save reload, or enabled at the main menu after a full restart. Script-drawn bins are not remapped either. The base game's own three remaps are tied to owned DLC content.
- `WorldUnits.setAgeStyle` only picks cosmetic unit variants within the current Age.

Covering or removing the street decal:
- `clipHexHeight` at any height, including negative: decals stay.
- Drawing other decals on top (brick, flagstone, plaza, road pieces): they do not cover it. Only high-priority sand-coloured dirt patches (`EXP_Decal_Patch_DirtRectangle_A_highPrio`) cover it, and they also erase my own street decals.
- `tintColor1/2` on decals: no effect (tint only reaches 3D models).
- Plot overlay fill: an opaque fill covers the engine's street decal completely, in any colour. But it also covers my own painted streets (only 3D models show above it), it is one flat colour per tile with a hard hexagon edge, and it shares the system the game uses for highlights.

Finding out which pattern the engine picked:
- No API reports it. `Camera.pickWorldPosFromPoint` over a tile full of buildings returns bare terrain height at all 169 sample points, so it cannot "feel" the houses.
- Scripts cannot read screen pixels.
- The pick is stable across save and reload, but I found no formula. Measured 24 tiles reliably (by drawing each candidate over the engine's ground and taking the least-changed one from screenshots outside the game), then tested about 1.09 million hypotheses: inputs were plot index, x, y, district id (whole, low word, high word), constructible id, simple combinations, alone and mixed with the map seed; functions were 25 integer hashes and generators (identity, Murmur3 finaliser, Wang, xorshift, SplitMix, PCG, MSVC and Numerical Recipes LCGs, minstd, Knuth multiplicative, MT19937 first output, FNV-1/1a 32 and 64 over bytes and over decimal text, Jenkins, CRC32, Adler) plus six pair hashes; tests were remainder for m = 2..12, every 1 to 3 bit field, and order when sorted by hash value. Nothing beat chance.
- Not the tile's terrain, biome, feature, river or building: identical tiles got different patterns.
- Not position relative to the city centre or the map centre (rings, sectors, parity), and not inherited from the neighbour nearer the centre.
- Sample of the data (x, y, district id, pattern): (17,15, 2555942, A0) (19,15, 2687016, B0) (20,15, 2359331, A60) (17,16, 2293794, B300) (18,16, 1572887, A0) (20,16, 1441813, A0) (21,16, 2424868, A60) (16,17, 2228257, B0) (17,17, 1376276, B300) (18,17, 1048591, B60) (20,17, 1507350, A0) (21,17, 2490405, A0) (16,18, 2162720, A60) (17,18, 1310739, A0) (18,18, 917517, A60) (20,18, 1114128, A0) (21,18, 1703961, A60) (22,18, 2752553, A0) (16,19, 3080238, B300) (17,19, 1900572, A60) (20,19, 1769498, A0) (17,20, 3014701, B300) (18,20, 1835035, A60) (21,20, 2883627, B0). Map 60 x 38, map seed 777123, city centre at (19,18). District ids are `(n + 1) * 65536 + n` in creation order.

## Questions

1. Is there any way, within the constraints, to learn which layout variant and turn the engine placed on a tile, or to force a specific one?
2. Is there a way to hide, replace or blank the engine's street decals for specific tiles without covering my own decals? For example a decal draw-order or priority trick, a per-tile state the art conditions react to (`ROUTE`, `DISTRICT`, `CONSTRUCTIBLE_STATE`, pillaged or under-construction states that use a different street bin such as `LAYOUT_CTY_Hex_Section_All_Road_PIL` or `..._Road_Construction`), or anything that makes the engine skip the layout on a tile.
3. Why would mod-added `VisualRemaps` rows be ignored, and is there a known way to make an `ART_BIN` remap take effect?
4. If the pattern comes from the engine's running random-number generator, is there any deterministic trick to synchronise with it or reset it from script?
5. Can my own streets be drawn above a plot overlay fill, or can a ground texture of my own be projected on a tile (sprite overlay, VFX, background layer)?
6. Any other approach that gets a later Age's city art per player.
