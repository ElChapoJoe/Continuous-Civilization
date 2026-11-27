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

-- 5) Fleet, Squadron, Carrier and Aerodrome Commanders (reported on the Workshop, 0.2.1-beta). Antiquity's units.xml,
--    which stays loaded here, deletes the Squadron, Carrier and Aerodrome Commanders (Types rows, so every row of theirs
--    goes with them) and limits the Fleet Commander to TRAIT_UNLOCK_FLEET_COMMANDER (only Yi Sun-sin has it). Vanilla
--    Exploration and Modern bring them back by not loading that file. Restored from base-standard/data/units.xml, with
--    vanilla's unlocks: Fleet Commander at Astronomy, Squadron Commander at Flight, Carrier Commander at Mobilization,
--    Aerodrome Commander with its Airfield (no unlock of its own). Yi Sun-sin keeps his early Fleet Commander (Sailing).
INSERT OR IGNORE INTO Types (Type, Kind) VALUES
  ('UNIT_SQUADRON_COMMANDER', 'KIND_UNIT'), ('UNIT_CARRIER_COMMANDER', 'KIND_UNIT'), ('UNIT_AERODROME_COMMANDER', 'KIND_UNIT');
INSERT OR IGNORE INTO Units (UnitType, Name, Description, BaseSightRange, BaseMoves, UnitMovementClass, Domain, CoreClass,
    FormationClass, ZoneOfControl, CostProgressionModel, CostProgressionParam1, CanEarnExperience, PromotionClass, WMDCapable)
  VALUES
  ('UNIT_SQUADRON_COMMANDER', 'LOC_UNIT_SQUADRON_COMMANDER_NAME', 'LOC_UNIT_SQUADRON_COMMANDER_DESCRIPTION', 2, 8,
    'UNIT_MOVEMENT_CLASS_FOOT', 'DOMAIN_AIR', 'CORE_CLASS_SUPPORT', 'FORMATION_CLASS_COMMAND', 1,
    'COST_PROGRESSION_PREVIOUS_COPIES', 140, 1, 'PROMOTION_CLASS_AIR_COMMANDER', 1),
  ('UNIT_CARRIER_COMMANDER', 'LOC_UNIT_CARRIER_COMMANDER_NAME', 'LOC_UNIT_CARRIER_COMMANDER_DESCRIPTION', 2, 4,
    'UNIT_MOVEMENT_CLASS_NAVAL', 'DOMAIN_SEA', 'CORE_CLASS_SUPPORT', 'FORMATION_CLASS_COMMAND', 1,
    'COST_PROGRESSION_PREVIOUS_COPIES', 160, 1, 'PROMOTION_CLASS_CARRIER_COMMANDER', 1);
INSERT OR IGNORE INTO Units (UnitType, Name, Description, BaseSightRange, BaseMoves, UnitMovementClass, Domain, CoreClass,
    FormationClass, ZoneOfControl, CanEarnExperience, PromotionClass, CanBeDamaged, WMDCapable, StaticConstructibleUnit,
    ConstructibleType)
  SELECT 'UNIT_AERODROME_COMMANDER', 'LOC_UNIT_AERODROME_COMMANDER_NAME', 'LOC_UNIT_AERODROME_COMMANDER_DESCRIPTION', 0, 0,
    'NO_UNIT_MOVEMENT_CLASS', 'DOMAIN_AIR', 'CORE_CLASS_STATIC_CONSTRUCTIBLE', 'FORMATION_CLASS_COMMAND', 0, 1,
    'PROMOTION_CLASS_AERODROME_COMMANDER', 0, 1, 1, 'BUILDING_AIRFIELD'
  WHERE EXISTS (SELECT 1 FROM Constructibles WHERE ConstructibleType = 'BUILDING_AIRFIELD');
INSERT OR IGNORE INTO Unit_Stats (UnitType) VALUES ('UNIT_SQUADRON_COMMANDER'), ('UNIT_CARRIER_COMMANDER');
INSERT OR IGNORE INTO Unit_Costs (UnitType, YieldType, Cost) VALUES
  ('UNIT_SQUADRON_COMMANDER', 'YIELD_PRODUCTION', 140), ('UNIT_CARRIER_COMMANDER', 'YIELD_PRODUCTION', 160);
INSERT OR IGNORE INTO Unit_Advisories (UnitType, AdvisoryClassType) VALUES
  ('UNIT_SQUADRON_COMMANDER', 'ADVISORY_CLASS_MILITARY'), ('UNIT_CARRIER_COMMANDER', 'ADVISORY_CLASS_MILITARY');
INSERT OR IGNORE INTO Unit_TransitionRetains (UnitType)
  SELECT UnitType FROM Units WHERE UnitType IN ('UNIT_SQUADRON_COMMANDER', 'UNIT_CARRIER_COMMANDER', 'UNIT_AERODROME_COMMANDER');
INSERT OR IGNORE INTO TypeTags (Type, Tag)
  SELECT v.Type, v.Tag FROM (
    SELECT 'UNIT_SQUADRON_COMMANDER' AS Type, 'UNIT_CLASS_COMMAND' AS Tag UNION ALL
    SELECT 'UNIT_SQUADRON_COMMANDER', 'UNIT_CLASS_SQUADRON_COMMANDER' UNION ALL
    SELECT 'UNIT_SQUADRON_COMMANDER', 'AGELESS' UNION ALL
    SELECT 'UNIT_SQUADRON_COMMANDER', 'UNIT_CLASS_AIRCRAFT' UNION ALL
    SELECT 'UNIT_CARRIER_COMMANDER', 'UNIT_CLASS_COMMAND' UNION ALL
    SELECT 'UNIT_CARRIER_COMMANDER', 'UNIT_COMMAND_RADIUS' UNION ALL
    SELECT 'UNIT_CARRIER_COMMANDER', 'UNIT_CLASS_SQUADRON_COMMANDER' UNION ALL
    SELECT 'UNIT_CARRIER_COMMANDER', 'UNIT_CLASS_CARRIER_COMMANDER' UNION ALL
    SELECT 'UNIT_CARRIER_COMMANDER', 'UNIT_CLASS_NAVAL' UNION ALL
    SELECT 'UNIT_CARRIER_COMMANDER', 'AGELESS' UNION ALL
    SELECT 'UNIT_AERODROME_COMMANDER', 'UNIT_CLASS_COMMAND' UNION ALL
    SELECT 'UNIT_AERODROME_COMMANDER', 'UNIT_CLASS_AERODROME_COMMANDER' UNION ALL
    SELECT 'UNIT_AERODROME_COMMANDER', 'AGELESS') v
  WHERE v.Type IN (SELECT UnitType FROM Units) AND v.Tag IN (SELECT Tag FROM Tags);
UPDATE Units SET TraitType = NULL
  WHERE UnitType = 'UNIT_FLEET_COMMANDER' AND TraitType = 'TRAIT_UNLOCK_FLEET_COMMANDER';
INSERT OR IGNORE INTO ProgressionTreeNodeUnlocks (ProgressionTreeNodeType, TargetKind, TargetType, UnlockDepth, RequiredTraitType)
  SELECT v.Node, 'KIND_UNIT', v.Unit, 1, v.Trait FROM (
    SELECT 'NODE_TECH_EX_ASTRONOMY' AS Node, 'UNIT_FLEET_COMMANDER' AS Unit, NULL AS Trait UNION ALL
    SELECT 'NODE_TECH_AQ_SAILING', 'UNIT_FLEET_COMMANDER', 'TRAIT_UNLOCK_FLEET_COMMANDER' UNION ALL
    SELECT 'NODE_TECH_MO_FLIGHT', 'UNIT_SQUADRON_COMMANDER', NULL UNION ALL
    SELECT 'NODE_TECH_MO_MOBILIZATION', 'UNIT_CARRIER_COMMANDER', NULL) v
  WHERE v.Unit IN (SELECT UnitType FROM Units)
    AND v.Node IN (SELECT ProgressionTreeNodeType FROM ProgressionTreeNodes)
    AND (v.Trait IS NULL OR v.Trait IN (SELECT TraitType FROM Traits))
    AND NOT EXISTS (SELECT 1 FROM ProgressionTreeNodeUnlocks p WHERE p.TargetType = v.Unit AND p.ProgressionTreeNodeType = v.Node);
