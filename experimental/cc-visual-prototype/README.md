# Visual prototype (experimental)

A separate, opt-in mod that gives each civilization city architecture from its own personal Age. **Not part of the released mod.** Display only: it never changes the game simulation.

## How it works
For every city-centre and urban tile of a city whose owner is in a later personal Age:
1. `WorldUI.clipHexHeight(plot, 0)` hides everything the engine draws on that tile above ground: houses, buildings, the palace, walls on the tile.
2. That Age's city-block model is drawn on the tile:

| Owner's personal Age | Models |
|---|---|
| Antiquity | none (engine art, untouched) |
| Exploration | `EXP_URBAN_City_Center_Palace_Layout` (capital), `EXP_URBAN_City_Center_Layout`, `EXP_URBAN_Basic_City_Layout` |
| Modern | `MOD_URBAN_City_Center_Palace_Layout` (capital), `MOD_URBAN_City_Center_Layout`, `MOD_URBAN_Basic_City_Layout` |

Personal Age uses the same techs as the main mod (Cartography, Astronomy or Machinery; Academics, Steam Engine or Military Science).

## Verified (2026-11-13)

| Requirement | Result |
|---|---|
| Two neighbours in different Ages | Turn-42 game: Rome moved to personal Modern showed Modern blocks in both its cities; neighbouring Russia (Antiquity) kept its timber Antiquity city. Game Age stayed Antiquity |
| Native art hidden, not just covered | Rome's terracotta houses, temples, market and palace disappear on replaced tiles; only the Modern blocks show |
| Exploration and Modern | Both model sets render correctly (Exploration seen on a test tile) |
| Updates on progress | Researching (granting) a Modern tech redrew Rome's cities on the next frame (`TechNodeCompleted`) |
| Survives turns | The replaced tile stayed replaced through a full AI turn, including the engine adding new art elsewhere |
| Rebuilt after loading | Installed as a mod: loading a turn-451 save rebuilt 241 replaced tiles automatically |
| Gameplay untouched | Reads state and draws client-side only; units, banners and yields still show on replaced tiles |
| City ownership changes | Hooked (`PlotOwnershipChanged`, `DistrictControlChanged`, `CityRemovedFromMap`); not tested |
| Multiplayer | Not tested (each client draws from shared game state, so it should match) |

## Limits
- **Buildings become generic blocks.** On a replaced tile the player's actual buildings aren't shown individually. Wonders on their own tiles still show, and the city view and tooltips still list everything.
- **One style for everyone.** The `*_URBAN_*_Layout` sets are a single European style, so every civ's later-Age city looks alike (no Russian, East Asian or other regional variants).
- **Repetition.** Every urban tile uses the same block, so large cities look tiled.
- **Walls on tile edges** keep their engine art.
- **Never call `clipHexHeight` without its height argument** (`clipHexHeight(plot)` crashed the game). `clipHexHeight(plot, height)` is safe; `restoreHexHeight(plot)` and `restoreAllHexHeight()` undo it.

## Try it
Copy this folder to `%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\Mods\cc-visual-prototype`. It's enabled automatically and also applies when loading existing saves. Delete the folder to remove it.
