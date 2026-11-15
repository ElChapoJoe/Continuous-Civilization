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
