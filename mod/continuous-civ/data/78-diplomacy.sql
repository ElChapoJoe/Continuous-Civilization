-- Continuous Civilization - Exploration and Modern diplomacy and espionage actions.
-- The imports add each Age's own actions; shared actions keep Antiquity's costs (00-snapshot / 50-restore).
-- In vanilla these actions are available for the whole of their Age. Here every one of them needs an unlock,
-- so a player only gets them through the Exploration or Modern tech, civic or city-state bonus that grants them.

DROP TABLE IF EXISTS cc_new_dip_actions;
CREATE TABLE cc_new_dip_actions (DiplomacyActionType TEXT PRIMARY KEY, UnlockNode TEXT);
INSERT INTO cc_new_dip_actions VALUES
  -- Exploration
  ('DIPLOMACY_ACTION_ESPIONAGE_OPEN_THE_GATES', NULL),           -- Castles
  ('DIPLOMACY_ACTION_ESPIONAGE_CONVERT_POPULATION', NULL),       -- Reformation
  ('DIPLOMACY_ACTION_ESPIONAGE_SABOTAGE_WORKERS', NULL),         -- Society
  ('DIPLOMACY_ACTION_ESPIONAGE_STEAL_RICHES', 'NODE_TECH_EX_CARTOGRAPHY'),
  ('DIPLOMACY_ACTION_ESTABLISH_TREASURE_FLEET', 'NODE_TECH_EX_CARTOGRAPHY'),
  ('DIPLOMACY_ACTION_DEMAND_TRIBUTE', NULL),                     -- city-state bonus
  -- Modern
  ('DIPLOMACY_ACTION_ESPIONAGE_SABOTAGE_SHIPPING', NULL),        -- Mass Production
  ('DIPLOMACY_ACTION_ESPIONAGE_FAKE_ARTIFACTS', NULL),           -- Globalism
  ('DIPLOMACY_ACTION_ESPIONAGE_INFILTRATE_ENEMY_POSITIONS', NULL), -- Nationalism
  ('DIPLOMACY_ACTION_ESPIONAGE_SABOTAGE_SPACE_PROGRAM', NULL),   -- Rocketry
  ('DIPLOMACY_ACTION_ESPIONAGE_IDEOLOGICAL_REVOLT', NULL);       -- city-state bonus

UPDATE DiplomacyActions SET RequiresUnlock = 1
  WHERE DiplomacyActionType IN (SELECT DiplomacyActionType FROM cc_new_dip_actions);

INSERT OR IGNORE INTO ProgressionTreeNodeUnlocks (ProgressionTreeNodeType, TargetKind, TargetType, UnlockDepth)
  SELECT n.UnlockNode, 'KIND_DIPLOMATIC_ACTION', n.DiplomacyActionType, 1 FROM cc_new_dip_actions n
  WHERE n.UnlockNode IS NOT NULL
    AND EXISTS (SELECT 1 FROM ProgressionTreeNodes p WHERE p.ProgressionTreeNodeType = n.UnlockNode)
    AND EXISTS (SELECT 1 FROM DiplomacyActions d WHERE d.DiplomacyActionType = n.DiplomacyActionType);

DROP TABLE cc_new_dip_actions;

-- Influence costs by personal Age. Vanilla's DiplomaticActionInfluenceCosts are set per Age, about 2x in Exploration
-- and 3x in Modern; here the shared actions keep Antiquity's (00-snapshot / 50-restore). Each player gets the step
-- through the per-action cost effect instead: a negative Percent raises the cost (-100 = double). Exploration adds
-- -100 and Modern another -100 (3x). The Exploration-only actions above already carry Exploration's costs, so they
-- only get Modern's step (-50 = 1.5x); Modern-only ones carry Modern's. Free and -1 ("not by Influence") costs skip.
INSERT OR IGNORE INTO Types (Type, Kind) VALUES ('CC_MODTYPE_PLAYER_DIP_COST', 'KIND_MODIFIER');
INSERT OR IGNORE INTO DynamicModifiers (ModifierType, CollectionType, EffectType)
  VALUES ('CC_MODTYPE_PLAYER_DIP_COST', 'COLLECTION_OWNER', 'EFFECT_DIPLOMACY_ADJUST_DIPLOMATIC_ACTION_TYPE_EFFICIENCY');
INSERT OR IGNORE INTO Types (Type, Kind) VALUES ('CC_MODTYPE_MAJORS_ATTACH', 'KIND_MODIFIER');
INSERT OR IGNORE INTO DynamicModifiers (ModifierType, CollectionType, EffectType)
  VALUES ('CC_MODTYPE_MAJORS_ATTACH', 'COLLECTION_MAJOR_PLAYERS', 'EFFECT_ATTACH_MODIFIERS');

DROP TABLE IF EXISTS cc_dip_cost_steps;
CREATE TABLE cc_dip_cost_steps (DiplomacyActionType TEXT, Age TEXT, Percent INTEGER);
INSERT INTO cc_dip_cost_steps
  SELECT c.DiplomacyActionType, a.Age, CASE WHEN c.DiplomacyActionType IN
      ('DIPLOMACY_ACTION_ESPIONAGE_OPEN_THE_GATES', 'DIPLOMACY_ACTION_ESPIONAGE_CONVERT_POPULATION',
       'DIPLOMACY_ACTION_ESPIONAGE_SABOTAGE_WORKERS', 'DIPLOMACY_ACTION_DEMAND_TRIBUTE') THEN -50 ELSE -100 END
  FROM DiplomaticActionInfluenceCosts c, (SELECT 'EX' AS Age UNION ALL SELECT 'MO') a
  WHERE MAX(IFNULL(c.InfCostNoRelationship, 0), IFNULL(c.InfCostHostile, 0), IFNULL(c.InfCostUnfriendly, 0),
            IFNULL(c.InfCostNeutral, 0), IFNULL(c.InfCostFriendly, 0), IFNULL(c.InfCostHelpful, 0)) > 0
    AND c.DiplomacyActionType NOT IN ('DIPLOMACY_ACTION_ESPIONAGE_SABOTAGE_SHIPPING', 'DIPLOMACY_ACTION_ESPIONAGE_FAKE_ARTIFACTS',
       'DIPLOMACY_ACTION_ESPIONAGE_INFILTRATE_ENEMY_POSITIONS', 'DIPLOMACY_ACTION_ESPIONAGE_SABOTAGE_SPACE_PROGRAM',
       'DIPLOMACY_ACTION_ESPIONAGE_IDEOLOGICAL_REVOLT');
DELETE FROM cc_dip_cost_steps WHERE Age = 'EX' AND Percent = -50;

INSERT INTO Modifiers (ModifierId, ModifierType)
  SELECT 'CC_DIPCOST_' || Age || '_' || DiplomacyActionType, 'CC_MODTYPE_PLAYER_DIP_COST' FROM cc_dip_cost_steps;
INSERT INTO ModifierArguments (ModifierId, Name, Value)
  SELECT 'CC_DIPCOST_' || Age || '_' || DiplomacyActionType, 'ActionType', DiplomacyActionType FROM cc_dip_cost_steps;
INSERT INTO ModifierArguments (ModifierId, Name, Value)
  SELECT 'CC_DIPCOST_' || Age || '_' || DiplomacyActionType, 'Percent', Percent FROM cc_dip_cost_steps;
-- Game-wide wrappers attach each step to every major player in that personal Age (70-personal-age.sql's test sets).
INSERT INTO Modifiers (ModifierId, ModifierType, SubjectRequirementSetId)
  SELECT 'CC_DIPCOSTRULE_' || Age || '_' || DiplomacyActionType, 'CC_MODTYPE_MAJORS_ATTACH',
    CASE Age WHEN 'EX' THEN 'CC_REQSET_TEST_IN_EXPLORATION' ELSE 'CC_REQSET_TEST_IN_MODERN' END FROM cc_dip_cost_steps;
INSERT INTO ModifierArguments (ModifierId, Name, Value)
  SELECT 'CC_DIPCOSTRULE_' || Age || '_' || DiplomacyActionType, 'ModifierId', 'CC_DIPCOST_' || Age || '_' || DiplomacyActionType
  FROM cc_dip_cost_steps;
INSERT INTO GameModifiers (ModifierId) SELECT 'CC_DIPCOSTRULE_' || Age || '_' || DiplomacyActionType FROM cc_dip_cost_steps;
DROP TABLE cc_dip_cost_steps;
