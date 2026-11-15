-- Continuous Civilization - victories (Phase 3.5). See docs/phase3-test-results.md for the investigation.
-- What works in a game that stays in Antiquity:
--   * Science (fixed score: 100 points + an undamaged Launch Pad, then a 5-turn countdown) - verified.
--   * Domination (capture every rival's original capital; REQUIREMENT_TEAM_DOMINATION_VICTORY, no Age link).
--   * Culture, Economic and Military with a fixed points target (below). Vanilla decides them by dominance (a 25%
--     lead over second place), which the engine only switches on inside a real Modern Age.

-- Launch Rocket (the space race's last project) requires a completed Modern Science legacy path in vanilla.
-- Legacy paths do not progress in this game (verified: granting a full path's points completed nothing), so it
-- requires the three projects that make up that path instead: Trans-Oceanic Flight, Break the Sound Barrier and
-- Launch Satellite.
UPDATE Projects SET RequireCompletedLegacyPathType = NULL WHERE ProjectType = 'PROJECT_LAUNCH_ROCKET';
INSERT OR IGNORE INTO ProjectPrereqs (PrereqProjectType, ProjectType, MinimumPlayerInstances)
  SELECT p.ProjectType, 'PROJECT_LAUNCH_ROCKET', 1 FROM Projects p
  WHERE p.ProjectType IN ('PROJECT_TRANS_OCEANIC_FLIGHT', 'PROJECT_BREAK_SOUND_BARRIER', 'PROJECT_LAUNCH_SATELLITE')
    AND EXISTS (SELECT 1 FROM Projects WHERE ProjectType = 'PROJECT_LAUNCH_ROCKET');

-- Culture and Economic victories: a fixed points target, like Science.
-- Vanilla scores them by dominance (25% ahead of second place), which the engine only switches on inside a real
-- Modern Age, so they could never be won here. With a fixed target the first player to reach it starts the usual
-- 5-turn countdown. Targets are tuned to the long runs (AI leaders: Culture 78 / Economic 8,882 at turn 301,
-- 239 / 16,847 at turn 451; Science was won on turn 399), aiming for a win in the same late-game window.
-- Culture was 150 until 0.2.0, which added later-Age Triumphs and Dedications with their vanilla Culture points
-- (Wonderland +3 per wonder, World's Fair +2 per wonder, Manifesto +4 per celebration, +2 per fortification). With
-- them 150 was reached by turn ~130 (Online speed). Measured with the Culture victory off (Online, turn 138-191):
-- Science won on turn 184; the Culture leaders had 345 / 251 at turn 170 and 438 / 289 at turn 180. 350 puts the
-- strongest Culture civ's win just before Science.
UPDATE VictoryTypes SET ScoringType = 'COUNTDOWN_VICTORY_SCORING_TYPE_FIXED_SCORE', MinimumPoints = 350
  WHERE VictoryType = 'VICTORY_CULTURE_MODERN';
UPDATE VictoryTypes SET ScoringType = 'COUNTDOWN_VICTORY_SCORING_TYPE_FIXED_SCORE', MinimumPoints = 12000
  WHERE VictoryType = 'VICTORY_ECONOMIC_MODERN';

-- Military victory ("control the most settlements"): the same fixed-target approach. Points come from the settlements
-- a player holds (4 each, +1 if conquered, +4 for an original capital, +1 in the Distant Lands, +2 ideology bonus) and
-- go down when settlements are lost. In long run 6 the AI leaders held 6-15 cities with settlement caps of 17-21 and
-- scored 28-73, unchanged from turn 301 to 451. 100 is above what an empire within its settlement cap scores without
-- fighting (about 70-85), so it takes conquest.
UPDATE VictoryTypes SET ScoringType = 'COUNTDOWN_VICTORY_SCORING_TYPE_FIXED_SCORE', MinimumPoints = 100
  WHERE VictoryType = 'VICTORY_MILITARY_MODERN';
