-- Continuous Civilization - Exploration great people, projects, city-states and AI priorities (imported in
-- cc-import-exploration: greatpeople, projects, independents, ai-exploration, pseudoyields).

-- Great people: Exploration's file holds the civ-unique Alim (Abbasid) and Conquistador (Spain) individuals.
-- The engine offers great people of the current Age only, so re-tag them (as buildings and the Theology tree).
UPDATE GreatPersonIndividuals SET AgeType = 'AGE_ANTIQUITY' WHERE AgeType IN ('AGE_EXPLORATION', 'AGE_MODERN');

-- Projects: Exploration re-defines the six town/city projects Antiquity already has. Keep Antiquity's values
-- (the only differences: culture/science projects cost 300 instead of 200, and the trade focus needs an unlock).
-- New: Town Temple and Town Inn focuses; Heliocentric Model and Invent Calculus (unlocked by the Education and
-- Urban Planning techs at mastery, as in vanilla).
UPDATE Projects SET Cost = 200 WHERE ProjectType IN ('PROJECT_CITY_CULTURE_PROJECT', 'PROJECT_CITY_SCIENCE_PROJECT');
UPDATE Projects SET RequiresUnlock = 0 WHERE ProjectType = 'PROJECT_TOWN_TRADE';

-- City-states: Exploration's independents and their suzerain bonuses are added to Antiquity's (no Age column;
-- available from the start). Shared bonus effects keep their Antiquity versions (parked by gen_dedupe).

-- AI components. ai-exploration.xml swaps the major-civ Military, Diplomatic and Tactical components for their
-- Exploration versions (tuned for Distant Lands and treasure fleets) from game start. Long-run finding (Phase 3):
-- with those, AIs barely settled (one or two cities at turn 90 with room for 4-6). The base components are put
-- back; the Exploration targets and AI lists stay. (Modern's ai-modern.xml is not imported at all: on top of
-- this it added Military_Modern and removed the diplomatic component, and the game crashed within ~90 turns.)
DELETE FROM AiDefinitions WHERE LeaderTrait = 'TRAIT_LEADER_MAJOR_CIV'
  AND AiComponent IN ('Military_Exploration', 'Diplomatic_Exploration', 'Tactical_Exploration', 'Military_Modern', 'Diplomatic_Modern', 'Tactical_Modern');
INSERT OR IGNORE INTO AiDefinitions (LeaderTrait, AiComponent) VALUES
  ('TRAIT_LEADER_MAJOR_CIV', 'Military'), ('TRAIT_LEADER_MAJOR_CIV', 'Diplomatic'), ('TRAIT_LEADER_MAJOR_CIV', 'Tactical');
