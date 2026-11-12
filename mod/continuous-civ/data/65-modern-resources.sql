-- Continuous Civilization - later-Age resources: on the map from turn 1, inactive until researched.
-- Civ VII cannot add resources to the map mid-game outside an Age transition, and has no "hidden until tech"
-- resources. So Exploration resources (made valid by 60-resources.sql) and Modern resources (made valid here)
-- are placed at map generation like everything else, but do nothing for a player until that player completes
-- the tech mapped to each one:
--   * the resource's base tile yields (Resource_YieldChanges) and its Age effects (Exploration: imported and
--     kept by 60-resources.sql in cc_res_mods; Modern: staged by the generated 64-modern-resource-data.sql)
--     become per-player modifiers;
--   * each is attached by a game-wide wrapper (COLLECTION_MAJOR_PLAYERS + EFFECT_ATTACH_MODIFIERS) only to
--     players who have the tech (REQUIREMENT_PLAYER_HAS_COMPLETED_PROGRESSION_TREE_NODE).
-- Engine-driven, per player (AI included), multiplayer-safe, survives save/load.
-- The UI script ui/cc-hide-resources.js hides their icons from a player until they have the tech.
-- Phase 3 will remap these to Modern techs.

-- Tunable: resource -> tech that activates it. Keep text/65-modern-resources-text.sql in step.
DROP TABLE IF EXISTS cc_resource_unlocks;
CREATE TABLE cc_resource_unlocks (ResourceType TEXT PRIMARY KEY, ProgressionTreeNodeType TEXT NOT NULL);
INSERT INTO cc_resource_unlocks VALUES
  -- Exploration
  ('RESOURCE_WHALES',   'NODE_TECH_EX_CARTOGRAPHY'),
  ('RESOURCE_PITCH',    'NODE_TECH_EX_CARTOGRAPHY'),
  ('RESOURCE_SPICES',   'NODE_TECH_EX_CARTOGRAPHY'),
  ('RESOURCE_CLOVES',   'NODE_TECH_EX_CARTOGRAPHY'),
  ('RESOURCE_SUGAR',    'NODE_TECH_EX_GUILDS'),
  ('RESOURCE_TEA',      'NODE_TECH_EX_GUILDS'),
  ('RESOURCE_COCOA',    'NODE_TECH_EX_GUILDS'),
  ('RESOURCE_FURS',     'NODE_TECH_EX_GUILDS'),
  ('RESOURCE_TRUFFLES', 'NODE_TECH_EX_GUILDS'),
  ('RESOURCE_NITER',    'NODE_TECH_EX_MACHINERY'),
  -- Modern (Phase 3.4: real Modern techs; before, Exploration stand-ins)
  ('RESOURCE_COFFEE',  'NODE_TECH_MO_URBANIZATION'),
  ('RESOURCE_TOBACCO', 'NODE_TECH_MO_URBANIZATION'),
  ('RESOURCE_CITRUS',  'NODE_TECH_MO_URBANIZATION'),
  ('RESOURCE_QUININE', 'NODE_TECH_MO_ACADEMICS'),
  ('RESOURCE_COAL',    'NODE_TECH_MO_STEAM_ENGINE'),
  ('RESOURCE_NICKEL',  'NODE_TECH_MO_INDUSTRIALIZATION'),
  ('RESOURCE_OIL',     'NODE_TECH_MO_COMBUSTION'),
  ('RESOURCE_RUBBER',  'NODE_TECH_MO_INDUSTRIALIZATION');
-- Skip rows whose resource or tech does not exist (e.g. after a patch).
DELETE FROM cc_resource_unlocks
  WHERE ResourceType NOT IN (SELECT ResourceType FROM Resources)
     OR ProgressionTreeNodeType NOT IN (SELECT ProgressionTreeNodeType FROM ProgressionTreeNodes);

-- 1) Map generation: valid in Antiquity, with room in the per-map type cap so they don't push others out.
DROP TABLE IF EXISTS cc_modern_new;
CREATE TABLE cc_modern_new AS SELECT ResourceType FROM cc_resource_unlocks
  WHERE ResourceType NOT IN (SELECT ResourceType FROM Resource_ValidAges WHERE AgeType = 'AGE_ANTIQUITY');
INSERT INTO Resource_ValidAges (AgeType, ResourceType) SELECT 'AGE_ANTIQUITY', ResourceType FROM cc_modern_new;
UPDATE Resource_Distribution
  SET MaxResourceTypes = MaxResourceTypes + (SELECT COUNT(*) FROM cc_modern_new)
  WHERE AgeType = 'AGE_ANTIQUITY';

-- 2) "Player has completed <tech>", one requirement set per tech.
INSERT OR IGNORE INTO Requirements (RequirementId, RequirementType)
  SELECT DISTINCT 'CC_REQ_HAS_' || ProgressionTreeNodeType, 'REQUIREMENT_PLAYER_HAS_COMPLETED_PROGRESSION_TREE_NODE'
  FROM cc_resource_unlocks;
INSERT OR IGNORE INTO RequirementArguments (RequirementId, Name, Value)
  SELECT DISTINCT 'CC_REQ_HAS_' || ProgressionTreeNodeType, 'ProgressionTreeNodeType', ProgressionTreeNodeType
  FROM cc_resource_unlocks;
INSERT OR IGNORE INTO RequirementSets (RequirementSetId, RequirementSetType)
  SELECT DISTINCT 'CC_REQSET_HAS_' || ProgressionTreeNodeType, 'REQUIREMENTSET_TEST_ALL' FROM cc_resource_unlocks;
INSERT OR IGNORE INTO RequirementSetRequirements (RequirementSetId, RequirementId)
  SELECT DISTINCT 'CC_REQSET_HAS_' || ProgressionTreeNodeType, 'CC_REQ_HAS_' || ProgressionTreeNodeType
  FROM cc_resource_unlocks;

-- Every gated modifier: (inner modifier, resource). The wrapper CC_GATE_<inner> is built from this at the end.
DROP TABLE IF EXISTS cc_gated;
CREATE TABLE cc_gated (ModifierId TEXT PRIMARY KEY, ResourceType TEXT NOT NULL);

-- 3) Base tile yields -> per-player plot yield on tiles with that resource.
INSERT OR IGNORE INTO Types (Type, Kind) VALUES ('CC_MODTYPE_PLAYER_PLOT_YIELD', 'KIND_MODIFIER');
INSERT OR IGNORE INTO DynamicModifiers (ModifierType, CollectionType, EffectType)
  VALUES ('CC_MODTYPE_PLAYER_PLOT_YIELD', 'COLLECTION_PLAYER_PLOT_YIELDS', 'EFFECT_PLOT_ADJUST_YIELD');
INSERT INTO Requirements (RequirementId, RequirementType)
  SELECT 'CC_REQ_PLOT_' || ResourceType, 'REQUIREMENT_PLOT_RESOURCE_TYPE_MATCHES' FROM cc_resource_unlocks;
INSERT INTO RequirementArguments (RequirementId, Name, Value)
  SELECT 'CC_REQ_PLOT_' || ResourceType, 'ResourceType', ResourceType FROM cc_resource_unlocks;
INSERT INTO RequirementSets (RequirementSetId, RequirementSetType)
  SELECT 'CC_REQSET_PLOT_' || ResourceType, 'REQUIREMENTSET_TEST_ALL' FROM cc_resource_unlocks;
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId)
  SELECT 'CC_REQSET_PLOT_' || ResourceType, 'CC_REQ_PLOT_' || ResourceType FROM cc_resource_unlocks;
INSERT INTO Modifiers (ModifierId, ModifierType, SubjectRequirementSetId)
  SELECT 'CC_YIELD_' || y.ResourceType || '_' || y.YieldType, 'CC_MODTYPE_PLAYER_PLOT_YIELD', 'CC_REQSET_PLOT_' || y.ResourceType
  FROM Resource_YieldChanges y JOIN cc_resource_unlocks u ON u.ResourceType = y.ResourceType;
INSERT INTO ModifierArguments (ModifierId, Name, Value)
  SELECT 'CC_YIELD_' || y.ResourceType || '_' || y.YieldType, 'YieldType', y.YieldType
  FROM Resource_YieldChanges y JOIN cc_resource_unlocks u ON u.ResourceType = y.ResourceType;
INSERT INTO ModifierArguments (ModifierId, Name, Value)
  SELECT 'CC_YIELD_' || y.ResourceType || '_' || y.YieldType, 'Amount', y.YieldChange
  FROM Resource_YieldChanges y JOIN cc_resource_unlocks u ON u.ResourceType = y.ResourceType;
INSERT INTO cc_gated (ModifierId, ResourceType)
  SELECT 'CC_YIELD_' || y.ResourceType || '_' || y.YieldType, y.ResourceType
  FROM Resource_YieldChanges y JOIN cc_resource_unlocks u ON u.ResourceType = y.ResourceType;
-- Yield filter tags used by the resource UI (YIELD_PRODUCTION -> PRODUCTION), only where the tag exists.
INSERT OR IGNORE INTO TypeTags (Type, Tag)
  SELECT y.ResourceType, substr(y.YieldType, 7) FROM Resource_YieldChanges y
  JOIN cc_resource_unlocks u ON u.ResourceType = y.ResourceType WHERE substr(y.YieldType, 7) IN (SELECT Tag FROM Tags);
DELETE FROM Resource_YieldChanges WHERE ResourceType IN (SELECT ResourceType FROM cc_resource_unlocks);

-- 4) Age resource effects -> per-player copies (CC_<id>).
--    The generated Modern staging also holds Modern's versions of earlier resources' effects: keep only
--    Modern-only resources from it, so Exploration resources get their Exploration effects only.
DELETE FROM cc_mres_args    WHERE ModifierId IN (SELECT ModifierId FROM cc_mres_mods WHERE ResourceType NOT IN (SELECT ResourceType FROM cc_modern_new));
DELETE FROM cc_mres_reqs    WHERE ModifierId IN (SELECT ModifierId FROM cc_mres_mods WHERE ResourceType NOT IN (SELECT ResourceType FROM cc_modern_new));
DELETE FROM cc_mres_reqargs WHERE ModifierId IN (SELECT ModifierId FROM cc_mres_mods WHERE ResourceType NOT IN (SELECT ResourceType FROM cc_modern_new));
DELETE FROM cc_mres_mods    WHERE ResourceType NOT IN (SELECT ResourceType FROM cc_modern_new);
--    Exploration's come from the live import (cc_res_mods, 60-resources.sql); add them to the staging tables.
INSERT INTO cc_mres_mods (ModifierId, ResourceType, CollectionType, EffectType, Permanent, RunOnce)
  SELECT m.ModifierId, r.ResourceType, d.CollectionType, d.EffectType, m.Permanent, m.RunOnce
  FROM cc_res_mods r JOIN Modifiers m ON m.ModifierId = r.ModifierId
  JOIN DynamicModifiers d ON d.ModifierType = m.ModifierType
  WHERE r.ResourceType IN (SELECT ResourceType FROM cc_resource_unlocks)
    AND m.OwnerRequirementSetId IS NULL
    AND m.ModifierId NOT IN (SELECT ModifierId FROM cc_mres_mods);
DROP TABLE IF EXISTS cc_ex_live;
CREATE TABLE cc_ex_live AS SELECT ModifierId FROM cc_mres_mods WHERE ModifierId IN (SELECT ModifierId FROM cc_res_mods);
INSERT INTO cc_mres_args (ModifierId, Name, Value)
  SELECT a.ModifierId, a.Name, a.Value FROM ModifierArguments a WHERE a.ModifierId IN (SELECT ModifierId FROM cc_ex_live);
INSERT INTO cc_mres_reqs (ModifierId, Seq, RequirementType, Inverse)
  SELECT m.ModifierId, q.RequirementId, q.RequirementType, q.Inverse FROM Modifiers m
  JOIN RequirementSetRequirements s ON s.RequirementSetId = m.SubjectRequirementSetId
  JOIN Requirements q ON q.RequirementId = s.RequirementId
  WHERE m.ModifierId IN (SELECT ModifierId FROM cc_ex_live);
INSERT INTO cc_mres_reqargs (ModifierId, Seq, Name, Value)
  SELECT m.ModifierId, q.RequirementId, q.Name, q.Value FROM Modifiers m
  JOIN RequirementSetRequirements s ON s.RequirementSetId = m.SubjectRequirementSetId
  JOIN RequirementArguments q ON q.RequirementId = s.RequirementId
  WHERE m.ModifierId IN (SELECT ModifierId FROM cc_ex_live);
-- Modern-Age and Exploration resource effects -> per-player copies (CC_<id>). The originals are game-wide modifiers on
--    every city/unit; attached per player they must only reach that player's own cities/units.
DROP TABLE IF EXISTS cc_mres;
CREATE TABLE cc_mres AS
  SELECT m.ModifierId AS Src, 'CC_' || m.ModifierId AS ModifierId, m.ResourceType, m.EffectType, m.Permanent, m.RunOnce,
         CASE m.CollectionType WHEN 'COLLECTION_ALL_CITIES' THEN 'COLLECTION_PLAYER_CITIES'
                               WHEN 'COLLECTION_ALL_UNITS'  THEN 'COLLECTION_PLAYER_UNITS'
                               WHEN 'COLLECTION_ALL_PLAYERS' THEN 'COLLECTION_OWNER'
                               WHEN 'COLLECTION_ALL_CAPITAL_CITIES' THEN 'COLLECTION_PLAYER_CAPITAL_CITY'
                               ELSE m.CollectionType END AS CollectionType
  FROM cc_mres_mods m WHERE m.ResourceType IN (SELECT ResourceType FROM cc_resource_unlocks)
    AND m.EffectType IN (SELECT Type FROM Types WHERE Kind = 'KIND_EFFECT');
-- Collections that would still reach other players are not safe to attach per player: skip them.
DELETE FROM cc_mres WHERE CollectionType LIKE 'COLLECTION_ALL_%';

INSERT OR IGNORE INTO Types (Type, Kind)
  SELECT DISTINCT 'CC_MT_' || CollectionType || '_' || EffectType, 'KIND_MODIFIER' FROM cc_mres;
INSERT OR IGNORE INTO DynamicModifiers (ModifierType, CollectionType, EffectType)
  SELECT DISTINCT 'CC_MT_' || CollectionType || '_' || EffectType, CollectionType, EffectType FROM cc_mres;

INSERT INTO Requirements (RequirementId, RequirementType, Inverse)
  SELECT r.ModifierId || '_R' || r.Seq, r.RequirementType, r.Inverse FROM (
    SELECT c.ModifierId, q.Seq, q.RequirementType, q.Inverse FROM cc_mres_reqs q JOIN cc_mres c ON c.Src = q.ModifierId) r;
INSERT INTO RequirementArguments (RequirementId, Name, Value)
  SELECT c.ModifierId || '_R' || a.Seq, a.Name, a.Value FROM cc_mres_reqargs a JOIN cc_mres c ON c.Src = a.ModifierId;
INSERT INTO RequirementSets (RequirementSetId, RequirementSetType)
  SELECT DISTINCT c.ModifierId || '_SUBJECT', 'REQUIREMENTSET_TEST_ALL' FROM cc_mres c
  WHERE c.Src IN (SELECT ModifierId FROM cc_mres_reqs);
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId)
  SELECT c.ModifierId || '_SUBJECT', c.ModifierId || '_R' || q.Seq FROM cc_mres_reqs q JOIN cc_mres c ON c.Src = q.ModifierId;

INSERT INTO Modifiers (ModifierId, ModifierType, Permanent, RunOnce, SubjectRequirementSetId)
  SELECT c.ModifierId, 'CC_MT_' || c.CollectionType || '_' || c.EffectType, c.Permanent, c.RunOnce,
         CASE WHEN c.Src IN (SELECT ModifierId FROM cc_mres_reqs) THEN c.ModifierId || '_SUBJECT' END
  FROM cc_mres c;
INSERT INTO ModifierArguments (ModifierId, Name, Value)
  SELECT c.ModifierId, a.Name, a.Value FROM cc_mres_args a JOIN cc_mres c ON c.Src = a.ModifierId;
-- Resource panel / tooltip link from modifier to resource.
INSERT OR IGNORE INTO ModifierMetadatas (FieldName, ModifierID, String)
  SELECT 'ResourceType', ModifierId, ResourceType FROM cc_mres;
INSERT INTO cc_gated (ModifierId, ResourceType) SELECT ModifierId, ResourceType FROM cc_mres;

-- 5) Wrappers: game-wide, attach each gated modifier to every major player who has the resource's tech.
INSERT OR IGNORE INTO Types (Type, Kind) VALUES ('CC_MODTYPE_MAJORS_ATTACH', 'KIND_MODIFIER');
INSERT OR IGNORE INTO DynamicModifiers (ModifierType, CollectionType, EffectType)
  VALUES ('CC_MODTYPE_MAJORS_ATTACH', 'COLLECTION_MAJOR_PLAYERS', 'EFFECT_ATTACH_MODIFIERS');
INSERT INTO Modifiers (ModifierId, ModifierType, SubjectRequirementSetId)
  SELECT 'CC_GATE_' || g.ModifierId, 'CC_MODTYPE_MAJORS_ATTACH', 'CC_REQSET_HAS_' || u.ProgressionTreeNodeType
  FROM cc_gated g JOIN cc_resource_unlocks u ON u.ResourceType = g.ResourceType;
INSERT INTO ModifierArguments (ModifierId, Name, Value)
  SELECT 'CC_GATE_' || ModifierId, 'ModifierId', ModifierId FROM cc_gated;
INSERT INTO GameModifiers (ModifierId) SELECT 'CC_GATE_' || ModifierId FROM cc_gated;
-- (MinDepth for all CC_ tech/civic requirements is added in 70-personal-age.sql, which runs last.)
