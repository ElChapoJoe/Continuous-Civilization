# Future work

Ideas and known gaps worth doing later, with what was already found, so the work doesn't have to start over.

## Overbuilding (`ui/cc-overbuild.js`, since 0.2.0)

How it works now: in the placement screen, a full tile whose older building is behind both your personal Age and the
new building's Age can be built over. The script removes the old building (`DESTROY_ELEMENT`) and then queues or buys
the new one; if the engine refuses, the old building is put back (`CREATE_ELEMENT`). See the script's header and
audit row #8.

### Old building stays until the new one is finished (vanilla behaviour)

Today a queued replacement removes the old building at once. Until the new one is built, the city has 1 less
Population (each building counts as urban Population) and lacks the old building's yields. Buying has no gap.
Specialists on the tile stay.

What the engine allows (tested 2026-11-15, turn-220 save, Roma2, Observatory over a Library):
- A building can be queued on a tile, and the old building put back afterwards: the item stays in the queue on the
  full tile, also over a turn end.
- The moment that item becomes the one being built (moved to the front, or the item ahead removed), the engine
  drops it from the queue. `canStart` with that tile also fails. So the old building must be gone before
  construction starts.

Options:
1. **Project swap (preferred).** For each later-Age building, a hidden project with the building's cost and cost
   progression (the `Projects` table has `Cost`, `CostProgressionModel`, `CostProgressionParam1`). Placing over an
   older building queues the project instead; the old building keeps working; when the project finishes, the script
   removes the old building and creates the new one finished. To check first:
   - Remembering the tile and the chosen building across save/load: whether a project queued with X/Y keeps a
     location in the queue item, or a marker on the old building (constructibles have `setProperty`; cities, players
     and `Game` have `getProperty`).
   - That `CityProductionCompleted` fires for the project.
   - "+% production towards buildings" bonuses don't apply to projects: find an equivalent or document it.
   - A building created by script may not count as "built" for quests ("build 3 Monuments").
2. **Queue timing (fallback).** Keep the old building while the replacement waits behind other items, remove it just
   before it starts: at `LocalPlayerTurnEnd` when the item ahead finishes this turn, and before the player's own
   purchase/reorder/cancel of the item ahead (wrap the queue requests). Safety net at `LocalPlayerTurnBegin`: a
   tracked replacement that vanished is re-queued with the normal overbuild. After a reload, a queued building on a
   tile that already has two buildings is a waiting replacement. Saves the gap only when queued behind other items.

### The AI doesn't overbuild

The AI doesn't use the placement screen, so it keeps building on new tiles (fewer farms, weaker quarters later). Idea:
the script acts for AI cities in single player: when an AI city queues a later-Age building on a rural tile while it
has a full tile with an older building, move it there. Needs an autoplay to confirm the AI's queue isn't disrupted.

### Smaller

- Multiplayer is untested (`DESTROY_ELEMENT`/`CREATE_ELEMENT` may be refused there).

## Known limitations: findings (2026-11-17)

### Later-Age unique Settler, Scout, Merchant and Commander from the start
Vanilla gives these replacements (Sokeman, Zamindar, Noyan, Mwami, Chasqui, Mandarin, Tajiro, Hangshang) no unlock:
the civ has them from its own start. `40-units.sql` step 3 already gates them at Machinery / Military Science with
their trait, and they are still trainable on turn 1, so the engine ignores a replacement's own unlock (`Units` has no
requirement column either). What they change: Sokeman and Zamindar carry one trait effect each
(`TRAIT_MOD_SOKEMAN_WALLS`, `TRAIT_MOD_ZAMINDAR_POPULATION_BONUS`, could be gated by personal Age); Noyan and Chasqui
have 4 moves and 4 sight instead of 2; Tajiro is cheaper (30) and Hangshang dearer (140); Mwami and Mandarin are
identical to the base unit. The other lever, dropping the `UnitReplaces` row, would leave the civ both units after
the tech. Low value: the civ is played from turn 1, as in vanilla's own Age.

### AI town purchases before the tech
`EFFECT_ADJUST_TOWN_CAN_PURCHASE_TAGGED_CONSTRUCTIBLES` (argument `ConstructibleTag`: CULTURE, MILITARY, SCIENCE,
FOOD, GOLD, ...) lets a town buy every building of that tag, locked or not; `ui/cc-age-ui.js` blocks it for the local
player only. Data fix in the style of `81-age-scaled-bonuses.sql`: per-Age copies of each tag (`CC_<TAG>_AQ/EX/MO` by
the building's original Age), the original modifier switched to the Antiquity tag, and two copies for the Exploration
and Modern tags switched on by personal Age. Used by leader traits (Augustus; owner = player, works like 81) and by
town-focus projects (`ProjectModifiers`, COLLECTION_OWNER: owner = the city). Also in DLC civ traits (Carthage,
England, Gaul, Joseon). Answered in game (2026-11-18, `tests/cc-probes.js` cityOwnerAge, and by hand): a personal-Age
set used as the owner requirement of a city-owned modifier tests the city's player. `CC_TEST_CITY_OWNER_EX`, attached
to all 6 civs' cities, was active only in the city of the player in Exploration. So the data fix can be built.
