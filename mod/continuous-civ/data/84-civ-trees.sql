-- Continuous Civilization - Exploration and Modern civilizations' own civic trees, by personal Age.
-- In vanilla a civilization's unique civic tree (Abbasid's, Prussia's, ...) loads with its Age, and a modifier on the
-- civ's ability reveals it (MOD_REVEAL_CIV_CULTURE_TREE_<CIV>, EFFECT_PLAYER_REVEAL_CULTURE_TREE in that Age's
-- civilizations-gameeffects.xml). The game Age is always Antiquity here, so those trees never loaded and a later-Age
-- civilization played from the start kept only Antiquity's Test of Time "Origins" civic all game.
-- The modinfo imports vanilla's tree files unchanged (base game and DLC civs). Here:
--   1) The trees are re-tagged to Antiquity: the engine only offers trees of the current Age (as the ideology trees
--      in 26 and the Theology branch in 25).
--   2) Each tree is revealed to its civilization once that civ is in the tree's personal Age (Exploration trees in
--      its Exploration, Modern trees in its Modern), with the same effect vanilla uses.
-- Antiquity's Test of Time tree (the Origins civics) stays, as in vanilla's Antiquity for these civs.

-- The Modern tree file uses a requirement that vanilla defines in civilizations-modern.xml (not imported): Russia's
-- REQSET_TUNDRA_TOWN needs "city center on Tundra". Defined here as vanilla does (the set itself is in base-standard).
INSERT OR IGNORE INTO Requirements (RequirementId, RequirementType)
  VALUES ('REQ_IS_MET_REQSET_CITY_CENTER_ON_TUNDRA', 'REQUIREMENT_REQUIREMENTSET_IS_MET');
INSERT OR IGNORE INTO RequirementArguments (RequirementId, Name, Value)
  VALUES ('REQ_IS_MET_REQSET_CITY_CENTER_ON_TUNDRA', 'RequirementSetId', 'REQSET_CITY_CENTER_ON_TUNDRA');

DROP TABLE IF EXISTS cc_civ_trees;
CREATE TABLE cc_civ_trees (TreeType TEXT PRIMARY KEY, TraitType TEXT, Age TEXT);
INSERT INTO cc_civ_trees (TreeType, TraitType, Age)
  SELECT t.ProgressionTreeType,
         'TRAIT_' || substr(t.ProgressionTreeType, length('TREE_CIVICS_EX_') + 1),
         CASE WHEN t.ProgressionTreeType LIKE 'TREE\_CIVICS\_EX\_%' ESCAPE '\' THEN 'EXPLORATION' ELSE 'MODERN' END
  FROM ProgressionTrees t
  WHERE t.SystemType = 'SYSTEM_CULTURE'
    AND (t.ProgressionTreeType LIKE 'TREE\_CIVICS\_EX\_%' ESCAPE '\' OR t.ProgressionTreeType LIKE 'TREE\_CIVICS\_MO\_%' ESCAPE '\')
    AND t.ProgressionTreeType NOT LIKE '%\_MAIN' ESCAPE '\'
    AND t.ProgressionTreeType NOT LIKE '%\_BRANCH\_%' ESCAPE '\'
    AND t.ProgressionTreeType NOT LIKE '%\_TEST\_OF\_TIME' ESCAPE '\';
-- Only trees whose civilization trait exists (a civ of an installed DLC, or the base game).
DELETE FROM cc_civ_trees WHERE TraitType NOT IN (SELECT TraitType FROM Traits);

-- 1) Offer them in this (Antiquity) game.
UPDATE ProgressionTrees SET AgeType = 'AGE_ANTIQUITY'
  WHERE ProgressionTreeType IN (SELECT TreeType FROM cc_civ_trees);

-- 2) Reveal each tree to its civ in the personal Age (70-personal-age.sql: CC_REQ_IN_EXPLORATION / CC_REQ_IN_MODERN).
INSERT OR IGNORE INTO Types (Type, Kind) VALUES ('CC_MODTYPE_PLAYER_REVEAL_CULTURE_TREE', 'KIND_MODIFIER');
INSERT OR IGNORE INTO DynamicModifiers (ModifierType, CollectionType, EffectType)
  VALUES ('CC_MODTYPE_PLAYER_REVEAL_CULTURE_TREE', 'COLLECTION_OWNER', 'EFFECT_PLAYER_REVEAL_CULTURE_TREE');
INSERT OR IGNORE INTO Types (Type, Kind) VALUES ('CC_MODTYPE_MAJORS_ATTACH', 'KIND_MODIFIER');
INSERT OR IGNORE INTO DynamicModifiers (ModifierType, CollectionType, EffectType)
  VALUES ('CC_MODTYPE_MAJORS_ATTACH', 'COLLECTION_MAJOR_PLAYERS', 'EFFECT_ATTACH_MODIFIERS');

INSERT INTO Requirements (RequirementId, RequirementType)
  SELECT 'CC_REQ_CIVTREE_TRAIT_' || TreeType, 'REQUIREMENT_PLAYER_HAS_CIVILIZATION_OR_LEADER_TRAIT' FROM cc_civ_trees;
INSERT INTO RequirementArguments (RequirementId, Name, Value)
  SELECT 'CC_REQ_CIVTREE_TRAIT_' || TreeType, 'TraitType', TraitType FROM cc_civ_trees;
INSERT INTO RequirementSets (RequirementSetId, RequirementSetType)
  SELECT 'CC_REQSET_CIVTREE_' || TreeType, 'REQUIREMENTSET_TEST_ALL' FROM cc_civ_trees;
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId)
  SELECT 'CC_REQSET_CIVTREE_' || TreeType, 'CC_REQ_CIVTREE_TRAIT_' || TreeType FROM cc_civ_trees;
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId)
  SELECT 'CC_REQSET_CIVTREE_' || TreeType, 'CC_REQ_IN_' || Age FROM cc_civ_trees;

INSERT INTO Modifiers (ModifierId, ModifierType)
  SELECT 'CC_REVEAL_' || TreeType, 'CC_MODTYPE_PLAYER_REVEAL_CULTURE_TREE' FROM cc_civ_trees;
INSERT INTO ModifierArguments (ModifierId, Name, Value)
  SELECT 'CC_REVEAL_' || TreeType, 'ProgressionTreeType', TreeType FROM cc_civ_trees;
INSERT INTO Modifiers (ModifierId, ModifierType, SubjectRequirementSetId)
  SELECT 'CC_REVEALRULE_' || TreeType, 'CC_MODTYPE_MAJORS_ATTACH', 'CC_REQSET_CIVTREE_' || TreeType FROM cc_civ_trees;
INSERT INTO ModifierArguments (ModifierId, Name, Value)
  SELECT 'CC_REVEALRULE_' || TreeType, 'ModifierId', 'CC_REVEAL_' || TreeType FROM cc_civ_trees;
INSERT INTO GameModifiers (ModifierId) SELECT 'CC_REVEALRULE_' || TreeType FROM cc_civ_trees;

DROP TABLE cc_civ_trees;
