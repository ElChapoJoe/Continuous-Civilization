-- ===== Experiment E1: freeze the age clock =====
UPDATE AgeProgressionTurns  SET Points = 0;
UPDATE AgeProgressionEvents SET Points = 0;
UPDATE AgeProgressions SET MaxPoints_Abbreviated = 100000, MaxPoints_Standard = 100000, MaxPoints_Long = 100000;

-- ===== Experiment E2: graft Exploration techs onto the Antiquity tree =====
-- Root EX techs (no prereqs) will require the last two non-repeatable AQ techs.
CREATE TEMP TABLE cc_ex_roots AS
  SELECT n.ProgressionTreeNodeType AS Node FROM ProgressionTreeNodes n
  WHERE n.ProgressionTree = 'TREE_TECHS_EX' AND n.Repeatable = 0
    AND n.ProgressionTreeNodeType NOT IN (SELECT Node FROM ProgressionTreePrereqs);
INSERT OR IGNORE INTO ProgressionTreePrereqs (Node, PrereqNode)
  SELECT Node, 'NODE_TECH_AQ_MATHEMATICS'  FROM cc_ex_roots;
INSERT OR IGNORE INTO ProgressionTreePrereqs (Node, PrereqNode)
  SELECT Node, 'NODE_TECH_AQ_IRON_WORKING' FROM cc_ex_roots;
-- Move non-repeatable EX nodes into the Antiquity tree.
UPDATE ProgressionTreeNodes SET ProgressionTree = 'TREE_TECHS_AQ'
  WHERE ProgressionTree = 'TREE_TECHS_EX' AND Repeatable = 0;

-- ===== Prune dangling references from partially-imported Exploration data =====
DELETE FROM TraditionModifiers  WHERE ModifierId NOT IN (SELECT ModifierId FROM Modifiers);
DELETE FROM UnitAbilityModifiers WHERE ModifierId NOT IN (SELECT ModifierId FROM Modifiers);
