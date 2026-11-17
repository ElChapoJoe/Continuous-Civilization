# Visual prototype (experimental)

A separate, opt-in mod that gives each civilization city architecture from its own personal Age, so a Modern Rome can stand next to an Antiquity Russia. **Not part of the released mod.** Display only: it never changes the game simulation.

## Current state (2026-11-16)

Active again, on the `experiment/visual-overlay` branch. This section is the short version; the full log of what was tried and measured is `docs/visual-progression-investigation.md` (rounds 1-56).

**Plan (set 2026-11-16):** finish **Tiny** completely before any other map size: its whole street table, rural improvements, rivers and capitals; then Exploration and Modern each compared tile by tile against a vanilla game of that Age on the same Tiny map; about 3 test games until they match; only then the other map sizes.

| Part | State |
|---|---|
| Buildings | The model the engine would pick for the owner's cultures and personal Age, in the engine's lots and turns (read from its layout data). Among equal variants we pick by our own per-tile number, not the engine's |
| Streets and ground | Per coordinate the engine keeps one street-layout pick (A/B) for every Age but draws **a separate turn for each Age** (round 58). The overlay draws streets, houses and lots where **vanilla of the owner's Age** puts them (`CCStreetTable.lookupAge`, measured in vanilla Exploration and Modern games), and falls back to the Antiquity table elsewhere. So on about half the tiles the Antiquity paint underneath (which nothing can hide) runs 60 degrees off our streets. Tested in game on Tiny against vanilla (round 58) |
| Street table coverage | Antiquity: Tiny 2,257 of 2,280 plots, Small 2,098 of 3,404, Standard 2,392 of 4,536. Exploration: Tiny 2,242 (bare) / 2,232 (wooded). Modern: Tiny 2,225. The Tiny rest were a river or city centre on every map measured. Other sizes have no Exploration/Modern layer yet |
| River tiles | Sources and sharp bends keep the coordinate's turn; other river tiles (about 5% of urban tiles) flip about half the time by a rule not found yet. Next idea: read the river's channel from terrain heights |
| Palace / capital square | Engine layout, palace in its slot at the engine's turn (measured on 3 vanilla capitals). Missing: the spiral topiary. City-centre ground not yet checked against the street table |
| House rows | The engine's own house layout, chosen like its layout bins; next to cliffs, water or mountains drawn slot by slot without the slots on the rocks or beach |
| Empty lots, owner colours, harbours | Vacant-plot pieces; banners, awnings and roof stripes in the owner's colours; harbour buildings on the shore side (the engine's piers are longer and more numerous) |
| Rural tiles | Modern farms, woodcutters, mines, clay pits, camps, quarries, pastures, plantations; Exploration camps. Drawn at the tile centre, unturned, with fixed variants (farm B): the engine's variant and turn per tile are not measured yet. Antiquity farm paths stay painted underneath. Pastures lack fence rails, plantations their vat and racks |

**Known limits:** the engine's Antiquity ground paint can't be removed, only matched; navigable-river tiles are left to the engine (the clip can't hide their houses); walls and wonders are left to the engine; spline pieces (topiary, fence rails) draw nothing when placed alone (not yet tried: placing their segments one by one, `addModelBetweenPlots`).

**Tiny vs vanilla (2026-11-17, `sandbox-shots/58-*`, `59-*`, vanilla left):** palace squares now match vanilla in both Ages (a capital that also had a City Hall drew the City Hall in the palace slot: fixed). Still different: some buildings use another of their bin's equal variants than vanilla (the large grey block in shot 58 is `MED_ROM_Arena` where vanilla drew `MID_ABB_Arena`; the Guildhall's Mongolian model is the same case): the engine picks among those per tile (round 59); harbour buildings sit further out to sea than vanilla's, with a longer pier; vanilla paves more of its streets (grey cobbles in Exploration, asphalt in Modern) where ours show the sandy Antiquity ground; some tiles have fewer houses than vanilla; 

**Next, in order (Tiny):** the harbour and street-paving differences above (the game's only high-priority ground patches are sand-coloured dirt, round 38: the street eraser built on them was removed, so paving needs another way, e.g. a later-Age decal or model drawn over the ground); the engine's per-tile pick among equal building variants (a measured table per building, if worth it); rural tiles (variant and turn per tile); then a second comparison game. Then the other map sizes (Standard: forest pass of `CC_AllLand9009_Cities`, steps in `C:\Users\imzth\CivStreetShots\README.txt`). Vanilla runs: park both mods outside the Mods folder; vanilla Modern crashes when founding more than about 95 cities, so do halves (`CCTable.bounds`).

**Folders:** `ui/` is the mod itself (copied into the game). `tools/game/` runs in the game's debug console (plus `capture-states.ps1`, which screenshots the window beside it); `tools/analysis/` runs offline on the screenshots and tables; `tools/extract/` reads the installed game's art files into `ui/`; `tools/data/` holds the measured street tables (`street-table-<size>-<seed>[-<age>].json`) and the reference city layout; `tools/river/` is the river-turn research; `sandbox-shots/` the screenshots the log refers to.

**Street table tools:** `all-land.js` (whole map turned into land, runbook in its header), `have_mask.py`, `gap_mask.js` (plots still missing from an Age's layer), `table-map.js` (`CCTable`; `targetFilter` for gap runs, `bounds` for halves), `street-probe.js` (`CCStreetProbeStreets` for another Age's roads), `capture-states.ps1` (screenshots; nothing may cover the game window), `table_score.py` (`CC_STREETS=1` for Modern's single road), `merge_passes.py`, `build_street_table.py` (Antiquity tables `street-table-<size>-<seed>.json`, later Ages `...-<seed>-exploration|modern.json`); `river/` holds the river courses, the rule search and the river-height test (`river-height.js` dumps terrain heights across river tiles, `river_height.py` checks whether the channel predicts the turn).

**Vanilla comparison tools:** `layout-copy.js` (`CCLayout`: record a game's cities tile by tile, rebuild the same layout in another game on the same map, shoot the same views; recipe in its header) and `compare_tiles.py` (ranks the city tiles by how much the two games' pictures differ, writes a side-by-side sheet of the worst ones), `variant-check.js` (`CCVariant`: draw candidate models next to the engine's own to see which variant it picked). The seed and hash experiments of rounds 39-46 were removed in the 2026-11-17 cleanup (git history has them).

## How it works
For every city-centre, urban and (in Modern) rural tile of a player whose personal Age is later than Antiquity:
1. `WorldUI.clipHexHeight(plot, 0)` hides everything the engine draws on the tile above ground (not ground paint).
2. The tile is composed again from the game's own models, drawn with `addModelAtPlot` in the owner's colours:
   - the street section and house layout of the owner's Age, chosen and placed from the engine's own layout data, in the street pattern and turn of the engine's Antiquity streets underneath (`ui/cc-street-table.js`);
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
| `tools/extract/extract_building_art.py` | `ui/cc-building-art.js` | Which art bin each building uses, and per bin the model for each building culture and Age (32-byte bin records, FNV-1a model hashes, string-table indexes) |
| `tools/extract/extract_layout_slots.py` | `ui/cc-layout-slots.js` | The attachment slots of the house layouts: model, position, turn, scale per slot (40-byte transform record before each slot's name record) |
| `tools/extract/decode_layouts.py LAYOUT_NAME` | (prints) | The slots of any layout, for checking |

`tools/game/sandbox.js` (`CCSandbox`) and `tools/game/bench.js` (`CCBench`) are debug-console helpers for test games: placing buildings, granting techs, framing top-down shots. They change the game state and are not part of the mod.

## Debug switches
From the debug console: `CCVisualOverlay.rebuild()`, `.reset()` (engine art back), `.tile(x, y)` (what is drawn on a tile), `.personalAge(player)`.

## Practical notes
- **Changing the modinfo needs a full game restart**; `UI.reloadUI()` re-reads scripts but not the script list.
- **Never call `clipHexHeight` without its height argument**: that crashes the game.
- Loading the overlay script by hand on the debug console registers its event handlers again, so a camera move can redraw it after `reset()`; check `WorldUI.modelGroupIds` before taking an "engine only" screenshot.
- Models take a second or two to load after a tile is drawn.

## Try it
Copy `cc-visual-prototype.modinfo` and the `ui` folder to `%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\Mods\cc-visual-prototype`, then restart the game. It's enabled automatically and also applies to existing saves. Delete the folder to remove it.
