# Phase 3 test results (Modern)

## 3.0 Spike: victories in a game that stays in Antiquity (2026-11-12)

- Victories in this game version are a whole-game points race (`VictoryTypes`, `VictoryScorings` in base-standard), read with `player.Victories.getPointsForVictoryType(victory.$hash)`. `LegacyPaths.getScore` reads 0 even in vanilla and is not what victories use.
- 40 turns of AI autoplay, vanilla vs mod: Military 8-12 vs 8-12, Culture up to 11 vs up to 10, Score ~900 vs ~940; Economic 12 for one civ vs 0 (fixed: GDP trackers added to `72`).
- Test win: Rome given 100 Science points with the Launch Pad requirement waived won a Science victory on turn 6 (5-turn countdown), Age still Antiquity, `FinalAge` untouched; normal end-game screen.
- `Game.AgeProgressManager.isFinalAge` comes from game setup (not changed by `VictoryTypes.FinalAge` or `Ages.ChronologyIndex`); dominance targets read -1 before the final Age in vanilla too.

## 3.1 Modern tech and civic trees (2026-11-12)

- Imports in a new `cc-import-modern` group (600); resource effects moved to their own last group (700). `tools/gen_dedupe.py` now also handles clashes between import groups (`09-dedupe-<group>.sql` / `-text.sql`); for the trees that is 3 text tags (Future Tech).
- `21` / `26` graft the roots, remove Exploration's Future Tech and Future Civic, move Modern nodes into the merged trees, re-tag the ideology trees.
- First load failed FK validation: Modern civic unlocks name Modern governments (`RequiredGovernmentType`), which arrive in 3.4. `90` now drops unlocks whose government or target is not imported yet (forward-compatible).
- **Verified live:** `CC.modernTrees()` passes (17 techs and 10 main civics in the merged trees, all six root links, no orphans, Exploration Future Tech/Civic gone, ideology trees on Antiquity, names show as text). `db`, `resources`, `civics`, `personalAge`, `batchA`, `batchB`, `exRules` pass (two checks updated for the new end of tree). Tech tree screen renders the whole chain through Rocketry to Future Tech.
- **Found after the first pass (user report):** the tech screen hid Academics, Steam Engine, Military Science, Nuclear Fission (and so Urbanization), leaving link stubs in empty space. Cause: those nodes only unlock Modern units and buildings, which `90` pruned because they are not imported yet; a node with nothing to unlock is reported by `Game.ProgressionTrees.canEverUnlock` as locked, and `tree-grid.js` drops locked nodes and their links. The graft links themselves are correct. Resolved by importing Modern buildings and units (3.2). Ideology civics also report locked but still have their unlocks; they open with Political Theory as in vanilla.
- Cosmetic, open: a few Modern unlock icons show as magenta placeholders (likely Modern-only icon assets); revisit when Modern buildings/units are imported.
- Not yet: a long run where the AI reaches Modern techs; Modern units, buildings, projects and governments (3.2-3.4), so most Modern techs unlock nothing yet.

## 3.2 Modern buildings and units (2026-11-12)

- Imports (cc-import-modern): constructibles (+ gameeffects, no-persist), constructible-modifiers (+ gameeffects), units (+ gameeffects). `08-pre-modern-import.sql` snapshots Units/Constructibles so `30`/`40` tell Exploration's additions from Modern's. 6 worker-yield rows re-defined by Modern are handled by the generated `09-dedupe-cc-import-modern.sql` (`50` still restores Antiquity's).
- Gates: Line Infantry, Field Cannon, Cuirassier, Mortar, Frigate at Military Science; Grocer and City Park at Urbanization; Mountain improvement at Industrialization. Catch-alls: Modern units at Military Science, Modern buildings (mostly civ-unique, from Modern civs' own civic trees, not imported) at Urbanization. Upgrades: Pikeman and Arquebusier -> Line Infantry, Lancer -> Cuirassier, Bombard -> Field Cannon, Galleon -> Frigate.
- **Verified live:** database validates; all suites pass, new `CC.modernContent()` and `CC.modernTrees().allModernTechsShown` (no Modern tech reports "can never unlock" any more). The tech screen shows Academics, Steam Engine, Military Science, Urbanization and Nuclear Fission again.

## Tree screen links (2026-11-12, `ui/cc-tree-links.js`)

Links that skip a column are routed through invisible waypoints by vanilla's tree screen, which has three bugs that vanilla's own trees rarely trigger (the merged trees trigger them often):
1. `TreeGrid.generateLayoutData` removes the wrong link when rerouting (`indexOf(from)` returns -1, `splice(-1, 1)` drops the source's last link). Fixed: links taken from the layout graph. Verified: Machinery -> Castles and Guilds -> Education drawn again.
2. Waypoints are placed as if cards were one row tall; under a two-level card ("Heraldry II") the line runs hidden behind it. Fixed: such waypoints move one row down. Verified: Castles -> Metallurgy is one continuous line.
3. A straight leg between two waypoints starts halfway. Patched (start at 0, full length).
- **Open:** links that skip two columns still show a gap (Steam Engine -> Combustion, Computation -> Aerodynamics). They come from the Modern roots sitting at different depths (Academics/Steam Engine after Education/Metallurgy, Military Science one column later after Gunpowder). Rooting all three after Exploration's last column (Urban Planning, Gunpowder) would keep Modern's tree in its vanilla shape with no column-skipping links; **decided 2026-11-12:** re-rooted (Academics after Urban Planning, Steam Engine and Military Science after Gunpowder); techs that do not lead on are fine.
- **After re-rooting (verified live, mod restarted):** all suites pass; `cc-tree-links.js` loads with the mod. The tech screen is clean from Antiquity through Exploration to Modern's Future Tech; Modern keeps its vanilla shape.
- **Still open (cosmetic):** Guilds -> Education draws as two parallel segments about 30 px apart (both legs of the waypoint are straight lines at different heights, no connector). Modern unlock icons for diplomacy actions show raw names (e.g. `DIPLOMACY_ACTION_ESPIONAGE_SABOTAGE_SHIPPING`) until Modern diplomacy is imported (3.4).

## 3.3 Personal Modern Age and Modern rules (2026-11-12)

- `70`: personal Modern Age (`CC_REQSET_PERSONAL_AGE_MODERN`: any of Academics, Steam Engine, Military Science). "Age is Modern" and "2 transitions" -> in Modern; "Age is Exploration" -> in Exploration and not yet Modern (as Antiquity content already ends at Exploration). Test hook `CC_TEST_IN_MODERN`. No Modern Age conditions are loaded yet outside account challenges (the ones in Modern's civ-common file sat in advanced-start modifiers); more arrive with 3.4.
- Modern `civilizations-common-gameeffects.xml` imported. `gen_dedupe.py` now handles modifier ids that two import groups define (18 here: later import wins; the earlier modifier, its arguments, strings and own requirement sets are removed first).
- `72`: Exploration rules end at the personal Modern Age (the attached modifier gets "not in Modern", combined with its own condition where it has one), except the four Economic trackers, which Modern civs also have.
- **Found and fixed: Exploration settlement cap never applied.** Each Age's cap modifier shares one id and Antiquity's (+3) is kept, so no player ever got Exploration's "at least 8". Now `CC_EX_SETTLEMENT_CAP` (at least 8) is an Exploration rule and `CC_MO_SETTLEMENT_CAP` (at least 16) a Modern rule.
- `74-modern-rules.sql`: Modern rules per player: ocean travel, embarkation, envoys, Department Store/Port/Factory resource slots, base +15 Gold / +30 Science, Culture, Influence, Factory town focus, ideology agendas, counter-spy, settlement cap.
- **Verified live:** all suites pass (new `CC.modernRules()`, extended `CC.personalAge()`). Player 0, capital founded: Antiquity Gold 5 / Science 0 / Culture 1 / Influence 0 -> Astronomy (Exploration): cap 8, 10 / 20 / 21 / 20 -> Academics (Modern): cap 16, 15 / 30 / 31 / 30 (replaced, not stacked). Rules attached to player 0 only.

## 3.4 Modern governments and systems (2026-11-12)

- Imported in cc-import-modern: governments, celebrations (golden ages), capabilities, great works, great people, projects (incl. space race), city-states, AI lists, pseudoyields, railroads, narratives, discoveries, Test-of-Time stories, narrative display (+ gameeffects), `ProjectsText`.
- **Left out: Modern diplomacy actions.** The file re-defines 99 Antiquity diplomacy rows (influence costs, responses), which would change diplomacy from turn 1; deferred to the balance batch with Exploration's. Tree unlocks of missing diplomacy actions are pruned by `90` (no more raw-name icons).
- Governments (`35`): Bureaucratic Monarchy at Modernization, Elective Republic at Social Question, Authoritarianism at Political Theory (not starting governments; the UI chooser picks them up from `CC_GOVUNLOCK_*`). AI rules are now keyed by (government, kind): Feudal Monarchy -> Bureaucratic Monarchy, Plutocracy -> Elective Republic, Theocracy -> Authoritarianism at those civics; a Chiefdom pick of a Modern government reverts like the Exploration ones.
- Great people and stories re-tagged to Antiquity (`36`, `37`). Modern resources now unlock at Modern techs (`65`): Coffee/Tobacco/Citrus at Urbanization, Quinine at Academics, Coal at Steam Engine, Nickel/Rubber at Industrialization, Oil at Combustion.
- **Generator:** clashes between import groups now snapshot the rows their deletes cascade into (283 child tables) and restore them at the end of the group (`09-restore-<group>.sql`). Without it, deleting the re-defined `AFFINITY_*` rows would have wiped every city-state.
- **Verified live:** database validates; all 11 suites pass (new `CC.modernSystems()`); 173 city-states (Antiquity, Exploration 61, Modern 49) over all three affinities; 81 great people, all on the Antiquity tag. 30 turns of autoplay: GameCore clean (only vanilla unit-flag UI warnings).
- Not yet: AI government switches to Modern governments in a long run; ideology choice in play.

## 3.5 Victories: investigation (2026-11-12)

How each standard victory is decided in this game version (`VictoryTypes`):
- **Science** - fixed score: 100 points plus an undamaged Launch Pad, then a 5-turn countdown. Works in our game (3.0 spike).
- **Military, Culture, Economic** - dominance: target = 1.25 x the second-best score (a 25% lead), then a 5-turn countdown. Observed in a vanilla Modern game: targets -1 at turn 28 (20% Age progress); at turn 133: Military 70, Culture 341, Economic 8,848, each exactly 1.25 x second place; an Economic victory had been won at turn 116.
- **Score** - decided at the final Age's end; never here.

In our game the dominance targets stay -1, so those three victories cannot be won. Ruled out as the switch:
- `isFinalAge`: the setup option "No Age Transitions" (`SingleAgeGame`, added in `config/cc-setup.sql`) makes it true, but targets stay -1.
- Age progress: with the meter shrunk to 40, targets stayed -1 through 100% (the Age-end countdown started; no game end).
- Legacy paths: with Modern's milestones imported, granting a full path's points (`EFFECT_PLAYER_GRANT_VICTORY_POINT`, attached to player 0) completed nothing, not even an Antiquity path (control), with or without re-tagging Modern paths to Antiquity. The vanilla game also reports no enabled legacy paths. Legacy-path rewards (World's Fair, Manhattan Project, Keynes) and Launch Rocket's legacy-path requirement are therefore unreachable as is.

Also noted: wonders, celebrations and unique quarters score by Age (4/8/12 for wonders); with everything tagged Antiquity, Exploration and Modern ones probably score at Antiquity's rate.

### Decision and implementation (2026-11-12, version 18)

- **Decided (user):** Culture and Economic victories are a known limitation for now (documented in the README); to be implemented in a later version. Military: Domination (capture every original capital), as in Civ VI.
- Domination is already enabled by default (`VICTORY_DOMINATION`, `REQUIREMENT_TEAM_DOMINATION_VICTORY`, no Age link); no change needed. Not yet seen in play.
- `76-victories.sql`: Launch Rocket no longer requires the Modern Science legacy path; it requires Trans-Oceanic Flight, Break the Sound Barrier and Launch Satellite instead.
- Modern `victories.xml`, `victories-gameeffects.xml` and `legacy-path-gameeffects.xml` are imported (AI victory strategies, Modern milestones).
- The "No Age Transitions" setup change was removed again (no benefit found).
- **Verified live:** database validates; all 12 suites pass (new `CC.victories()`: Domination enabled, Science target 100, Launch Rocket prerequisites, not single-Age).
- Not yet: whether 100 Science points are reachable in a long game; Domination in play.

## 3.6 Long run (2026-11-12)

### First attempt: crash at turn 173, and a serious bug it exposed

- 300-turn AI autoplay (Rome, Mexico, Han, Persia, Egypt, Russia) crashed natively at turn 173, right after the autosave; loading that autosave and pressing Begin hung the game, so it reproduces.
- At turn 171 every civ had exactly one city, settlement cap 1-2, no Exploration tech, Science 2-34 per turn; Mexico had been eliminated. Long run 5 (Phase 2) had several cities each and 4 of 6 civs at Machinery by turn 151.
- **Cause:** `01-park-modifiers.sql` parks (deletes) Antiquity modifiers that an import re-defines; the delete cascades into the rows linking them to traits, governments, traditions, abilities (`TraitModifiers` etc., FK ON DELETE CASCADE), and `55` put back the modifiers but not those links. Since the Exploration civ-common import (last step of Phase 2, after long run 5), `TRAIT_ANTIQUITY_CIV` lost 6 of its 19 modifiers: the +3 settlement cap, capital and city resource caps, Gold/Happiness for unassigned resources, and the base +10 Science/Culture/Influence.
- **Fix:** `01` snapshots the link rows of parked ids (9 link tables), `55` also snapshots the imported versions' links before deleting them, then restores both. New test `CC.parkLinks()` (all 19 vanilla `TRAIT_ANTIQUITY_CIV` modifiers attached; cap still 3). Verified: all 13 suites pass.
- The crash itself was a separate problem (below).

### Second attempt: crash at turn 87, and the AI fixes

- On the link-fixed build the run crashed natively at turn ~87 (`EXCEPTION_ACCESS_VIOLATION`, heap frames; reproduced twice from the turn-86 autosave, at turns 87 and 89). Civs had 1-2 cities at turn 85 although settlers were buildable and caps were 4-6.
- **Cause:** the later-Age AI files rewrite the major-civ AI from turn 1. `ai-exploration.xml` (since Phase 2) swaps the base `Military`, `Diplomatic` and `Tactical` components for their Exploration versions; `ai-modern.xml` (added in 3.4) additionally adds `Military_Modern` and removes the diplomatic component.
- **Fix:** `ai-modern.xml` is no longer imported (verified: the turn-86 save then ran 22 turns past both crash points); `36-batch-a.sql` puts the base Military/Diplomatic/Tactical components back (Exploration targets and lists stay). Test: `CC.modernSystems().aiBaseComponents`.

### Third attempt: long run 6, 300 turns, clean (version 19 + AI fix)

Rome, Norman, Mexico, Shawnee, Spain, French Empire; 300 turns of AI autoplay, no crash; no GameCore or script errors; several city-states conquered.

| Civ | Cities | Personal Age | Government | Exploration techs | Modern techs | Modern civics | Science/turn | Modern land/naval units |
|---|---|---|---|---|---|---|---|---|
| Rome | 15 | Modern | Authoritarianism | 14 | 9 | 8 | 501 | 25 |
| Norman | 7 | Modern | Feudal Monarchy | 12 | 1 | 1 | 256 | 0 |
| Mexico | 13 | Modern | Revolucion (unique) | 14 | 6 | 6 | 834 | 7 |
| Shawnee | 15 | Modern | Feudal Monarchy | 13 | 2 | 2 | 351 | 0 |
| Spain | 12 | Modern | Feudal Monarchy | 12 | 2 | 2 | 376 | 0 |
| French Empire | 6 | Modern | Authoritarianism | 14 | 5 | 6 | 429 | 0 |

- **Expansion fixed:** 6-15 cities (before the fixes: one). Settlement caps 17-21 (Exploration minimum 8, Modern 16, plus techs).
- **All six civs reached their personal Modern Age** (at turn 251: four Modern, two Exploration).
- **AI government chain works:** Rome and France went Theocracy -> Authoritarianism at Political Theory.
- **Victory points at turn 301:** Science 19-77 (target 100; Rome 77, so a Science win is plausibly reachable later), Military 28-73, Culture 17-78, Economic 4,909-8,882. No win yet.
- All suites pass (`notStartingGovernments` now reads the table without the UI script's additions).
- Not seen yet: a Science or Domination win; a human playing through the Modern UI.

### Long run 6 continued to turn 451: first natural victory

- **Mexico won a Science victory on turn 399** (space race, normal end-game screen; autoplay played on to 451). No crash in 450 turns.
- AI government chain completed: Norman, Shawnee and Spain went Feudal Monarchy -> Bureaucratic Monarchy at Modernization; Rome and France Theocracy -> Authoritarianism; Mexico kept its unique Revolucion.
- Turn 451: 6-15 cities each, 10-16 Modern techs, Science 277-1,421 per turn; points Science 45-109, Culture 35-239, Military 28-73, Economic 9,375-16,847.
