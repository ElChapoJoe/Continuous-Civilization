# Brief: per-player city architecture in a Civilization VII mod

I'm looking for workarounds to a modding problem in Civilization VII (version 1.5.1, PC). Everything below has been tested in the running game unless marked otherwise.

## The goal

My mod ("Continuous Civilization") removes Age transitions. The game Age stays Antiquity forever, and each player moves through "personal Ages" (Antiquity, Exploration, Modern) by their own research. I want each player's cities to look like their personal Age: Modern Rome next to Antiquity Russia, at the same time, in the same game. It's display only; gameplay already works.

## How the game draws cities (what we know)

- City art comes from art packages (`Base/Platforms/Windows/BLPs/StandardAsset.*.blp`). These hold "bins": lists of model variants, each with a condition such as `[AGE:AGE_MODERN]`, `[BUILDING_CULTURE:BUILDING_CULTURE_SAM_MOD]` or `[CONSTRUCTIBLE_STATE:COMPLETED]`.
- **`[AGE:...]` is the single game-wide Age.** It decides the era of city layouts (streets, houses), the palace, the city hall, bridges and countryside props. Because my mod keeps the game in Antiquity, every city is drawn in Antiquity style.
- **Building culture is per civilization**, from the database table `VisArt_CivilizationBuildingCultures` (Rome: `MED`, `MED_ANT`, `MED_EXP`, `SAM_MOD`, ...). Changing this table at runtime, or at load time with a save reload, had **no visible effect**: the renderer takes the culture from somewhere else.
- **The engine's placement algorithm is compiled C++.** It fits houses around rivers, coasts and cliffs, joins each city tile's streets to its neighbours into one network, turns each tile in 60-degree steps, and fills gaps between city tiles with extra buildings (in Modern only). None of it is in the art data. The art bins themselves are simple (one street piece, one house piece, trees on forest tiles).
- The art data contains road-style street pieces chosen by connection shape (`BIN_TER_Decal_Route_Layout_Straight`, `Bend60`, `Bend120`, `YLeft`, `YRight`, `YSplit`, `Trident`, `X`, `Adjacent3` to `Adjacent6`), and gap filler (`LAYOUT_CTY_MOD_Wedge`, `BIN_CTY_MOD_Wedge_Filler`, empty in Antiquity and Exploration).

## What mods can do (scripting API exposed to UI JavaScript)

- `WorldUI.createModelGroup(name)`, then `group.addModelAtPlot(assetName, {x, y}, {x, y, z} offset in tile units, {placement, scale, angle in degrees})`: draws any art asset or bin at a tile, client-side only. Bins drawn this way resolve `[AGE]` to the game Age and do **not** use the tile owner's culture.
- `WorldUI.clipHexHeight(plot, height)`: hides everything the engine draws on a tile above that height. `restoreHexHeight` and `restoreAllHexHeight` undo it. **Ground decals (painted streets and paving) are not hidden**, at any height. On navigable-river tiles it doesn't hide the riverside houses at all. The engine redraws a city's tiles when the city changes, which undoes the clip.
- `WorldUI.getAssetNames()` lists all 25,908 asset names. There is no way to query which models the engine placed on a tile, or their positions or rotations.
- `WorldUnits.setAgeStyle(unit, 1|2|3)` only picks a cosmetic unit variant within the current Age.
- `VisualRemaps` (`UpdateVisualRemaps`, Kind `ART_BIN`) can swap one art bin for another, but only globally, chosen in the options menu before a game starts.
- Gameplay database writes are possible at runtime (`Database.query('gameplay', sql)`), but the renderer doesn't re-read the art tables.
- I searched the executable's strings: no per-player or per-city art Age. The only Age settings are the start Age, the Age-transition data and the unit `setAgeStyle`.
- Mods can't ship new compiled code. Art-package modding tools haven't been released.

## What I built (the prototype)

For each city tile of a player in a later personal Age:

1. Hide the engine's art with `clipHexHeight(tile, 0)`.
2. Redraw the tile myself from the game's own models, using the right Age's streets and houses, and each building actually on the tile in the owner's regional style. The model choices come from decoding the art bins: each bin entry is a 32-byte record holding the FNV-1a hash of the model name, a model index and a condition index into the package's string table.

It works: Modern Rome sits next to Antiquity Russia, it updates on research, survives turns and save loads, and is display-only.

**Why it still looks wrong:** I'm hand-placing pieces the engine would place with its algorithm.

- **Street ground:** the engine's painted streets stay under my models, turned the engine's way (for example the capital's square at about 330 degrees), while my streets sit at my own turn, so the two cross.
- **Missing density:** I don't draw the Modern gap filler between tiles.
- **River tiles:** I can't hide the engine's art there, so I leave them Antiquity.
- **Countryside:** farms, rural houses and props stay Antiquity; I don't touch them.
- **Shore and cliff tiles:** sparser than the engine's, because I can't fit houses around the terrain.

## Constraints

- No reverse engineering or patching of the game executable (it's against the licence, and it would break with every patch).
- It must work on procedurally generated maps and keep working when a save is reloaded.
- Display only: nothing may change the game simulation, so multiplayer stays in sync.
- Must ship as a normal mod (SQL/XML data and UI JavaScript), from the Steam Workshop.

## Questions

1. Is there any known way to make the renderer evaluate `[AGE:...]` per player, per city or per tile? For example, a hidden parameter on `addModelAtPlot`, a per-player visual setting, or a database table the renderer does read at runtime.
2. Can a city's or tile's art be forced to rebuild with different conditions (an engine event, a debug or tuner command, or the FireTuner panels)?
3. Is there a known way to read the engine's placed models on a tile (positions and rotations), so a redraw could copy its layout?
4. Can the engine's street-network rule be inferred from data, for example from the street connection pieces (Straight/Bend/Y/X/Adjacent) and which neighbouring tiles are city tiles?
5. Any other approach that gets the engine's own placement for a later Age without a game-wide Age change?

Known fallback: a game-wide art Age switch (change the game Age for everyone at once). It gives correct art but isn't per player.
