-- Continuous Civilization - Exploration and Modern units unlock through research.

-- 1) Exploration "age-start" units have no tech unlock in vanilla (they are simply available when the
--    Exploration Age begins). Gate them. Verified Phase 1: without this, AI trained Coursers etc. on turn 1.
DROP TABLE IF EXISTS cc_unit_gates;
CREATE TABLE cc_unit_gates (UnitType TEXT PRIMARY KEY, Node TEXT NOT NULL);
INSERT INTO cc_unit_gates (UnitType, Node) VALUES
  ('UNIT_SWORDSMAN',     'NODE_TECH_EX_MACHINERY'),
  ('UNIT_HEAVY_ARCHER',  'NODE_TECH_EX_MACHINERY'),
  ('UNIT_COURSER',       'NODE_TECH_EX_MACHINERY'),
  ('UNIT_CATAPULT',      'NODE_TECH_EX_MACHINERY'),
  ('UNIT_COG',           'NODE_TECH_EX_CARTOGRAPHY'),
  -- Missionary: vanilla has it from the Exploration Age start; here it comes with Piety (Temple, religion).
  ('UNIT_MISSIONARY',    'NODE_CIVIC_EX_MAIN_PIETY'),
  -- Modern age-start units (Phase 3.2)
  ('UNIT_LINE_INFANTRY', 'NODE_TECH_MO_MILITARY_SCIENCE'),
  ('UNIT_FIELD_CANNON',  'NODE_TECH_MO_MILITARY_SCIENCE'),
  ('UNIT_CUIRASSIER',    'NODE_TECH_MO_MILITARY_SCIENCE'),
  ('UNIT_MORTAR',        'NODE_TECH_MO_MILITARY_SCIENCE'),
  ('UNIT_FRIGATE',       'NODE_TECH_MO_MILITARY_SCIENCE');

INSERT OR IGNORE INTO ProgressionTreeNodeUnlocks (ProgressionTreeNodeType, TargetKind, TargetType, UnlockDepth)
  SELECT g.Node, 'KIND_UNIT', g.UnitType, 1
  FROM cc_unit_gates g
  WHERE g.UnitType IN (SELECT UnitType FROM Units)
    AND g.UnitType NOT IN (SELECT TargetType FROM ProgressionTreeNodeUnlocks);

-- 2) Civ-unique units that replace a gated unit and have no unlock of their own inherit that gate
--    (e.g. Hawaii's Leiomano -> Swordsman, Abbasid Mamluk -> Courser).
INSERT OR IGNORE INTO ProgressionTreeNodeUnlocks
       (ProgressionTreeNodeType, TargetKind, TargetType, UnlockDepth, RequiredTraitType)
  SELECT MIN(p.ProgressionTreeNodeType), 'KIND_UNIT', r.CivUniqueUnitType, 1, u.TraitType
  FROM UnitReplaces r
  JOIN Units u ON u.UnitType = r.CivUniqueUnitType
  JOIN ProgressionTreeNodeUnlocks p ON p.TargetType = r.ReplacesUnitType AND p.TargetKind = 'KIND_UNIT'
                                   AND p.ProgressionTreeNodeType LIKE 'NODE_TECH_%'
  WHERE r.CivUniqueUnitType NOT IN (SELECT UnitType FROM cc_pre_units)
    AND r.CivUniqueUnitType NOT IN (SELECT TargetType FROM ProgressionTreeNodeUnlocks
                                    WHERE ProgressionTreeNodeType LIKE 'NODE_TECH_%')
  GROUP BY r.CivUniqueUnitType;

-- 3) Catch-all: any other imported, trainable unit with no tech or civic unlock is gated at Machinery
--    (Exploration's) or Military Science (Modern's).
INSERT OR IGNORE INTO ProgressionTreeNodeUnlocks
       (ProgressionTreeNodeType, TargetKind, TargetType, UnlockDepth, RequiredTraitType)
  SELECT 'NODE_TECH_EX_MACHINERY', 'KIND_UNIT', u.UnitType, 1, u.TraitType
  FROM Units u
  WHERE u.UnitType NOT IN (SELECT UnitType FROM cc_pre_units)
    AND u.UnitType IN (SELECT UnitType FROM cc_pre_modern_units)
    AND u.CanTrain = 1
    AND u.UnitType NOT IN (SELECT TargetType FROM ProgressionTreeNodeUnlocks);
INSERT OR IGNORE INTO ProgressionTreeNodeUnlocks
       (ProgressionTreeNodeType, TargetKind, TargetType, UnlockDepth, RequiredTraitType)
  SELECT 'NODE_TECH_MO_MILITARY_SCIENCE', 'KIND_UNIT', u.UnitType, 1, u.TraitType
  FROM Units u
  WHERE u.UnitType NOT IN (SELECT UnitType FROM cc_pre_modern_units)
    AND u.CanTrain = 1
    AND u.UnitType NOT IN (SELECT TargetType FROM ProgressionTreeNodeUnlocks);

-- 4) Upgrade lineage across the old Age boundary (vanilla converts these at the Age transition instead).
--    UnitUpgrades.Unit is the primary key; only add where Antiquity's top unit has no upgrade yet.
INSERT OR IGNORE INTO UnitUpgrades (Unit, UpgradeUnit)
  SELECT v.Unit, v.UpgradeUnit FROM (
    SELECT 'UNIT_PHALANX'    AS Unit, 'UNIT_SWORDSMAN'    AS UpgradeUnit UNION ALL
    SELECT 'UNIT_ARCHER',             'UNIT_HEAVY_ARCHER'               UNION ALL
    SELECT 'UNIT_HORSEMAN',           'UNIT_COURSER'                    UNION ALL
    SELECT 'UNIT_BALLISTA',           'UNIT_CATAPULT'                   UNION ALL
    SELECT 'UNIT_QUADRIREME',         'UNIT_COG'                        UNION ALL
    -- Exploration's top units into Modern's first tier (Phase 3.2)
    SELECT 'UNIT_PIKEMAN',            'UNIT_LINE_INFANTRY'              UNION ALL
    SELECT 'UNIT_ARQUEBUSIER',        'UNIT_LINE_INFANTRY'              UNION ALL
    SELECT 'UNIT_LANCER',             'UNIT_CUIRASSIER'                 UNION ALL
    SELECT 'UNIT_BOMBARD',            'UNIT_FIELD_CANNON'               UNION ALL
    SELECT 'UNIT_GALLEON',            'UNIT_FRIGATE') v
  WHERE v.Unit IN (SELECT UnitType FROM Units) AND v.UpgradeUnit IN (SELECT UnitType FROM Units);
