# Game update 1.5.1 (2026-11-10): what to check with the mod

The installed game is 1.5.1 (Engine.log `Engine Version: 1.5.1 (1327230)`), and 0.2.1-beta was built and tested on it.

**Already checked (2026-11-16):** 18 of the 185 game files the mod imports changed in 1.5.1 (Exploration and Modern great people, narrative stories, units, AI lists, civilization effects, Modern Projects and Technologies text, Iceland). Every generator (`gen_dedupe`, `gen_modern_resources`, `gen_dedications`, `gen_civ_abilities`, `gen_prune_fk`) was rerun against the installed game: the output is identical to the repository apart from line endings, so the generated data already matches 1.5.1. `tools/check_mod.py` passes, including that every import exists in the installed game.

## Still to check in a game

| 1.5.1 change | Why it may matter here | How to check |
|---|---|---|
| Liberation: captured settlements can be returned to their owner or restored as City-States | Military victory points count conquered settlements (`76-victories`); City-States come from all three Ages | Capture a settlement, liberate it both ways; Military points drop as expected, the City-State works |
| Great People rework: unique conditions shown on the setup screen, loading screen and details panel | Exploration and Modern great people are imported into Antiquity (`36-great-people-city-states`); a panel that asks for `Game.age` sees Antiquity | Personal Exploration: the later-Age great people and their conditions show and trigger (for example the Alim in an Abbasid unique quarter) |
| Game year recalibrated per Age, slowing at the end of an Age during a Crisis | The Age never ends here | Look at the year late in a long game (turn 200+): it keeps advancing sensibly |
| Placement previews no longer double-count natural yields | `ui/cc-overbuild.js` shows its own preview in the side panel | Overbuild preview numbers match the result after placing |
| New map types (Donut, Randomized Earth) and updated Voronoi generation | Map scripts are new code paths; the street table is per map size and coordinate, not per script | Start a game on each new map type with the mod: it loads, autoplays 10 turns, `scan-logs.ps1` clean |
| Updates switch all active mods off | Players need to turn the mod back on after every game update | Done: a line in How to play (`README.md`, `docs/workshop/description.txt`); reaches Workshop players with the next upload |

Sources: official patch notes for [1.5.1](https://support.civilization.com/hc/en-us/articles/57073538595987-Civilization-VII-Patch-Notes-November-10-2026) and [1.5.0](https://support.civilization.com/hc/en-us/articles/55328611080339-Civilization-VII-Patch-Notes-September-15-2026).
