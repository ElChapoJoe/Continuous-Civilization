-- Continuous Civilization - remove rows that reference modifiers defined in Exploration files we do not
-- import (golden ages, age transition, traditions). Without this the gameplay DB fails FK validation and
-- the engine rolls back the whole mod (verified Phase 1).
DELETE FROM TraditionModifiers   WHERE ModifierId NOT IN (SELECT ModifierId FROM Modifiers);
DELETE FROM UnitAbilityModifiers WHERE ModifierId NOT IN (SELECT ModifierId FROM Modifiers);

-- Tree unlocks whose target is not in the database (yet): Modern tree nodes unlock Modern units, buildings,
-- projects and traditions that later Phase 3 steps import. Without a target the unlock only shows as a broken
-- entry, so it is dropped; once the target is imported (before this file runs) the unlock stays.
DELETE FROM ProgressionTreeNodeUnlocks WHERE TargetKind = 'KIND_UNIT'         AND TargetType NOT IN (SELECT UnitType FROM Units);
DELETE FROM ProgressionTreeNodeUnlocks WHERE TargetKind = 'KIND_CONSTRUCTIBLE' AND TargetType NOT IN (SELECT ConstructibleType FROM Constructibles);
DELETE FROM ProgressionTreeNodeUnlocks WHERE TargetKind = 'KIND_PROJECT'      AND TargetType NOT IN (SELECT ProjectType FROM Projects);
DELETE FROM ProgressionTreeNodeUnlocks WHERE TargetKind = 'KIND_TRADITION'    AND TargetType NOT IN (SELECT TraditionType FROM Traditions);
DELETE FROM ProgressionTreeNodeUnlocks WHERE TargetKind = 'KIND_MODIFIER'     AND TargetType NOT IN (SELECT ModifierId FROM Modifiers);
DELETE FROM ProgressionTreeNodeUnlocks WHERE TargetKind = 'KIND_DIPLOMATIC_ACTION' AND TargetType NOT IN (SELECT DiplomacyActionType FROM DiplomacyActions);
-- Unlocks tied to a government that is not in the database yet (Modern civics name the Modern governments,
-- imported in a later Phase 3 step). The FK on RequiredGovernmentType would fail validation otherwise.
DELETE FROM ProgressionTreeNodeUnlocks
  WHERE RequiredGovernmentType IS NOT NULL AND RequiredGovernmentType NOT IN (SELECT GovernmentType FROM Governments);
