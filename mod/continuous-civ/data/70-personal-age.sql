-- Continuous Civilization - "personal Age": Age conditions become per-player research conditions.
-- The game never leaves Antiquity, so data that asks "is the current Age X?" (REQUIREMENT_GAME_AGE_TYPE_MATCH)
-- or "have N Age transitions happened?" (REQUIREMENT_IS_AGE_COUNT) would be frozen at Antiquity / 0 forever.
-- Instead, each player has a personal Age: a player is "in Exploration" once they have researched any
-- Exploration root tech (Cartography, Astronomy, Machinery), and "in Modern" once they have researched any
-- Modern root tech (Academics, Steam Engine, Military Science); first level is enough. Rewrites:
--   * Age is AGE_ANTIQUITY          -> player is NOT yet in Exploration (Antiquity-only content ends per player)
--   * Age is AGE_EXPLORATION        -> player is in Exploration and NOT yet in Modern (likewise)
--   * Age is AGE_MODERN             -> player is in Modern
--   * Age count 1                   -> player is in Exploration (one transition behind them)
--   * Age count 2                   -> player is in Modern
-- Metaprogression (account challenges / triumphs) is left alone: it is about the player's profile, not the game.
-- Every rewritten requirement is listed in cc_age_rewrites during the build; tools/age-audit.js audits the
-- loaded database for anything left.
-- Note: REQUIREMENT_REQUIREMENTSET_IS_MET evaluates the set on the same subject; the set tests the player,
-- which resolves for player subjects (and, as for other player requirements, their cities/units).

-- Tunable: the techs that start a player's Exploration.
DROP TABLE IF EXISTS cc_exploration_roots;
CREATE TABLE cc_exploration_roots (ProgressionTreeNodeType TEXT PRIMARY KEY);
INSERT INTO cc_exploration_roots VALUES ('NODE_TECH_EX_CARTOGRAPHY'), ('NODE_TECH_EX_ASTRONOMY'), ('NODE_TECH_EX_MACHINERY');
DELETE FROM cc_exploration_roots WHERE ProgressionTreeNodeType NOT IN (SELECT ProgressionTreeNodeType FROM ProgressionTreeNodes);

INSERT OR IGNORE INTO Requirements (RequirementId, RequirementType)
  SELECT 'CC_REQ_ROOT_' || ProgressionTreeNodeType, 'REQUIREMENT_PLAYER_HAS_COMPLETED_PROGRESSION_TREE_NODE' FROM cc_exploration_roots;
INSERT OR IGNORE INTO RequirementArguments (RequirementId, Name, Value)
  SELECT 'CC_REQ_ROOT_' || ProgressionTreeNodeType, 'ProgressionTreeNodeType', ProgressionTreeNodeType FROM cc_exploration_roots;
INSERT INTO RequirementSets (RequirementSetId, RequirementSetType) VALUES ('CC_REQSET_PERSONAL_AGE_EXPLORATION', 'REQUIREMENTSET_TEST_ANY');
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId)
  SELECT 'CC_REQSET_PERSONAL_AGE_EXPLORATION', 'CC_REQ_ROOT_' || ProgressionTreeNodeType FROM cc_exploration_roots;

-- Tunable: the techs that start a player's Modern Age (Phase 3).
DROP TABLE IF EXISTS cc_modern_roots;
CREATE TABLE cc_modern_roots (ProgressionTreeNodeType TEXT PRIMARY KEY);
INSERT INTO cc_modern_roots VALUES ('NODE_TECH_MO_ACADEMICS'), ('NODE_TECH_MO_STEAM_ENGINE'), ('NODE_TECH_MO_MILITARY_SCIENCE');
DELETE FROM cc_modern_roots WHERE ProgressionTreeNodeType NOT IN (SELECT ProgressionTreeNodeType FROM ProgressionTreeNodes);
INSERT OR IGNORE INTO Requirements (RequirementId, RequirementType)
  SELECT 'CC_REQ_ROOT_' || ProgressionTreeNodeType, 'REQUIREMENT_PLAYER_HAS_COMPLETED_PROGRESSION_TREE_NODE' FROM cc_modern_roots;
INSERT OR IGNORE INTO RequirementArguments (RequirementId, Name, Value)
  SELECT 'CC_REQ_ROOT_' || ProgressionTreeNodeType, 'ProgressionTreeNodeType', ProgressionTreeNodeType FROM cc_modern_roots;
INSERT INTO RequirementSets (RequirementSetId, RequirementSetType) VALUES ('CC_REQSET_PERSONAL_AGE_MODERN', 'REQUIREMENTSET_TEST_ANY');
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId)
  SELECT 'CC_REQSET_PERSONAL_AGE_MODERN', 'CC_REQ_ROOT_' || ProgressionTreeNodeType FROM cc_modern_roots;

-- Building blocks: "in Exploration", "in Modern", "not in Modern", and "in Exploration but not yet Modern".
INSERT INTO Requirements (RequirementId, RequirementType) VALUES ('CC_REQ_IN_EXPLORATION', 'REQUIREMENT_REQUIREMENTSET_IS_MET');
INSERT INTO RequirementArguments (RequirementId, Name, Value) VALUES ('CC_REQ_IN_EXPLORATION', 'RequirementSetId', 'CC_REQSET_PERSONAL_AGE_EXPLORATION');
INSERT INTO Requirements (RequirementId, RequirementType) VALUES ('CC_REQ_IN_MODERN', 'REQUIREMENT_REQUIREMENTSET_IS_MET');
INSERT INTO RequirementArguments (RequirementId, Name, Value) VALUES ('CC_REQ_IN_MODERN', 'RequirementSetId', 'CC_REQSET_PERSONAL_AGE_MODERN');
INSERT INTO Requirements (RequirementId, RequirementType, Inverse) VALUES ('CC_REQ_NOT_IN_MODERN', 'REQUIREMENT_REQUIREMENTSET_IS_MET', 1);
INSERT INTO RequirementArguments (RequirementId, Name, Value) VALUES ('CC_REQ_NOT_IN_MODERN', 'RequirementSetId', 'CC_REQSET_PERSONAL_AGE_MODERN');
INSERT INTO RequirementSets (RequirementSetId, RequirementSetType) VALUES
  ('CC_REQSET_NOT_IN_MODERN', 'REQUIREMENTSET_TEST_ALL'), ('CC_REQSET_PERSONAL_AGE_EXPLORATION_ONLY', 'REQUIREMENTSET_TEST_ALL');
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId) VALUES
  ('CC_REQSET_NOT_IN_MODERN', 'CC_REQ_NOT_IN_MODERN'),
  ('CC_REQSET_PERSONAL_AGE_EXPLORATION_ONLY', 'CC_REQ_IN_EXPLORATION'),
  ('CC_REQSET_PERSONAL_AGE_EXPLORATION_ONLY', 'CC_REQ_NOT_IN_MODERN');

-- Requirements to rewrite (gameplay only).
DROP TABLE IF EXISTS cc_age_rewrites;
CREATE TABLE cc_age_rewrites (RequirementId TEXT PRIMARY KEY, Kind TEXT, Flip INTEGER, TargetSet TEXT);
INSERT INTO cc_age_rewrites (RequirementId, Kind, Flip, TargetSet)
  SELECT q.RequirementId, 'AGE_IS_' || a.Value,
         CASE a.Value WHEN 'AGE_ANTIQUITY' THEN 1 ELSE 0 END,
         CASE a.Value WHEN 'AGE_ANTIQUITY'   THEN 'CC_REQSET_PERSONAL_AGE_EXPLORATION'
                      WHEN 'AGE_EXPLORATION' THEN 'CC_REQSET_PERSONAL_AGE_EXPLORATION_ONLY'
                      ELSE 'CC_REQSET_PERSONAL_AGE_MODERN' END
  FROM Requirements q JOIN RequirementArguments a ON a.RequirementId = q.RequirementId AND a.Name = 'AgeType'
  WHERE q.RequirementType = 'REQUIREMENT_GAME_AGE_TYPE_MATCH' AND a.Value IN ('AGE_ANTIQUITY', 'AGE_EXPLORATION', 'AGE_MODERN');
INSERT OR IGNORE INTO cc_age_rewrites (RequirementId, Kind, Flip, TargetSet)
  SELECT q.RequirementId, 'AGE_COUNT_' || CAST(a.Value AS INTEGER), 0,
         CASE CAST(a.Value AS INTEGER) WHEN 1 THEN 'CC_REQSET_PERSONAL_AGE_EXPLORATION' ELSE 'CC_REQSET_PERSONAL_AGE_MODERN' END
  FROM Requirements q JOIN RequirementArguments a ON a.RequirementId = q.RequirementId AND a.Name = 'AgeCount'
  WHERE q.RequirementType = 'REQUIREMENT_IS_AGE_COUNT' AND CAST(a.Value AS INTEGER) IN (1, 2);
DELETE FROM cc_age_rewrites
  WHERE RequirementId LIKE '%CHALLENGE%' OR RequirementId LIKE '%TRIUMPH%' OR RequirementId LIKE 'METAPROGRESSION%';

DELETE FROM RequirementArguments WHERE RequirementId IN (SELECT RequirementId FROM cc_age_rewrites) AND Name IN ('AgeType', 'AgeCount');
INSERT INTO RequirementArguments (RequirementId, Name, Value)
  SELECT RequirementId, 'RequirementSetId', TargetSet FROM cc_age_rewrites;
UPDATE Requirements
  SET RequirementType = 'REQUIREMENT_REQUIREMENTSET_IS_MET',
      Inverse = CASE WHEN (SELECT Flip FROM cc_age_rewrites r WHERE r.RequirementId = Requirements.RequirementId) = 1
                     THEN 1 - Inverse ELSE Inverse END
  WHERE RequirementId IN (SELECT RequirementId FROM cc_age_rewrites);

-- Test hooks (harmless, +0 Gold): their subjects are exactly the major players in their Exploration / Modern.
INSERT OR IGNORE INTO Types (Type, Kind) VALUES ('CC_MODTYPE_MAJORS_YIELD', 'KIND_MODIFIER');
INSERT OR IGNORE INTO DynamicModifiers (ModifierType, CollectionType, EffectType)
  VALUES ('CC_MODTYPE_MAJORS_YIELD', 'COLLECTION_MAJOR_PLAYERS', 'EFFECT_PLAYER_ADJUST_YIELD');
INSERT INTO RequirementSets (RequirementSetId, RequirementSetType) VALUES ('CC_REQSET_TEST_IN_EXPLORATION', 'REQUIREMENTSET_TEST_ALL');
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId) VALUES ('CC_REQSET_TEST_IN_EXPLORATION', 'CC_REQ_IN_EXPLORATION');
INSERT INTO Modifiers (ModifierId, ModifierType, SubjectRequirementSetId) VALUES ('CC_TEST_IN_EXPLORATION', 'CC_MODTYPE_MAJORS_YIELD', 'CC_REQSET_TEST_IN_EXPLORATION');
INSERT INTO ModifierArguments (ModifierId, Name, Value) VALUES ('CC_TEST_IN_EXPLORATION', 'YieldType', 'YIELD_GOLD'), ('CC_TEST_IN_EXPLORATION', 'Amount', '0');
INSERT INTO GameModifiers (ModifierId) VALUES ('CC_TEST_IN_EXPLORATION');
INSERT INTO RequirementSets (RequirementSetId, RequirementSetType) VALUES ('CC_REQSET_TEST_IN_MODERN', 'REQUIREMENTSET_TEST_ALL');
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId) VALUES ('CC_REQSET_TEST_IN_MODERN', 'CC_REQ_IN_MODERN');
INSERT INTO Modifiers (ModifierId, ModifierType, SubjectRequirementSetId) VALUES ('CC_TEST_IN_MODERN', 'CC_MODTYPE_MAJORS_YIELD', 'CC_REQSET_TEST_IN_MODERN');
INSERT INTO ModifierArguments (ModifierId, Name, Value) VALUES ('CC_TEST_IN_MODERN', 'YieldType', 'YIELD_GOLD'), ('CC_TEST_IN_MODERN', 'Amount', '0');
INSERT INTO GameModifiers (ModifierId) VALUES ('CC_TEST_IN_MODERN');

-- All of this mod's "has completed <tech/civic>" requirements (here, 35-governments.sql, 65-modern-resources.sql)
-- need MinDepth 1: without it the requirement means fully completed, incl. the node's mastery level, which AI
-- players often never research (verified in a 150-turn run). Firaxis passes MinDepth the same way.
INSERT OR IGNORE INTO RequirementArguments (RequirementId, Name, Value)
  SELECT RequirementId, 'MinDepth', '1' FROM Requirements
  WHERE RequirementType = 'REQUIREMENT_PLAYER_HAS_COMPLETED_PROGRESSION_TREE_NODE' AND RequirementId LIKE 'CC\_%' ESCAPE '\';
