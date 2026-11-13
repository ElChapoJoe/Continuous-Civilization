# Continuous Civilization

**One uninterrupted campaign for Sid Meier's Civilization VII.** The Antiquity Age never ends. Exploration and Modern content continues directly from it: one technology tree, one civic tree, and each player moves into the next Age on their own as they research, instead of the whole world transitioning at once.

> **Status:** playable prototype (mod version 19). All three Ages are merged and a full 450-turn AI game has run to a Science victory without crashes. Some victory types are not available yet (see [Known limitations](#known-limitations)).

---

## Features

All of the following have been verified in game (see [`docs/`](docs) for test reports).

### One continuous game
- **No Age transitions.** The Age clock is switched off, so there is no Age-end countdown, no civilization swap and no reset of your empire.
- **Merged technology and civic trees.** Exploration techs and civics follow Antiquity's, and Modern's follow Exploration's, ending in Modern's Future Tech and Future Civic.
- **Personal Ages.** Each player is in their own Age, based on research:
  - **Exploration** begins with any of Cartography, Astronomy or Machinery.
  - **Modern** begins with any of Academics, Steam Engine or Military Science.

  Game rules that depend on the Age follow the player's personal Age.

### Content from every Age
- **Units and buildings** from all three Ages, unlocked through research. Older units upgrade into newer ones (for example Galleon to Frigate, Arquebusier to Line Infantry).
- **Age rules per player.** Entering a personal Age applies that Age's civilization rules:
  - base yields: Antiquity +5 Gold / +10, Exploration +10 / +20, Modern +15 / +30 (Gold / Science, Culture, Influence);
  - settlement caps of at least 8 (Exploration) and 16 (Modern);
  - deep-ocean travel and embarkation;
  - resource slots, envoys and town focuses.
- **Governments** unlock by civic:

  | Exploration | Modern |
  |---|---|
  | Feudal Monarchy | Bureaucratic Monarchy |
  | Plutocracy | Elective Republic |
  | Theocracy | Authoritarianism |

  The government chooser opens when one unlocks, and a **Change Government** button is added to the policies screen. AI civilizations move along the same chain.
- **Diplomacy and espionage** from Exploration and Modern: Demand Tribute, Treasure Fleets and spy actions such as Open the Gates, Sabotage Shipping and Sabotage Space Program. Each one unlocks with the tech, civic or city-state bonus that grants it.
- **Religion** from the Exploration Age: Piety, Temples, founding a religion, beliefs, Missionaries and relics.
- **City-states, great people, projects, narratives and discoveries** from all three Ages share one pool.
- **Resources from later Ages** are placed at map start but stay inactive and hidden for each player until they research the matching tech (for example Coal at Steam Engine, Oil at Combustion).
- **Ideologies:** the Democracy, Fascism and Communism civic trees open with Political Theory.

### Winning
- **Science victory:** the space race. Reach 100 Science victory points with an undamaged Launch Pad, then hold through a 5-turn countdown. Verified: in a 450-turn AI game, Mexico won on turn 399.
- **Domination victory:** capture every rival's original capital. Enabled by default; it doesn't depend on any Age.

## Known limitations

- **Culture, Economic and Military (points) victories cannot be won yet.** Points for them build up and show on the victories screen. In vanilla these victories need a 25% lead over second place, and the game engine only turns that check on inside a real Modern Age. Planned for a later version. For a military win, use Domination.
- **Score victory** is decided when the final Age ends, which never happens in a continuous game.
- **Legacy paths** do not progress, so their Modern rewards (World's Fair, Manhattan Project, John Maynard Keynes) are unavailable. Launch Rocket instead requires the three earlier space projects.
- **Not imported:** Modern's AI file, which crashed the game.
- **Diplomacy costs don't scale by Age.** Actions shared by all Ages keep Antiquity's Influence costs, which vanilla doubles in Exploration and triples in Modern.
- **Ruins are Antiquity discoveries all game**, so Modern archaeology can't use them.
- **City art stays Antiquity-style.** Town houses, roads and bridges keep their Antiquity look all game, because the game engine draws them from the single game-wide Age. Buildings, wonders and units from later Ages do use their own art, so cities look newer as players build them. See [the investigation](docs/visual-progression-investigation.md).
- **Tested in single player only.** The UI scripts act for the local player, so multiplayer is untested.

## Installation

Requires **Sid Meier's Civilization VII** (tested on version 1.5.1). No game files are included or modified: the mod loads Exploration and Modern data from your installed game.

1. Copy the `mod/continuous-civ` folder into your Civilization VII mods folder:
   `%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\Mods\`
   (or run `tools/deploy.ps1`, which does the same).
2. Enable **Continuous Civilization** under **Additional Content** in game.
3. Start a **new** game with an **Antiquity** start. The mod changes the game database, so it does not apply to existing saves.

## Repository layout

| Path | Contents |
|---|---|
| `mod/continuous-civ/` | The mod: `.modinfo`, SQL data changes (`data/`), text (`text/`), UI scripts (`ui/`) and a technical [README](mod/continuous-civ/README.md) |
| `tools/` | Generators and helpers: `gen_dedupe.py` (resolves clashes between Ages' data), `gen_modern_resources.py`, `survey_imports.py`, `age-audit.js`, `deploy.ps1` |
| `tests/cc-tests.js` | In-game test suites, run on the game's debug console (`CC.db()`, `CC.modernTrees()`, `CC.parkLinks()`, `CC.victories()` and more) |
| `docs/` | Engine investigation, phase plans and test reports, including the long-run results |
| `research/` | Early probes and screenshots from the investigation phase |

## Development

- After changing which game files are imported, regenerate the generated SQL:
  ```
  python -I tools/gen_dedupe.py
  ```
- Deploy with `tools/deploy.ps1`.
  - A change to the `.modinfo` file needs a full game restart.
  - SQL-only changes only need a new game.
- Verify in game: load `tests/cc-tests.js` on the debug console and run the suites. Then run an AI autoplay long run and check expansion, Age progress and errors.
- Branches: `main` is the stable, tested version; larger changes go on development branches.

## Roadmap

- Culture and Economic victories (a lead-based rule that works without a Modern Age).
- Balance pass: pacing, diplomacy costs, wonder scoring by Age.
- Visual progression, if the engine allows it: possibly a world-wide art step when most players enter a new Age, and per-player road art through railroads.
- Playtesting of the Modern interface by human players; multiplayer.

## Disclaimer

Continuous Civilization is an unofficial fan modification. It is not affiliated with or endorsed by Firaxis Games or 2K. Sid Meier's Civilization VII and its content are the property of their respective owners. This repository contains no game assets: it ships only mod scripts and data changes, and reads the game's own files from your installation at load time.
