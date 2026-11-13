-- Continuous Civilization - Exploration and Modern buildings in a permanent Antiquity.

-- 1) Engine rule (verified Phase 1): only constructibles whose Age is the current Age (or NULL) can be
--    built. Re-tag everything that was imported from Exploration.
UPDATE Constructibles SET Age = 'AGE_ANTIQUITY'
 WHERE Age IN ('AGE_EXPLORATION', 'AGE_MODERN')
   AND ConstructibleType NOT IN (SELECT ConstructibleType FROM cc_pre_constructibles);
UPDATE Warehouse_YieldChanges SET Age = 'AGE_ANTIQUITY'
 WHERE Age IN ('AGE_EXPLORATION', 'AGE_MODERN') AND ID NOT IN (SELECT ID FROM cc_pre_warehouse);
UPDATE Adjacency_YieldChanges SET Age = 'AGE_ANTIQUITY'
 WHERE Age IN ('AGE_EXPLORATION', 'AGE_MODERN') AND ID NOT IN (SELECT ID FROM cc_pre_adjacency);

-- 2) Prevent premature access. A constructible that is not the target of any unlock row is buildable
--    immediately, so gate it behind a tech. Since the Exploration civics are merged (25-civic-tree.sql),
--    content that vanilla unlocks by civic (Temple at Piety, most Exploration wonders) keeps its civic unlock
--    and these rows only apply to what has no unlock at all (e.g. after a patch, or Theology-only content).
DROP TABLE IF EXISTS cc_building_gates;
CREATE TABLE cc_building_gates (ConstructibleType TEXT PRIMARY KEY, Node TEXT NOT NULL);
INSERT INTO cc_building_gates (ConstructibleType, Node) VALUES
  -- common buildings (vanilla: Piety civic / available at Age start)
  ('BUILDING_TEMPLE',              'NODE_TECH_EX_ASTRONOMY'),
  ('BUILDING_BAZAAR',              'NODE_TECH_EX_GUILDS'),
  -- wonders (vanilla: Exploration civics)
  ('WONDER_HALE_O_KEAWE',          'NODE_TECH_EX_CARTOGRAPHY'),
  ('WONDER_BRIHADEESWARAR_TEMPLE', 'NODE_TECH_EX_GUILDS'),
  ('WONDER_BOROBUDUR',             'NODE_TECH_EX_FEUDALISM'),
  ('WONDER_ERDENE_ZUU',            'NODE_TECH_EX_HERALDRY'),
  ('WONDER_WHITE_TOWER',           'NODE_TECH_EX_CASTLES'),
  ('WONDER_HOUSE_OF_WISDOM',       'NODE_TECH_EX_EDUCATION'),
  ('WONDER_TOMB_OF_ASKIA',         'NODE_TECH_EX_METALLURGY'),
  ('WONDER_NOTRE_DAME',            'NODE_TECH_EX_ARCHITECTURE'),
  ('WONDER_EL_ESCORIAL',           'NODE_TECH_EX_URBAN_PLANNING'),
  -- Modern buildings available at the Modern Age start in vanilla (Phase 3.2)
  ('BUILDING_GROCER',              'NODE_TECH_MO_URBANIZATION'),
  ('BUILDING_CITY_PARK',           'NODE_TECH_MO_URBANIZATION'),
  ('IMPROVEMENT_MOUNTAIN',         'NODE_TECH_MO_INDUSTRIALIZATION');

INSERT OR IGNORE INTO ProgressionTreeNodeUnlocks (ProgressionTreeNodeType, TargetKind, TargetType, UnlockDepth)
  SELECT g.Node, 'KIND_CONSTRUCTIBLE', g.ConstructibleType, 1
  FROM cc_building_gates g
  WHERE g.ConstructibleType IN (SELECT ConstructibleType FROM Constructibles)
    AND g.ConstructibleType NOT IN (SELECT TargetType FROM ProgressionTreeNodeUnlocks);

-- 3) Catch-all: any other imported constructible that is freely buildable (RequiresUnlock = 0) and is not
--    unlocked by any tech or civic gets gated at Feudalism (Exploration's) or Urbanization (Modern's; mostly
--    civ-unique buildings that vanilla unlocks in the Modern civs' own civic trees, which are not imported).
--    Civ-unique ones carry their trait so the unlock only shows for that civilization. RequiresUnlock = 1 items (city-state/narrative rewards) are left alone.
INSERT OR IGNORE INTO ProgressionTreeNodeUnlocks
       (ProgressionTreeNodeType, TargetKind, TargetType, UnlockDepth, RequiredTraitType)
  SELECT 'NODE_TECH_EX_FEUDALISM', 'KIND_CONSTRUCTIBLE', c.ConstructibleType, 1,
         COALESCE(b.TraitType, i.TraitType)
  FROM Constructibles c
  LEFT JOIN Buildings    b ON b.ConstructibleType = c.ConstructibleType
  LEFT JOIN Improvements i ON i.ConstructibleType = c.ConstructibleType
  WHERE c.ConstructibleType NOT IN (SELECT ConstructibleType FROM cc_pre_constructibles)
    AND c.ConstructibleType IN (SELECT ConstructibleType FROM cc_pre_modern_constructibles)
    AND c.RequiresUnlock = 0
    AND c.ConstructibleType NOT IN (SELECT TargetType FROM ProgressionTreeNodeUnlocks);
INSERT OR IGNORE INTO ProgressionTreeNodeUnlocks
       (ProgressionTreeNodeType, TargetKind, TargetType, UnlockDepth, RequiredTraitType)
  SELECT 'NODE_TECH_MO_URBANIZATION', 'KIND_CONSTRUCTIBLE', c.ConstructibleType, 1,
         COALESCE(b.TraitType, i.TraitType)
  FROM Constructibles c
  LEFT JOIN Buildings    b ON b.ConstructibleType = c.ConstructibleType
  LEFT JOIN Improvements i ON i.ConstructibleType = c.ConstructibleType
  WHERE c.ConstructibleType NOT IN (SELECT ConstructibleType FROM cc_pre_modern_constructibles)
    AND c.RequiresUnlock = 0
    AND c.ConstructibleType NOT IN (SELECT TargetType FROM ProgressionTreeNodeUnlocks);

-- Ruins: Modern's constructibles file turns them into always-visible archaeology sites that stay after entry.
-- Restore Antiquity's discovery behaviour (hidden until seen, a goody site removed when a unit enters).
-- Modern archaeology on ruins is therefore unavailable; Culture victory is a known limitation anyway.
UPDATE Constructibles SET CanBeHidden = 1, Archaeology = 0, Discovery = 1 WHERE ConstructibleType = 'IMPROVEMENT_RUINS';
UPDATE Improvements SET RemoveOnEntry = 1 WHERE ConstructibleType = 'IMPROVEMENT_RUINS';
