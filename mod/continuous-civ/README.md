# Continuous Civilization: technical notes (0.2.0-beta)

The Antiquity Age never ends. The full Exploration technology and civic trees continue directly from the Antiquity trees, and the Modern ones continue from those, and Exploration and Modern units, buildings, wonders, policies and governments unlock through research.

- **Civics:** the 12 Exploration main civics plus Exploration Future Civic follow Antiquity's (Economics after Commerce, Piety after Philosophy), with their policies, buildings and wonders. Antiquity Future Civic is removed. The Theology branch opens once you have founded a religion.
- **More Exploration content:** Exploration city-states and their suzerain bonuses join Antiquity's from the start; Exploration city and town projects (Town Temple and Inn focuses; Heliocentric Model at Education, Invent Calculus at Urban Planning) with Antiquity's values kept for the shared ones; the Abbasid and Spanish unique great people; Exploration AI priority lists.
- **Exploration Age rules:** once a player is in their personal Exploration (any of Cartography, Astronomy, Machinery), they get the rules every vanilla Exploration civ has: naval units may enter Deep Ocean, safe deep-ocean trade, land units embark on shallow water, Antiquity's "Ocean is impassable" rule ends for them (so Cartography lets civilians and commanders, and Shipbuilding mastery all land units, cross the Ocean), Bazaar and Wharf resource slots, +2 envoys, Gold and Silver counting, base yields of +10 Gold and +20 Science/Culture/Influence (replacing Antiquity's +5 Gold and +10), and Economic victory scoring (points for slotted and imported resources and Gold buildings).
- **Narratives and discoveries:** Exploration's 1,597 narrative events, discoveries and Test-of-Time stories join Antiquity's pool; their own requirements still gate them, and their Age-transition conditions follow the personal Age.
- **Religion:** Exploration religions are on: research Piety, build a Temple, found a religion and pick beliefs (pantheons still work). Missionaries unlock with Piety; relics exist.
- **Governments:** Feudal Monarchy (Authority), Plutocracy (Mercantilism) and Theocracy (Piety) unlock by civic. The government chooser opens when you unlock one, and the policies screen gets a **Change Government** button. The AI switches by rule once it has the civic: Despotism to Feudal Monarchy (Authority), Oligarchy to Plutocracy (Mercantilism), Classical Republic to Theocracy (Piety). The engine AI picks from all governments at Chiefdom, so an AI that takes an Exploration government before its civic (or a crisis-only one) is set back to an Antiquity one.
- **Distant Lands are open** (`72-exploration-rules.sql`): in an Antiquity game the engine closes the Distant Lands to everyone (no meeting the civilizations there, no entering or settling their land). The switch is the Ages column `NoVictoriesSecondaryHemisphere`, which only Antiquity has on; it is off here, as in vanilla Exploration and Modern. There is no per-player version, so it is off for everyone from the start, but crossing the Ocean still needs the personal Exploration.

Map generation, terrain, rivers, graphics and all Antiquity rules are vanilla, except that later-Age resources also spawn:

- **Exploration and Modern resources** spawn at map start but are **inactive for each player until that player researches** the mapped tech. Until then they give no yields or effects, and a UI script hides them from that player's map icons, tile tooltips and resource screens. Their 3D models stay visible: the engine draws those. The engine also picks a tile's improvement from the real resource (`Constructible_ValidResources`, base-standard), so a city growing onto Oil builds an Oil Rig in Antiquity (no effect until the tech; it then works as is). Remapping Oil to an ordinary improvement would hide that but leave Oil without Oil Rigs in Modern too, so it is left as is. Icons: verified hidden in normal play (2026-11-14); during AI autoplay there is no local player and the resource layer's `ResourceAddedToMap` handler draws icons from the event's own type, past `GameplayMap.getResourceType`, so a few can appear then. Verified usable after the tech: a Rubber tile went from 1 to 2 Production on Industrialization, with no player having assigned a gated resource to a city before it.
  - Exploration (with Exploration effects): Cartography (Whales, Pitch, Spices, Cloves), Guilds (Sugar, Tea, Cocoa, Furs, Truffles), Machinery (Niter).
  - Modern (with Modern effects): Urbanization (Coffee, Tobacco, Citrus), Academics (Quinine), Steam Engine (Coal), Industrialization (Nickel, Rubber), Combustion (Oil).
- Antiquity resources keep their Antiquity effects.

## Winning

- **Science:** the space race. Once you reach 100 Science victory points with an undamaged Launch Pad, a 5-turn countdown starts and you win when it ends (verified; in a 450-turn AI game Mexico won it on turn 399). Launch Rocket requires Trans-Oceanic Flight, Break the Sound Barrier and Launch Satellite (in vanilla it needs the Modern Science legacy path, which cannot complete here).
- **Domination:** capture every rival's original capital (vanilla's Domination victory; no Age dependence; not yet seen in play).

## New-Age scene

`ui/cc-age-scene.js`: when the local player enters their personal Exploration or Modern Age, vanilla's Age transition
plays for them: the legacy movie of the Age they leave (`EndGameMovies` by civilization and legacy path class: the
last completed legacy path, else the class with most triggered Triumphs, else the best legacy path score; generic
`MOVIE_VICTORY_<AGE>_<CLASS>` without a civ movie), then `age-transition-banner` ("age-start") with the personal Age in its
text. Queued through `DisplayQueueManager` after the tech popup (priority 8500); not during autoplay or multiplayer.
Other civilizations entering a new personal Age get a short non-blocking notice (`LOC_CC_AGE_NOTICE_*`).
Needs `{age-exploration}` and `{age-modern}` `data/movies.xml` (imported; non-English subtitles not imported).

## Known limitations

- **Culture, Economic and Military victories use fixed targets** (350 Culture, 8,000 Economic, 100 Military points, then a 5-turn countdown; `data/3-merge/76-victories.sql`) instead of vanilla's 25% lead over second place, which the engine only checks inside a real Modern Age.
- **Score victory** is decided when the final Age ends, which never happens here.
- **Triumphs** (1.5's legacy paths, `Legacies` table): Exploration's and Modern's are imported and re-tagged to Antiquity, and each trigger also requires the personal Age (`80-triumphs.sql`); `ui/cc-triumphs.js` takes that requirement's share out of the progress shown (0/20, not 0/200). The Wonders Triumphs' "wonders of the current Age" (`RequiresCurrentAge`) would count every wonder, all being tagged Antiquity, so `80` tags wonders by the Age of their unlocking node (`CC_WONDER_EXPLORATION`/`_MODERN`) and counts the tag instead (`REQUIREMENT_PLAYER_HAS_AT_LEAST_NUM_BUILDINGS`, `BuildingTag`). Dedications (Major Triumph rewards, vanilla's Age-transition cards): `tools/gen_dedications.py` stages the cards and their modifiers (`82-dedication-cards.sql`); `83-dedications.sql` makes them nodes of a Dedications attribute tree, gives 3 points on entering the personal Exploration and 3 in Modern (condition: the Age only), gates each card's effects on a completed Triumph + the card's Age + a human owner (checked when bought), and gives AI players the earned ones automatically when they complete the Triumph (`CC_DMAI_` copies on the major-civ trait, condition Triumph + AI; what an AI buys with points has no effect). Verified with probes in AI autoplays: the engine re-checks a combined condition when a Triumph completes but not when the personal Age changes, and an Age check on an attached modifier never passes, so AI Dedications can't wait for the next Age; `ui/cc-dedications.js` refuses buying a Dedication that doesn't qualify yet; `ui/cc-dedication-popup.js` is the vanilla-like picker (vanilla's Age-transition screen can't run mid-game: the advanced-start deck is closed after turn 1): at turn start, once the game's own popups are closed, it lists the earned Dedications and buys the picked ones (map input off while it's open; "Later" hides it until something new is on offer). Wildcard attribute points can also buy Dedications, and an AI with Wildcard points spends some on Dedication nodes, first the Modern Scientific cards (it rates their victory-point effects highly), which do nothing for an AI; `RevealRequirementSetId` (player is human) on the tree and `AIIgnoreUnlockValue` on the unlocks both failed to stop it, so `ui/cc-dedications.js` gives the AI the point back on `AttributeNodeCompleted`. Crisis cards are left out. Not completable: LEGACY_EX_ECONOMIC_2 (Treasure Fleet points) and LEGACY_MO_ECONOMIC_1 (Factory resource points; its reward is John Maynard Keynes). World's Fair and Manhattan Project are available from Hegemony and Nuclear Fission.
- **A few numbers stay at Antiquity's values** because the engine reads them from the one game Age, with no per-player version: the celebration Happiness curve, happiness stages (Joyous, Ecstatic) and war weariness. Growth costs, specialist cap and town upgrade costs follow the personal Age (`72`, `74`), as do ScaleByGameAge bonuses of leaders, mementos, attribute trees and traditions (`81`) and narrative/discovery reward sizes (`37`). Diplomacy action results that use ScaleByGameAge keep Antiquity's size. See `docs/audit-age-gated-mechanics.md` (#2, #9, #15).
- **Older buildings never become obsolete** for the engine: every building counts as "current Age", so they keep their adjacency bonuses and the engine never offers to build over them (#8). `ui/cc-overbuild.js` adds overbuilding per player in the placement screen: a full tile whose older building (vanilla Age from the `CC_AGE_EXPLORATION`/`CC_AGE_MODERN` tags of `30-buildings.sql`) is behind both the player's personal Age and the new building's Age becomes a spot (if both buildings there qualify, a first dialog asks which one and the side panel is redrawn for that choice before the confirmation); confirming removes it (`DESTROY_ELEMENT`) and then queues or buys the new building, putting the old one back (`CREATE_ELEMENT`) if the engine refuses. Specialists on the tile stay; a queued replacement leaves the city 1 urban Population short until it is built (buildings count as urban Population). Local player only; the AI doesn't overbuild.
- **Culture victory points** for wonders follow the wonder's Age and for celebrations the player's personal Age (`80-triumphs.sql`, #12), as in vanilla.
- **No crises** happen (the Age meter is held near 0%) (#16).
- **Not yet included** (planned or under consideration): Treasure Fleets and Factory resources (#1), the remaining civilization-pack wonders (England, Dai Viet, Goryeo, Iceland, Sengoku, Joseon, Ottomans, Qajar, Pirate Republic) and DLC story events (#4, #14).
- **Modern AI file** (`ai-modern.xml`) is not imported: it crashed the game. The AI uses the base military/diplomatic components with Exploration's targets and lists.
- **Modern diplomacy actions** (espionage etc.) are not imported yet; they re-define Antiquity's diplomacy values (planned with the balance pass).

## How it works

Gameplay is data-only (modinfo, SQL, and XML references); UI scripts in `ui/` patch vanilla screens that read the game Age, and add the overbuild, Dedications and government interfaces. No Firaxis files are copied or modified; generated files are rebuilt from the installed game by the tools below.

The files are laid out by load stage, in the order the game applies them (`continuous-civ.modinfo` lists each one).
Files marked **generated** are written by `tools/gen_*.py` from the installed game; don't edit them by hand.

```
data/1-pre/      cc-pre (LoadOrder 400): before any import
data/2-import/   inside the cc-import-* groups (500-700), around the imported Exploration, Modern and DLC files
data/3-merge/    cc-merge (1000): one continuous Antiquity game; the number is the order inside the group
text/<stage>/    the same stages for localization
ui/              UI scripts (patches of vanilla screens that read the game Age, and the mod's own interfaces)
```

**1-pre** (`cc-pre`, 400)
- `1-snapshot.sql` records which units and buildings exist and backs up Antiquity globals.
- `2-dedupe-exploration.sql` (**generated**) removes the rows Exploration re-defines, after snapshotting the rows those deletes cascade into; `text/1-pre/park-resource-tooltips.sql` (**generated**) does the same for text.
- `3-park-modifier-ids.sql` (**generated**) and `4-park-modifiers.sql` park the Antiquity versions of resource effects that Exploration re-defines (put back by `3-merge/55`).

**2-import** (imports straight from the installed game, no copied Firaxis data)
- `cc-import-exploration` (500): `{age-exploration}` constructibles (incl. gameeffects and no-persist), units, tech and civic trees, governments and celebrations, religion, great people, projects, city-states, AI lists, narratives and discoveries, Exploration civ common effects, `TechnologiesText.xml` and `ResourcesText`.
- `cc-import-modern` (600): `{age-modern}` tech and civic trees, buildings, units, civ common effects, governments, great people and great works, projects, city-states, AI lists, railroads, narratives and discoveries. `modern-1-snapshot.sql` first, then `modern-2-dedupe.sql` (**generated**) deletes what the Exploration import added that Modern re-defines (the later Age wins); `modern-3-restore.sql` (**generated**, last item) puts back the rows those deletes cascaded into. `text/2-import/modern-*` keep earlier resource tooltips.
- `cc-import-dlc-*` (650, owners only): DLC wonders and the DLC civilizations' own later-Age civic trees. `cc-import-difficulty` (660): later Ages' AI difficulty bonuses.
- `cc-import-resources` (700): `resources-snapshot.sql` records the modifier list, then Exploration's resource effects load. Must stay the last import group: `3-merge/60` treats every modifier added after the snapshot as a resource effect.

**3-merge** (`cc-merge`, 1000)
- Setup: `00-restore-cascades` (**generated**) puts back rows the `1-pre` deletes cascaded into; `10-age-clock` turns the Age clock off (`EndsAge=0`, 1,000,000 max points).
- Trees: `20-tech-tree` grafts Exploration's techs into `TREE_TECHS_AQ`, then Modern's after them, and removes the Antiquity and Exploration Future Techs. `25-civic-tree` does the same for civics (`TREE_CIVICS_AQ_MAIN`), re-tags the Theology branch (opens with a religion) and the three ideology trees (open with Political Theory) to Antiquity.
- Content: `30-buildings` re-tags building Ages and gates civic and age-start buildings and wonders behind techs. `35-governments` keeps Exploration governments out of the starting choice and records which civic unlocks each (`ui/cc-governments.js`). `36-great-people-city-states` re-tags Exploration great people and keeps Antiquity's project values. `37-narratives` re-tags Exploration stories to Antiquity. `40-units` gates age-start units and inherited uniques and adds upgrade lineage.
- Restores: `50-restore-antiquity-globals` (worker, Palace and City Hall yields); `55-restore-parked-modifiers` (the effects parked in `1-pre`).
- Resources: `60-resources` makes Exploration resources spawn with their Exploration effects; `64-modern-resource-data` (**generated**) stages Modern resource effects; `65-modern-resources` makes Modern resources spawn and gates both Ages' resource yields and effects behind techs (`ui/cc-hide-resources.js` hides them until researched).
- Personal Age: `70-personal-age` turns Age conditions into research conditions (see below) and adds the world Age; `72-exploration-rules` and `74-modern-rules` attach each Age's rules per player; `75-civ-abilities` (**generated**) the civ abilities; `79-leader-attributes` the attribute points; `81-age-scaled-bonuses` the bonuses vanilla scales by Age; `84-civ-trees` reveals later civs' own civic trees and the Test of Time trees.
- Victories and diplomacy: `76-victories`, `78-diplomacy`, `80-triumphs`, `82-dedication-cards` (**generated**) and `83-dedications`.
- Finish: `90-prune-dangling` drops refs to content that is not imported; `95-prune-dangling-fk` (**generated**) is the safety net for any other broken reference (recorded in `cc_pruned_fk`); `99-cleanup` drops the working tables.

Gate choices (all tunable in one table each):

- Units (`40-units.sql`): Swordsman, Heavy Archer, Courser and Catapult unlock at Machinery; Cog at Cartography.
- Buildings (`30-buildings.sql`): Temple unlocks at Astronomy; Bazaar at Guilds; wonders are mapped by theme.
- Root links (`20-tech-tree.sql`): Cartography follows Navigation, Astronomy follows Mathematics, Machinery follows Military Training (Iron Working was skipped by every AI in long run 4).
- Modern root links (`20-tech-tree.sql`, `25-civic-tree.sql`): Academics follows Urban Planning, Steam Engine and Military Science follow Gunpowder (Exploration's last column, so Modern's tree keeps its vanilla shape); Modernization follows Imperialism, Natural History follows Social Class, Social Question follows Sovereignty.
- Governments (`35-governments.sql`): `cc_government_unlocks` (Theocracy at Piety, Plutocracy at Mercantilism, Feudal Monarchy at Authority), `cc_ai_government_rules` (AI switch and revert rules).
- Exploration rules (`72-exploration-rules.sql`, `cc_exploration_rules`).
- Personal Age (`70-personal-age.sql`, `cc_exploration_roots`): a player is "in Exploration" after any of Cartography, Astronomy, Machinery.
- Later civs' own civic trees (`84-civ-trees.sql`): vanilla's `progression-trees-culture-unique.xml` of Exploration, Modern and civ DLCs are imported (modinfo), re-tagged to Antiquity, and `CC_REVEALRULE_<tree>` reveals each (EFFECT_PLAYER_REVEAL_CULTURE_TREE) once the civ's trait AND its personal Age match.
- Civ abilities per personal Age (`75-civ-abilities.sql`, generated by `tools/gen_civ_abilities.py`): vanilla attaches each civ's ability per Age in `civilizations-<age>.xml`; a modifier vanilla has only in some Ages is moved to a copy `CC_AB_<AQ|EX|MO|AQEX|EXMO>_<id>` whose owner must be in those personal Ages. Runs before `81` so its scaled copies follow.
- Test of Time trees (`84-civ-trees.sql`): `TREE_CIVICS_EX_TEST_OF_TIME` / `_MO_` are revealed to a civ in that personal Age that is not a civ of that Age (vanilla: `TRAIT_ANACHRONISTIC_CIV`), with the per-civ civics of each module's `progression-trees-culture-unique-ex/mo.xml`.
- World Age (end of `70-personal-age.sql`): `CC_REQSET_WORLD_IN_EXPLORATION` / `_MODERN` are true once ceil(m/2) of the m living majors are in that personal Age (one set per m = 1-16, counted with `REQUIREMENT_COLLECTION_COUNT_ATLEAST` over `COLLECTION_MAJOR_PLAYERS`). Growth and town-upgrade steps (`72`/`74`) and Influence cost steps (`78`) hang on them; `CC_CATCHUP_*` give techs/civics ahead of the world Age -20% efficiency and behind it +20%.
- Later-Age resources (`65-modern-resources.sql`, `cc_resource_unlocks`): resource to activating tech. If you change it, update the tech names in `text/3-merge/resource-tooltips.sql`.

## Developer workflow

```
python -I tools/gen_dedupe.py "<Civ7>/Base"            # after every game patch, or after changing imports
python -I tools/gen_modern_resources.py "<Civ7>/Base"  # after every game patch
powershell -File tools/deploy.ps1                # copy into %LOCALAPPDATA%\...\Civilization VII\Mods
powershell -File tools/deploy.ps1 -Remove        # remove from Mods
```

Engine gotchas, all verified:

- **`version` must be an integer.** With `version="0.2.0"` the mod showed as enabled but was silently left out of the game's mod list, with no error.
- The `.modinfo` is cached at game start. Changing it needs a full game restart. Changes to SQL file contents only need a new game.
- Civ VII can't add a resource to the map mid-game outside an Age transition. `EFFECT_CITY_ADD_RESOURCE_TO_PLOT` (city-state bonus) attaches but places nothing when used from a mod, and `Resources.Weight = 0` does not keep a resource off the map. Hence "spawn at start, inactive until the tech".
- "Player has tech" requirements are only reliable on player subjects. Gated effects are attached by a game-wide `COLLECTION_MAJOR_PLAYERS` wrapper (`EFFECT_ATTACH_MODIFIERS`) that carries the requirement.
- The engine accepts `CHANGE_GOVERNMENT` at any time after Chiefdom, for any government; vanilla only limits it through the UI (the chooser lists `StartingGovernments`, read through `GameInfo`). `GameInfo` is a proxy that ignores new properties, but a table's iterator can be patched on the instance.
- `REQUIREMENT_PLAYER_HAS_GOVERNMENT` checks the modifier's owner, so it never matches on a game-wide modifier. The AI rules attach a player-owned inner modifier through a game-wide `EFFECT_ATTACH_MODIFIERS` wrapper.
- UI scripts can only send player operations (grants, government changes) for the local human player; requests for AI players are silently ignored.
- `60-resources.sql` treats modifiers created after the resource import as resource effects; it skips this mod's own `CC_` modifiers, so new merge-file modifiers must use the `CC_` prefix.
- **Personal Age.** Data asks "is the current Age X?" (`REQUIREMENT_GAME_AGE_TYPE_MATCH`) or "have N Age transitions happened?" (`REQUIREMENT_IS_AGE_COUNT`); both would be frozen forever. `70-personal-age.sql` rewrites them, for whatever is loaded, into `REQUIREMENT_REQUIREMENTSET_IS_MET` on a per-player set: Exploration conditions mean the player has an Exploration root tech but no Modern one; "1 transition" means an Exploration root tech; Modern conditions and "2 transitions" mean a Modern root tech (Academics, Steam Engine, Military Science); Antiquity conditions mean no Exploration root tech yet. Account challenges are left alone. Run `tools/age-audit.js` in a game (`CCAge.audit()`) to list any Age dependency left, including Age-tagged table rows. Many Age conditions sit in `<Requirements>` rows, not XML attributes, so audit the loaded database rather than grepping files.
- **Collision deletes cascade.** Deleting a colliding row also deletes or resets every row that references it through a foreign key (deleting the shared `Affinities` rows would have deleted all 63 Antiquity city-states). `gen_dedupe.py` snapshots those rows (`2-dedupe-exploration.sql`) and restores the ones the import does not re-define (`00-restore-cascades.sql`).
- `tools/survey_imports.py` lists every Exploration-only file not imported yet, with its collisions and Age conditions.
- One DB error anywhere makes the engine **roll back the whole mod**. Check `Logs/Database.log` and `Logs/Modding.log` (`* cc-pre`, `* cc-import-exploration`, `* cc-merge` must be listed).

Tests: `tests/cc-tests.js` (run with FireTuner `execute_js_file`, then `CC.db()`, `CC.gating(pid)`, `CC.status()`, `CC.resources()`, `CC.civics()`, `CC.personalAge()`, `CC.greatPeopleCityStates()`, `CC.narratives()`, `CC.exRules()`, `CC.distantLands(pid)`).
