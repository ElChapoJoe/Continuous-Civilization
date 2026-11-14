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

UPDATE Legacies SET Age = 'AGE_ANTIQUITY' WHERE LegacyType IN (SELECT LegacyType FROM cc_triumph_ages);

-- Crisis Triumphs need crises, which never happen here (10-age-clock.sql).
DELETE FROM GameModifiers WHERE ModifierId LIKE 'MOD_EX_%_CRISIS_%_ADD_TRIUMPH' OR ModifierId LIKE 'MOD_MO_%_CRISIS_%_ADD_TRIUMPH';
