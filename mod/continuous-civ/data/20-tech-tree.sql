-- Continuous Civilization - one continuous technology tree.

-- 1) Remove Antiquity Future Tech (repeatable, would sit in the middle of the merged tree).
--    Its prereq/unlock/advisory rows cascade with the node.
DELETE FROM ProgressionTreeNodes WHERE ProgressionTreeNodeType = 'NODE_TECH_AQ_FUTURE_TECH';
DELETE FROM Types                WHERE Type                    = 'NODE_TECH_AQ_FUTURE_TECH';

-- 2) Connect the Exploration roots to the Antiquity leaves (thematic).
--    Exploration roots in vanilla: Cartography, Astronomy, Machinery (no prereqs).
INSERT OR IGNORE INTO ProgressionTreePrereqs (Node, PrereqNode) VALUES
  ('NODE_TECH_EX_CARTOGRAPHY', 'NODE_TECH_AQ_NAVIGATION'),
  ('NODE_TECH_EX_ASTRONOMY',   'NODE_TECH_AQ_MATHEMATICS'),
  -- Machinery follows Military Training, not Iron Working: in long run 4 all six AIs skipped Iron Working
  -- (738, a dead end otherwise), so nobody reached Machinery or the Exploration land units it unlocks.
  ('NODE_TECH_EX_MACHINERY',   'NODE_TECH_AQ_MILITARY_TRAINING');

-- Safety net: any other Exploration node that still has no prereq hangs off Mathematics + Military Training.
INSERT OR IGNORE INTO ProgressionTreePrereqs (Node, PrereqNode)
  SELECT n.ProgressionTreeNodeType, a.PrereqNode
  FROM ProgressionTreeNodes n,
       (SELECT 'NODE_TECH_AQ_MATHEMATICS' AS PrereqNode UNION ALL SELECT 'NODE_TECH_AQ_MILITARY_TRAINING') a
  WHERE n.ProgressionTree = 'TREE_TECHS_EX'
    AND n.ProgressionTreeNodeType NOT IN (SELECT Node FROM ProgressionTreePrereqs);

-- 3) Move every Exploration tech (incl. the repeatable Exploration Future Tech, which already requires
--    Urban Planning + Gunpowder and therefore sits at the very end) into the Antiquity tree.
UPDATE ProgressionTreeNodes SET ProgressionTree = 'TREE_TECHS_AQ' WHERE ProgressionTree = 'TREE_TECHS_EX';
