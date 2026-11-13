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
