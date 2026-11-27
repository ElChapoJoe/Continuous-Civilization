-- Continuous Civilization - Economic victory target for GAMESPEED_EPIC (loaded only at that speed, continuous-civ.modinfo).
-- 76-victories.sql sets 8,000, tuned on Online speed. Economic points accrue per turn at the same rate whatever the
-- speed, while a game lasts longer in turns (GameSpeeds.CostMultiplier: Online 50, Quick 67, Standard 100, Epic 150,
-- Marathon 300), so the target scales with it: 8,000 x CostMultiplier / 50. Reported on the Workshop (0.2.1-beta):
-- on Epic an AI reached 8,000 around turn 350 of a game meant to last about 650.
UPDATE VictoryTypes SET MinimumPoints = 24000 WHERE VictoryType = 'VICTORY_ECONOMIC_MODERN';
