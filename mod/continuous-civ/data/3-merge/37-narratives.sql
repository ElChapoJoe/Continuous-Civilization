-- Continuous Civilization - Exploration narratives and discoveries (imported in cc-import-exploration:
-- narrative-stories, discovery-stories, tot-narrative-stories, narrative-display, narrative-sifting; their text
-- already loads in every Age).
-- The engine offers stories of the current Age only, so the 1,597 Exploration stories are re-tagged to
-- Antiquity and join Antiquity's pool. Their requirements still gate them (Exploration systems, buildings,
-- religion...); their "N Age transitions" conditions are rewritten to the personal Age by 70-personal-age.sql.
-- Reward sizes (audit #15). The engine reads NarrativeStory_Yield_Rewards / DiscoveryStory_Yield_Rewards for the
-- game Age, which stays Antiquity, and ScaleByGameAge amounts stay x1. Before the stories are re-tagged below, the
-- rewards of Exploration and Modern stories get their own Age's sizes back:
--   * each later-Age reward size is copied under a CC_EX_ / CC_MO_ name as an Antiquity row, and the stories'
--     yield rewards (MultiplierType) point to it;
--   * their ScaleByGameAge amounts are doubled (Exploration) or tripled (Modern), as vanilla does in that Age.
-- So a story is rewarded at the size of the Age it comes from. Modifiers shared by stories of different Ages keep
-- Antiquity's size.
DROP TABLE IF EXISTS cc_story_modifier_age;
CREATE TABLE cc_story_modifier_age (ModifierId TEXT PRIMARY KEY, Tag TEXT, Factor INTEGER);
INSERT INTO cc_story_modifier_age (ModifierId, Tag, Factor)
  SELECT r.ModifierID, CASE MIN(s.Age) WHEN 'AGE_EXPLORATION' THEN 'CC_EX_' ELSE 'CC_MO_' END,
         CASE MIN(s.Age) WHEN 'AGE_EXPLORATION' THEN 2 ELSE 3 END
  FROM NarrativeRewards r
  JOIN NarrativeStory_Rewards sr ON sr.NarrativeRewardType = r.NarrativeRewardType
  JOIN NarrativeStories s ON s.NarrativeStoryType = sr.NarrativeStoryType
  WHERE r.ModifierID IS NOT NULL
  GROUP BY r.ModifierID
  HAVING MIN(s.Age) = MAX(s.Age) AND MIN(s.Age) IN ('AGE_EXPLORATION', 'AGE_MODERN');

INSERT OR IGNORE INTO NarrativeStory_Yield_Rewards
       (Age, Type, DiplomacyYieldValue, MaintenanceYieldValue, ProgressionYieldValue)
  SELECT 'AGE_ANTIQUITY', CASE Age WHEN 'AGE_EXPLORATION' THEN 'CC_EX_' ELSE 'CC_MO_' END || Type,
         DiplomacyYieldValue, MaintenanceYieldValue, ProgressionYieldValue
  FROM NarrativeStory_Yield_Rewards WHERE Age IN ('AGE_EXPLORATION', 'AGE_MODERN');
INSERT OR IGNORE INTO DiscoveryStory_Yield_Rewards
       (Age, Type, DiplomacyYieldValue, FoodYieldValue, GoldYieldValue, HappinessYieldValue, ProductionYieldValue, ProgressionYieldValue)
  SELECT 'AGE_ANTIQUITY', CASE Age WHEN 'AGE_EXPLORATION' THEN 'CC_EX_' ELSE 'CC_MO_' END || Type,
         DiplomacyYieldValue, FoodYieldValue, GoldYieldValue, HappinessYieldValue, ProductionYieldValue, ProgressionYieldValue
  FROM DiscoveryStory_Yield_Rewards WHERE Age IN ('AGE_EXPLORATION', 'AGE_MODERN');

UPDATE ModifierArguments
  SET Value = (SELECT a.Tag FROM cc_story_modifier_age a WHERE a.ModifierId = ModifierArguments.ModifierId) || Value
  WHERE Name = 'MultiplierType'
    AND ModifierId IN (SELECT ModifierId FROM cc_story_modifier_age)
    AND (SELECT a.Tag FROM cc_story_modifier_age a WHERE a.ModifierId = ModifierArguments.ModifierId) || Value IN
        (SELECT Type FROM NarrativeStory_Yield_Rewards WHERE Age = 'AGE_ANTIQUITY'
         UNION SELECT Type FROM DiscoveryStory_Yield_Rewards WHERE Age = 'AGE_ANTIQUITY');
UPDATE ModifierArguments
  SET Value = CAST(CAST(Value AS INTEGER) * (SELECT a.Factor FROM cc_story_modifier_age a
                                             WHERE a.ModifierId = ModifierArguments.ModifierId) AS TEXT)
  WHERE Type = 'ScaleByGameAge'
    AND ModifierId IN (SELECT ModifierId FROM cc_story_modifier_age)
    AND Value GLOB '[0-9-]*' AND Value NOT GLOB '*[^0-9-]*';

UPDATE NarrativeStories SET Age = 'AGE_ANTIQUITY' WHERE Age IN ('AGE_EXPLORATION', 'AGE_MODERN');
