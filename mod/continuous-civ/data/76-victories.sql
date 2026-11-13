-- Continuous Civilization - victories (Phase 3.5). See docs/phase3-test-results.md for the investigation.
-- What works in a game that stays in Antiquity:
--   * Science (fixed score: 100 points + an undamaged Launch Pad, then a 5-turn countdown) - verified.
--   * Domination (capture every rival's original capital; REQUIREMENT_TEAM_DOMINATION_VICTORY, no Age link).
-- Known limitation: the Military, Culture and Economic points victories are decided by dominance (a 25% lead over
-- second place), which the engine only switches on inside a real Modern Age; they cannot be won here yet.

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
UPDATE VictoryTypes SET ScoringType = 'COUNTDOWN_VICTORY_SCORING_TYPE_FIXED_SCORE', MinimumPoints = 150
  WHERE VictoryType = 'VICTORY_CULTURE_MODERN';
UPDATE VictoryTypes SET ScoringType = 'COUNTDOWN_VICTORY_SCORING_TYPE_FIXED_SCORE', MinimumPoints = 12000
  WHERE VictoryType = 'VICTORY_ECONOMIC_MODERN';
