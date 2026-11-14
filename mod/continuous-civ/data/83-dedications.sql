-- Continuous Civilization - Dedications: Major Triumph rewards, picked when entering the next personal Age.
-- In vanilla, a Major Triumph grants an unlock, and at the next Age transition the matching Dedication card is
-- offered in the advanced-start deck, where the player picks up to 3. There is no Age transition here, so the cards
-- (82-dedication-cards.sql, generated from the game's age-transition files) become a Dedications attribute tree:
--   * Entering the personal Exploration gives a human player 3 Dedication points, entering Modern 3 more.
--   * Each Dedication is a node (cost 1). Its effects only apply once the player has completed a Triumph that grants
--     that card's unlock and has reached the Age the card belongs to (Antiquity cards: Exploration; Exploration
--     cards: Modern). ui/cc-dedications.js only lets you buy the ones that qualify.
--   * AI players get no points (they would spend them blindly); each earned Dedication applies to them
--     automatically instead, when they reach that Age.
-- Crisis cards are left out (no crises here).

DELETE FROM cc_dedication_cards WHERE Unlock LIKE '%PLAGUE%' OR Unlock LIKE '%CRISIS%';
DELETE FROM cc_dedication_effects WHERE CardId NOT IN (SELECT CardId FROM cc_dedication_cards);

-- The Triumphs that grant each card's unlock (Default, Race and other sets share an unlock).
DROP TABLE IF EXISTS cc_dedication_triumphs;
CREATE TABLE cc_dedication_triumphs (CardId TEXT PRIMARY KEY, TriumphTypes TEXT);
INSERT INTO cc_dedication_triumphs (CardId, TriumphTypes)
  SELECT c.CardId, group_concat(lm.LegacyType, ',')
  FROM cc_dedication_cards c
  JOIN ModifierArguments a ON a.Name = 'Unlock' AND a.Value = c.Unlock
  JOIN LegacyModifiers lm ON lm.ModifierId = a.ModifierId
  GROUP BY c.CardId;
DELETE FROM cc_dedication_cards WHERE CardId NOT IN (SELECT CardId FROM cc_dedication_triumphs);
DELETE FROM cc_dedication_effects WHERE CardId NOT IN (SELECT CardId FROM cc_dedication_cards);

-- 1) The card modifiers (renamed CC_DM_*), their requirement sets and modifier types.
INSERT OR IGNORE INTO Types (Type, Kind)
  SELECT DISTINCT 'CC_DMT_' || CollectionType || '__' || EffectType, 'KIND_MODIFIER' FROM cc_ded_mods;
INSERT OR IGNORE INTO DynamicModifiers (ModifierType, CollectionType, EffectType)
  SELECT DISTINCT 'CC_DMT_' || CollectionType || '__' || EffectType, CollectionType, EffectType FROM cc_ded_mods;
INSERT INTO RequirementSets (RequirementSetId, RequirementSetType) SELECT RequirementSetId, RequirementSetType FROM cc_ded_reqsets;
INSERT INTO Requirements (RequirementId, RequirementType, Inverse) SELECT RequirementId, RequirementType, Inverse FROM cc_ded_reqs;
INSERT INTO RequirementArguments (RequirementId, Name, Value) SELECT RequirementId, Name, Value FROM cc_ded_reqargs;
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId) SELECT RequirementSetId, RequirementId FROM cc_ded_reqs;

-- Each card's condition: one of its Triumphs completed, and its Age reached.
INSERT INTO Requirements (RequirementId, RequirementType)
  SELECT 'CC_REQ_DED_TRIUMPH_' || CardId, 'REQUIREMENT_TRIUMPHS_COMPLETED' FROM cc_dedication_cards;
INSERT INTO RequirementArguments (RequirementId, Name, Value)
  SELECT 'CC_REQ_DED_TRIUMPH_' || t.CardId, 'TriumphTypes', t.TriumphTypes FROM cc_dedication_triumphs t
  UNION ALL SELECT 'CC_REQ_DED_TRIUMPH_' || CardId, 'MinCount', '1' FROM cc_dedication_cards;
INSERT INTO RequirementSets (RequirementSetId, RequirementSetType)
  SELECT 'CC_REQSET_DED_' || CardId, 'REQUIREMENTSET_TEST_ALL' FROM cc_dedication_cards;
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId)
  SELECT 'CC_REQSET_DED_' || CardId, 'CC_REQ_DED_TRIUMPH_' || CardId FROM cc_dedication_cards
  UNION ALL
  SELECT 'CC_REQSET_DED_' || CardId, CASE Age WHEN 'EX' THEN 'CC_REQ_IN_EXPLORATION' ELSE 'CC_REQ_IN_MODERN' END FROM cc_dedication_cards;

-- Human players: the card's own modifiers, owned by the player once the node is bought, gated by the condition
-- (plus the modifier's own owner requirements, if any). AI players: CC_DMAI_ copies attached to every major civ,
-- gated by the condition and "not human".
INSERT INTO Requirements (RequirementId, RequirementType) VALUES ('CC_REQ_DED_IS_HUMAN', 'REQUIREMENT_PLAYER_IS_HUMAN');
INSERT INTO Requirements (RequirementId, RequirementType, Inverse) VALUES ('CC_REQ_DED_IS_AI', 'REQUIREMENT_PLAYER_IS_HUMAN', 1);
INSERT INTO Requirements (RequirementId, RequirementType)
  SELECT 'CC_REQ_DED_COND_' || CardId, 'REQUIREMENT_REQUIREMENTSET_IS_MET' FROM cc_dedication_cards;
INSERT INTO RequirementArguments (RequirementId, Name, Value)
  SELECT 'CC_REQ_DED_COND_' || CardId, 'RequirementSetId', 'CC_REQSET_DED_' || CardId FROM cc_dedication_cards;

DROP TABLE IF EXISTS cc_ded_top;
CREATE TABLE cc_ded_top (CardId TEXT, ModifierId TEXT, AiId TEXT, OrigOwner TEXT);
INSERT INTO cc_ded_top (CardId, ModifierId, AiId, OrigOwner)
  SELECT e.CardId, e.ModifierId, 'CC_DMAI_' || e.CardId || '_' || substr(e.ModifierId, 7), m.OwnerRequirementSetId
  FROM cc_dedication_effects e JOIN cc_ded_mods m ON m.ModifierId = e.ModifierId;

INSERT INTO RequirementSets (RequirementSetId, RequirementSetType)
  SELECT 'CC_REQSET_DEDOWN_' || ModifierId, 'REQUIREMENTSET_TEST_ALL' FROM cc_ded_top
  UNION ALL SELECT 'CC_REQSET_DEDOWN_' || AiId, 'REQUIREMENTSET_TEST_ALL' FROM cc_ded_top;
INSERT INTO Requirements (RequirementId, RequirementType)
  SELECT 'CC_REQ_DEDORIG_' || ModifierId, 'REQUIREMENT_REQUIREMENTSET_IS_MET' FROM cc_ded_top WHERE OrigOwner IS NOT NULL;
INSERT INTO RequirementArguments (RequirementId, Name, Value)
  SELECT 'CC_REQ_DEDORIG_' || ModifierId, 'RequirementSetId', OrigOwner FROM cc_ded_top WHERE OrigOwner IS NOT NULL;
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId)
  SELECT 'CC_REQSET_DEDOWN_' || ModifierId, 'CC_REQ_DED_COND_' || CardId FROM cc_ded_top
  UNION ALL SELECT 'CC_REQSET_DEDOWN_' || ModifierId, 'CC_REQ_DED_IS_HUMAN' FROM cc_ded_top
  UNION ALL SELECT 'CC_REQSET_DEDOWN_' || ModifierId, 'CC_REQ_DEDORIG_' || ModifierId FROM cc_ded_top WHERE OrigOwner IS NOT NULL
  UNION ALL SELECT 'CC_REQSET_DEDOWN_' || AiId, 'CC_REQ_DED_COND_' || CardId FROM cc_ded_top
  UNION ALL SELECT 'CC_REQSET_DEDOWN_' || AiId, 'CC_REQ_DED_IS_AI' FROM cc_ded_top
  UNION ALL SELECT 'CC_REQSET_DEDOWN_' || AiId, 'CC_REQ_DEDORIG_' || ModifierId FROM cc_ded_top WHERE OrigOwner IS NOT NULL;

INSERT INTO Modifiers (ModifierId, ModifierType, RunOnce, NewOnly, Permanent, OwnerStackLimit, SubjectStackLimit,
                       SubjectRequirementSetId, OwnerRequirementSetId)
  SELECT m.ModifierId, 'CC_DMT_' || m.CollectionType || '__' || m.EffectType, m.RunOnce, m.NewOnly, m.Permanent,
         m.OwnerStackLimit, m.SubjectStackLimit, m.SubjectRequirementSetId,
         CASE WHEN t.ModifierId IS NOT NULL THEN 'CC_REQSET_DEDOWN_' || t.ModifierId ELSE m.OwnerRequirementSetId END
  FROM cc_ded_mods m LEFT JOIN cc_ded_top t ON t.ModifierId = m.ModifierId;
INSERT INTO Modifiers (ModifierId, ModifierType, RunOnce, NewOnly, Permanent, OwnerStackLimit, SubjectStackLimit,
                       SubjectRequirementSetId, OwnerRequirementSetId)
  SELECT t.AiId, 'CC_DMT_' || m.CollectionType || '__' || m.EffectType, m.RunOnce, m.NewOnly, m.Permanent,
         m.OwnerStackLimit, m.SubjectStackLimit, m.SubjectRequirementSetId, 'CC_REQSET_DEDOWN_' || t.AiId
  FROM cc_ded_top t JOIN cc_ded_mods m ON m.ModifierId = t.ModifierId;
INSERT INTO ModifierArguments (ModifierId, Name, Value, Type, Extra)
  SELECT ModifierId, Name, Value, Type, Extra FROM cc_ded_args
  UNION ALL
  SELECT t.AiId, a.Name, a.Value, a.Type, a.Extra FROM cc_ded_top t JOIN cc_ded_args a ON a.ModifierId = t.ModifierId;
INSERT INTO ModifierStrings (ModifierId, Context, Text) SELECT ModifierId, Context, Text FROM cc_ded_strings;
INSERT INTO TraitModifiers (TraitType, ModifierId) SELECT 'TRAIT_LEADER_MAJOR_CIV', AiId FROM cc_ded_top;

-- 2) The Dedications attribute tree: one node per card, unlocking the card's modifiers.
INSERT INTO Types (Type, Kind) VALUES
  ('ATTRIBUTE_CC_DEDICATION', 'KIND_ATTRIBUTE'), ('TREE_ATTRIBUTE_CC_DEDICATION', 'KIND_TREE');
INSERT INTO ProgressionTrees (ProgressionTreeType, Name, PrereqFormat, SystemType, CostProgressionModel, CostProgressionParam1)
  VALUES ('TREE_ATTRIBUTE_CC_DEDICATION', 'LOC_CC_ATTRIBUTE_DEDICATION', 'AND', 'SYSTEM_ATTRIBUTES', 'NO_COST_PROGRESSION', 0);
INSERT INTO Attributes (AttributeType, Name, Description, ProgressionTreeType)
  VALUES ('ATTRIBUTE_CC_DEDICATION', 'LOC_CC_ATTRIBUTE_DEDICATION', 'LOC_CC_ATTRIBUTE_DEDICATION_DESCRIPTION', 'TREE_ATTRIBUTE_CC_DEDICATION');
-- Listed Antiquity Triumphs' Dedications first, then Exploration's (the screen shows them in one scrolling row).
INSERT INTO Types (Type, Kind) SELECT 'CC_DED_' || CardId, 'KIND_TREE_NODE' FROM cc_dedication_cards;
INSERT INTO ProgressionTreeNodes (ProgressionTreeNodeType, ProgressionTree, Name, Description, Cost)
  SELECT 'CC_DED_' || CardId, 'TREE_ATTRIBUTE_CC_DEDICATION', Name, Description, 1 FROM cc_dedication_cards ORDER BY Age, rowid;
INSERT INTO ProgressionTreeNodeUnlocks (ProgressionTreeNodeType, TargetKind, TargetType, UnlockDepth)
  SELECT 'CC_DED_' || CardId, 'KIND_MODIFIER', ModifierId, 1 FROM cc_ded_top;
-- The tree card lists its modifiers' descriptions: the card's own text goes on its first modifier, once.
DELETE FROM ModifierStrings WHERE Context = 'Description' AND ModifierId IN (SELECT ModifierId FROM cc_ded_top);
INSERT INTO ModifierStrings (ModifierId, Context, Text)
  SELECT MIN(t.ModifierId), 'Description', c.Description
  FROM cc_ded_top t JOIN cc_dedication_cards c ON c.CardId = t.CardId GROUP BY c.CardId;

-- 3) Dedication points for human players: 3 on entering the personal Exploration, 3 on entering Modern.
INSERT INTO RequirementSets (RequirementSetId, RequirementSetType) VALUES
  ('CC_REQSET_DEDPOINTS_EX', 'REQUIREMENTSET_TEST_ALL'), ('CC_REQSET_DEDPOINTS_MO', 'REQUIREMENTSET_TEST_ALL');
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId) VALUES
  ('CC_REQSET_DEDPOINTS_EX', 'CC_REQ_IN_EXPLORATION'), ('CC_REQSET_DEDPOINTS_EX', 'CC_REQ_DED_IS_HUMAN'),
  ('CC_REQSET_DEDPOINTS_MO', 'CC_REQ_IN_MODERN'), ('CC_REQSET_DEDPOINTS_MO', 'CC_REQ_DED_IS_HUMAN');
INSERT INTO Modifiers (ModifierId, ModifierType, OwnerRequirementSetId, Permanent) VALUES
  ('CC_DEDPOINTS_EX', 'CC_MODTYPE_OWNER_ATTRIBUTE', 'CC_REQSET_DEDPOINTS_EX', 1),
  ('CC_DEDPOINTS_MO', 'CC_MODTYPE_OWNER_ATTRIBUTE', 'CC_REQSET_DEDPOINTS_MO', 1);
INSERT INTO ModifierArguments (ModifierId, Name, Value) VALUES
  ('CC_DEDPOINTS_EX', 'AttributeType', 'ATTRIBUTE_CC_DEDICATION'), ('CC_DEDPOINTS_EX', 'Amount', '3'),
  ('CC_DEDPOINTS_MO', 'AttributeType', 'ATTRIBUTE_CC_DEDICATION'), ('CC_DEDPOINTS_MO', 'Amount', '3');
INSERT INTO TraitModifiers (TraitType, ModifierId) VALUES
  ('TRAIT_LEADER_MAJOR_CIV', 'CC_DEDPOINTS_EX'), ('TRAIT_LEADER_MAJOR_CIV', 'CC_DEDPOINTS_MO');
