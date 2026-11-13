# Continuous Civilization: Antiquity + Exploration (Phase 2 prototype)

The Antiquity Age never ends. The full Exploration technology and civic trees continue directly from the Antiquity trees, and the Modern ones continue from those (Phase 3, in progress), and Exploration units, buildings, wonders, policies and governments unlock through research.

- **Civics:** the 12 Exploration main civics plus Exploration Future Civic follow Antiquity's (Economics after Commerce, Piety after Philosophy), with their policies, buildings and wonders. Antiquity Future Civic is removed. The Theology branch opens once you have founded a religion.
- **More Exploration content (batch A):** Exploration city-states and their suzerain bonuses join Antiquity's from the start; Exploration city and town projects (Town Temple and Inn focuses; Heliocentric Model at Education, Invent Calculus at Urban Planning) with Antiquity's values kept for the shared ones; the Abbasid and Spanish unique great people; Exploration AI priority lists.
- **Exploration Age rules:** once a player is in their personal Exploration (any of Cartography, Astronomy, Machinery), they get the rules every vanilla Exploration civ has: naval units may enter Deep Ocean, safe deep-ocean trade, land units embark on shallow water, Bazaar and Wharf resource slots, +2 envoys, Gold and Silver counting, base yields of +10 Gold and +20 Science/Culture/Influence (replacing Antiquity's +5 Gold and +10), and Economic victory scoring (points for slotted and imported resources and Gold buildings).
- **Narratives and discoveries (batch B):** Exploration's 1,597 narrative events, discoveries and Test-of-Time stories join Antiquity's pool; their own requirements still gate them, and their Age-transition conditions follow the personal Age.
- **Religion:** Exploration religions are on: research Piety, build a Temple, found a religion and pick beliefs (pantheons still work). Missionaries unlock with Piety; relics exist.
- **Governments:** Feudal Monarchy (Authority), Plutocracy (Mercantilism) and Theocracy (Piety) unlock by civic. The government chooser opens when you unlock one, and the policies screen gets a **Change Government** button. The AI switches by rule once it has the civic: Despotism to Feudal Monarchy (Authority), Oligarchy to Plutocracy (Mercantilism), Classical Republic to Theocracy (Piety). The engine AI picks from all governments at Chiefdom, so an AI that takes an Exploration government before its civic (or a crisis-only one) is set back to an Antiquity one.

Map generation, terrain, rivers, graphics and all Antiquity rules are vanilla, except that later-Age resources also spawn:

- **Exploration and Modern resources** spawn at map start but are **inactive for each player until that player researches** the mapped tech. Until then they give no yields or effects, and a UI script hides them from that player's map icons, tile tooltips and resource screens. Their 3D models stay visible: the engine draws those.
  - Exploration (with Exploration effects): Cartography (Whales, Pitch, Spices, Cloves), Guilds (Sugar, Tea, Cocoa, Furs, Truffles), Machinery (Niter).
  - Modern (with Modern effects): Urbanization (Coffee, Tobacco, Citrus), Academics (Quinine), Steam Engine (Coal), Industrialization (Nickel, Rubber), Combustion (Oil).
- Antiquity resources keep their Antiquity effects.

## Winning

- **Science:** the space race. Once you reach 100 Science victory points with an undamaged Launch Pad, a 5-turn countdown starts and you win when it ends (verified; in a 450-turn AI game Mexico won it on turn 399). Launch Rocket requires Trans-Oceanic Flight, Break the Sound Barrier and Launch Satellite (in vanilla it needs the Modern Science legacy path, which cannot complete here).
- **Domination:** capture every rival's original capital (vanilla's Domination victory; no Age dependence; not yet seen in play).

## Known limitations

- **Culture and Economic victories use fixed targets** (150 Culture, 12,000 Economic points, then a 5-turn countdown; `data/76-victories.sql`) instead of vanilla's 25% lead over second place, which the engine only checks inside a real Modern Age.
- **Military (points) victory cannot be won** (same 25%-lead check). For Military, use Domination.
- **Score victory** is decided when the final Age ends, which never happens here.
- **Legacy paths** do not progress (their per-Age rewards normally pay out at Age transitions, which never happen). Their Modern rewards (World's Fair, Manhattan Project, John Maynard Keynes) are therefore not available.
- **Modern AI file** (`ai-modern.xml`) is not imported: it crashed the game. The AI uses the base military/diplomatic components with Exploration's targets and lists.
- **Modern diplomacy actions** (espionage etc.) are not imported yet; they re-define Antiquity's diplomacy values (planned with the balance pass).

## How it works

Gameplay is data-only (modinfo, SQL, and XML references), plus one display-only UI script. No Firaxis files are copied or modified; generated files are rebuilt from the installed game by the tools below.

| Load order | Group | What it does |
|---|---|---|
| 400 | `cc-pre` | `00-snapshot.sql` records which units/buildings exist and backs up Antiquity globals. `00-pre-dedupe.sql` and `text/00-pre-dedupe-text.sql` remove primary-key and text collisions. Both dedupe files are **generated**. |
| 500 | `cc-import-exploration` | Loads `{age-exploration}` constructibles (incl. gameeffects and no-persist), units (incl. gameeffects), tech tree (incl. gameeffects), civic tree (incl. gameeffects), governments and celebrations, religion (capability, beliefs, relics), great people, projects, city-states, AI lists, narratives and discoveries, Exploration civ common effects, resource effects, `TechnologiesText.xml` and `ResourcesText` straight from the installed game. `01-park-modifiers.sql` (in `cc-pre`) first parks the Antiquity versions of resource effects that Exploration redefines. |
| 600 | `cc-import-modern` | Loads `{age-modern}` tech and civic trees, buildings, units, civ common effects, governments and celebrations, great people and great works, projects, city-states, AI lists, railroads, narratives and discoveries (each incl. gameeffects), `TechnologiesText.xml` and `ProjectsText.xml`. Not yet: diplomacy actions (they re-define Antiquity's; balance batch), victories (3.5). `09-dedupe-cc-import-modern` (**generated**) first deletes rows, modifiers and text the Exploration import already added that Modern re-defines (the later Age wins), after snapshotting the rows those deletes cascade into; `09-restore-cc-import-modern` (**generated**, last item) puts them back. |
| 700 | `cc-import-resources` | `05` snapshots the modifier list, then the Exploration resource effects load. Must stay the last import group: `60` treats every modifier added after `05` as a resource effect. |
| 1000 | `cc-merge` | `10` age clock off (`EndsAge=0`, 1,000,000 max points). `20` grafts Exploration techs into `TREE_TECHS_AQ`, removes Antiquity Future Tech. `21` grafts Modern techs after them and removes Exploration Future Tech (Modern's is the end of the tree). `25` does the same for civics (`TREE_CIVICS_AQ_MAIN`) and re-tags the Theology branch to Antiquity (opens with a religion). `26` grafts Modern civics and re-tags the three ideology trees to Antiquity (they open with Political Theory). `30` re-tags building ages and gates civic/age-start buildings and wonders behind techs. `06` (**generated**) puts back rows the collision deletes cascaded into. `36` re-tags Exploration great people and keeps Antiquity project values. `37` re-tags Exploration stories to Antiquity. `35` keeps Exploration governments out of the starting choice and records which civic unlocks each (`ui/cc-governments.js` uses that). `40` gates age-start units and inherited uniques, adds upgrade lineage. `50` restores Antiquity worker, Palace and City Hall yields. `55` restores the parked Antiquity resource effects and text. `60` makes Exploration resources spawn and keeps their Exploration effects. `64` (**generated**) stages Modern resource effects; `65` makes Modern resources spawn and gates both Ages' resource yields and effects behind techs; `ui/cc-hide-resources.js` hides them in the UI until researched. `70` gives every player a **personal Age**: Age conditions in the data become research conditions (see below). `72` attaches the Exploration Age rules per player from their personal Exploration; most end at their personal Modern. `74` attaches the Modern Age rules from their personal Modern. `90` prunes dangling modifier refs, and tree unlocks whose target (unit, building, project, tradition, modifier, government) is not imported yet. `99` drops work tables. |

Gate choices (all tunable in one table each):

- Units (`40-units.sql`): Swordsman, Heavy Archer, Courser and Catapult unlock at Machinery; Cog at Cartography.
- Buildings (`30-buildings.sql`): Temple unlocks at Astronomy; Bazaar at Guilds; wonders are mapped by theme.
- Root links (`20-tech-tree.sql`): Cartography follows Navigation, Astronomy follows Mathematics, Machinery follows Military Training (Iron Working was skipped by every AI in long run 4).
- Modern root links (`21`, `26`): Academics follows Urban Planning, Steam Engine and Military Science follow Gunpowder (Exploration's last column, so Modern's tree keeps its vanilla shape); Modernization follows Imperialism, Natural History follows Social Class, Social Question follows Sovereignty.
- Governments (`35-governments.sql`): `cc_government_unlocks` (Theocracy at Piety, Plutocracy at Mercantilism, Feudal Monarchy at Authority), `cc_ai_government_rules` (AI switch and revert rules).
- Exploration rules (`72-exploration-rules.sql`, `cc_exploration_rules`).
- Personal Age (`70-personal-age.sql`, `cc_exploration_roots`): a player is "in Exploration" after any of Cartography, Astronomy, Machinery.
- Later-Age resources (`65-modern-resources.sql`, `cc_resource_unlocks`): resource to activating tech. If you change it, update the tech names in `text/65-modern-resources-text.sql`.

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
- **Collision deletes cascade.** Deleting a colliding row also deletes or resets every row that references it through a foreign key (deleting the shared `Affinities` rows would have deleted all 63 Antiquity city-states). `gen_dedupe.py` snapshots those rows (`00-pre-dedupe.sql`) and restores the ones the import does not re-define (`06-restore-cascades.sql`).
- `tools/survey_imports.py` lists every Exploration-only file not imported yet, with its collisions and Age conditions.
- One DB error anywhere makes the engine **roll back the whole mod**. Check `Logs/Database.log` and `Logs/Modding.log` (`* cc-pre`, `* cc-import-exploration`, `* cc-merge` must be listed).

Tests: `tests/cc-tests.js` (run with FireTuner `execute_js_file`, then `CC.db()`, `CC.gating(pid)`, `CC.status()`, `CC.resources()`, `CC.civics()`, `CC.personalAge()`, `CC.batchA()`, `CC.batchB()`, `CC.exRules()`).
