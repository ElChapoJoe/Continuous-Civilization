# Changelog

Versions follow `MAJOR.MINOR.PATCH`. The number in brackets is the mod's internal version in `continuous-civ.modinfo`.

Saves from one beta version may not load in the next. Start a new game after updating.

## Unreleased

### Added
- Exploration and Modern wonders from the DLC wonder packs, if you own them: Grand Bazaar, Wat Xieng Thong and Ubudiah Mosque (Asia wonders), Nirayama Reverberatory Furnace (Japan and Korea wonders) and Nan Madol (water wonders). In vanilla they only appear from their Age on, which never comes here. Each unlocks with the same tech or civic as in vanilla. Not yet tested in a game by an owner of these packs.
- Four Exploration and Modern wonders from DLC civilization packs, if you own the pack: Rila Monastery (Bulgaria), Serpent Mound (Shawnee and Tecumseh), Battersea Power Station (Great Britain) and Boudhanath (Nepal), each unlocked by its vanilla tech or civic. Tested in game. The civilizations' own unique buildings and improvements in those files stay limited to that civilization.
- Military victory can be won: 100 Military victory points, then a 5-turn countdown, like the Culture and Economic targets. Points come from the settlements you hold (4 each), with more for conquered settlements, original capitals, the Distant Lands and ideology. Vanilla's rule (25% ahead of second place) only runs in a real Modern Age. Tested in game: reaching 100 points started the countdown and won on schedule.
- Numbers that vanilla raises in later Ages now follow each player's personal Age:
  - City growth costs: about 1.9x in Exploration and 3.3x in Modern, as in vanilla. Town upgrade costs: about 2x and 3x. Specialist cap: +1 in Exploration, +3 in Modern.
  - Leader abilities, mementos, attribute-tree nodes and traditions whose amounts vanilla scales by Age: double in Exploration, triple in Modern (108 bonuses, including DLC leaders you own).
  - Narrative and discovery rewards from Exploration and Modern stories use their own Age's sizes.
  - Still at Antiquity's values (no per-player version in the engine): the Happiness needed for celebrations and for Joyous/Ecstatic settlements, war weariness, and diplomacy action results.
- Exploration and Modern Triumphs (legacy paths): all three Ages' Triumphs are on the Triumphs screen, and each later-Age Triumph counts once you reach that personal Age, with vanilla's reward. Their progress shows the real count (for example 1/20 relics). Tested in game: Tuhuoqiang (Gunpowder) and Dawn of the Space Race (Flight) completed.
- Dedications: Major Triumphs' bonuses, which vanilla offers at the next Age transition. Entering your personal Exploration gives 3 Dedication points and Modern 3 more, spent on a new Dedications tab of the attribute screen; only Dedications you've earned can be picked (Antiquity Triumphs' from Exploration on, Exploration Triumphs' from Modern on). AI civilizations get the ones they earn automatically. Tested in game: after founding 8 settlements in Exploration, the Four Corners of the World Dedication became available and was bought; unearned ones stayed locked.
- AI civilizations get vanilla's later-Age difficulty bonuses by their personal Age: +10% yields and production in Exploration, +20% in Modern, and free Medieval Walls or Defensive Fortifications on higher difficulties (after Castles or Military Science). Before, AIs kept Antiquity's bonuses all game.

## 0.1.1-beta (21) - fixes from beta feedback

### Fixed
- Land units can cross the Ocean once you are in your personal Exploration: civilians and commanders after Cartography, all land units after Shipbuilding mastery, as in vanilla. Antiquity's rule that makes the Ocean impassable now ends for each player at their personal Exploration; before, it never ended. (Reported by beta testers.)
- The Distant Lands are open: you can meet the civilizations there (their leaders now appear in the diplomacy ribbon), land units can enter that land, and it has valid settlement spots. In an Antiquity game the engine keeps the Distant Lands closed to everyone, and this game always is one; that switch is now off for everyone. Crossing the Ocean still needs your personal Exploration. (Reported by beta testers.)
- The Religion button (and the radial menu's Religion entry) opens the religion picker once you can found a religion, and the belief picker after you have founded one. Before, it always opened the pantheon screen, because the game picks that screen from the game Age, which stays Antiquity. ([audit](docs/audit-age-gated-mechanics.md) #3)
- Trade route range grows with your personal Age, as it does between Ages in vanilla: +5 land and +15 sea range in Exploration, the same again in Modern. ([audit](docs/audit-age-gated-mechanics.md) #5)
- Embarked land units get stronger with your personal Age: +15 combat strength in Exploration and +30 more in Modern, matching vanilla's 5 / 20 / 50. Matters now that land units can cross the Ocean. ([audit](docs/audit-age-gated-mechanics.md) #6)
- Leaders receive their attribute points for each new Age when they enter their personal Exploration (+1 per favoured attribute) and Modern (+2), as at vanilla's Age transitions; Ibn Battuta gets his 4 and 6 Wildcard points. Before, these never arrived. ([audit](docs/audit-age-gated-mechanics.md) #7)
- These four fixes only apply to games started on this version (the game sets up these rules when a game starts).
- City-state bonus choices now only list the bonuses of your personal Age (Antiquity, Exploration or Modern), as in vanilla, instead of all three Ages at once. If every bonus of your Age is already taken, the other Ages' bonuses are offered so the choice is never empty. The AI's own picks are unchanged. ([#2](https://github.com/ElChapoJoe/Continuous-Civilization/issues/2))

## 0.1.0-beta (20) - first public beta

First release for playtesters.

### One continuous game
- The Antiquity Age never ends: no Age transition, no civilization swap, no reset.
- Exploration and Modern techs and civics continue Antiquity's in one technology tree and one civic tree, ending in Future Tech and Future Civic.
- Personal Ages: each player enters Exploration (Cartography, Astronomy or Machinery) and Modern (Academics, Steam Engine or Military Science) through their own research. Age rules follow each player's personal Age.

### Content from every Age
- Units and buildings from all three Ages, with upgrade paths between Ages.
- Governments unlock by civic, with a Change Government button; AI civilizations change government too.
- Religion, city-states, great people, projects, narratives and discoveries from all three Ages.
- Exploration and Modern resources stay inactive and hidden for each player until they research the matching tech.
- Exploration and Modern diplomacy and espionage actions, each unlocked by its tech, civic or city-state bonus.
- Ideology trees open with Political Theory.

### Winning
- Science: 100 points with an undamaged Launch Pad, then a 5-turn countdown.
- Culture: 150 points, then a 5-turn countdown.
- Economic: 12,000 points, then a 5-turn countdown.
- Domination: capture every rival's original capital.

### Interface
- Neater tech and civic tree screens: fewer crossing lines, rows that line up, straight links.

### Known limitations
See the README: Military (points) and Score victories, legacy paths, diplomacy costs that don't scale by Age, Antiquity-style city art, single player only.
