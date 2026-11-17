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

-- ====================================================================================================
-- Continuous Civilization - world Age, after Civilization VI's world eras.
-- Each player has a personal Age (70-personal-age.sql). The world Age is shared: it reaches Exploration (Modern) once
-- at least half of the living major civilizations are in that personal Age (Civ VI starts its world-era countdown when
-- about half the civs are in the next era). Costs that vanilla raises per Age follow the world Age, so a leader isn't
-- charged more than its rivals for advancing, and a civ far behind pays the world's prices (78-diplomacy.sql,
-- 72/74 growth and town upgrades). Techs and civics also cost +20% when they are from an Age ahead of the world's
-- and -20% when from an Age behind it, as Civ VI's TECH/CIVIC_COST_PERCENT_CHANGE_AFTER/BEFORE_GAME_ERA.
--
-- "Half" needs the number of living majors, which isn't known when the database is built, so there is one set per
-- civ count m (1-16): "exactly m majors alive AND at least ceil(m/2) of them in the Age". The world set is "any of
-- these". COLLECTION_MAJOR_PLAYERS counts living major players.

DROP TABLE IF EXISTS cc_world_counts;
CREATE TABLE cc_world_counts (m INTEGER PRIMARY KEY);
INSERT INTO cc_world_counts (m) VALUES (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (11), (12), (13), (14), (15), (16), (17);

-- "At least n majors alive" (n = 1..17); "exactly m" = at least m AND NOT at least m+1.
INSERT INTO Requirements (RequirementId, RequirementType)
  SELECT 'CC_REQ_MAJORS_ATLEAST_' || m, 'REQUIREMENT_COLLECTION_COUNT_ATLEAST' FROM cc_world_counts;
INSERT INTO RequirementArguments (RequirementId, Name, Value)
  SELECT 'CC_REQ_MAJORS_ATLEAST_' || m, 'CollectionType', 'COLLECTION_MAJOR_PLAYERS' FROM cc_world_counts;
INSERT INTO RequirementArguments (RequirementId, Name, Value)
  SELECT 'CC_REQ_MAJORS_ATLEAST_' || m, 'Count', m FROM cc_world_counts;
INSERT INTO Requirements (RequirementId, RequirementType, Inverse)
  SELECT 'CC_REQ_MAJORS_FEWER_THAN_' || m, 'REQUIREMENT_COLLECTION_COUNT_ATLEAST', 1 FROM cc_world_counts;
INSERT INTO RequirementArguments (RequirementId, Name, Value)
  SELECT 'CC_REQ_MAJORS_FEWER_THAN_' || m, 'CollectionType', 'COLLECTION_MAJOR_PLAYERS' FROM cc_world_counts;
INSERT INTO RequirementArguments (RequirementId, Name, Value)
  SELECT 'CC_REQ_MAJORS_FEWER_THAN_' || m, 'Count', m FROM cc_world_counts;

-- "At least k majors in personal Exploration / Modern".
INSERT INTO Requirements (RequirementId, RequirementType)
  SELECT 'CC_REQ_MAJORS_IN_' || a.Age || '_ATLEAST_' || c.m, 'REQUIREMENT_COLLECTION_COUNT_ATLEAST'
  FROM cc_world_counts c, (SELECT 'EXPLORATION' AS Age UNION ALL SELECT 'MODERN') a WHERE c.m <= 9;
INSERT INTO RequirementArguments (RequirementId, Name, Value)
  SELECT 'CC_REQ_MAJORS_IN_' || a.Age || '_ATLEAST_' || c.m, 'CollectionType', 'COLLECTION_MAJOR_PLAYERS'
  FROM cc_world_counts c, (SELECT 'EXPLORATION' AS Age UNION ALL SELECT 'MODERN') a WHERE c.m <= 9;
INSERT INTO RequirementArguments (RequirementId, Name, Value)
  SELECT 'CC_REQ_MAJORS_IN_' || a.Age || '_ATLEAST_' || c.m, 'Count', c.m
  FROM cc_world_counts c, (SELECT 'EXPLORATION' AS Age UNION ALL SELECT 'MODERN') a WHERE c.m <= 9;
INSERT INTO RequirementArguments (RequirementId, Name, Value)
  SELECT 'CC_REQ_MAJORS_IN_' || a.Age || '_ATLEAST_' || c.m, 'RequirementSetId', 'CC_REQSET_PERSONAL_AGE_' || a.Age
  FROM cc_world_counts c, (SELECT 'EXPLORATION' AS Age UNION ALL SELECT 'MODERN') a WHERE c.m <= 9;

-- Per civ count m: exactly m alive and ceil(m/2) in the Age.
INSERT INTO RequirementSets (RequirementSetId, RequirementSetType)
  SELECT 'CC_REQSET_WORLD_' || a.Age || '_' || c.m, 'REQUIREMENTSET_TEST_ALL'
  FROM cc_world_counts c, (SELECT 'EXPLORATION' AS Age UNION ALL SELECT 'MODERN') a WHERE c.m <= 16;
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId)
  SELECT 'CC_REQSET_WORLD_' || a.Age || '_' || c.m, 'CC_REQ_MAJORS_ATLEAST_' || c.m
  FROM cc_world_counts c, (SELECT 'EXPLORATION' AS Age UNION ALL SELECT 'MODERN') a WHERE c.m <= 16;
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId)
  SELECT 'CC_REQSET_WORLD_' || a.Age || '_' || c.m, 'CC_REQ_MAJORS_FEWER_THAN_' || (c.m + 1)
  FROM cc_world_counts c, (SELECT 'EXPLORATION' AS Age UNION ALL SELECT 'MODERN') a WHERE c.m <= 16;
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId)
  SELECT 'CC_REQSET_WORLD_' || a.Age || '_' || c.m, 'CC_REQ_MAJORS_IN_' || a.Age || '_ATLEAST_' || ((c.m + 1) / 2)
  FROM cc_world_counts c, (SELECT 'EXPLORATION' AS Age UNION ALL SELECT 'MODERN') a WHERE c.m <= 16;

-- World in Exploration (also true in Modern) / world in Modern: any of the per-count sets.
INSERT INTO Requirements (RequirementId, RequirementType)
  SELECT 'CC_REQ_WORLD_' || a.Age || '_' || c.m, 'REQUIREMENT_REQUIREMENTSET_IS_MET'
  FROM cc_world_counts c, (SELECT 'EXPLORATION' AS Age UNION ALL SELECT 'MODERN') a WHERE c.m <= 16;
INSERT INTO RequirementArguments (RequirementId, Name, Value)
  SELECT 'CC_REQ_WORLD_' || a.Age || '_' || c.m, 'RequirementSetId', 'CC_REQSET_WORLD_' || a.Age || '_' || c.m
  FROM cc_world_counts c, (SELECT 'EXPLORATION' AS Age UNION ALL SELECT 'MODERN') a WHERE c.m <= 16;
INSERT INTO RequirementSets (RequirementSetId, RequirementSetType) VALUES
  ('CC_REQSET_WORLD_IN_EXPLORATION', 'REQUIREMENTSET_TEST_ANY'), ('CC_REQSET_WORLD_IN_MODERN', 'REQUIREMENTSET_TEST_ANY');
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId)
  SELECT 'CC_REQSET_WORLD_IN_' || a.Age, 'CC_REQ_WORLD_' || a.Age || '_' || c.m
  FROM cc_world_counts c, (SELECT 'EXPLORATION' AS Age UNION ALL SELECT 'MODERN') a WHERE c.m <= 16;
-- The Modern world is also an Exploration world (half the civs in Modern are also in Exploration, but this keeps
-- it true if the Exploration count is ever read differently).
INSERT INTO Requirements (RequirementId, RequirementType) VALUES ('CC_REQ_WORLD_IN_MODERN', 'REQUIREMENT_REQUIREMENTSET_IS_MET');
INSERT INTO RequirementArguments (RequirementId, Name, Value) VALUES ('CC_REQ_WORLD_IN_MODERN', 'RequirementSetId', 'CC_REQSET_WORLD_IN_MODERN');
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId) VALUES ('CC_REQSET_WORLD_IN_EXPLORATION', 'CC_REQ_WORLD_IN_MODERN');
INSERT INTO Requirements (RequirementId, RequirementType) VALUES ('CC_REQ_WORLD_IN_EXPLORATION', 'REQUIREMENT_REQUIREMENTSET_IS_MET');
INSERT INTO RequirementArguments (RequirementId, Name, Value) VALUES ('CC_REQ_WORLD_IN_EXPLORATION', 'RequirementSetId', 'CC_REQSET_WORLD_IN_EXPLORATION');
-- Exactly the Exploration world (Exploration, not Modern), for steps that Modern replaces.
INSERT INTO Requirements (RequirementId, RequirementType, Inverse) VALUES ('CC_REQ_WORLD_NOT_MODERN', 'REQUIREMENT_REQUIREMENTSET_IS_MET', 1);
INSERT INTO RequirementArguments (RequirementId, Name, Value) VALUES ('CC_REQ_WORLD_NOT_MODERN', 'RequirementSetId', 'CC_REQSET_WORLD_IN_MODERN');
INSERT INTO Requirements (RequirementId, RequirementType, Inverse) VALUES ('CC_REQ_WORLD_NOT_EXPLORATION', 'REQUIREMENT_REQUIREMENTSET_IS_MET', 1);
INSERT INTO RequirementArguments (RequirementId, Name, Value) VALUES ('CC_REQ_WORLD_NOT_EXPLORATION', 'RequirementSetId', 'CC_REQSET_WORLD_IN_EXPLORATION');
INSERT INTO RequirementSets (RequirementSetId, RequirementSetType) VALUES
  ('CC_REQSET_WORLD_ANTIQUITY', 'REQUIREMENTSET_TEST_ALL'), ('CC_REQSET_WORLD_NOT_MODERN', 'REQUIREMENTSET_TEST_ALL'),
  ('CC_REQSET_WORLD_EXPLORATION_ONLY', 'REQUIREMENTSET_TEST_ALL');
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId) VALUES
  ('CC_REQSET_WORLD_ANTIQUITY', 'CC_REQ_WORLD_NOT_EXPLORATION'),
  ('CC_REQSET_WORLD_NOT_MODERN', 'CC_REQ_WORLD_NOT_MODERN'),
  ('CC_REQSET_WORLD_EXPLORATION_ONLY', 'CC_REQ_WORLD_IN_EXPLORATION'), ('CC_REQSET_WORLD_EXPLORATION_ONLY', 'CC_REQ_WORLD_NOT_MODERN');

DROP TABLE cc_world_counts;

-- Test hooks (harmless, +0 Gold): every major player is a subject while the world is in that Age.
INSERT INTO Modifiers (ModifierId, ModifierType, SubjectRequirementSetId) VALUES
  ('CC_TEST_WORLD_EXPLORATION', 'CC_MODTYPE_MAJORS_YIELD', 'CC_REQSET_WORLD_IN_EXPLORATION'),
  ('CC_TEST_WORLD_MODERN', 'CC_MODTYPE_MAJORS_YIELD', 'CC_REQSET_WORLD_IN_MODERN');
INSERT INTO ModifierArguments (ModifierId, Name, Value) VALUES
  ('CC_TEST_WORLD_EXPLORATION', 'YieldType', 'YIELD_GOLD'), ('CC_TEST_WORLD_EXPLORATION', 'Amount', '0'),
  ('CC_TEST_WORLD_MODERN', 'YieldType', 'YIELD_GOLD'), ('CC_TEST_WORLD_MODERN', 'Amount', '0');
INSERT INTO GameModifiers (ModifierId) VALUES ('CC_TEST_WORLD_EXPLORATION'), ('CC_TEST_WORLD_MODERN');
-- Building-block hooks for tests: "exactly 6 majors alive" and "at least 1 major in Exploration".
INSERT INTO RequirementSets (RequirementSetId, RequirementSetType) VALUES
  ('CC_REQSET_TEST_SIX_MAJORS', 'REQUIREMENTSET_TEST_ALL'), ('CC_REQSET_TEST_ONE_IN_EXPLORATION', 'REQUIREMENTSET_TEST_ALL');
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId) VALUES
  ('CC_REQSET_TEST_SIX_MAJORS', 'CC_REQ_MAJORS_ATLEAST_6'), ('CC_REQSET_TEST_SIX_MAJORS', 'CC_REQ_MAJORS_FEWER_THAN_7'),
  ('CC_REQSET_TEST_ONE_IN_EXPLORATION', 'CC_REQ_MAJORS_IN_EXPLORATION_ATLEAST_1');
INSERT INTO Modifiers (ModifierId, ModifierType, SubjectRequirementSetId) VALUES
  ('CC_TEST_SIX_MAJORS', 'CC_MODTYPE_MAJORS_YIELD', 'CC_REQSET_TEST_SIX_MAJORS'),
  ('CC_TEST_ONE_IN_EXPLORATION', 'CC_MODTYPE_MAJORS_YIELD', 'CC_REQSET_TEST_ONE_IN_EXPLORATION');
INSERT INTO ModifierArguments (ModifierId, Name, Value) VALUES
  ('CC_TEST_SIX_MAJORS', 'YieldType', 'YIELD_GOLD'), ('CC_TEST_SIX_MAJORS', 'Amount', '0'),
  ('CC_TEST_ONE_IN_EXPLORATION', 'YieldType', 'YIELD_GOLD'), ('CC_TEST_ONE_IN_EXPLORATION', 'Amount', '0');
INSERT INTO GameModifiers (ModifierId) VALUES ('CC_TEST_SIX_MAJORS'), ('CC_TEST_ONE_IN_EXPLORATION');

-- Catch-up, after Civ VI (TECH/CIVIC_COST_PERCENT_CHANGE_AFTER/BEFORE_GAME_ERA, +20% / -20%): techs and civics from an
-- Age ahead of the world Age cost 20% more, those from an Age behind it 20% less, for every major player.
--   World Antiquity: Exploration and Modern nodes +20%.  World Exploration: Antiquity -20%, Modern +20%.
--   World Modern: Antiquity and Exploration -20%.
-- The efficiency effect lowers a cost by Percent (vanilla's System of Ideas: 50); a negative Percent raises it.
INSERT OR IGNORE INTO Types (Type, Kind) VALUES ('CC_MODTYPE_MAJORS_TREE_COST', 'KIND_MODIFIER');
INSERT OR IGNORE INTO DynamicModifiers (ModifierType, CollectionType, EffectType)
  VALUES ('CC_MODTYPE_MAJORS_TREE_COST', 'COLLECTION_MAJOR_PLAYERS', 'EFFECT_PLAYER_ADJUST_PROGRESSION_TREE_EFFICIENCY');
DROP TABLE IF EXISTS cc_catchup;
CREATE TABLE cc_catchup (Id TEXT, NodeAge TEXT, Percent INTEGER, ReqSet TEXT);
INSERT INTO cc_catchup VALUES
  ('EX_AHEAD', 'EX', -20, 'CC_REQSET_WORLD_ANTIQUITY'),
  ('MO_AHEAD', 'MO', -20, 'CC_REQSET_WORLD_NOT_MODERN'),
  ('AQ_BEHIND', 'AQ', 20, 'CC_REQSET_WORLD_IN_EXPLORATION'),
  ('EX_BEHIND', 'EX', 20, 'CC_REQSET_WORLD_IN_MODERN');
DROP TABLE IF EXISTS cc_catchup_sys;
CREATE TABLE cc_catchup_sys (Sys TEXT, Prefix TEXT);
INSERT INTO cc_catchup_sys VALUES ('SYSTEM_TECH', 'NODE_TECH_'), ('SYSTEM_CULTURE', 'NODE_CIVIC_');
INSERT INTO Modifiers (ModifierId, ModifierType, SubjectRequirementSetId)
  SELECT 'CC_CATCHUP_' || s.Prefix || c.Id, 'CC_MODTYPE_MAJORS_TREE_COST', c.ReqSet FROM cc_catchup c, cc_catchup_sys s;
INSERT INTO ModifierArguments (ModifierId, Name, Value)
  SELECT 'CC_CATCHUP_' || s.Prefix || c.Id, 'SystemType', s.Sys FROM cc_catchup c, cc_catchup_sys s;
INSERT INTO ModifierArguments (ModifierId, Name, Value)
  SELECT 'CC_CATCHUP_' || s.Prefix || c.Id, 'Percent', c.Percent FROM cc_catchup c, cc_catchup_sys s;
INSERT INTO ModifierArguments (ModifierId, Name, Value)
  SELECT 'CC_CATCHUP_' || s.Prefix || c.Id, 'ProgressionTreeNodeType',
    (SELECT GROUP_CONCAT(n.ProgressionTreeNodeType, ',') FROM ProgressionTreeNodes n
     WHERE n.ProgressionTreeNodeType LIKE s.Prefix || c.NodeAge || '\_%' ESCAPE '\')
  FROM cc_catchup c, cc_catchup_sys s;
INSERT INTO GameModifiers (ModifierId) SELECT 'CC_CATCHUP_' || s.Prefix || c.Id FROM cc_catchup c, cc_catchup_sys s;
DROP TABLE cc_catchup;
DROP TABLE cc_catchup_sys;

-- Test hooks for city-owned modifiers (tests/cc-probes.js, cityOwnerAge): does the personal-Age condition, which tests
-- a player (REQUIREMENT_PLAYER_HAS_COMPLETED_PROGRESSION_TREE_NODE), work when the subject or the owner is a city?
-- Vanilla never uses it that way; town-focus projects (ProjectModifiers) own their modifiers through the city.
--   CC_TEST_CITY_SUBJECT_EX: every city, condition on the city as the subject.
--   CC_TEST_CITY_OWNER_EX:   attached to every city (owner = the city), condition as the owner's requirement.
-- Both +0 Gold. Expected if it works: the cities of players in their Exploration, and no others.
INSERT OR IGNORE INTO Types (Type, Kind) VALUES
  ('CC_MODTYPE_CITIES_YIELD', 'KIND_MODIFIER'), ('CC_MODTYPE_CITIES_ATTACH', 'KIND_MODIFIER'), ('CC_MODTYPE_OWNER_CITY_YIELD', 'KIND_MODIFIER');
INSERT OR IGNORE INTO DynamicModifiers (ModifierType, CollectionType, EffectType) VALUES
  ('CC_MODTYPE_CITIES_YIELD', 'COLLECTION_ALL_CITIES', 'EFFECT_CITY_ADJUST_YIELD'),
  ('CC_MODTYPE_CITIES_ATTACH', 'COLLECTION_ALL_CITIES', 'EFFECT_ATTACH_MODIFIERS'),
  ('CC_MODTYPE_OWNER_CITY_YIELD', 'COLLECTION_OWNER', 'EFFECT_CITY_ADJUST_YIELD');
INSERT INTO Modifiers (ModifierId, ModifierType, SubjectRequirementSetId, OwnerRequirementSetId) VALUES
  ('CC_TEST_CITY_SUBJECT_EX', 'CC_MODTYPE_CITIES_YIELD', 'CC_REQSET_TEST_IN_EXPLORATION', NULL),
  ('CC_TEST_CITY_OWNER_EX_ATTACH', 'CC_MODTYPE_CITIES_ATTACH', NULL, NULL),
  ('CC_TEST_CITY_OWNER_EX', 'CC_MODTYPE_OWNER_CITY_YIELD', NULL, 'CC_REQSET_TEST_IN_EXPLORATION');
INSERT INTO ModifierArguments (ModifierId, Name, Value) VALUES
  ('CC_TEST_CITY_SUBJECT_EX', 'YieldType', 'YIELD_GOLD'), ('CC_TEST_CITY_SUBJECT_EX', 'Amount', '0'),
  ('CC_TEST_CITY_OWNER_EX_ATTACH', 'ModifierId', 'CC_TEST_CITY_OWNER_EX'),
  ('CC_TEST_CITY_OWNER_EX', 'YieldType', 'YIELD_GOLD'), ('CC_TEST_CITY_OWNER_EX', 'Amount', '0');
INSERT INTO GameModifiers (ModifierId) VALUES ('CC_TEST_CITY_SUBJECT_EX'), ('CC_TEST_CITY_OWNER_EX_ATTACH');
