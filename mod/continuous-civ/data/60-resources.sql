-- Continuous Civilization - map resources.
-- Vanilla map generation only places resources valid for the current Age (Resource_ValidAges), and the game
-- never leaves Antiquity, so later-Age resources would never exist. This file:
--   1) makes every resource of the Ages listed in cc_resource_spawn_ages valid in Antiquity, so map
--      generation places them at game start;
--   2) raises the Antiquity "resource types per map" cap by the number of types added, so they are not cut;
--   3) keeps Exploration's effects for those resources only (Antiquity resources keep Antiquity effects).
-- 65-modern-resources.sql then adds Modern resources and makes both Exploration and Modern resources inactive
-- (and hidden in the UI) for each player until that player researches the tech mapped to each one.

-- Tunable: Ages whose resources spawn at map generation.
DROP TABLE IF EXISTS cc_resource_spawn_ages;
CREATE TABLE cc_resource_spawn_ages (AgeType TEXT PRIMARY KEY);
INSERT INTO cc_resource_spawn_ages VALUES ('AGE_EXPLORATION');

-- 1) Resources that become valid in Antiquity.
DROP TABLE IF EXISTS cc_new_resources;
CREATE TABLE cc_new_resources AS
  SELECT DISTINCT ResourceType FROM Resource_ValidAges
  WHERE AgeType IN (SELECT AgeType FROM cc_resource_spawn_ages)
    AND ResourceType NOT IN (SELECT ResourceType FROM Resource_ValidAges WHERE AgeType = 'AGE_ANTIQUITY');

INSERT INTO Resource_ValidAges (AgeType, ResourceType, AIModifierHint)
  SELECT 'AGE_ANTIQUITY', v.ResourceType, MIN(v.AIModifierHint) FROM Resource_ValidAges v
  WHERE v.ResourceType IN (SELECT ResourceType FROM cc_new_resources) GROUP BY v.ResourceType;

-- 2) Room for the extra types (vanilla Antiquity: 25 of ~35 valid types per map).
UPDATE Resource_Distribution
  SET MaxResourceTypes = MaxResourceTypes + (SELECT COUNT(*) FROM cc_new_resources)
  WHERE AgeType = 'AGE_ANTIQUITY';

-- 3) Effects. Modifiers added by the resource GameEffects import (see 05-pre-resource-import.sql) whose
--    ResourceType argument is one of the new resources get switched on; the rest of that import (Exploration's
--    versions of Antiquity resource effects) is deleted, since nothing would ever use it.
DROP TABLE IF EXISTS cc_res_mods;
CREATE TABLE cc_res_mods AS
  SELECT m.ModifierId, a.Value AS ResourceType FROM Modifiers m
  LEFT JOIN ModifierArguments a ON a.ModifierId = m.ModifierId AND a.Name = 'ResourceType'
  WHERE m.ModifierId NOT IN (SELECT ModifierId FROM cc_pre_res_mods)
    AND m.ModifierId NOT IN (SELECT ModifierId FROM cc_park_ids)    -- restored Antiquity versions
    AND m.ModifierId NOT LIKE 'CC\_%' ESCAPE '\';                   -- this mod's own (e.g. 35-governments.sql)

DROP TABLE IF EXISTS cc_drop_sets;
CREATE TABLE cc_drop_sets AS
  SELECT SubjectRequirementSetId AS RequirementSetId FROM Modifiers
    WHERE SubjectRequirementSetId IS NOT NULL AND ModifierId IN (SELECT ModifierId FROM cc_res_mods
      WHERE ResourceType IS NULL OR ResourceType NOT IN (SELECT ResourceType FROM cc_new_resources))
  UNION SELECT OwnerRequirementSetId FROM Modifiers
    WHERE OwnerRequirementSetId IS NOT NULL AND ModifierId IN (SELECT ModifierId FROM cc_res_mods
      WHERE ResourceType IS NULL OR ResourceType NOT IN (SELECT ResourceType FROM cc_new_resources));
DELETE FROM ModifierArguments WHERE ModifierId IN (SELECT ModifierId FROM cc_res_mods
  WHERE ResourceType IS NULL OR ResourceType NOT IN (SELECT ResourceType FROM cc_new_resources));
DELETE FROM Modifiers WHERE ModifierId IN (SELECT ModifierId FROM cc_res_mods
  WHERE ResourceType IS NULL OR ResourceType NOT IN (SELECT ResourceType FROM cc_new_resources));
-- Only sets nothing else still uses.
DELETE FROM cc_drop_sets WHERE RequirementSetId IN (
  SELECT SubjectRequirementSetId FROM Modifiers WHERE SubjectRequirementSetId IS NOT NULL
  UNION SELECT OwnerRequirementSetId FROM Modifiers WHERE OwnerRequirementSetId IS NOT NULL);
DROP TABLE IF EXISTS cc_drop_reqs;
CREATE TABLE cc_drop_reqs AS SELECT RequirementId FROM RequirementSetRequirements
  WHERE RequirementSetId IN (SELECT RequirementSetId FROM cc_drop_sets)
    AND RequirementId NOT IN (SELECT RequirementId FROM RequirementSetRequirements
                              WHERE RequirementSetId NOT IN (SELECT RequirementSetId FROM cc_drop_sets));
DELETE FROM RequirementArguments       WHERE RequirementId    IN (SELECT RequirementId FROM cc_drop_reqs);
DELETE FROM RequirementSetRequirements WHERE RequirementSetId IN (SELECT RequirementSetId FROM cc_drop_sets);
DELETE FROM Requirements               WHERE RequirementId    IN (SELECT RequirementId FROM cc_drop_reqs);
DELETE FROM RequirementSets            WHERE RequirementSetId IN (SELECT RequirementSetId FROM cc_drop_sets);
DELETE FROM cc_res_mods WHERE ResourceType IS NULL OR ResourceType NOT IN (SELECT ResourceType FROM cc_new_resources);

-- The remaining ones (cc_res_mods) are NOT switched on here: 65-modern-resources.sql turns them into
-- per-player copies that only attach once a player researches the resource's tech.
-- Yield tags used by the resource UI filters (YIELD_GOLD -> GOLD), only where the tag exists.
INSERT OR IGNORE INTO TypeTags (Type, Tag)
  SELECT DISTINCT r.ResourceType, substr(a.Value, 7) FROM cc_res_mods r
  JOIN ModifierArguments a ON a.ModifierId = r.ModifierId AND a.Name = 'YieldType'
  WHERE substr(a.Value, 7) IN (SELECT Tag FROM Tags);
