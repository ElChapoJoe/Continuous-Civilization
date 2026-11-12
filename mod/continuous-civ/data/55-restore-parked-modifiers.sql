-- Continuous Civilization - put back the Antiquity modifiers parked by 01-park-modifiers.sql.
-- First remove Exploration's same-id versions together with the requirement sets only they use.
-- Their link rows (traits, governments, traditions... that the imports attached to these ids) cascade away with
-- the delete, so they are snapshotted first and put back at the end, with Antiquity's (snapshotted in 01).
DROP TABLE IF EXISTS cc_parklink2_EnterStageModifiers;
CREATE TABLE cc_parklink2_EnterStageModifiers AS SELECT * FROM EnterStageModifiers WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);
DROP TABLE IF EXISTS cc_parklink2_EnvoysInActionModifiers;
CREATE TABLE cc_parklink2_EnvoysInActionModifiers AS SELECT * FROM EnvoysInActionModifiers WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);
DROP TABLE IF EXISTS cc_parklink2_EnvoysInStageModifiers;
CREATE TABLE cc_parklink2_EnvoysInStageModifiers AS SELECT * FROM EnvoysInStageModifiers WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);
DROP TABLE IF EXISTS cc_parklink2_GovernmentModifiers;
CREATE TABLE cc_parklink2_GovernmentModifiers AS SELECT * FROM GovernmentModifiers WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);
DROP TABLE IF EXISTS cc_parklink2_MementoModifiers;
CREATE TABLE cc_parklink2_MementoModifiers AS SELECT * FROM MementoModifiers WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);
DROP TABLE IF EXISTS cc_parklink2_TraditionModifiers;
CREATE TABLE cc_parklink2_TraditionModifiers AS SELECT * FROM TraditionModifiers WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);
DROP TABLE IF EXISTS cc_parklink2_TraitModifiers;
CREATE TABLE cc_parklink2_TraitModifiers AS SELECT * FROM TraitModifiers WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);
DROP TABLE IF EXISTS cc_parklink2_UnitAbilityModifiers;
CREATE TABLE cc_parklink2_UnitAbilityModifiers AS SELECT * FROM UnitAbilityModifiers WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);
DROP TABLE IF EXISTS cc_parklink2_UnitPromotionModifiers;
CREATE TABLE cc_parklink2_UnitPromotionModifiers AS SELECT * FROM UnitPromotionModifiers WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);

DROP TABLE IF EXISTS cc_ex_sets;
CREATE TABLE cc_ex_sets AS SELECT RequirementSetId FROM RequirementSets WHERE RequirementSetId IN (
    SELECT SubjectRequirementSetId FROM Modifiers WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids)
    UNION SELECT OwnerRequirementSetId FROM Modifiers WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids))
  AND RequirementSetId NOT IN (
    SELECT SubjectRequirementSetId FROM Modifiers WHERE SubjectRequirementSetId IS NOT NULL AND ModifierId NOT IN (SELECT ModifierId FROM cc_park_ids)
    UNION SELECT OwnerRequirementSetId FROM Modifiers WHERE OwnerRequirementSetId IS NOT NULL AND ModifierId NOT IN (SELECT ModifierId FROM cc_park_ids))
  UNION SELECT RequirementSetId FROM cc_park_sets;
DROP TABLE IF EXISTS cc_ex_reqs;
CREATE TABLE cc_ex_reqs AS SELECT RequirementId FROM RequirementSetRequirements WHERE RequirementSetId IN (SELECT RequirementSetId FROM cc_ex_sets)
  AND RequirementId NOT IN (SELECT RequirementId FROM RequirementSetRequirements WHERE RequirementSetId NOT IN (SELECT RequirementSetId FROM cc_ex_sets))
  UNION SELECT RequirementId FROM cc_park_reqs;

DELETE FROM ModifierArguments WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);
DELETE FROM ModifierStrings   WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);
DELETE FROM Modifiers         WHERE ModifierId IN (SELECT ModifierId FROM cc_park_ids);
DELETE FROM RequirementArguments       WHERE RequirementId    IN (SELECT RequirementId FROM cc_ex_reqs);
DELETE FROM RequirementSetRequirements WHERE RequirementSetId IN (SELECT RequirementSetId FROM cc_ex_sets);
DELETE FROM Requirements               WHERE RequirementId    IN (SELECT RequirementId FROM cc_ex_reqs);
DELETE FROM RequirementSets            WHERE RequirementSetId IN (SELECT RequirementSetId FROM cc_ex_sets);

INSERT INTO RequirementSets            SELECT * FROM cc_park_sets;
INSERT INTO Requirements               SELECT * FROM cc_park_reqs;
INSERT INTO RequirementArguments       SELECT * FROM cc_park_reqargs;
INSERT INTO RequirementSetRequirements SELECT * FROM cc_park_setreqs;
INSERT INTO Modifiers                  SELECT * FROM cc_park_mod;
INSERT INTO ModifierArguments          SELECT * FROM cc_park_args;
INSERT INTO ModifierStrings            SELECT * FROM cc_park_strings;
-- Put back the link rows of the parked ids (Antiquity's from 01, the imports' from above).
INSERT OR IGNORE INTO EnterStageModifiers SELECT * FROM cc_parklink_EnterStageModifiers;
INSERT OR IGNORE INTO EnterStageModifiers SELECT * FROM cc_parklink2_EnterStageModifiers;
DROP TABLE cc_parklink_EnterStageModifiers;
DROP TABLE cc_parklink2_EnterStageModifiers;
INSERT OR IGNORE INTO EnvoysInActionModifiers SELECT * FROM cc_parklink_EnvoysInActionModifiers;
INSERT OR IGNORE INTO EnvoysInActionModifiers SELECT * FROM cc_parklink2_EnvoysInActionModifiers;
DROP TABLE cc_parklink_EnvoysInActionModifiers;
DROP TABLE cc_parklink2_EnvoysInActionModifiers;
INSERT OR IGNORE INTO EnvoysInStageModifiers SELECT * FROM cc_parklink_EnvoysInStageModifiers;
INSERT OR IGNORE INTO EnvoysInStageModifiers SELECT * FROM cc_parklink2_EnvoysInStageModifiers;
DROP TABLE cc_parklink_EnvoysInStageModifiers;
DROP TABLE cc_parklink2_EnvoysInStageModifiers;
INSERT OR IGNORE INTO GovernmentModifiers SELECT * FROM cc_parklink_GovernmentModifiers;
INSERT OR IGNORE INTO GovernmentModifiers SELECT * FROM cc_parklink2_GovernmentModifiers;
DROP TABLE cc_parklink_GovernmentModifiers;
DROP TABLE cc_parklink2_GovernmentModifiers;
INSERT OR IGNORE INTO MementoModifiers SELECT * FROM cc_parklink_MementoModifiers;
INSERT OR IGNORE INTO MementoModifiers SELECT * FROM cc_parklink2_MementoModifiers;
DROP TABLE cc_parklink_MementoModifiers;
DROP TABLE cc_parklink2_MementoModifiers;
INSERT OR IGNORE INTO TraditionModifiers SELECT * FROM cc_parklink_TraditionModifiers;
INSERT OR IGNORE INTO TraditionModifiers SELECT * FROM cc_parklink2_TraditionModifiers;
DROP TABLE cc_parklink_TraditionModifiers;
DROP TABLE cc_parklink2_TraditionModifiers;
INSERT OR IGNORE INTO TraitModifiers SELECT * FROM cc_parklink_TraitModifiers;
INSERT OR IGNORE INTO TraitModifiers SELECT * FROM cc_parklink2_TraitModifiers;
DROP TABLE cc_parklink_TraitModifiers;
DROP TABLE cc_parklink2_TraitModifiers;
INSERT OR IGNORE INTO UnitAbilityModifiers SELECT * FROM cc_parklink_UnitAbilityModifiers;
INSERT OR IGNORE INTO UnitAbilityModifiers SELECT * FROM cc_parklink2_UnitAbilityModifiers;
DROP TABLE cc_parklink_UnitAbilityModifiers;
DROP TABLE cc_parklink2_UnitAbilityModifiers;
INSERT OR IGNORE INTO UnitPromotionModifiers SELECT * FROM cc_parklink_UnitPromotionModifiers;
INSERT OR IGNORE INTO UnitPromotionModifiers SELECT * FROM cc_parklink2_UnitPromotionModifiers;
DROP TABLE cc_parklink_UnitPromotionModifiers;
DROP TABLE cc_parklink2_UnitPromotionModifiers;
