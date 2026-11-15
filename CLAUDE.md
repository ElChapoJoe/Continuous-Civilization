# Continuous Civilization - notes for Claude sessions

A Civilization VII mod: the Antiquity Age never ends; Exploration and Modern content follows each player's personal
Age (techs), costs follow a shared world Age. Design and mechanics: `README.md`, `mod/continuous-civ/README.md`,
`docs/audit-age-gated-mechanics.md`. Changes per release: `CHANGELOG.md`.

## Rules from the owner
- Git: commit tested work with descriptive messages; branches for major work, `main` stays stable; never force-push
  or rewrite history; ask before pushing; never commit game files (XML, art, audio, saves, logs).
- Test with the local beta copy of the mod (`%LOCALAPPDATA%\...\Mods\continuous-civ`), not the Workshop copy
  (`tools\civ-status.ps1` warns if another copy is installed).
- Balance: a player must not be punished for advancing; costs that vanilla raises per Age follow the world Age.
  Civ VI's values and mechanics are the reference (installed at `G:\SteamLibrary\steamapps\common\Sid Meier's Civilization VI`).

## Dev loop
See CONTRIBUTING.md "Workflow": `tools\deploy.ps1`, `tools\restart-civ.ps1`, `tools\wait-civ.ps1 -For game`,
`tools\watch-autoplay.ps1`, `tools\scan-logs.ps1`, `tools\civ-status.ps1`; console: `tests/cc-tests.js` +
`tests/run-all-suites.js`, `tests/cc-dev.js` (`CCDev.*`).

## Engine gotchas
- The mod's file list (`.modinfo` UIScripts/UpdateDatabase items) is read at game start: a new file needs a full
  restart. Game-wide modifiers (`GameModifiers`) attach only in games started after the change, not in old saves.
- The debug console can't `await`: use `CCDev.run(async () => ...)` then `CCDev.result()`.
- Tree-node grants from the console only apply to the local human player.
- After "Begin Game" on a fresh game a second dialog appears; actions on turn 1 fail until it is closed.
- `Game.Modifiers.getModifierSubjects` works for GameModifiers, returns null for trait-attached modifiers.
- Vanilla UI scripts that ask for the game Age (`Game.age`) always see Antiquity; `ui/cc-age-ui.js` and
  `ui/cc-religion.js` show how to patch them by personal Age.
