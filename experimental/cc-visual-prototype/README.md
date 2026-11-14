# Visual prototype (experimental)

A separate, opt-in mod that gives each civilization city architecture from its own personal Age, so a Modern Rome can stand next to an Antiquity Russia. **Not part of the released mod.** Display only: it never changes the game simulation.

## Status (pinned 2026-11-14)

Paused here. Work happens on the `experiment/visual-overlay` branch; the full log of what was tried and measured is in `docs/visual-progression-investigation.md` (rounds 1-33).

**Estimated closeness to vanilla, by eye at normal zoom:** Modern cities about 80-85%, Exploration about 60-65%.

| Part | State |
|---|---|
| Buildings | The model the engine would pick for the owner's cultures and personal Age, in the engine's lots and turns (read from its layout data) |
| Palace / capital square | Engine layout, palace in its slot at the engine's turn, Exploration and Modern. Missing: the spiral topiary in the garden beds |
| House rows | The engine's own house layout, chosen like its layout bins (forest version on wooded tiles, "Less" version for some cultures in Exploration); next to cliffs, water or mountains drawn slot by slot without the slots on the rocks or beach |
| Empty building lots | The engine's vacant-plot piece of the owner's Age |
| Owner colours | Banners, awnings and roof stripes in the owner's colours |
| Harbour tiles | Wharf, shipyard and quay on the shore side with a pier; the engine's piers are longer and more numerous |
| Rural tiles (Modern) | Farms, woodcutters, mines, clay pits, camps, quarries, pastures, plantations in Modern art. Farms are sparser than vanilla; the mine's rock colour differs; pastures lack fence rails; plantations lack their vat and racks |
| Streets and ground | Our streets are drawn, but the engine's own Antiquity street pattern stays painted underneath, and on about 70% of tiles it differs from ours. Nothing in the game can paint over it except sand-coloured patches (the "eraser", off by default) |

**Known limits (not fixable from scripts as far as we found):** the engine turns some tiles at random (Antiquity: 5 street patterns; Modern: 0 or 60 degrees) in compiled code; navigable-river tiles are left to the engine because the clip can't hide their houses; walls and wonders are left to the engine.

**Next candidates if work resumes:** the Modern river-city ground pieces (`River_City_I_*_MOD_Decal`) for river tiles; `addModelBetweenPlots` for edge pieces; topiary and fence rails (spline pieces that don't draw on their own); the mine's resource-dependent rock; Exploration capitals checked on screen; city ownership changes and multiplayer.

## How it works
For every city-centre, urban and (in Modern) rural tile of a player whose personal Age is later than Antiquity:
1. `WorldUI.clipHexHeight(plot, 0)` hides everything the engine draws on the tile above ground (not ground paint).
2. The tile is composed again from the game's own models, drawn with `addModelAtPlot` in the owner's colours:
   - the street section and house layout of the owner's Age, chosen and placed from the engine's own layout data;
   - each completed building on the tile, as the model the engine would choose for the owner's building cultures (`VisArt_CivilizationBuildingCultures`) and personal Age, in the engine's lot for it;
   - the vacant-plot piece in empty lots; Modern rural improvements; harbour buildings on the shore side.
3. Tiles with a wonder, navigable-river tiles and walls are left to the engine.

| Owner's personal Age | Result |
|---|---|
| Antiquity | engine art, untouched |
| Exploration (Cartography, Astronomy or Machinery) | Exploration streets, houses and squares; buildings in the owner's style; camps |
| Modern (Academics, Steam Engine or Military Science) | Modern streets, houses and squares; buildings in the owner's style; Modern rural improvements |

## Data read from the game
All generated from the installed game's art packages (`Base/Platforms/Windows/BLPs/*.blp`). They hold only asset names and numbers; no art is copied, the game draws its own models. Rerun after a game patch (set `CIV7_DIR` to the game folder or pass its `Base` folder):

| Tool | Writes | What |
|---|---|---|
| `tools/extract_building_art.py` | `ui/cc-building-art.js` | Which art bin each building uses, and per bin the model for each building culture and Age (32-byte bin records, FNV-1a model hashes, string-table indexes) |
| `tools/extract_layout_slots.py` | `ui/cc-layout-slots.js` | The attachment slots of the house layouts: model, position, turn, scale per slot (40-byte transform record before each slot's name record) |
| `tools/decode_layouts.py LAYOUT_NAME` | (prints) | The slots of any layout, for checking |

`tools/sandbox.js` (`CCSandbox`) and `tools/bench.js` (`CCBench`) are debug-console helpers for test games: placing buildings, granting techs, framing top-down shots. They change the game state and are not part of the mod.

## Debug switches
From the debug console: `CCVisualOverlay.rebuild()`, `.reset()` (engine art back), `.tile(x, y)` (what is drawn on a tile), `.setErase(true|false)` (the street eraser test), `.personalAge(player)`.

## Practical notes
- **Changing the modinfo needs a full game restart**; `UI.reloadUI()` re-reads scripts but not the script list.
- **Never call `clipHexHeight` without its height argument**: that crashes the game.
- Loading the overlay script by hand on the debug console registers its event handlers again, so a camera move can redraw it after `reset()`; check `WorldUI.modelGroupIds` before taking an "engine only" screenshot.
- Models take a second or two to load after a tile is drawn.

## Try it
Copy `cc-visual-prototype.modinfo` and the `ui` folder to `%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\Mods\cc-visual-prototype`, then restart the game. It's enabled automatically and also applies to existing saves. Delete the folder to remove it.
