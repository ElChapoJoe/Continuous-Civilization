-- Continuous Civilization - runs BEFORE the Exploration import (LoadOrder 400), after 00-pre-park-ids.sql.
-- Exploration's resource GameEffects files re-define some Antiquity resource modifiers (same ModifierId).
-- Deleting the Antiquity rows would hand those resources Exploration's effects, so instead we copy each one
-- (with its arguments, strings and requirement sets) into cc_park_* tables and remove it. After the import,
-- 55-restore-parked-modifiers.sql deletes Exploration's version and puts the Antiquity one back.
-- GameModifiers rows are left in place: nothing cascades from Modifiers to GameModifiers.

DROP TABLE IF EXISTS cc_park_mod;
DROP TABLE IF EXISTS cc_park_args;
DROP TABLE IF EXISTS cc_park_strings;
DROP TABLE IF EXISTS cc_park_sets;
DROP TABLE IF EXISTS cc_park_setreqs;
DROP TABLE IF EXISTS cc_park_reqs;
DROP TABLE IF EXISTS cc_park_reqargs;

CREATE TABLE cc_park_mod     AS SELECT * FROM Modifiers         WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);
-- Rows that link the parked modifiers to traits, governments, traditions, abilities... cascade away with the
-- delete below (FK ON DELETE CASCADE) and are put back by 55. Found in Phase 3: without this, Antiquity civs
-- lost e.g. their +3 settlement cap (TRAIT_ANTIQUITY_CIV -> TRAIT_INITIAL_SETTLEMENT_CAP) and stayed at one city.
DROP TABLE IF EXISTS cc_parklink_EnterStageModifiers;
CREATE TABLE cc_parklink_EnterStageModifiers AS SELECT * FROM EnterStageModifiers WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);
DROP TABLE IF EXISTS cc_parklink_EnvoysInActionModifiers;
CREATE TABLE cc_parklink_EnvoysInActionModifiers AS SELECT * FROM EnvoysInActionModifiers WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);
DROP TABLE IF EXISTS cc_parklink_EnvoysInStageModifiers;
CREATE TABLE cc_parklink_EnvoysInStageModifiers AS SELECT * FROM EnvoysInStageModifiers WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);
DROP TABLE IF EXISTS cc_parklink_GovernmentModifiers;
CREATE TABLE cc_parklink_GovernmentModifiers AS SELECT * FROM GovernmentModifiers WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);
DROP TABLE IF EXISTS cc_parklink_MementoModifiers;
CREATE TABLE cc_parklink_MementoModifiers AS SELECT * FROM MementoModifiers WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);
DROP TABLE IF EXISTS cc_parklink_TraditionModifiers;
CREATE TABLE cc_parklink_TraditionModifiers AS SELECT * FROM TraditionModifiers WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);
DROP TABLE IF EXISTS cc_parklink_TraitModifiers;
CREATE TABLE cc_parklink_TraitModifiers AS SELECT * FROM TraitModifiers WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);
DROP TABLE IF EXISTS cc_parklink_UnitAbilityModifiers;
CREATE TABLE cc_parklink_UnitAbilityModifiers AS SELECT * FROM UnitAbilityModifiers WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);
DROP TABLE IF EXISTS cc_parklink_UnitPromotionModifiers;
CREATE TABLE cc_parklink_UnitPromotionModifiers AS SELECT * FROM UnitPromotionModifiers WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);
CREATE TABLE cc_park_args    AS SELECT * FROM ModifierArguments WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);
CREATE TABLE cc_park_strings AS SELECT * FROM ModifierStrings   WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);

-- Requirement sets used only by parked modifiers (a set shared with any other modifier stays where it is).
CREATE TABLE cc_park_sets AS SELECT * FROM RequirementSets WHERE RequirementSetId IN (
    SELECT SubjectRequirementSetId FROM cc_park_mod UNION SELECT OwnerRequirementSetId FROM cc_park_mod)
  AND RequirementSetId NOT IN (
    SELECT SubjectRequirementSetId FROM Modifiers WHERE SubjectRequirementSetId IS NOT NULL AND ModifierId NOT IN (SELECT ModifierId FROM cc_park_ids)
    UNION SELECT OwnerRequirementSetId FROM Modifiers WHERE OwnerRequirementSetId IS NOT NULL AND ModifierId NOT IN (SELECT ModifierId FROM cc_park_ids));
CREATE TABLE cc_park_setreqs AS SELECT * FROM RequirementSetRequirements WHERE RequirementSetId IN (SELECT RequirementSetId FROM cc_park_sets);
-- Requirements used only by parked sets.
CREATE TABLE cc_park_reqs AS SELECT * FROM Requirements WHERE RequirementId IN (SELECT RequirementId FROM cc_park_setreqs)
  AND RequirementId NOT IN (SELECT RequirementId FROM RequirementSetRequirements WHERE RequirementSetId NOT IN (SELECT RequirementSetId FROM cc_park_sets));
CREATE TABLE cc_park_reqargs AS SELECT * FROM RequirementArguments WHERE RequirementId IN (SELECT RequirementId FROM cc_park_reqs);

DELETE FROM ModifierArguments WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);
DELETE FROM ModifierStrings   WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);
DELETE FROM Modifiers         WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);
DELETE FROM RequirementArguments       WHERE RequirementId    IN (SELECT RequirementId FROM cc_park_reqs);
DELETE FROM RequirementSetRequirements WHERE RequirementSetId IN (SELECT RequirementSetId FROM cc_park_sets);
DELETE FROM Requirements               WHERE RequirementId    IN (SELECT RequirementId FROM cc_park_reqs);
DELETE FROM RequirementSets            WHERE RequirementSetId IN (SELECT RequirementSetId FROM cc_park_sets);
