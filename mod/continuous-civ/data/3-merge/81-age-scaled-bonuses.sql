-- Continuous Civilization - bonuses that vanilla scales by Age, scaled by personal Age instead (audit #2).
-- About 400 modifier amounts use the argument type ScaleByGameAge (extra="100"): the amount is multiplied by the
-- game Age, x1 in Antiquity, x2 in Exploration, x3 in Modern. The game Age stays Antiquity here, so they stayed x1.
-- For the ones a player owns all game (leader abilities, mementos, attribute-tree nodes, traditions), add two
-- copies with the same amounts and attachments: one switched on in the player's personal Exploration (x2 in total)
-- and one in their personal Modern (x3). Narrative rewards are handled in 82-narrative-rewards.sql.
-- Left out: diplomacy action results and modifiers attached by other modifiers or by buildings, whose owner is not
-- the player (the personal-Age condition tests a player).

DROP TABLE IF EXISTS cc_age_scaled;
CREATE TABLE cc_age_scaled (ModifierId TEXT PRIMARY KEY);
INSERT OR IGNORE INTO cc_age_scaled
  SELECT DISTINCT a.ModifierId FROM ModifierArguments a
  WHERE a.Type = 'ScaleByGameAge'
    AND (a.ModifierId IN (SELECT ModifierId FROM TraitModifiers)
      OR a.ModifierId IN (SELECT ModifierId FROM MementoModifiers)
      OR a.ModifierId IN (SELECT ModifierId FROM TraditionModifiers)
      OR a.ModifierId IN (SELECT TargetType FROM ProgressionTreeNodeUnlocks WHERE TargetKind = 'KIND_MODIFIER'));

DROP TABLE IF EXISTS cc_age_scaled_copies;
CREATE TABLE cc_age_scaled_copies (ModifierId TEXT, CopyId TEXT PRIMARY KEY, AgeSet TEXT, OwnerSet TEXT);
INSERT INTO cc_age_scaled_copies (ModifierId, CopyId, AgeSet, OwnerSet)
  SELECT s.ModifierId, 'CC_SA_' || a.Tag || '_' || s.ModifierId, a.AgeSet,
         CASE WHEN m.OwnerRequirementSetId IS NULL THEN a.AgeSet ELSE 'CC_SA_' || a.Tag || '_' || s.ModifierId END
  FROM cc_age_scaled s JOIN Modifiers m ON m.ModifierId = s.ModifierId
  CROSS JOIN (SELECT 'EX' AS Tag, 'CC_REQSET_PERSONAL_AGE_EXPLORATION' AS AgeSet
              UNION ALL SELECT 'MO', 'CC_REQSET_PERSONAL_AGE_MODERN') a;

-- A copy whose original already has an owner condition gets "that condition AND the personal Age".
INSERT INTO RequirementSets (RequirementSetId, RequirementSetType)
  SELECT c.CopyId, 'REQUIREMENTSET_TEST_ALL' FROM cc_age_scaled_copies c WHERE c.OwnerSet = c.CopyId;
INSERT INTO Requirements (RequirementId, RequirementType)
  SELECT c.CopyId || '_ORIG', 'REQUIREMENT_REQUIREMENTSET_IS_MET' FROM cc_age_scaled_copies c WHERE c.OwnerSet = c.CopyId
  UNION ALL
  SELECT c.CopyId || '_AGE', 'REQUIREMENT_REQUIREMENTSET_IS_MET' FROM cc_age_scaled_copies c WHERE c.OwnerSet = c.CopyId;
INSERT INTO RequirementArguments (RequirementId, Name, Value)
  SELECT c.CopyId || '_ORIG', 'RequirementSetId', m.OwnerRequirementSetId
  FROM cc_age_scaled_copies c JOIN Modifiers m ON m.ModifierId = c.ModifierId WHERE c.OwnerSet = c.CopyId
  UNION ALL
  SELECT c.CopyId || '_AGE', 'RequirementSetId', c.AgeSet FROM cc_age_scaled_copies c WHERE c.OwnerSet = c.CopyId;
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId)
  SELECT c.CopyId, c.CopyId || '_ORIG' FROM cc_age_scaled_copies c WHERE c.OwnerSet = c.CopyId
  UNION ALL
  SELECT c.CopyId, c.CopyId || '_AGE' FROM cc_age_scaled_copies c WHERE c.OwnerSet = c.CopyId;

INSERT INTO Modifiers (ModifierId, ModifierType, RunOnce, NewOnly, Permanent, OwnerRequirementSetId,
                       SubjectRequirementSetId, OwnerStackLimit, SubjectStackLimit)
  SELECT c.CopyId, m.ModifierType, m.RunOnce, m.NewOnly, m.Permanent, c.OwnerSet,
         m.SubjectRequirementSetId, m.OwnerStackLimit, m.SubjectStackLimit
  FROM cc_age_scaled_copies c JOIN Modifiers m ON m.ModifierId = c.ModifierId;
INSERT INTO ModifierArguments (ModifierId, Name, Value, Type, Extra, SecondExtra)
  SELECT c.CopyId, a.Name, a.Value, a.Type, a.Extra, a.SecondExtra
  FROM cc_age_scaled_copies c JOIN ModifierArguments a ON a.ModifierId = c.ModifierId;

-- Same attachments as the original. Attribute-tree copies are hidden so the node's text isn't listed three times.
INSERT INTO TraitModifiers (TraitType, ModifierId)
  SELECT t.TraitType, c.CopyId FROM cc_age_scaled_copies c JOIN TraitModifiers t ON t.ModifierId = c.ModifierId;
INSERT INTO MementoModifiers (MementoType, ModifierId)
  SELECT t.MementoType, c.CopyId FROM cc_age_scaled_copies c JOIN MementoModifiers t ON t.ModifierId = c.ModifierId;
INSERT INTO TraditionModifiers (TraditionType, ModifierId)
  SELECT t.TraditionType, c.CopyId FROM cc_age_scaled_copies c JOIN TraditionModifiers t ON t.ModifierId = c.ModifierId;
INSERT INTO ProgressionTreeNodeUnlocks (ProgressionTreeNodeType, TargetKind, TargetType, UnlockDepth, RequiredTraitType, Hidden)
  SELECT u.ProgressionTreeNodeType, u.TargetKind, c.CopyId, u.UnlockDepth, u.RequiredTraitType, 1
  FROM cc_age_scaled_copies c JOIN ProgressionTreeNodeUnlocks u ON u.TargetKind = 'KIND_MODIFIER' AND u.TargetType = c.ModifierId;
