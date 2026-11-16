-- Continuous Civilization - one continuous civic (culture) tree. Same technique as 20-tech-tree.sql.
-- Exploration's main civics (progression-trees-culture-common.xml, imported in cc-import-exploration) are
-- grafted onto the end of the Antiquity main civic tree. Exploration policies (traditions) and their text are
-- already loaded in every Age by the base game, so only the tree itself needs importing.

-- 1) Remove Antiquity Future Civic (repeatable, would sit in the middle of the merged tree).
--    Its prereq/unlock/advisory rows cascade with the node.
DELETE FROM ProgressionTreeNodes WHERE ProgressionTreeNodeType = 'NODE_CIVIC_AQ_MAIN_FUTURE_CIVIC';
DELETE FROM Types                WHERE Type                    = 'NODE_CIVIC_AQ_MAIN_FUTURE_CIVIC';

-- 2) Theology branch (Theology -> Reformation) is kept as its own tree, as in vanilla: it opens once the player
--    has founded a religion (REQSET_CULTURE_TREE_THEOLOGY). Religion founding comes from the imported
--    Exploration gamecapabilities.xml / religion.xml. The engine only offers trees of the current Age, so it
--    is re-tagged to Antiquity (verified: tagged AGE_EXPLORATION it never appeared, even with a religion).
UPDATE ProgressionTrees SET AgeType = 'AGE_ANTIQUITY' WHERE ProgressionTreeType = 'TREE_CIVICS_EX_BRANCH_THEOLOGY';
-- Its reveal condition also requires the Exploration Age (REQ_AGE_IS_EXPLORATION), which never happens here:
-- keep only "has founded a religion".
DELETE FROM RequirementSetRequirements
  WHERE RequirementSetId = 'REQSET_CULTURE_TREE_THEOLOGY' AND RequirementId = 'REQ_AGE_IS_EXPLORATION';

-- 3) Connect the Exploration roots to the Antiquity leaves (thematic).
--    Exploration roots in vanilla: Economics, Piety (no prereqs).
INSERT OR IGNORE INTO ProgressionTreePrereqs (Node, PrereqNode) VALUES
  ('NODE_CIVIC_EX_MAIN_ECONOMICS', 'NODE_CIVIC_AQ_MAIN_COMMERCE'),
  ('NODE_CIVIC_EX_MAIN_PIETY',     'NODE_CIVIC_AQ_MAIN_PHILOSOPHY');

-- Safety net: any other Exploration main civic that still has no prereq hangs off Commerce + Philosophy.
INSERT OR IGNORE INTO ProgressionTreePrereqs (Node, PrereqNode)
  SELECT n.ProgressionTreeNodeType, a.PrereqNode
  FROM ProgressionTreeNodes n,
       (SELECT 'NODE_CIVIC_AQ_MAIN_COMMERCE' AS PrereqNode UNION ALL SELECT 'NODE_CIVIC_AQ_MAIN_PHILOSOPHY') a
  WHERE n.ProgressionTree = 'TREE_CIVICS_EX_MAIN'
    AND n.ProgressionTreeNodeType NOT IN (SELECT Node FROM ProgressionTreePrereqs);

-- 4) Move every Exploration main civic (incl. the repeatable Exploration Future Civic, which already requires
--    Imperialism + Sovereignty + Social Class and therefore sits at the very end) into the Antiquity tree.
UPDATE ProgressionTreeNodes SET ProgressionTree = 'TREE_CIVICS_AQ_MAIN' WHERE ProgressionTree = 'TREE_CIVICS_EX_MAIN';


-- ---- Modern civics continue the merged civic tree, same technique as above. Modern's tree
-- (progression-trees-culture-common.xml) is imported in cc-import-modern.

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
