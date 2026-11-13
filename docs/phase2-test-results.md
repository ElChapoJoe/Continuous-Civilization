# Continuous Civilization — Phase 2 Test Results (Antiquity → Exploration)

**Date:** 2026-11-12
**Mod:** `mod/continuous-civ/` (modinfo `version="2"`)
**Build under test:** Civilization VII (Steam)
**Method:** FireTuner MCP against disposable single-player games (Rome, Tiny map, 4 majors). Test suite: `tests/cc-tests.js`. No game files modified.

## Verdict: **PASS.** All acceptance tests passed. Phase 3 may begin.

| # | Acceptance test | Result | Evidence |
|---|---|---|---|
| 1 | Database validation succeeds | **PASS** | `[gameplay]: Passed Validation` in every launch and every reload. `Modding.log` lists `cc-pre`, `cc-import-exploration`, `cc-merge`. |
| 2 | Techs researched normally across the Antiquity→Exploration boundary | **PASS** | Controlled test: once Antiquity was done, the available techs were exactly Cartography, Astronomy and Machinery (577 science each). Machinery, Astronomy and Heraldry were each completed via `SET_TECH_TREE_NODE` plus normal science, not grants. Long run: all 4 AIs researched Exploration techs on their own (first at about turn 90). |
| 3 | Units and buildings unlock at their intended techs | **PASS** | Sweep of all 14 Exploration techs: each unlocked exactly its own units and buildings. **0 violations** (table below). |
| 4 | No Age transition | **PASS** | 151 turns: progress 151 of 1,000,000, `isAgeOver=false`, `countdownStarted=false`, still `AGE_ANTIQUITY`. |
| 5 | Save/load works with the modified tree | **PASS** | Saved `CC_Phase2_SaveLoad` at turn 6 with 14 Exploration techs. After exit and reload: identical fingerprint (turn, 29 unlocked nodes, units, gold, 6 trainable / 29 buildable). DB re-validated. Play continued for 2 more turns. Long-run checkpoints T51/T101/T151 saved fine. |
| 6 | Stable over ≥150 automated turns | **PASS** | Turns 1→151 autoplayed, no crash dumps, process alive throughout. `UI.log` has only a vanilla `unit-flags.js` null-unit warning (seen during autoplay). |
| 7 | AI researches and builds later-period content | **PASS** (partial for units) | By T151 every AI had 2–3 Exploration techs. They built Bazaars, Guildhalls and Kilns (all 4 civs) and two Exploration wonders (Brihadeeswarar Temple by Shawnee, Hale o Keawe by France). **No Exploration *units* were trained yet.** Only Cog was available, and the AI didn't choose it. |
| 8 | Map generation, terrain, rivers and graphics unchanged | **PASS** | No map or art data touched. Vanilla continents-voronoi script, standard visuals. |
| 9 | No premature access to later content | **PASS** | Turn 3: 0 Exploration units or buildings available to any of 4 civs, incl. Shawnee (an Exploration civ; in Phase 1 AIs had Coursers and Mamluks by now). `CC.gating` = 0 violations at T3, T51, T101 and T151 for all civs. |

### Static database checks (`CC.db()`; all 14 pass, every game)

- One tree: `TREE_TECHS_AQ` = 30 nodes, `TREE_TECHS_EX` = 0.
- Antiquity Future Tech removed. Exploration Future Tech (repeatable) requires Gunpowder and Urban Planning, and nothing requires it, so it sits at the end.
- Roots linked: Cartography←Navigation, Astronomy←Mathematics, Machinery←Iron Working.
- Every node is reachable from Agriculture, and every Exploration node has a prereq.
- Age clock: `EndsAge=0`, `MaxPoints=1,000,000`, event points total 0.
- Age-start units gated. All 31 Exploration buildings and wonders gated by an Exploration tech. Upgrade lineage Phalanx→Swordsman, Archer→Heavy Archer, Horseman→Courser, Ballista→Catapult, Quadrireme→Cog.
- Antiquity globals intact: workers F−1 H−1 S0 C0, age-modifier F−1 H−1, Palace 5/5/5 (Exploration would set 10/10/10).
- No `cc_*` work tables left.

### Unlock sweep (player 0, one tech at a time, `CC.gating` after each)

| Tech | Newly trainable | Newly buildable | Violations |
|---|---|---|---|
| Machinery *(researched normally)* | Swordsman, Heavy Archer, Courser, Catapult | Gristmill, Sawmill | 0 |
| Astronomy *(researched normally)* | — | Observatory, Temple | 0 |
| Heraldry *(researched normally)* | Knight, Man-at-Arms, Privateer (Courser and Swordsman correctly go obsolete) | Erdene Zuu | 0 |
| Cartography | Cog | Wharf, Hale o Keawe | 0 |
| Castles | Crossbowman | Dungeon, Medieval Walls | 0 |
| Guilds | — | Guildhall, Kiln, Bazaar, Brihadeeswarar Temple | 0 |
| Feudalism | — | Tavern, Borobudur, Stonecutter | 0 |
| Education | — | University, Medieval Bridge, House of Wisdom | 0 |
| Shipbuilding | Carrack | Shipyard | 0 |
| Metallurgy | Trebuchet | Armorer, Tomb of Askia | 0 |
| Architecture | — | Menagerie, Pavilion, Notre Dame | 0 |
| Metal Casting | Lancer, Pikeman | Forbidden City | 0 |
| Urban Planning | — | Bank, Hospital, El Escorial | 0 |
| Gunpowder | Arquebusier, Bombard, Galleon, Privateer II | — | 0 |

### Long run (fresh game, no grants, AI on all 4 slots)

| Turn | Age / progress | Exploration techs (Rome / Shawnee / France / Egypt) | Exploration buildings | Gating |
|---|---|---|---|---|
| 51 | AQ, 51/1e6 | 0 / 0 / 0 / 0 | — | 0 violations |
| 93 | AQ, 93/1e6 | 1 / 1 / 0 / 1 | — | — |
| 101 | AQ, 101/1e6 | 1 / 2 / 1 / 1 | none yet | 0 violations |
| 151 | AQ, 151/1e6 | 2 / 3 / 2 / 2 | Bazaar ×6, Guildhall ×5, Kiln ×3, Brihadeeswarar Temple, Hale o Keawe | 0 violations |

---

## Building art (answer to "do buildings update their style as the age progresses?")

**CONFIRMED (asset library, `WorldUI.getAssetNames()`):**

- Art is chosen per civilization culture set. Rome (Mediterranean) has two building sets: `MED_ROM_*` for Antiquity (houses `Bld_*`, Granary, Barracks, Brickworks, Palace, City Hall) and `MED_SPN_*` for Exploration (houses `CityBld_*`, Bank, Kiln, Bazaar, University, Observatory, Armorer, Hospital, plus their own Palace and City Hall).
- **Exploration buildings use their Exploration-era models.** Guildhall has no Mediterranean model and falls back to `GEN_Wood_GuildHall`.
- **The city itself does not restyle.** Houses, Palace and City Hall stay Roman. In vanilla, the visual jump happens because you switch civilization at the Age transition, which never occurs here. No model swaps were seen, and no missing or broken models were seen in screenshots.

**Not verified:** the exact engine rule that picks `*_ANT` vs `*_EXP` culture variants (by current Age vs by building). Whatever the rule, a permanent Antiquity Age means no automatic city restyle.

---

## Engine findings and limitations discovered in Phase 2

1. **`version` must be an integer** (`version="0.2.0"` → mod silently excluded from the game's mod list while the API still reports `enabled:true`; no log error). Fixed with `version="2"`.
2. **One DB error rolls back the whole mod**, as in Phase 1. Collision handling is now generated by `tools/gen_dedupe.py` (9 gameplay rows + 3 text tags for this build).
3. **Exploration's `constructibles-no-persist.xml` mixes global overrides with per-building data.** It sets Palace/City Hall to 10, worker yields, and the worker age modifier to −2. Antiquity values are snapshotted and restored, and the per-building rows (University science modifiers, building tags, warehouse yields) are kept.
4. **Content with no tech unlock is available immediately.** In vanilla this covers age-start units, civic-unlocked buildings and Exploration wonders. All are now tech-gated through tunable mapping tables, with a catch-all for anything new.
5. **AI pace:** on Tiny/Standard speed the AI reaches Exploration techs around turn 90 and has 2–3 by turn 150. Exploration tech costs (base 525–3,625; observed in-game 577 for the roots, 957 for Heraldry) are tuned for Exploration-age economies. Balance tuning needed.
6. **AI unit choice:** no Exploration units trained by T151. Only Cog was available. Antiquity AI unit-preference lists (`ai-antiquity.xml`) don't reference Exploration units. Not yet a defect; needs a longer run to judge.
7. **City art does not restyle** (above).

---

## Remaining obstacles before Phase 3 (Modern)

| # | Obstacle | Severity | Notes |
|---|---|---|---|
| 1 | ~~**Civics are still Antiquity-only.**~~ **Mostly resolved 2026-11-12** (see "Civics and governments" below). | Low | Exploration main civics, policies and governments merged, AI included. Left: Theology branch (needs religion), Exploration Test-of-Time attribute tree, civ-unique Exploration trees. |
| 2 | ~~**Map resources per Age.**~~ **Resolved 2026-11-12** (see "Map resources" below). | — | Exploration and Modern resources spawn at map start but stay inactive and hidden per player until a mapped tech. Phase 3 remaps the Modern activating techs to Modern ones. |
| 3 | **Exploration systems not imported:** religion (Exploration religion/Missionaries), Distant Lands and treasure fleets, legacy paths/victories, crises, golden ages, Exploration discoveries/narratives, great people. | Medium | Each is a separate age-current file set with its own collisions. Legacy paths and victories decide how a continuous game is *won*, which needs a design decision. |
| 4 | **Balance:** tech cost curve, building yields, unit strengths across eras, AI tech pace. | Medium | Exploration techs cost ~3–5× late-Antiquity ones. AI reached only 2–3 Exploration techs by T151. |
| 5 | **AI unit and building priorities** for later-era content. | Medium | Consider importing Exploration AI lists (`ai-exploration.xml`, collisions expected) or adding pseudo-yield entries. |
| 6 | **Localization:** only `en_us` Exploration tech text imported. | Low | Other locales show English names for Exploration techs. Age-specific l10n files collide broadly and need generated dedupe. |
| 7 | **DLC content:** DLC civs, wonders and units of Exploration aren't imported. | Low/Med | Same pattern, conditional on `ModInUse`. |
| 8 | **City art never advances eras.** | Low (cosmetic) | Engine-side choice. No data lever found. Also applies to roads, bridges and ground art: the asset library has Age variants (ANT/EXP wooden bridges, MOD stone bridge, EXP brick paving and city layouts), picked by the global Age, so the map keeps the Antiquity set. Parked by the user 2026-11-12; possible route: mod-shipped art definitions (would switch the whole map at once, not per player). |
| 9 | **Multiplayer and Workshop packaging** untested. | Low | Integer `version`, `AffectsSavedGames=1`, generated dedupe must be refreshed per game patch. |
| 10 | **Civilopedia:** Exploration tech pages (`civilopedia-exploration.xml`) not imported. | Low | Cosmetic. |

## Exploration Age rules (added 2026-11-12)

Vanilla gives every Exploration civilization a common trait (`TRAIT_EXPLORATION_CIV`). Compared with Antiquity's (`TRAIT_ANTIQUITY_CIV`), its Exploration-only rules are applied here per player from their personal Exploration (`72-exploration-rules.sql`, game-wide wrappers on `CC_REQSET_TEST_IN_EXPLORATION`; definitions from the imported Exploration `civilizations-common-gameeffects.xml`):

- **Deep Ocean for naval units** (`MOD_TECH_OCEAN_TRAVEL`) and safe deep-ocean trade. **Found missing:** nothing granted ocean travel before this, so no player could cross deep ocean. Land units' deep-water embarkation already comes with Shipbuilding.
- Land units embark onto shallow water (Antiquity: rivers only); Bazaar +1 / Wharf +2 resource slots; +2 envoys; Gold and Silver count per instance; trade focus for Distant Lands towns; AI naval sight +1.
- Base yields switch from Antiquity's +5 Gold / +10 Science, Culture, Influence to Exploration's +10 Gold / +20 (Antiquity's are made non-permanent and gated on "not in Exploration"; Exploration's Gold modifier re-uses an Antiquity id, so it is a CC_ copy).
- Economic victory scoring (added 2026-11-12 after the Phase 3.0 spike): the four "GDP" tracker activations (`TRAIT_BONUS_RESOURCE_GDP`, `TRAIT_CITY_RESOURCE_GDP`, `TRAIT_GOLD_BUILDING_GDP`, `TRAIT_IMPORTED_RESOURCE_GDP`). Without them nobody scored Economic victory points. Verified: after Astronomy, player 0 alone got the Gold-buildings tracker; `CC.exRules()` passes with 16 wrappers.
- Left out: Age-transition "advanced start" bonuses (including advanced-start GDP), free ship.

**Verified live:** all suites pass (`CC.exRules()`, 12 wrappers). After granting level 1 of Astronomy to player 0, every rule attached to exactly player 0, and its net yields went from Gold 7 / Science 0 / Culture 1 / Influence 0 to 12 / 20 / 21 / 20 (+5 Gold, +20 each).

## Long run 5 (2026-11-12, Machinery fix and revert-window fix)

Fresh game, 6 civs (Rome, Maurya, Prussia, Songhai, French Empire, Mexico), 150 turns of AI autoplay. All alive at T151, no errors in GameCore or UI logs.

| Player | Exploration techs | Exploration civics | Government | Religion | Exploration land units |
|---|---|---|---|---|---|
| Rome | Astronomy, Machinery | Piety, Inspiration, Society | **Theocracy** (from T128) | Islam (T139) | 1 Catapult |
| Maurya | Cartography, Guilds | 0 | Oligarchy | - | 0 |
| Prussia | Machinery | 0 | Classical Republic | - | 4 Heavy Archers |
| Songhai | Cartography, Astronomy, Machinery, Guilds, Feudalism | Piety | Oligarchy | Protestantism (T149) | 12 (Coursers, Heavy Archers, unique Tajiro) |
| French Empire | 0 | 0 | Classical Republic | - | 0 |
| Mexico | Machinery | 0 | Revolucion (Mexico's unique) | - | 2 Coursers |

- **Machinery fix confirmed:** 4 of 6 civs reached Machinery (run 4: none); 19 Exploration land units in play (run 4: none). Niter's gated effects are active for those 4.
- **Revert-window fix confirmed:** Rome switched Classical Republic -> Theocracy at Piety (T128) and stayed; the Chiefdom revert still works (Songhai Plutocracy -> Oligarchy at T11). No same-turn flips.
- **Religion:** two AI-founded religions without any help (Islam T139, Protestantism T149).

## Long run 4 (2026-11-12, with religion, personal Age, batches A and B)

Fresh game, 6 civs (Rome, Bulgaria, Shawnee, French Empire, Achaemenid Persia, Great Britain), 150 turns of AI autoplay. All alive at T151, no errors in GameCore or UI logs.

| Player | Antiquity techs / civics | Exploration techs | Exploration civics | Government | Exploration units / buildings |
|---|---|---|---|---|---|
| Rome | 14/15, 11/13 | Cartography | Piety | Classical Republic | 0 / 0 |
| Bulgaria | 14/15, 7/13 | Cartography, Astronomy, Guilds, Feudalism | 0 | Despotism | Cog / Observatory, Bazaar |
| Shawnee | 14/15, 9/13 | Cartography, Astronomy | 0 | Despotism | 0 / Wharf |
| French Empire | 14/15, 12/13 | Cartography, Astronomy, Guilds | Piety, Inspiration | Classical Republic | 0 / 2 Bazaars |
| Achaemenid Persia | 14/15, 6/13 | 0 | 0 | Despotism | 0 / 0 |
| Great Britain | 14/15, 9/13 | Cartography, Astronomy, Guilds, Feudalism, Education | 0 | Classical Republic | 0 / Bazaar, Observatory, Guildhall |

- **Personal Age:** 5 of 6 civs were "in Exploration" by T151 (first Exploration tech between T114 and T149).
- **City-states:** four suzerainties (Shawnee x2, Bulgaria, Great Britain), Exploration and Antiquity city-states mixed. Pantheons founded by every civ (T49-T80). **No religion founded:** Piety came at T143 (France) and T149 (Rome); no Temple was built in time.
- **AI government revert at Chiefdom works** (Bulgaria and Shawnee Feudal Monarchy -> Despotism, T11). **Bug:** France completed Piety at T143, switched Classical Republic -> Theocracy and was reverted the same turn (same race as Egypt in run 2, despite the inner-modifier civic check). **Fix:** the revert rules now apply only before the AI researches Mysticism, i.e. right after its Chiefdom pick; the switch civics sit at the end of the civic tree, so the two rules can no longer coincide.

**Balance findings:**
- **No cost cliff at the seam:** Exploration root techs cost 525 (below Antiquity's last, Mathematics / Iron Working at 738); Exploration root civics 700 (Antiquity's last, Philosophy / Commerce, 750). Exploration content arrives around T115-150, roughly when a vanilla Antiquity Age ends.
- **Iron Working bottleneck:** all six civs skipped Iron Working, the only prerequisite of Machinery. Machinery gates the Exploration land units (Swordsman, Heavy Archer, Courser, Catapult) and Machinery-gated resources (Niter), so no civ could build any of them; the only Exploration units were 1 Cog.
- **Civics lag techs:** 6-12 of 13 Antiquity civics at T151, so Exploration civics (and the governments and religion behind them) come late or never.
- **Religion comes very late** because Piety sits after Philosophy, the last Antiquity civic; in vanilla, religion is an early Exploration-Age system.

**Balance pass, decided by the user:** only the Machinery fix. Machinery now follows Military Training instead of Iron Working (also the safety-net prerequisite for unlinked Exploration techs). Pace and costs stay as they are (Exploration content at about vanilla Age length); Piety stays after Philosophy. Verified in long run 5.

## More Exploration systems, batch B (added 2026-11-12)

- **Imported:** `narrative-stories`, `discovery-stories`, `tot-narrative-stories` (+ gameeffects), `narrative-display`, `narrative-sifting`. No collisions; text already loads in every Age. `37-batch-b.sql` re-tags the 1,597 stories from `AGE_EXPLORATION` to Antiquity (the engine offers current-Age stories only); per-Age reward scaling tables are left as they are. The personal-Age rewrite picked up their Age-transition conditions automatically (25 rewritten requirements in total).
- **Dropped from batch B:** the Exploration `civilizations-common` / `attributes` / `leaders` effects. They hang off the Exploration civs' common traits (`civilizations-exploration.xml`), so they reach only Exploration-civ players; most are Age-transition "advanced start" bonuses. A few are real Exploration rules worth adding later through the personal Age: Bazaar and Wharf raise resource caps, wider embarkation.
- **Verified:** all suites pass (3,670 stories, all Antiquity). In a 60-turn autoplay, 27 of the 108 distinct stories in the narrative log were Exploration stories (discoveries, attribute quests); no errors in GameCore or UI logs.

## More Exploration systems, batch A (added 2026-11-12)

`tools/survey_imports.py` surveyed the 60 Exploration-only files not yet imported (tables, collisions, Age conditions) and grouped them: A (great people, projects, city-states, AI lists), B (narratives and discoveries, Age-transition bonuses), C (files that override Antiquity values: diplomacy, terrain, goody huts, happiness stages; for the balance pass), and files left out (Age transition, advanced start, crises, legacies, legacy paths, victories, account progression, movies, civ unlocks, civilopedia).

Batch A imported: `greatpeople` (Abbasid Alim, Spanish Conquistador; re-tagged to Antiquity), `projects` (new: Town Temple, Town Inn, Heliocentric Model, Invent Calculus; the six shared town/city projects keep Antiquity's values: culture/science cost 200 not 300, trade focus without unlock), `independents` (61 Exploration city-states and their bonuses, added to Antiquity's 63, from the start), `ai-exploration` and `pseudoyields`, plus `ProjectsText`.

**Bug found and fixed (affects all imports):** the generated collision deletes cascade through foreign keys. Exploration re-defines the three `Affinities` rows, and deleting them would have deleted every Antiquity city-state (Independents -> Affinities, ON DELETE CASCADE); earlier imports had the same blind spot (e.g. Revolucion's government rows). `gen_dedupe.py` now snapshots every row a delete would cascade into or reset (recursively, from the schema's foreign keys) and `06-restore-cascades.sql` (generated) puts back what the import does not re-define. Verified: all checks pass, 63 Antiquity + 61 Exploration city-states present.

## Religion (added 2026-11-12)

- **Imported:** Exploration `gamecapabilities.xml` (`CAPABILITY_FOUND_RELIGIONS`; Antiquity's pantheon capability stays), `religion.xml` + gameeffects (42 beliefs, 3 belief classes), `greatworks.xml` (relics). No new collisions. Religion text already loads in every Age.
- **Founding works:** with Piety, an AI-played player built a Temple and founded a religion (Orthodoxy, Protestantism, Confucianism in three test games; holy city the capital, 2 beliefs). Founding is engine-driven (Temple + notification); the human pick-a-religion screen was not exercised.
- **Missionary:** vanilla has no unlock (available from the Exploration Age start), so 40-units' catch-all had put it at Machinery. Now unlocked by Piety; trainable in a city with a Temple once a religion exists. The unit and building catch-alls now count civic unlocks as well as tech unlocks.
- **Theology branch:** restored. It was hidden twice: the tree is tagged `AGE_EXPLORATION` (the engine only offers current-Age trees; re-tagged), and its reveal set also requires `REQ_AGE_IS_EXPLORATION` (removed; founding a religion is enough). Verified: with a religion the tree is offered and Theology can be started.
- **Policies:** Exploration policies (tagged `AGE_EXPLORATION`) can be slotted in Antiquity: Commune was slotted after a civic opened the policy-change window.
- **Not done:** relics not exercised in play; the human pick-a-religion screen not exercised. (Theocracy is now an AI switch target: see Civics and governments.)

## Personal Age (added 2026-11-12)

The user asked to attack Age conditions systematically. Inventory of Age switches: (1) files that load only in one Age (handled by importing), (2) Age columns in ~40 tables, (3) "current Age is X" requirements, (4) "N Age transitions" requirements. Kinds 3 and 4 are now rewritten generically by `70-personal-age.sql` into a per-player "personal Age" (has any Exploration root tech: Cartography, Astronomy, Machinery). Exploration / "1 transition" conditions become "in Exploration"; Antiquity conditions become "not yet in Exploration"; Modern stays off; account challenges untouched.

- `tools/age-audit.js` (`CCAge.audit()`) audits the loaded database. Before the rewrite: 2 unused generic Age requirements and 1 live gameplay one (Trung Trac's Trung Nhi unit, which needs one Age transition). After: none left except a tutorial account challenge.
- **Verified live:** `CC.personalAge()` passes; nobody was "in Exploration" at start; after granting level 1 of Astronomy to player 0, exactly player 0 was.
- The 58 other "N transitions" uses in game files are in Exploration/Modern files not imported yet (narratives, civ and leader abilities, attributes); they will be rewritten automatically when imported. Kind 2 rows are listed by the audit for case-by-case decisions (global settings like happiness stages keep Antiquity values).

## Long run 3 (2026-11-12, with the MinDepth and AI-government fixes)

Fresh game, 6 civs (Rome, Persia, America, Hawai'i, Russia, Abbasid), 150 turns of AI autoplay. All 6 alive at T151, no errors in GameCore or UI logs, no crash.

| Player | Cities | Exploration techs | Exploration civics | Government | Gated resource effects active | Exploration units / buildings |
|---|---|---|---|---|---|---|
| Rome | 4 | Astronomy | Piety, Inspiration, Society | Classical Republic | 0 | 0 / Temple |
| Persia | 7 | Cartography, Astronomy, Guilds | Piety | Despotism | 30 | Cog / 2 Observatories |
| America | 8 | Cartography, Astronomy, Machinery, Guilds, Feudalism, Education | 0 | Classical Republic | 34 | Courser, Cog / 3 Bazaars, 2 Observatories |
| Hawai'i | 5 | Cartography, Astronomy, Guilds | Piety, Inspiration, Society | Classical Republic | 30 | 0 / Temple, Observatory, Hale o Keawe |
| Russia | 3 | 0 | 0 | Classical Republic | 0 | 0 / 0 |
| Abbasid | 5 | Cartography, Astronomy, Guilds, Feudalism | Piety | Classical Republic | 30 | 0 / Wharf, Observatory, Madrasa |

- **Resource gating works for the AI now:** every civ with Cartography and Guilds has the Cartography and Guilds resource effects active (30 = 12 + 18), America also has Niter (Machinery) and Quinine (Education); civs without those techs have none. In run 2 only the Cartography ones ever activated.
- **AI government revert works in a real game:** Hawai'i and the Abbasids picked Theocracy at Chiefdom (T10) and were set back to Classical Republic the same turn.
- **No AI reached an Exploration government,** correctly: no civ researched Mercantilism or Authority. Every civ with Exploration civics went Piety -> Inspiration -> Society. Theocracy (Piety) is deliberately not an AI switch target until religion is merged. If AIs keep favouring that branch, they will rarely change government; worth revisiting with religion.
- **Pace:** Exploration techs 0-6 per civ (run 2: 1-5), Exploration civics 0-3, 3 Exploration units, 14 Exploration buildings plus Hale o Keawe and the Abbasid Madrasa. America leads at 244 Science per turn; Russia (3 cities) has no Exploration content. Exploration techs and civics still arrive late (balance item 4).

## Long run 2 (2026-11-12, after resources, civics and governments)

Fresh game, 6 civs (Rome, Buganda, Persia, Spain, Egypt, Inca), 150 turns of AI autoplay. All 6 civs alive at T151, no errors in GameCore/UI logs, no crash.

| Player | Cities | Exploration techs | Exploration civics | Government | Exploration units / buildings |
|---|---|---|---|---|---|
| Rome | 4 | 5 (Cartography, Astronomy, Guilds, Feudalism, Education) | 0 | Classical Republic | 0 / Bazaar, Observatory, Guildhall |
| Buganda | 4 | 1 | 1 (Piety) | Classical Republic | 0 / 0 |
| Persia | 5 | 4 | 0 | Despotism | 0 / Wharf, 2 Bazaars |
| Spain | 6 | 2 | 0 | Despotism | Cog / Wharf |
| Egypt | 8 | 1 | 3 (Economics, Mercantilism, Colonialism) | Oligarchy | 0 / Tomb of Askia, El Escorial |
| Inca | 5 | 4 | 0 | Classical Republic | Cog / Bazaar, Guildhall, Observatory |

Compared with long run 1 (T151: 2-3 Exploration techs, no Exploration units): Exploration techs 1-5, the first Exploration units (2 Cogs), 12 Exploration buildings and 2 Exploration wonders. Exploration civics are slow: only 2 of 6 civs reached any. The largest city yields at T151 are around 90 Production / 90 Science per city; no obvious runaway from Antiquity and Exploration adjacencies stacking, but there is no vanilla baseline to compare against yet.

**Bugs found and fixed:**
- **Gated resources never activated past one tech level.** `REQUIREMENT_PLAYER_HAS_COMPLETED_PROGRESSION_TREE_NODE` without `MinDepth` means fully completed, mastery level included. AIs research Guilds and Education to level 1, so only the single-level Cartography resources ever activated. `65-modern-resources.sql` now adds `MinDepth = 1` to all of this mod's tech and civic requirements (as Firaxis does). Verified: with Guilds at depth 1 of 2, the Sugar and Tea gates activate.
- **AI government switch undone the same turn.** Egypt went Oligarchy -> Plutocracy -> Oligarchy on T129 (gossip log): the Plutocracy revert rule, attached while Mercantilism was missing, fired before its outer condition was re-evaluated. The inner modifiers now repeat the civic condition. Verified: Oligarchy -> Plutocracy at Mercantilism, no flip back.

Both bugs affected this run (no Guilds/Education/Machinery resources activated; no AI on an Exploration government), so the AI-side numbers above understate the merged content. Balance work should start from a new long run.

## Civics and governments (added 2026-11-12)

- **Civic tree:** `progression-trees-culture-common(-gameeffects).xml` imported. The 12 Exploration main civics + Exploration Future Civic are grafted into `TREE_CIVICS_AQ_MAIN` (Economics after Commerce, Piety after Philosophy); Antiquity Future Civic removed. The Theology branch is removed (requires founding a religion). Exploration policies (`traditions*.xml`) already load in every Age. Content vanilla unlocks by civic (Temple at Piety, most Exploration wonders) now unlocks by civic again; `30-buildings.sql` only gates what has no unlock at all.
- **Governments, engine facts (live):** after Chiefdom, `CHANGE_GOVERNMENT` is accepted at any time for any government and applies instantly; before Chiefdom it is refused. Vanilla only gates it in the UI (the chooser opens from the start-of-Age notification and lists `StartingGovernments`).
- **Governments, design:** `governments.xml` and `golden-ages(-gameeffects).xml` imported. Exploration governments are removed from `StartingGovernments` (so the Chiefdom choice and the AI never see them) and unlock by civic: Theocracy at Piety, Plutocracy at Mercantilism, Feudal Monarchy at Authority. `ui/cc-governments.js` patches the `StartingGovernments` table iterator in the UI to append the local player's unlocked ones, opens the chooser after a civic unlocks one, and adds a **Change Government** button to the policies screen.
- **Verified live:** all `CC.civics()`, `CC.resources()` and `CC.db()` checks pass. Before any Exploration civic the chooser lists only the 3 Antiquity governments. After Piety it adds Theocracy, Piety's policy Commune is unlocked, and picking Theocracy in the chooser changed the government (celebrations linked). After Mercantilism + Authority the chooser opened by itself and showed Plutocracy and Feudal Monarchy with their policies; Feudal Monarchy was adopted through it. The policies-screen button opens the chooser. 5 turns of autoplay with every Exploration civic granted to all players: no errors.
- **AI:** the engine AI picks its government at Chiefdom from ALL governments (live: AIs took Plutocracy, Feudal Monarchy and Theocracy around turn 10) and never reopens the choice. Rules in `35-governments.sql` (`EFFECT_PLAYER_SET_GOVERNMENT`, the effect vanilla's crises use): an AI on an Exploration government without its civic, or on a crisis-only one, is set back to a matching Antiquity government; an AI with the civic switches Despotism to Feudal Monarchy (Authority), Oligarchy to Plutocracy (Mercantilism), and, since religion was merged, Classical Republic to Theocracy at Piety (it used to go to Plutocracy). Verified: player 0 on Classical Republic with Piety switched to Theocracy as soon as autoplay made it AI-controlled, with no flip back. A "has founded a religion" condition was tried first: REQUIREMENT_FOUNDED_NO_RELIGION, REQUIREMENT_PLAYER_FOUNDED_RELIGION and REQUIREMENT_PLAYER_IS_RELIGION_FOUNDER never matched a player that had founded one, on a game-wide or a player-owned modifier. Vanilla does not require a religion for Theocracy, and AIs found one soon after Piety. `REQUIREMENT_PLAYER_HAS_GOVERNMENT` checks the modifier's owner (it never matched on a game-wide modifier; it did on a player-owned one), so each rule is a game-wide wrapper attaching a player-owned inner modifier. Live: player 0 on Despotism with Authority switched to Feudal Monarchy as soon as autoplay made it AI-controlled. UI scripts cannot grant techs or change governments for AI players (requests are ignored), so the AI rules were tested through autoplay.
- **Bug found and fixed:** `60-resources.sql` swept up every modifier created after the resource import as a "resource effect" and deleted those without a resource, which silently removed the first AI rules. It now skips this mod's `CC_` modifiers.
- **Limits:** Theocracy's own policies were in the Theology branch, and its celebrations reward Relics. A chooser opened while two civic popups are queued was once lost (fixed by waiting for 2 clear ticks; not re-tested).

## Map resources (added 2026-11-12)

Vanilla places a later Age's resources only during the Age transition (a gameplay script), which never happens here. Findings:

- `<ScenarioScripts>` gameplay JS never runs in a normal game, and `ResourceBuilder` doesn't exist in the UI context. `WorldBuilder.MapPlots.setResource` exists in the UI but returns false outside the editor.
- `EFFECT_CITY_ADD_RESOURCE_TO_PLOT` (the city-state "receive X in your Capital" bonus) places nothing when attached by a mod, even with rows identical to Firaxis's `ATTACH_LAPIS_LAZULI`; the engine lists the capital as its subject. An ungated version crashed the game when capitals were founded.
- `Resources.Weight = 0` does **not** keep a resource off the map.

Result (verified live, all `CC.resources()` checks pass):

- Exploration resources are valid in Antiquity and the per-map type cap is raised (25 to 43 including Modern). Their base yields and 22 Exploration effects are gated the same way as Modern's (below): live, Whales were hidden with no effects until Cartography, then shown with their effects on, while Sugar (Guilds) stayed off. Antiquity resources keep Antiquity effects and tooltips (parked and restored around the import).
- Modern resources spawn at map start (e.g. Coal 11, Oil 9-11 per map). Their base tile yields and 14 Modern effects are per-player modifiers, attached only once the player has the tech. Live: before Metallurgy player 0 had no Coal modifiers; after it, the Coal yield, port and naval effects attached, and an owned Coal tile gave 2 Production vs 1 for an AI without the tech. Oil stayed inactive until Gunpowder. 5 turns of autoplay with every activating tech (Exploration and Modern) granted to all players: no errors.
- `ui/cc-hide-resources.js` wraps `GameplayMap.getResourceType` in the UI so locked Modern resources read as "no resource" for the local player, and redraws map icons on `TechNodeCompleted`. Verified through the API (Coal hidden, then shown after Metallurgy). The on-screen icon check was inconclusive: screenshots and camera calls didn't reflect changes in that session. 3D resource models remain visible.

## Test artifacts

- **Mod:** `mod/continuous-civ/`. Deploy with `tools/deploy.ps1`, remove with `tools/deploy.ps1 -Remove`. While deployed it applies to every new single-player game.
- **Generators:** `tools/gen_dedupe.py`, `tools/gen_modern_resources.py`.
- **Test suite:** `tests/cc-tests.js`.
- **Saves** (in `Documents\My Games\Sid Meier's Civilization VII\Saves\Single\`): `CC_Phase2_SaveLoad`, `CC_Phase2_Long_T51`, `CC_Phase2_Long_T101`, `CC_Phase2_Long_T151`. They need the mod deployed to load.
- **Screenshots:** `research/screenshots/art-roma-*.png`.
