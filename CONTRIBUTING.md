# Contributing and development

## Reporting
- **Bugs:** use the [bug report form](../../issues/new?template=bug_report.yml). Include the turn, what happened, a screenshot, and `Modding.log`, `Database.log` and `UI.log` from `%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\Logs\`.
- **Balance:** use the [balance feedback form](../../issues/new?template=balance_feedback.yml). Turn numbers for Age entry and game end help most.

## How the mod works
The mod is data and UI only (SQL, XML imports and UI scripts). It ships no game files: each Age's content is imported from the player's installed game when the game is created.

- Load groups run in order: `cc-pre` (400), `cc-import-exploration` (500), `cc-import-modern` (600), the DLC imports (650-660), `cc-import-resources` (700), `cc-merge` (1000). The files sit in one folder per stage: `data/1-pre/`, `data/2-import/`, `data/3-merge/` (and the same under `text/`).
- Where a later Age re-defines a row from an earlier one, generated SQL resolves it (`1-pre/2-dedupe-exploration`, `2-import/modern-2-dedupe` and `-3-restore`, `3-merge/00-restore-cascades`).
- Personal Ages are requirement sets (`data/3-merge/70-personal-age.sql`). Rules tied to an Age are rewritten to follow the player's own Age.
- The technical notes are in [mod/continuous-civ/README.md](mod/continuous-civ/README.md); the investigation and test reports are in [docs/](docs).

## Repository layout

| Path | Contents |
|---|---|
| `mod/continuous-civ/` | The mod: `.modinfo`, SQL data changes (`data/<stage>/`), text (`text/<stage>/`), UI scripts (`ui/`); layout in its README |
| `tools/` | Generators: `gen_dedupe.py` (resolves clashes between Ages' data), `gen_modern_resources.py`, `gen_dedications.py` (Dedication cards), `gen_civ_abilities.py` (civ abilities per Age, with `civ_abilities_logic.sql`), `gen_prune_fk.py` (broken-reference safety net), `survey_imports.py`, `age-audit.js`. Checks: `check_mod.py` (static checks, run by `deploy.ps1` and on every pull request), `release.ps1` (release checklist, see `docs/workshop/README.md`), `dbprint.js` (debug console: fingerprint of the gameplay database, to prove a refactor changed nothing). Dev loop (PowerShell, see below): `doctor.ps1`, `deploy.ps1`, `restart-civ.ps1`, `wait-civ.ps1`, `watch-autoplay.ps1`, `scan-logs.ps1`, `civ-status.ps1` (shared paths in `civ7-common.ps1`). Node run scripts (Node 22+): `test-game.mjs` (in-game test suites from the command line), `balance-run.mjs` + `balance-report.mjs` (balance report from an AI autoplay), built on `lib/civ.mjs` (game control through the UI debugger, saves, test games, crash recovery, a journal per run in `~/CivRuns`) |
| `tests/cc-tests.js` | In-game test suites for the game's debug console (`CC.db()`, `CC.modernTrees()`, `CC.victories()`, `CC.diplomacy()`, `CC.worldAge()` and more); `tests/run-all-suites.js` runs them all and lists failing checks |
| `tests/cc-dev.js` | Debug-console helpers: `CCDev.status()`, `.victory()`, `.costs()`, `.load()`, `.save()`, `.newGame()`, `.autoplay()`, `.grant()` and more |
| `docs/` | Engine investigation, phase plans, test reports and README images |

## Workflow
- The tools find Civilization VII through Steam. To point them elsewhere, pass the game's `Base` folder as the first argument or set `CIV7_DIR`.
- `python -I tools/check_generated.py` tells whether the generated SQL is up to date with the installed game (it runs every generator, compares, and puts the files back; `--update` keeps the new output). `deploy.ps1` and the pre-commit hook run it and warn.
- One-time setup per clone: `git config core.hooksPath tools/hooks` turns on the pre-commit hook (blocks game files such as saves and logs, runs `check_mod.py` when the mod changes, warns on stale generated SQL; `git commit --no-verify` skips it once). `tools/doctor.ps1` shows whether it is on.
- Pull requests: the Mod check workflow also warns when the mod changes without a `CHANGELOG.md` entry.
- After changing which game files are imported, or after a game patch, regenerate the generated SQL:
  ```
  python -I tools/gen_dedupe.py
  python -I tools/gen_modern_resources.py
  python -I tools/gen_dedications.py
  python -I tools/gen_civ_abilities.py
  python -I tools/gen_prune_fk.py
  ```
- Dev loop (run the scripts with `powershell -ExecutionPolicy Bypass -File tools\<script>.ps1`):
  0. `doctor.ps1`: checks the whole setup in one go (game found, debug ports on, crash reporter, deployed mods, mods left parked by a vanilla test run, Node, Python with numpy, git, GitHub CLI, disk space); exit 1 when something fails. Run it before an unattended run.
  1. `civ-status.ps1`: game running?, UI page (menu or game), a stuck crash reporter, whether the deployed mod matches the project, newest saves and crash dumps.
  2. `deploy.ps1` first runs `check_mod.py` (modinfo file list, SQL that parses, well-formed XML, UI script syntax, imports that exist in the installed game) and stops on any error; then it mirrors `mod/continuous-civ` into the Mods folder and says what the game needs next: a `.modinfo` change (new or removed files) needs a full restart, data changes a new game (game-wide rules only attach in games started after the change), UI-only changes a UI reload.
  3. `restart-civ.ps1` starts or restarts the game and waits for the main menu. Close the game first (`engine.call("exitToDesktop")` on the console) or pass `-Kill`. It stops a leftover `FiraxisCrashReporter.exe`, which otherwise makes Steam think the game is still running and silently refuse to launch it.
  4. Load a save or start a game from the console (`CCDev.load(name)`, `CCDev.newGame()`), then `wait-civ.ps1 -For game` returns when loading has finished and "Begin Game" can be pressed.
  5. On the console: load `tests/cc-tests.js`, then `tests/run-all-suites.js` (all suites, failing checks listed); load `tests/cc-dev.js` for the helpers. Or from the command line: `node tools/test-game.mjs` starts a fresh 6-player game, runs every suite and exits 1 on an unexpected failure (`--save NAME` to test a save, `--turns N` to autoplay first, `--deploy` to deploy first, `--probes` to also run the in-game experiments of `tests/cc-probes.js`, which change the game and answer open questions; results in the run journal). Checks that can't be judged yet (the Ocean checks of `distantLands` before anyone has deep-water units) are listed under `skipped` with the reason, not as failures, so every entry under `failing` is a real problem.
  6. AI autoplay: `CCDev.autoplay(turns)`, then `watch-autoplay.ps1` prints `TURN n` lines and exits on `DONE`, `CRASH` or `STALL` (no autosave for 6 minutes).
  7. `scan-logs.ps1` summarises errors in the game logs, mod-related first; it exits 1 on mod or database errors. After a game you checked, `scan-logs.ps1 -SaveBaseline` records the errors a normal game always prints (in `~/CivRuns/log-baseline.txt`, not the repo); later scans list only new errors and count the known ones (`-All` lists them too, `-NoBaseline` ignores it). Save a new baseline after a game update.
  8. Balance: `node tools/balance-run.mjs --turns 200 --every 10` plays an AI autoplay (6 civs, small map; `--save NAME` to start from a save) and snapshots every civ every 10 turns (`CCDev.balance()`: personal Age, cities, population, techs, civics, net yields, victory points). It writes `report.md` and `balance.csv` to `~/CivRuns/<time>-balance/`: when each civ reached each Age, the numbers by turn, and flags where one civ makes 2x the median of a yield or more (`--ratio`, `--from`). It resumes from the newest autosave after a crash. `node tools/balance-report.mjs DIR` rebuilds the report without the game.
- Branches: `main` is the stable, tested version; work happens on branches and is merged once tested. Never upload game files (XML, art, audio, saves, logs).
