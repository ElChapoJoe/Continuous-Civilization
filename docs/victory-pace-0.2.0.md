# Victory pace in 0.2.0 (Online speed)

Measurements behind the 0.2.0 Culture target, and where the other fixed targets stand. All games are AI autoplays on
Online speed (costs 50% of Standard). The points a civ has at a given stage of development do not depend on game
speed; only the turn number scales with the speed's cost multiplier (Quick 67%, Standard 100%, Epic 150%, Marathon 300%).

## Culture target: 150 to 350

Release check 1 (0.2.0 build, before the Wonders Triumph fix): Russia won Culture on turn 143.

Fix check (with the Wonders Triumph fix): Culture still passed 150 by turn ~130. Nothing scores twice. The points
are vanilla's Culture rewards that 0.2.0's later-Age Triumphs and Dedications now hand out:

| Source | Points | Example at turn 138 |
|---|---|---|
| Each wonder | 4 (the wonder tracker scores by game Age, always Antiquity here) | Rome: 20 wonders, 80 |
| Wonderland Triumph (own 20 wonders) | +3 per wonder | Rome: 60 |
| Modern World Wonders Triumph (6 Modern wonders) | 36 once | Rome: 36 |
| Dedication from an Exploration Militaristic Triumph | +2 per fortification (walls), counting walls already built | Abbasids: 33 walls, 66 |
| Manifesto Triumph | +4 per celebration | Abbasids: 24 |
| World's Fair (wonder) | +2 per wonder | Rome, turn ~155: about 44 |

The same game was then continued from turn 138 with the Culture victory switched off:

| Turn | Culture: 1st | 2nd | 3rd | Science: 1st | Economic: 1st | Military: 1st |
|---|---|---|---|---|---|---|
| 138 | 198 | 184 | 45 | 83 | 3,930 | 61 |
| 151 | 238 | 200 | 111 | 96 | 4,953 | 65 |
| 160 | 322 | 213 | 112 | 101 | 5,776 | 70 |
| 170 | 345 | 251 | 119 | 115 | 6,762 | 70 |
| 180 | 438 | 289 | 133 | 123 | 7,856 | 70 |
| 191 | 441 | 299 | 169 | 123 | 8,324 | 70 |

Science (Rome) was won on turn 184. The target is now 350: the strongest Culture civ (Rome, 22 wonders) would cross
it around turn 171 and win around 176, just ahead of Science; the second-best Culture civ would not have reached it.

## Economic: 12,000 to 8,000. Military (100): not changed

- **Economic** grew about 85 points a turn for the leader between turns 140 and 191 (4,076 to 8,324). At that rate
  the leader reaches 12,000 around turn 235, about 50 turns after the Science win. Economic is out of reach in a game
  that ends on time. The target is now 8,000, which this game's leader would cross around turn 187, near the Science win.
- **Military** stayed at 70 or below from turn 160 on (settlements held, no big conquests). That is by design: 100
  is above what an empire scores within its settlement cap, so it takes conquest. No AI went for it here.

## Release rerun with 350

New game from turn 1 (Online; Augustus, Ibn Battuta, Harriet Tubman, Hatshepsut, Alexander, Gilgamesh), autoplayed
to turn 228 with no crash (the named save failed with no local player alive; the turn-228 autosave has it).

- Rome (Augustus, an AI during autoplay) was conquered before turn 61.
- **Harriet Tubman won Culture on turn 152** (countdown started around turn 147). She was a runaway: 21 cities, 27
  wonders, 470 Culture points by the end. Her Culture went from 83 at turn 102 to 450 at turn 151: 27 wonders at 4
  each, Wonderland +3 each, Modern World Wonders +36, Manifesto 14 x 4, 38 walls at 2 each, Eiffel Tower 26,
  18 celebrations at 2. At the win she also had 125 Science points (no Launch Pad yet) and 97 Military.
- Nobody else passed 82 Culture. Economic leader at the win: 5,051.
- All test suites pass except two checks that read the local player, who is dead in this game (Rome): Modern techs
  shown and deep-water units entering the Ocean. For living civs all 17 Modern techs are unlockable.

Two games, two different shapes: a wonder builder that would win Culture about 8 turns before Science (game 1, with
350), and a runaway that wins Culture on turn 152 with Science and Military also close. 350 keeps Culture from
winning before turn ~150 on Online in both. Whether a runaway should win this way, or this early, is for the
balancing pass against vanilla game lengths.

## Vanilla reference game (no mods, Online)

Same settings and leaders as the fix check (Sovereign, Continents and Islands, Small map; Augustus, Ibn Battuta,
Alexander, Lafayette, Friedrich alt, Napoleon), autoplayed with only the base game. Each Age lasted 70 turns
(Antiquity turns 1-70, Exploration 71-140, Modern 141-210 counted across the game; vanilla restarts the turn counter
each Age). **The game ended on turn 210 with a Score victory (Siam)**: nobody got the 25% lead that vanilla's Culture,
Economic and Military victories need, and nobody launched a rocket.

Leaders' victory points (vanilla scores them all game; they carry over between Ages):

| Turn (whole game) | Age | Culture 1st / 2nd | Science 1st | Economic 1st | Military 1st |
|---|---|---|---|---|---|
| 40 | Antiquity | 10 / 8 | 3 | 38 | 20 |
| 60 | Antiquity | 22 / 21 | 12 | 229 | 24 |
| 72 | Exploration starts | 25 / 24 | 19 | 410 | 32 |
| 100 | Exploration | 86 / 62 | 19 | 950 | 37 |
| 130 | Exploration | 131 / 102 | 28 | 1,917 | 47 |
| 141 | Modern starts | 150 / 134 | 43 | 2,295 | 52 |
| 160 | Modern | 177 / 173 | 46 | 2,575 | 56 |
| 180 | Modern | 246 / 231 | 54 | 3,049 | 75 |
| 200 | Modern | 301 / 273 | 59 | 3,895 | 75 |
| 210 (end) | Modern | 336 / 299 | 72 | 4,646 | 77 |

Compared with this mod (Online):

- **Game length.** Vanilla ends on turn 210 at the latest. This mod's Science win came on turn 184 (game 1) and the
  Culture win on turn 152 (game 2), so games end at about the same time or earlier.
- **Culture.** Vanilla's leader has 336 at the very end. 350 is in the same range, but this mod gets there sooner
  (345 by turn 170 in game 1, 450 by turn 151 in game 2), because wonders and buildings are never lost to an Age
  transition and all Triumphs count from the personal Age on.
- **Economic.** Vanilla's leader ends with 4,646; this mod's leader had 8,324 at turn 191. 12,000 was far above both; hence 8,000.
- **Military.** Vanilla's leader ends with 77 (Siam reached 100 only after the Score victory); this mod's leaders sat
  at 61-97. 100 matches "takes conquest" in both.
- **Science points** are not comparable: vanilla's Science victory is the rocket, and vanilla's points come mostly from
  codices.

One game per side; a second vanilla game would show how much these numbers vary.
