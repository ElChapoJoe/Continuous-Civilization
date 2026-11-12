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
