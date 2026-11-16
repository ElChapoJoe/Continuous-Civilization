-- Continuous Civilization - one continuous technology tree: Exploration's techs graft onto Antiquity's, then
-- Modern's onto Exploration's (both trees imported in 2-import).

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


-- ---- Modern techs continue the merged tree, same technique as above. Modern's tree (progression-trees-tech.xml)
-- is imported in cc-import-modern.

-- 1) Remove Exploration Future Tech (repeatable; Modern's Future Tech is now the end of the tree).
--    Its prereq/unlock/advisory rows cascade with the node.
DELETE FROM ProgressionTreeNodes WHERE ProgressionTreeNodeType = 'NODE_TECH_EX_FUTURE_TECH';
DELETE FROM Types                WHERE Type                    = 'NODE_TECH_EX_FUTURE_TECH';

-- 2) Connect the Modern roots (no prereqs in vanilla) to Exploration's last column (Urban Planning, Gunpowder),
--    so all three sit at the same depth and Modern's tree keeps its vanilla shape (no links that skip columns,
--    which the tree screen draws badly). Education and Metallurgy still lead on inside Exploration.
DROP TABLE IF EXISTS cc_modern_tech_roots;
CREATE TABLE cc_modern_tech_roots (Node TEXT, PrereqNode TEXT, PRIMARY KEY (Node, PrereqNode));
INSERT INTO cc_modern_tech_roots VALUES
  ('NODE_TECH_MO_ACADEMICS',        'NODE_TECH_EX_URBAN_PLANNING'),
  ('NODE_TECH_MO_STEAM_ENGINE',     'NODE_TECH_EX_GUNPOWDER'),
  ('NODE_TECH_MO_MILITARY_SCIENCE', 'NODE_TECH_EX_GUNPOWDER');
INSERT OR IGNORE INTO ProgressionTreePrereqs (Node, PrereqNode) SELECT Node, PrereqNode FROM cc_modern_tech_roots;

-- Safety net: any other Modern tech that still has no prereq hangs off Urban Planning + Gunpowder (the
-- Exploration leaves).
INSERT OR IGNORE INTO ProgressionTreePrereqs (Node, PrereqNode)
  SELECT n.ProgressionTreeNodeType, a.PrereqNode
  FROM ProgressionTreeNodes n,
       (SELECT 'NODE_TECH_EX_URBAN_PLANNING' AS PrereqNode UNION ALL SELECT 'NODE_TECH_EX_GUNPOWDER') a
  WHERE n.ProgressionTree = 'TREE_TECHS_MO'
    AND n.ProgressionTreeNodeType NOT IN (SELECT Node FROM ProgressionTreePrereqs);

-- 3) Move every Modern tech (incl. Modern's repeatable Future Tech, which already requires Rocketry + Nuclear
--    Fission and so sits at the very end) into the Antiquity tree.
UPDATE ProgressionTreeNodes SET ProgressionTree = 'TREE_TECHS_AQ' WHERE ProgressionTree = 'TREE_TECHS_MO';
