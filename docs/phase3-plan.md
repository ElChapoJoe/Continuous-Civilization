# Phase 3 plan: Modern content

Goal: Modern techs, civics, buildings, units, governments and rules merge into the never-ending Antiquity game the same way Exploration did, and the game ends on the standard victories you pick at setup (Science, Culture, Economic, Military, plus Domination and Score).

Survey: `python -I tools/survey_imports.py "" AGE_MODERN` (2026-11-12). 70 Modern-only files are not imported yet.

## What Modern brings

| Area | Content | Collisions with an Antiquity game |
|---|---|---|
| Tech tree | 17 nodes: Academics, Steam Engine, Military Science → ... → Rocketry, Nuclear Fission → Future Tech | none |
| Civic tree | 10 main (Modernization, Natural History, Social Question → Political Theory → ... → Future Civic) + 9 ideology branches (Democracy, Fascism, Communism lines) | none |
| Buildings, units | 102 units; ~85 buildings (factories, rail stations, Launch Pad, ...) | none |
| Governments | Authoritarianism, Bureaucratic Monarchy, Elective Republic, Revolucion (Mexico, already in) | 2 rows |
| Projects | Space race (satellite, sound barrier, crewed flight, rocket launch), Operation Ivy, WMD | 18 rows (town and city projects shared with Antiquity) |
| Victories | Final requirements and point sources: Launch Pad and space projects, World's Fair, factories and rail, ideology conquests | Victory rows, trackers and countdowns already exist in every game (base-standard) |
| Rules | Modern civ common trait (base yields, rail, etc.), resources, city-states, great people, narratives | 59 city-state modifiers, 14 project modifiers, smaller sets elsewhere |
| Age conditions | 9 IS_AGE_COUNT in civ common effects, 7 in attributes, 10 GAME_AGE_TYPE_MATCH in metaprogression | rewritten by `70` |

The import machinery from Phase 2 (gen_dedupe, cascade restore, parking, `CC_` prefixes, 05 snapshot order) covers all of this. No new mechanism needed for the bulk.

## Steps

**3.0 Spike: can a victory be won in a game that stays in Antiquity? Done (2026-11-12): yes.**
- In this game version, victories are a **whole-game points race** (base-standard `VictoryTypes` / `VictoryScorings`, read with `player.Victories.getPointsForVictoryType`). Points accrue from Antiquity on: wonders, settlements, codices, resources, projects. Legacy paths are a separate per-Age reward system that victories do not depend on, so the legacy-path re-tag idea is dropped.
- Under the mod, 40 turns of autoplay gave points at vanilla levels (Military 8-12, Culture up to 10, Score ~940), except Economic (see 3.3).
- Test win: with 100 Science points granted to Rome and the Launch Pad requirement waived, Rome won a Science victory on turn 6 (5-turn countdown) with the game Age still Antiquity and `VictoryTypes.FinalAge` left as `AGE_MODERN`. The end-game screen showed normally.
- So no victory scripting is needed: Phase 3 only has to supply the Modern content that earns points and the final requirements (Launch Pad, space projects, World's Fair, ideologies, factories and rail).

**3.1 Tech and civic trees. Done 2026-11-12** (see `phase3-test-results.md`). Import Modern trees and effects. Roots: Academics ← Urban Planning, Steam Engine ← Gunpowder, Military Science ← Gunpowder (re-rooted 2026-11-12 so Modern's tree keeps its vanilla shape). Move `TREE_TECHS_MO` / `TREE_CIVICS_MO_MAIN` into the Antiquity trees; re-tag ideology branches to `AGE_ANTIQUITY` as with Theology. Delete Exploration's Future Tech / Future Civic (Modern's become the finale).

**3.2 Buildings and units.** Import constructibles, units, gameeffects. Gates in `30` / `40` already handle "any unlock". Check obsolete chains (Exploration units upgrading to Modern).

**3.3 Personal Modern Age. Done 2026-11-12** (see `phase3-test-results.md`). `CC_REQSET_PERSONAL_AGE_MODERN` = any Modern root tech. `70` rewrites `AGE_MODERN` and `IS_AGE_COUNT=2` conditions to it; Exploration conditions become "in Exploration and not in Modern". `72` gains a `cc_modern_rules` list from the Modern civ common trait, and Exploration base yields hand over the way Antiquity's did. **Also add the four GDP tracker activations** (`TRAIT_BONUS_RESOURCE_GDP`, `TRAIT_CITY_RESOURCE_GDP`, `TRAIT_GOLD_BUILDING_GDP`, `TRAIT_IMPORTED_RESOURCE_GDP`) to `cc_exploration_rules`: vanilla Exploration civs switch on Economic victory scoring with them. **Done 2026-11-12.** Modern's common trait activates the same four, so nothing more is needed for them in 3.3.

**3.4 Governments, ideologies, rest. Done 2026-11-12** (diplomacy actions deferred to the balance batch). Modern governments unlock via `cc_government_unlocks`; AI switch rules extended. Ideology branches (Democracy / Fascism / Communism) need checking: vanilla makes you pick one. Import great people, projects, city-states, AI lists, narratives, resources (Modern resources' activation techs move from Exploration stand-ins to real Modern techs: Coal at Industrialization, Oil at Combustion, etc.).

**3.5 Victories. Done 2026-11-12:** Science and Domination; Culture/Economic/Military points victories are a known limitation (see `phase3-test-results.md`). Import Modern `victories.xml` for its AI victory strategies and the Modern scoring items; the victory rules themselves need no change. Keep the age clock off (`10`). Check the Score victory (it ends at the final Age's end, which never comes here) and Domination. Long run to a natural win.

**3.6 Long run, balance, docs. Done 2026-11-12:** long run 6 (300 turns, clean) after two bug fixes; see `phase3-test-results.md`. 300+ turn AI run; check Modern reached, victories progress, no errors. Update README and a `phase3-test-results.md`.

## Decisions for you

1. **Where Modern grafts on.** Recommended: Academics ← Education (Exploration), Steam Engine ← Metallurgy, Military Science ← Gunpowder; Modernization civic ← the last Exploration main civics. Alternative: Modern roots only after Exploration's Future Tech equivalent (slower, more "Age-like").
2. **Pace.** Modern techs at vanilla costs (as done for Exploration) or scaled?
3. **Legacy paths** (per-Age rewards that normally pay out at Age transitions, which never happen here). Leave them as they are, or hide them? Not needed for victories.
4. **Score victory.** It is decided when the final Age ends, which never happens here. Leave it unreachable, or end it some other way (for example a turn limit)?
5. **Ideologies.** Keep vanilla's single pick (Democracy / Fascism / Communism branches) or leave all three open?

## Risks

- ~~Legacy-path scoring tied to the current Age~~ and ~~victories assuming the Modern Age~~: resolved by 3.0.
- AI victory pursuit: AI victory strategies come from Modern `victories.xml` and may only kick in late.
- Database size: Modern adds ~70 files on top of Exploration; one bad row still rolls back the whole mod, so import in the same small batches as Phase 2.
- Roads and bridges art (parked) gains a third stage.
