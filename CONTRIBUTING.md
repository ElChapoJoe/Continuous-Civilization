# Contributing and development

## Reporting
- **Bugs:** use the [bug report form](../../issues/new?template=bug_report.yml). Include the turn, what happened, a screenshot, and `Modding.log`, `Database.log` and `UI.log` from `%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\Logs\`.
- **Balance:** use the [balance feedback form](../../issues/new?template=balance_feedback.yml). Turn numbers for Age entry and game end help most.

## How the mod works
The mod is data and UI only (SQL, XML imports and UI scripts). It ships no game files: each Age's content is imported from the player's installed game when the game is created.

- Load groups run in order: `cc-pre` (400), `cc-import-exploration` (500), `cc-import-modern` (600), `cc-import-resources` (700), `cc-merge` (1000).
- Where a later Age re-defines a row from an earlier one, generated SQL resolves it (`data/00-*`, `data/06-*`, `data/09-*`, `text/00-*`, `text/09-*`).
- Personal Ages are requirement sets (`data/70-personal-age.sql`). Rules tied to an Age are rewritten to follow the player's own Age.
- The technical notes are in [mod/continuous-civ/README.md](mod/continuous-civ/README.md); the investigation and test reports are in [docs/](docs).

## Repository layout

| Path | Contents |
|---|---|
| `mod/continuous-civ/` | The mod: `.modinfo`, SQL data changes (`data/`), text (`text/`), UI scripts (`ui/`) |
| `tools/` | `gen_dedupe.py` (resolves clashes between Ages' data), `gen_modern_resources.py`, `survey_imports.py`, `age-audit.js`, `deploy.ps1` |
| `tests/cc-tests.js` | In-game test suites for the game's debug console (`CC.db()`, `CC.modernTrees()`, `CC.victories()`, `CC.diplomacy()` and more) |
| `docs/` | Engine investigation, phase plans, test reports and README images |

## Workflow
- The tools find Civilization VII through Steam. To point them elsewhere, pass the game's `Base` folder as the first argument or set `CIV7_DIR`.
- After changing which game files are imported, or after a game patch, regenerate the generated SQL:
  ```
  python -I tools/gen_dedupe.py
  python -I tools/gen_modern_resources.py
  ```
- Deploy to your Mods folder with `tools/deploy.ps1`. A `.modinfo` change needs a full game restart; SQL-only changes need a new game (or a reload).
- Test in game: load `tests/cc-tests.js` on the debug console (FireTuner) and run the suites, then run an AI autoplay and check expansion, Age progress and the logs.
- Branches: `main` is the stable, tested version; work happens on branches and is merged once tested. Never upload game files (XML, art, audio, saves, logs).
