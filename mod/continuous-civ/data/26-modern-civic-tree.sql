-- Continuous Civilization - Modern civics continue the merged civic tree (Phase 3.1). Same technique as
-- 25-civic-tree.sql. Modern's tree (progression-trees-culture-common.xml) is imported in cc-import-modern.

-- 1) Remove Exploration Future Civic (repeatable; Modern's Future Civic is now the end of the tree).
DELETE FROM ProgressionTreeNodes WHERE ProgressionTreeNodeType = 'NODE_CIVIC_EX_MAIN_FUTURE_CIVIC';
DELETE FROM Types                WHERE Type                    = 'NODE_CIVIC_EX_MAIN_FUTURE_CIVIC';

-- 2) Ideology trees (Democracy, Fascism, Communism) stay separate trees, as in vanilla: they open with
--    Political Theory (REQSET_RESEARCHED_POLITICAL_THEORY). The engine only offers trees of the current Age, so
--    they are re-tagged to Antiquity (as the Theology branch in 25).
UPDATE ProgressionTrees SET AgeType = 'AGE_ANTIQUITY'
  WHERE ProgressionTreeType IN ('TREE_CIVIC_MO_BRANCH_DEMOCRACY', 'TREE_CIVIC_MO_BRANCH_FASCISM', 'TREE_CIVIC_MO_BRANCH_COMMUNISM');

-- 3) Connect the Modern roots (no prereqs in vanilla) to Exploration's last civics.
DROP TABLE IF EXISTS cc_modern_civic_roots;
CREATE TABLE cc_modern_civic_roots (Node TEXT, PrereqNode TEXT, PRIMARY KEY (Node, PrereqNode));
INSERT INTO cc_modern_civic_roots VALUES
  ('NODE_CIVIC_MO_MAIN_MODERNIZATION',   'NODE_CIVIC_EX_MAIN_IMPERIALISM'),
  ('NODE_CIVIC_MO_MAIN_NATURAL_HISTORY', 'NODE_CIVIC_EX_MAIN_SOCIAL_CLASS'),
  ('NODE_CIVIC_MO_MAIN_SOCIAL_QUESTION', 'NODE_CIVIC_EX_MAIN_SOVEREIGNTY');
INSERT OR IGNORE INTO ProgressionTreePrereqs (Node, PrereqNode) SELECT Node, PrereqNode FROM cc_modern_civic_roots;

-- Safety net: any other Modern main civic that still has no prereq hangs off Imperialism + Sovereignty.
INSERT OR IGNORE INTO ProgressionTreePrereqs (Node, PrereqNode)
  SELECT n.ProgressionTreeNodeType, a.PrereqNode
  FROM ProgressionTreeNodes n,
       (SELECT 'NODE_CIVIC_EX_MAIN_IMPERIALISM' AS PrereqNode UNION ALL SELECT 'NODE_CIVIC_EX_MAIN_SOVEREIGNTY') a
  WHERE n.ProgressionTree = 'TREE_CIVICS_MO_MAIN'
    AND n.ProgressionTreeNodeType NOT IN (SELECT Node FROM ProgressionTreePrereqs);

-- 4) Move every Modern main civic (incl. Modern's repeatable Future Civic, at the very end) into the Antiquity tree.
UPDATE ProgressionTreeNodes SET ProgressionTree = 'TREE_CIVICS_AQ_MAIN' WHERE ProgressionTree = 'TREE_CIVICS_MO_MAIN';
