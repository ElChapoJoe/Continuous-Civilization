# Visual prototype (experimental)

A separate, opt-in mod that tries per-player city architecture. **Not part of the released mod.** Display only: it never changes the game simulation.

## What it does
For every city and town, it reads the owner's personal Age (the same techs as the main mod) and draws that Age's city-block models on the city-centre and urban tiles:

| Owner's personal Age | Models drawn |
|---|---|
| Antiquity | none (the engine's own art) |
| Exploration | `EXP_URBAN_City_Center_Palace_Layout` (capital), `EXP_URBAN_City_Center_Layout`, `EXP_URBAN_Basic_City_Layout` |
| Modern | `MOD_URBAN_City_Center_Palace_Layout` (capital), `MOD_URBAN_City_Center_Layout`, `MOD_URBAN_Basic_City_Layout` |

- Only tiles the local player has revealed get models, so it never shows hidden cities.
- Rebuilds when research, cities, districts, tile ownership or visibility change, at the start of each turn, and when a game loads.
- Every client derives the same picture from the same game state, so nothing needs syncing.

## Status (2026-11-13)

| Requirement | Status |
|---|---|
| Uses each player's personal Age | Verified (Rome in Modern drew 4 models across 2 cities; Antiquity neighbours drew none) |
| Antiquity, Exploration and Modern cities at once | Verified for Modern next to Antiquity; Exploration uses the same code path, not seen on screen |
| Updates on progress | Hooked to `TechNodeCompleted` and `PlayerTurnActivated`; not yet seen live |
| City ownership changes | Hooked to `PlotOwnershipChanged`, `DistrictControlChanged`, `CityRemovedFromMap`; not tested |
| Gameplay untouched | By design (reads state, adds client models only) |
| Rebuilt after loading | Verified after an interface reload (models gone, then rebuilt) |
| Multiplayer | Not tested |
| Looks like a later-Age city | **No.** The engine's Antiquity houses stay underneath; the overlay mixes later buildings in |

## Try it
Copy this folder to `%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\Mods\cc-visual-prototype`, enable it under Additional Content, and start a new game. The modinfo itself hasn't been loaded through the game's mod list yet; the script was tested by running it in a loaded game.
