# Continuous Civilization — Phase 1: Engine Investigation

**Date:** 2026-11-12
**Game build:** Civilization VII (Steam), install at `G:\SteamLibrary\steamapps\common\Sid Meier's Civilization VII`
**Method:** read-only inspection of the installed game data, then live checks through FireTuner MCP. Experiments ran in three throw-away single-player Antiquity games (Rome, small map). They used a diagnostic mod placed in the user Mods folder. The game install was **not modified** and no existing saves were touched.

Legend: **CONFIRMED (live)** = checked in a running game. **CONFIRMED (files)** = read directly from shipped data or schema. **INFERRED** = a reasoned conclusion that was not tested directly.

---

## 0. TL;DR

| Question | Answer |
|---|---|
| Can the Age clock be stopped? | **Yes, through data alone. CONFIRMED (live).** `AgeProgressions.EndsAge=0` stopped the age ending even 14 turns after progress hit max. Raising `MaxPoints_*` keeps progress near 0% so warnings and crises never trigger. The engine's +1 point/turn is hard-coded but harmless. |
| Can Exploration/Modern techs live in the Antiquity tree? | **Yes. CONFIRMED (live).** We grafted 14 Exploration techs onto `TREE_TECHS_AQ`. The stock tech-tree screen laid them out automatically as one continuous tree. |
| Can later-age units and buildings be used during Antiquity? | **Yes. CONFIRMED (live).** Pikeman, Arquebusier, Lancer and Bombard were trainable. University, Bank, Guildhall and others were buildable after one data change (`Constructibles.Age`). The Pikeman's 3D model, portrait and unit panel rendered. |
| Hard-coded blockers found? | No hard block found. There are several **soft** engine behaviours we must work around (see §4). |
| Steam Workshop viable? | **Yes. Recommended.** Everything used standard modinfo/XML/SQL plus officially documented `{module-id}` cross-module file references. No binaries and no copied Firaxis files. |

---

## 1. The Age system

### 1.1 How an Age is chosen and loaded — CONFIRMED (files + live)

Each Age is a **module**: `Base/modules/age-antiquity`, `age-exploration`, `age-modern`. Each module's `.modinfo` gates its content with `ActionCriteria`:

| Criteria (in each age's modinfo) | Meaning | What it loads |
|---|---|---|
| `<AlwaysMet/>` | every game | icons, most text, `gameplay-static.xml`, shared civ data, traditions |
| `<AgeInUse>AGE_X</AgeInUse>` | only while X is the current Age | **tech/civic trees, units, governments, resources rules, victories/legacy paths, crises, projects, AI, `age-active.xml`** … (~90 files per age) |
| `<AgeAtOrBefore>AGE_X</AgeAtOrBefore>` | X has been reached (persists into later ages) | `constructibles.xml` (+gameeffects), legacy civ data |

So **the gameplay database is rebuilt for each Age at game setup or Age transition.** During Antiquity, the database simply *does not contain* Exploration or Modern techs or units. Live check in a vanilla Antiquity game:

```
Ages: AQ Active=1, EX Active=0, MO Active=0
ProgressionTreeNodes: TREE_TECHS_AQ=16, TREE_TECHS_EX=0, TREE_TECHS_MO=0   (tree headers exist, nodes don't)
Units=92, UNIT_CROSSBOWMAN/UNIT_MUSKETMAN/UNIT_INFANTRY absent
Constructibles by Age: AQ=60, EX=2 (DLC), none=35
```

`age-active.xml` in each age does `UPDATE Ages SET Active=1 WHERE AgeType=<self>`. `base-standard/data/ages-post-process.sql` uses `Active` to tag off-age civs as `TRAIT_ANACHRONISTIC_CIV`.

### 1.2 What ends an Age — CONFIRMED (files + live)

Tables (schema: `Base/Assets/schema/gameplay/01_GameplaySchema.sql`):

- `AgeProgressions(AgeProgressionType, AgeType, EndsAge, MaxPoints_Abbreviated/Standard/Long)`. Antiquity: `AGE_PROGRESSION_ANTIQUITY_AGE_TIMER`, EndsAge=1, 120/140/160.
- `AgeProgressionTurns`: points per turn (Antiquity: 1).
- `AgeProgressionEvents`: points from events (legacy milestones 5/5/10, Future Tech 10, Future Civic 10).
- `AgeProgressionMilestones`: legacy-path thresholds → events.
- `AgeCrises` / `AgeCrisisStages`: crisis stages keyed to % of age progress.
- `AgeSuccessors`: AQ→EX→MO.
- `AgeProgressionNotifications`: 25/75/90% warnings.
- Setup parameters (`core/config/SetupParameters.xml`): `AgeLength`, `AgeCountdownTimer` (incl. `AGE_COUNTDOWN_LENGTH_NONE`), `AgeTransitionSetting` (`KEEP_MORE` "Continuity" / `ORIGINAL`), `AgeTransitionCivSelectionMode` (incl. `PERSISTENCE`), and a hidden `SingleAgeGame` (`SupportsSinglePlayer="0"`).

Live: `Game.AgeProgressManager` reports `getCurrentAgeProgressionPoints()`, `getMaxAgeProgressionPoints()`, `isAgeOver`, `ageCountdownStarted`, `isFinalAge`, `isSingleAge`, `isExtendedGame`, `getAgeCountdownLength` (=10).

### 1.3 Where transition logic lives

| Layer | Location | Role |
|---|---|---|
| **Engine (C++) — not moddable** | `GameCore` | Adds points, decides `isAgeOver`, runs the countdown, rebuilds the DB for the next age, performs the transition itself |
| JS (gameplay script) | `base-standard/scripts/age-transition-post-load.js` | Runs *after* a transition: removes/adds resources, generates discoveries, demotes cities to towns, places commanders, makes dark-age and legacy cards. Fully moddable, but runs only on transition. |
| JS (UI) | `ui/action/panel-action.js`, `ui-next/screens/age-transition/*`, `ui/age-progression-warning-*`, `ui/legends-report/*`, `ui-next/screens/endgame/*` | Banners, countdown, transition screens, “One More Turn” (`PlayerOperationTypes.EXTEND_GAME`) |
| Data | tables in §1.2 | All thresholds and point values |

When `isAgeOver` is true, ending the turn (`GameContext.sendTurnComplete()`) leads the engine into the transition. Nothing in JS *starts* the transition.

### 1.4 Hard-coded behaviour found — CONFIRMED (live)

**The engine adds +1 age-progress point per turn, independent of data.**

- Run 1: `AgeProgressionTurns.Points=0` and every `AgeProgressionEvents.Points=0`. Progress still equalled the turn number (26 at turn 26).
- Run 2: `DELETE FROM AgeProgressionTurns` (no rows). Progress was still 3 at turn 3.
- The only data effect that touches age progress is `EFFECT_PLAYER_ADJUST_AGE_PROGRESS`, used by Future Tech and Future Civic only.

So progress cannot be frozen at 0, but it is a slow, predictable 1/turn.

### 1.5 Data levers that work — CONFIRMED (live)

`UPDATE AgeProgressions SET MaxPoints_* = 100000` was honoured (`getMaxAgeProgressionPoints()`=100000). Over 26 autoplayed turns: `isAgeOver=false`, no countdown, no crisis, no transition. At 1 point/turn that is ~100k turns, effectively infinite.

**Warning:** the tuner docs bundled with the MCP warn that calling `Game.AgeProgressManager.updateAgeProgressionPoints()` from JS hard-crashes this build. Don't use it.

### 1.6 `EndsAge = 0` — CONFIRMED (live, run 2)

Setup: `EndsAge=0`, `MaxPoints_*=20`, `AgeProgressionTurns` rows deleted.

| Turn | Progress | countdownStarted | isAgeOver | Age |
|---|---|---|---|---|
| 3 | 3/20 | false | false | Antiquity |
| 16 | 16/20 | false | false | Antiquity |
| 26 | **20/20 (capped)** | **true** | false | Antiquity |
| 34 | 20/20 | true | **false** | **Antiquity**, game continues normally |

What this shows:

- **`EndsAge=0` stops the age from ending.** We were 14+ turns past max, beyond the 10-turn countdown (`getAgeCountdownLength`=10), and no transition happened.
- **The countdown still *starts*** (`ageCountdownStarted=true`), which drives the end-of-age UI (warning banner and popup).
- Crisis stages are keyed to progress %, so they would also fire at 100%.

**Recommended combination:** `EndsAge=0` (safety: the age can never end) **plus** `MaxPoints_*` huge (so progress stays near 0%, keeping the countdown, crisis and warning UI dormant).

### 1.7 Can Age progression be disabled?

| Mechanism | Status |
|---|---|
| XML/SQL: `MaxPoints_*` huge | **Works.** CONFIRMED live |
| XML/SQL: zero per-turn/event points | Partly. Event points go to 0; the 1/turn floor stays (hard-coded) |
| XML/SQL: `EndsAge=0` | **Works.** The age never ends; the countdown UI still starts at max. CONFIRMED live (§1.6) |
| Setup option `AgeCountdownTimer=NONE` | Exists; only affects the post-max countdown. Not tested |
| `SingleAgeGame` setup param / `Configuration.editGame().setSingleAge()` | Exists (used by Firaxis automation). Hidden for single player (`SupportsSinglePlayer=0`), but a mod can un-hide setup params in the shell DB. **Not tested.** Likely makes the current age the final age, so the game ends (with "One More Turn") instead of transitioning. A possible fallback. |
| JS API to change progress | `updateAgeProgressionPoints` exists but reportedly crashes. Not used |

---

## 2. The technology system

### 2.1 Definitions — CONFIRMED (files)

| What | Where |
|---|---|
| Tree headers (all 6 main trees, plus attribute trees) | `base-standard/data/progression-trees-common.xml` → `ProgressionTrees(ProgressionTreeType, AgeType, SystemType, CostProgressionModel, PrereqFormat…)`. **Always loaded.** |
| Which tree is “the” tech tree for an age | `Ages.MainTechProgressionTreeType` / `MainCultureProgressionTreeType` (`base-standard/data/ages.xml`) |
| Nodes, prereqs, unlocks | `age-*/data/progression-trees-tech.xml` → `ProgressionTreeNodes`, `ProgressionTreePrereqs(Node, PrereqNode)`, `ProgressionTreeNodeUnlocks(ProgressionTreeNodeType, TargetKind, TargetType, UnlockDepth, RequiredTraitType…)`. **Loaded only for the current age.** |
| Node effects | `age-*/data/progression-trees-tech-gameeffects.xml` (`<GameEffects>` format; modifiers) |
| Text | `age-*/text/en_us/TechnologiesText.xml`. **Age-specific text group** |

Node facts:

- Antiquity has 16 nodes (incl. repeatable `NODE_TECH_AQ_FUTURE_TECH`, cost 1255). Costs run 70–738.
- Exploration has 15 nodes (`NODE_TECH_EX_*`), costs 525–3625, plus Future Tech 4250.
- Modern has 17 `NODE_TECH_MO_*`.
- “Masteries” (e.g. “Writing II”) are `UnlockDepth=2` rows on the same node, not separate nodes.
- Prereqs default to AND (`PrereqFormat="AND"`).

Age restriction of a tech is purely **which `ProgressionTree` its node belongs to** and **whether its file is loaded**. No per-node age column exists.

### 2.2 Can techs from different Ages share one active tree? — CONFIRMED (live)

Yes. Probe run 1 did the following:

1. Loaded `{age-exploration}data/progression-trees-tech*.xml` during Antiquity.
2. `UPDATE ProgressionTreeNodes SET ProgressionTree='TREE_TECHS_AQ' WHERE ProgressionTree='TREE_TECHS_EX' AND Repeatable=0`.
3. Made the EX root nodes (Cartography, Astronomy, Machinery) require `AQ_MATHEMATICS` + `AQ_IRON_WORKING`.

Result:

- `TREE_TECHS_AQ` had **30 nodes**.
- `Player.Techs.getTreeType()` = `TREE_TECHS_AQ`.
- The stock tech-tree screen drew both eras as one continuous tree with working connectors and unlock icons (screenshots in `research/screenshots/`). No UI layout data was needed: the screen auto-lays-out by prereq depth.
- `PlayerOperationTypes.GRANT_TREE_NODE` granted all 30. The "research all technologies" triumph counted **48/48** (it counts masteries too), so engine systems treat the merged tree as one.

### 2.3 Scripting APIs (live)

- `Players.get(id).Techs`: `getTreeType, getResearching, getResearched, isNodeUnlocked, getAllAvailableNodeTypes, getNodeCost, getTurnsForNode, getNumTechsUnlocked…`
- `Game.ProgressionTrees`: `getTree, getNode, getTreeStructure, getNodeState, revealTree, canEverUnlock…`
- Operations: `PlayerOperationTypes.SET_TECH_TREE_NODE`, `GRANT_TREE_NODE` (debug, from FireTuner `Player.ltp`)
- Tree screen: `ContextManager.push("screen-tech-tree")`, then dispatch `view-tech-progression-tree` with `{treeCSV}`.

---

## 3. Age-specific restrictions on units and buildings

| Restriction | Mechanism | Moddable? | Evidence |
|---|---|---|---|
| Later-age units/buildings/techs absent | Their XML is loaded only under `AgeInUse` | **Yes**: a mod can load them with `{age-exploration}data/units.xml` etc. | CONFIRMED live |
| Later-age **buildings** not buildable even when loaded and unlocked | Engine rule: a constructible is buildable only if `Constructibles.Age` is the current age (or NULL/ageless). That is how vanilla obsoletes old-age buildings. | **Yes**: `UPDATE Constructibles SET Age='AGE_ANTIQUITY'`. Run 1: University/Bank/Temple all false. Run 2 after re-tag: University, Bank, Temple, Guildhall, Armorer, Kiln, Tavern, Medieval Walls all **true** | CONFIRMED live |
| Units | Unlocked by `ProgressionTreeNodeUnlocks`; older ones go obsolete via `UnitUpgrades` once the upgrade is unlocked | Data-only | Live: Crossbowman/Knight/Man-at-Arms correctly obsolete once Arquebusier/Lancer/Pikeman were unlocked; those 4 were trainable |
| “Age-start” units have **no tech gate** | Exploration's Swordsman, Heavy Archer, Courser, Catapult, Cog (and civ uniques that replace them, e.g. Leiomano, Mamluk) are just available at the start of Exploration | Must add `ProgressionTreeNodeUnlocks` rows | Live: AI Maurya/Buganda built Coursers and AI Hawaii/Abbasid fielded Leiomano/Mamluk in the first 20 turns |
| Art / 3D assets | Not age-gated: art lives in shared `Base/Platforms/Windows/BLPs/*.blp`; no per-age art packages | n/a | Live: Pikeman 3D model, portrait and unit panel rendered in Antiquity |
| Map resources | `Resource_ValidAges` (base-standard) says which resources map generation places per age (Coal, Oil… = Modern only). New ones are added only by `age-transition-post-load.js` at transition. | Data + script | CONFIRMED (files). Must be handled; not yet tested |
| Civs | Civs of all ages are loaded. Off-age civs get `TRAIT_ANACHRONISTIC_CIV` and “Test of Time” `*_TOT_AQ` attributes | Yes | Live: AI played Russia, Hawaii, Abbasid, America and Buganda in Antiquity |

### 3.1 What a cross-age load costs — CONFIRMED (live)

Loading Exploration's units, constructibles and tech files (plus gameeffects) into Antiquity needed:

- **3 primary-key collisions** removed first: `ABILITY_SEARCH_RECON` in `Types`, `UnitAbilities`, `UnitClass_Abilities`.
- **3 localization collisions** removed: `LOC_TECH_FUTURE_TECH_{NAME,QUOTE,AUTHOR}`.
- **4 dangling foreign keys** pruned afterwards: modifiers defined in Exploration files we didn't import (golden ages, age-transition, traditions).

After that the gameplay DB passed validation and the game ran 26 autoplayed turns with no errors.

- Modern's units, constructibles and techs show **0** PK collisions with Antiquity data (static analysis, `research/tools/pk_dedupe.py`). Not yet loaded live.
- **Engine behaviour that matters for design:** a single DB error in any mod file makes the engine **roll back every component of the mod** ("Content configuration validation failed"). Robust collision handling is mandatory.

---

## 4. Engine limitations and unknowns

### Hard limits (cannot change)

1. **+1 age progress per turn is hard-coded.** We can only push the threshold out of reach.
2. **Transition is engine-driven.** No JS hook can veto an age ending once `isAgeOver` is true. Avoid reaching it.
3. **Modinfo is read only at game start-up** (mod discovery). File *contents* are re-read on each new game. This affects the dev loop, not players.
4. **One DB error rolls back the whole mod.**

### Soft limits (data or scripts can fix; work required)

5. **Building age gate.** Re-tagging `Constructibles.Age` to the active age makes later buildings buildable. Side effects not yet tested: obsolescence of Antiquity buildings, per-age default yields and maintenance (`AgeConstructibleDefaultYields/Maintenances`), "ageless" warehouse buildings, legacy scoring.
6. **Age-start units have no tech gate.** Each needs a tech unlock row.
7. **Map resources per age.** `Resource_ValidAges` and the transition script mean Modern resources (Coal, Oil, Rubber…) won't exist. Options: add Antiquity validity (they spawn at map start), or place them mid-game from a gameplay script (`ResourceBuilder` is used by the transition script; runtime use not yet tested).
8. **Everything else in `age-*-main` is still Antiquity's.** Governments, policies/traditions, civics, legacy paths and victories, crises, narrative events, AI strategy lists, city-state bonuses, discoveries, golden ages and great people stay Antiquity's unless also merged. Several of these collide by key (governments, projects, goody huts, deal items: see `collisions.py` output). The **civic tree** needs the same graft as techs.
9. **Unique-unit and civ-unique content of later civs** comes in with `units.xml`. Anachronistic AI civs immediately use their later-age uniques.
10. **AI.** Antiquity AI lists and pseudo-yields don't value later-age units or buildings (the AI did build a Pikeman, so it isn't blind). Balance unknown.
11. **Antiquity Future Tech** sits mid-tree after the graft and must be moved to the end or removed. It also grants age progress unless its event points are zeroed (done).
12. **DLC age content** (civs, wonders) uses the same `AgeInUse` pattern. Every owned DLC module needs the same cross-age load and collision handling, conditional on `ModInUse`.

### Unknowns (not yet tested)

- Whether `EndsAge=0` holds over very long spans (tested 14 turns past max), and whether the countdown UI can be suppressed (high MaxPoints avoids it).
- Whether `SingleAgeGame` can be enabled for single player via a shell-DB mod, and what it does.
- Save/load and long-game stability with ~3× the DB rows. Performance on 300+ turn games.
- Multiplayer (Workshop mods sync, but not tested).
- Whether `Resource_ValidAges` or `ResourceBuilder` can add resources mid-game.
- Combat balance: units from different eras fighting.

---

## 5. Proposed minimal proof-of-concept mod (Phase 2 candidate)

**Goal:** a playable Antiquity game where Exploration techs, units and buildings follow on in one tree and the age never ends. Exploration only; Modern comes in the next step.

```
continuous-civ/
  continuous-civ.modinfo
  data/00-pre-dedupe.sql        -- generated: DELETE colliding PKs (LoadOrder 400)
  text/00-pre-dedupe-text.sql   -- generated: DELETE colliding LOC tags (LoadOrder 400)
  data/90-age-clock.sql         -- EndsAge = 0; MaxPoints_* = 1e6; event points = 0 (LoadOrder 1000)
  data/91-graft-techs.sql       -- EX nodes -> TREE_TECHS_AQ; roots require last AQ techs;
                                --   move/remove AQ Future Tech
  data/92-buildings.sql         -- Constructibles.Age EX -> AQ
  data/93-gate-age-start-units.sql -- ProgressionTreeNodeUnlocks for Swordsman/HeavyArcher/Courser/Catapult/Cog
  data/99-prune-dangling.sql    -- delete rows whose FK targets don't exist
```

`modinfo` (single criteria `AgeInUse AGE_ANTIQUITY`):

- LoadOrder 500 `UpdateDatabase`: `{age-exploration}data/constructibles.xml`, `constructibles-gameeffects.xml`, `units.xml`, `units-gameeffects.xml`, `progression-trees-tech.xml`, `progression-trees-tech-gameeffects.xml`
- `UpdateText`: `{age-exploration}text/en_us/TechnologiesText.xml`

This is exactly the probe in `research/probe-mod/` plus items 93 and the Future Tech fix. Every part except those two has been validated live.

**Acceptance tests:**

1. DB passes validation.
2. Age progress never reaches max in a 150-turn autoplay.
3. Tech tree shows 30 nodes in one tree.
4. A player can research into Gunpowder normally (not only by grant).
5. University, Bank etc. can be built.
6. No Exploration unit is available before its tech.
7. Save, quit and reload keeps everything.

---

## 6. Recommendation: Steam Workshop?

**Yes. This can be built as a standard Steam Workshop mod.**

- Everything used is first-party mod machinery: modinfo `ActionCriteria`/`ActionGroups`, `UpdateDatabase`/`UpdateText` with XML/SQL, and **`{module-id}path` cross-module references** (documented in the official dev-tools `modinfo Files.md`).
- No game files are modified and no Firaxis data is copied. The mod references the installed age modules, so it picks up Firaxis patches automatically.
- The fragile part is collision handling. It should be **generated** (`pk_dedupe.py` against the installed build) and re-checked after each game patch, because one bad row disables the whole mod.

**Risk assessment:**

- **Low** for techs, units and buildings (demonstrated).
- **Medium** for civics, governments, resources and legacy/victory systems (data work, some collisions).
- **Medium-high** for AI quality and balance over a 3-era game.
- **Unknown** for save stability and multiplayer.

None of these needs engine access.

**Architectural choice for Phase 2:** keep **Antiquity as the permanent engine Age** and import later content into it. The opposite (start in Modern and back-fill) was considered. Modern does persist Antiquity and Exploration *buildings* (`AgeAtOrBefore`), but it would still need back-filled techs and units and would start with Modern-age map, start-position and AI rules. The Antiquity-first approach keeps vanilla map generation and early-game feel intact.

---

## Appendix A — Key files

| Path (under `Base/modules/`) | Purpose |
|---|---|
| `age-*/age-*.modinfo` | Age loading criteria (the core mechanism) |
| `base-standard/data/ages.xml` | `Ages`, `AdvancedStartAges`, trade param sets |
| `base-standard/data/ages-post-process.sql` | Anachronistic-civ tagging via `Ages.Active` |
| `base-standard/data/progression-trees-common.xml` | All tree headers |
| `age-*/data/progression-trees-tech(-gameeffects).xml` | Tech nodes, prereqs, unlocks, effects |
| `age-*/data/victories.xml` | `AgeProgressions`, `AgeProgressionTurns/Events/Milestones`, legacy scoring |
| `age-*/data/crisis-stages.xml` | Crises tied to age %|
| `age-exploration|modern/data/age-transition*.xml` | Transition parameters, armies, legacy points |
| `age-*/data/age-active.xml` | Sets `Ages.Active` |
| `age-*/data/units.xml`, `constructibles*.xml` | Units and buildings per age |
| `base-standard/data/resources.xml` → `Resource_ValidAges` | Resource availability per age |
| `base-standard/scripts/age-transition-post-load.js` | Post-transition map/script processing |
| `core/config/SetupParameters.xml` | `AgeLength`, `AgeCountdownTimer`, `AgeTransitionSetting`, `SingleAgeGame`… |
| `Base/Assets/schema/gameplay/01_GameplaySchema.sql` | Authoritative table schema |
| Dev tools `Documentation/modinfo Files.md` | Criteria types, `{mod-id}` file references |

## Appendix B — Probe experiment log

| Run | Change | Result |
|---|---|---|
| 0 | vanilla | Baseline DB counts (§1.1) |
| 1a | load EX files via `{age-exploration}` | Files loaded; `UNIQUE Types.Type ABILITY_SEARCH_RECON` → whole mod rolled back |
| 1b | + delete that Type | Next collision `UnitClass_Abilities` → generated full PK dedupe (3 rows) |
| 1c | + PK dedupe | Gameplay OK; localization collision `LOC_TECH_FUTURE_TECH_NAME` → rolled back |
| 1d | + text dedupe | FK validation: 4 dangling modifier refs |
| 1e | + prune dangling | **DB valid.** 30-node merged tree, 176 units, 52 EX buildings; Max=100000; 26 turns: progress 26, no age end; EX units trainable; EX buildings blocked; Pikeman renders |
| 2 | delete `AgeProgressionTurns`; EndsAge=0, Max=20; `Constructibles.Age` EX→AQ | Progress still 1/turn (hard-coded); EX buildings buildable; capped at 20/20, countdown started, **no age end through turn 34** |

Probe source: `research/probe-mod/`. Tools: `research/tools/`. Screenshots: `research/screenshots/`.
