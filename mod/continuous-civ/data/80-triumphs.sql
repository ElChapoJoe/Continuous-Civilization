-- Continuous Civilization - Exploration and Modern Triumphs (legacy paths), by personal Age.
-- Since 1.5, legacy paths are Triumphs (the Legacies table, chosen per game as a "Triumph set"; the Classic set
-- recreates the original legacy path milestones). The engine only offers the current Age's Triumphs, so a game
-- that stays in Antiquity only ever had Antiquity's. The Exploration and Modern files are imported
-- (cc-import-exploration / cc-import-modern) and their Triumphs re-tagged to Antiquity, so all three Ages' appear
-- in the Triumphs screen. Each later-Age Triumph only counts once its owner is in that personal Age: the personal-Age
-- requirement (70-personal-age.sql) is added to its trigger. Rewards are vanilla's (e.g. John Maynard Keynes for a
-- Modern economic Triumph).

DROP TABLE IF EXISTS cc_triumph_ages;
CREATE TABLE cc_triumph_ages (LegacyType TEXT PRIMARY KEY, AgeRequirement TEXT NOT NULL);
INSERT INTO cc_triumph_ages (LegacyType, AgeRequirement)
  SELECT LegacyType, CASE Age WHEN 'AGE_EXPLORATION' THEN 'CC_REQ_IN_EXPLORATION' ELSE 'CC_REQ_IN_MODERN' END
  FROM Legacies WHERE Age IN ('AGE_EXPLORATION', 'AGE_MODERN');

-- Trigger sets that require everything get the personal-Age requirement added (a set can be shared, e.g. by a
-- Default and a Race Triumph, always of the same Age). Any other kind of set is wrapped instead: "the original set
-- AND the personal Age". Adding keeps the Triumphs screen's progress (e.g. 0/20 relics); a wrapper would show it as
-- a percentage-like 0/200.
DROP TABLE IF EXISTS cc_triumph_sets;
CREATE TABLE cc_triumph_sets (LegacyType TEXT, RequirementSetId TEXT, AgeRequirement TEXT, Wrap INTEGER);
INSERT INTO cc_triumph_sets (LegacyType, RequirementSetId, AgeRequirement, Wrap)
  SELECT m.LegacyType, m.RequirementSetID, a.AgeRequirement,
         CASE WHEN s.RequirementSetType = 'REQUIREMENTSET_TEST_ALL' THEN 0 ELSE 1 END
  FROM LegacyModifiers m
  JOIN cc_triumph_ages a ON a.LegacyType = m.LegacyType
  JOIN RequirementSets s ON s.RequirementSetId = m.RequirementSetID;

INSERT OR IGNORE INTO RequirementSetRequirements (RequirementSetId, RequirementId)
  SELECT RequirementSetId, AgeRequirement FROM cc_triumph_sets WHERE Wrap = 0;

INSERT INTO Requirements (RequirementId, RequirementType)
  SELECT 'CC_REQ_TRIUMPH_' || LegacyType, 'REQUIREMENT_REQUIREMENTSET_IS_MET' FROM cc_triumph_sets WHERE Wrap = 1;
INSERT INTO RequirementArguments (RequirementId, Name, Value)
  SELECT 'CC_REQ_TRIUMPH_' || LegacyType, 'RequirementSetId', RequirementSetId FROM cc_triumph_sets WHERE Wrap = 1;
INSERT INTO RequirementSets (RequirementSetId, RequirementSetType)
  SELECT 'CC_REQSET_TRIUMPH_' || LegacyType, 'REQUIREMENTSET_TEST_ALL' FROM cc_triumph_sets WHERE Wrap = 1;
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId)
  SELECT 'CC_REQSET_TRIUMPH_' || LegacyType, 'CC_REQ_TRIUMPH_' || LegacyType FROM cc_triumph_sets WHERE Wrap = 1
  UNION ALL
  SELECT 'CC_REQSET_TRIUMPH_' || LegacyType, AgeRequirement FROM cc_triumph_sets WHERE Wrap = 1;
UPDATE LegacyModifiers
  SET RequirementSetID = 'CC_REQSET_TRIUMPH_' || LegacyType
  WHERE LegacyType IN (SELECT LegacyType FROM cc_triumph_sets WHERE Wrap = 1);

-- Wonders Triumphs ("Wonders of the Renaissance World" / "of the Modern World": build 6 Exploration / Modern Age
-- wonders). Their requirement counts the current Age's wonders (REQUIREMENT_PLAYER_HAS_X_WONDERS, RequiresCurrentAge),
-- which here is every wonder: the game Age stays Antiquity and all wonders are tagged Antiquity. An empire with 6
-- wonders of any Age completed both on entering the personal Age (the Modern one is worth 36 Culture victory points).
-- Count the later Ages' wonders by tag instead: wonders unlocked by an Exploration or Modern tech or civic (DLC ones
-- included, 30-buildings.sql) get CC_WONDER_EXPLORATION or CC_WONDER_MODERN, and the requirement becomes "at least 6
-- constructibles with that tag". Unlike vanilla, a captured wonder also counts.
INSERT INTO Tags (Tag, Category) VALUES ('CC_WONDER_EXPLORATION', 'CONSTRUCTIBLE_TAG'), ('CC_WONDER_MODERN', 'CONSTRUCTIBLE_TAG');
INSERT OR IGNORE INTO TypeTags (Type, Tag)
  SELECT DISTINCT u.TargetType,
         CASE WHEN u.ProgressionTreeNodeType GLOB 'NODE_TECH_EX_*' OR u.ProgressionTreeNodeType GLOB 'NODE_CIVIC_EX_*'
              THEN 'CC_WONDER_EXPLORATION' ELSE 'CC_WONDER_MODERN' END
  FROM ProgressionTreeNodeUnlocks u JOIN Constructibles c ON c.ConstructibleType = u.TargetType
  WHERE c.ConstructibleClass = 'WONDER'
    AND (u.ProgressionTreeNodeType GLOB 'NODE_TECH_EX_*' OR u.ProgressionTreeNodeType GLOB 'NODE_CIVIC_EX_*'
      OR u.ProgressionTreeNodeType GLOB 'NODE_TECH_MO_*' OR u.ProgressionTreeNodeType GLOB 'NODE_CIVIC_MO_*');

DROP TABLE IF EXISTS cc_wonder_triumph_reqs;
CREATE TABLE cc_wonder_triumph_reqs (RequirementId TEXT PRIMARY KEY, Tag TEXT NOT NULL);
INSERT OR IGNORE INTO cc_wonder_triumph_reqs (RequirementId, Tag)
  SELECT q.RequirementId, CASE s.AgeRequirement WHEN 'CC_REQ_IN_EXPLORATION' THEN 'CC_WONDER_EXPLORATION' ELSE 'CC_WONDER_MODERN' END
  FROM cc_triumph_sets s
  JOIN RequirementSetRequirements r ON r.RequirementSetId = s.RequirementSetId
  JOIN Requirements q ON q.RequirementId = r.RequirementId AND q.RequirementType = 'REQUIREMENT_PLAYER_HAS_X_WONDERS'
  JOIN RequirementArguments a ON a.RequirementId = q.RequirementId AND a.Name = 'RequiresCurrentAge' AND lower(a.Value) = 'true';
UPDATE Requirements SET RequirementType = 'REQUIREMENT_PLAYER_HAS_AT_LEAST_NUM_BUILDINGS'
  WHERE RequirementId IN (SELECT RequirementId FROM cc_wonder_triumph_reqs);
UPDATE RequirementArguments SET Name = 'Amount'
  WHERE Name = 'Count' AND RequirementId IN (SELECT RequirementId FROM cc_wonder_triumph_reqs);
DELETE FROM RequirementArguments
  WHERE Name IN ('RequiresCurrentAge', 'OriginalConstructor') AND RequirementId IN (SELECT RequirementId FROM cc_wonder_triumph_reqs);
INSERT INTO RequirementArguments (RequirementId, Name, Value)
  SELECT RequirementId, 'BuildingTag', Tag FROM cc_wonder_triumph_reqs;

UPDATE Legacies SET Age = 'AGE_ANTIQUITY' WHERE LegacyType IN (SELECT LegacyType FROM cc_triumph_ages);

-- Crisis Triumphs need crises, which never happen here (10-age-clock.sql).
DELETE FROM GameModifiers WHERE ModifierId LIKE 'MOD_EX_%_CRISIS_%_ADD_TRIUMPH' OR ModifierId LIKE 'MOD_MO_%_CRISIS_%_ADD_TRIUMPH';
