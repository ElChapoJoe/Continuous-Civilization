-- Continuous Civilization - Exploration narratives and discoveries (imported in cc-import-exploration:
-- narrative-stories, discovery-stories, tot-narrative-stories, narrative-display, narrative-sifting; their text
-- already loads in every Age).
-- The engine offers stories of the current Age only, so the 1,597 Exploration stories are re-tagged to
-- Antiquity and join Antiquity's pool. Their requirements still gate them (Exploration systems, buildings,
-- religion...); their "N Age transitions" conditions are rewritten to the personal Age by 70-personal-age.sql.
-- Reward scaling (NarrativeStory_Yield_Rewards / DiscoveryStory_Yield_Rewards) is a per-Age setting and is left
-- alone: the engine uses Antiquity's values.
UPDATE NarrativeStories SET Age = 'AGE_ANTIQUITY' WHERE Age IN ('AGE_EXPLORATION', 'AGE_MODERN');
