-- ---------------------------------------------------------------------------------------------------------------
-- Continuous Civilization - civ abilities by personal Age (hand-written part of 75-civ-abilities.sql; it is copied in
-- by tools/gen_civ_abilities.py after the generated rows above).
-- Each ability modifier stays attached as vanilla attaches it in every Age where it has it. A modifier vanilla has in
-- only some Ages is moved to a copy (CC_AB_<pattern>_<modifier>) whose owner must be in one of those personal Ages
-- (70-personal-age.sql / 72-exploration-rules.sql conditions), attached to the same civ trait. Examples: an Exploration
-- civ played from Antiquity uses its Test of Time ability until its personal Exploration, then its real ability; a
-- grant such as the Abbasid Alim quarter comes when the civ enters its Exploration.
-- Runs before 81-age-scaled-bonuses.sql on purpose: 81 then makes its personal-Age scaled copies (x2 / x3) of these
-- copies too, so a real ability scales as in vanilla's later Ages and a Test of Time ability stops with its copies.
-- Only modifiers that exist in the database are used (a DLC you don't own, or an ability effect the mod doesn't
-- import, is skipped).

DELETE FROM cc_civ_ability_rows WHERE TraitType NOT IN (SELECT TraitType FROM Traits)
  OR ModifierId NOT IN (SELECT ModifierId FROM Modifiers);
-- Rows that are the same in every Age need nothing.
DELETE FROM cc_civ_ability_rows WHERE InAQ = 1 AND InEX = 1 AND InMO = 1;

-- Personal-Age conditions per pattern (AQ / EX / MO = the Ages the modifier is active in).
DROP TABLE IF EXISTS cc_ab_patterns;
CREATE TABLE cc_ab_patterns (Pattern TEXT PRIMARY KEY, InAQ INTEGER, InEX INTEGER, InMO INTEGER, SetType TEXT);
INSERT INTO cc_ab_patterns VALUES
  ('AQ', 1, 0, 0, 'REQUIREMENTSET_TEST_ALL'), ('EX', 0, 1, 0, 'REQUIREMENTSET_TEST_ALL'),
  ('MO', 0, 0, 1, 'REQUIREMENTSET_TEST_ALL'), ('AQEX', 1, 1, 0, 'REQUIREMENTSET_TEST_ALL'),
  ('EXMO', 0, 1, 1, 'REQUIREMENTSET_TEST_ALL'), ('AQMO', 1, 0, 1, 'REQUIREMENTSET_TEST_ANY');
INSERT INTO RequirementSets (RequirementSetId, RequirementSetType)
  SELECT 'CC_REQSET_ABAGE_' || Pattern, SetType FROM cc_ab_patterns;
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId) VALUES
  ('CC_REQSET_ABAGE_AQ', 'CC_REQ_NOT_IN_EXPLORATION'),
  ('CC_REQSET_ABAGE_EX', 'CC_REQ_IN_EXPLORATION'), ('CC_REQSET_ABAGE_EX', 'CC_REQ_NOT_IN_MODERN'),
  ('CC_REQSET_ABAGE_MO', 'CC_REQ_IN_MODERN'),
  ('CC_REQSET_ABAGE_AQEX', 'CC_REQ_NOT_IN_MODERN'),
  ('CC_REQSET_ABAGE_EXMO', 'CC_REQ_IN_EXPLORATION'),
  ('CC_REQSET_ABAGE_AQMO', 'CC_REQ_NOT_IN_EXPLORATION'), ('CC_REQSET_ABAGE_AQMO', 'CC_REQ_IN_MODERN');
INSERT INTO Requirements (RequirementId, RequirementType)
  SELECT 'CC_REQ_ABAGE_' || Pattern, 'REQUIREMENT_REQUIREMENTSET_IS_MET' FROM cc_ab_patterns;
INSERT INTO RequirementArguments (RequirementId, Name, Value)
  SELECT 'CC_REQ_ABAGE_' || Pattern, 'RequirementSetId', 'CC_REQSET_ABAGE_' || Pattern FROM cc_ab_patterns;

DROP TABLE IF EXISTS cc_ab_moves;
CREATE TABLE cc_ab_moves (TraitType TEXT, ModifierId TEXT, Pattern TEXT, Clone TEXT, OwnerSet TEXT, NewOwnerSet TEXT);
INSERT INTO cc_ab_moves (TraitType, ModifierId, Pattern, Clone, OwnerSet)
  SELECT r.TraitType, r.ModifierId, p.Pattern, 'CC_AB_' || p.Pattern || '_' || r.ModifierId, m.OwnerRequirementSetId
  FROM cc_civ_ability_rows r
  JOIN cc_ab_patterns p ON p.InAQ = r.InAQ AND p.InEX = r.InEX AND p.InMO = r.InMO
  JOIN Modifiers m ON m.ModifierId = r.ModifierId;
-- Owner condition of each copy: the Age set, AND the modifier's own owner condition if it has one.
UPDATE cc_ab_moves SET NewOwnerSet = CASE WHEN OwnerSet IS NULL THEN 'CC_REQSET_ABAGE_' || Pattern
  ELSE 'CC_REQSET_AB_' || Pattern || '_' || ModifierId END;
INSERT OR IGNORE INTO RequirementSets (RequirementSetId, RequirementSetType)
  SELECT DISTINCT NewOwnerSet, 'REQUIREMENTSET_TEST_ALL' FROM cc_ab_moves WHERE OwnerSet IS NOT NULL;
INSERT OR IGNORE INTO Requirements (RequirementId, RequirementType)
  SELECT DISTINCT 'CC_REQ_AB_OWN_' || ModifierId, 'REQUIREMENT_REQUIREMENTSET_IS_MET' FROM cc_ab_moves WHERE OwnerSet IS NOT NULL;
INSERT OR IGNORE INTO RequirementArguments (RequirementId, Name, Value)
  SELECT DISTINCT 'CC_REQ_AB_OWN_' || ModifierId, 'RequirementSetId', OwnerSet FROM cc_ab_moves WHERE OwnerSet IS NOT NULL;
INSERT OR IGNORE INTO RequirementSetRequirements (RequirementSetId, RequirementId)
  SELECT DISTINCT NewOwnerSet, 'CC_REQ_AB_OWN_' || ModifierId FROM cc_ab_moves WHERE OwnerSet IS NOT NULL;
INSERT OR IGNORE INTO RequirementSetRequirements (RequirementSetId, RequirementId)
  SELECT DISTINCT NewOwnerSet, 'CC_REQ_ABAGE_' || Pattern FROM cc_ab_moves WHERE OwnerSet IS NOT NULL;

-- The copies (same effect, arguments and texts; only the owner condition differs).
INSERT OR IGNORE INTO Modifiers (ModifierId, ModifierType, NewOnly, OwnerRequirementSetId, OwnerStackLimit, Permanent, RunOnce, SubjectRequirementSetId, SubjectStackLimit)
  SELECT DISTINCT a.Clone, m.ModifierType, m.NewOnly, a.NewOwnerSet, m.OwnerStackLimit, m.Permanent, m.RunOnce, m.SubjectRequirementSetId, m.SubjectStackLimit
  FROM cc_ab_moves a JOIN Modifiers m ON m.ModifierId = a.ModifierId;
INSERT OR IGNORE INTO ModifierArguments (ModifierId, Name, Value, Type, Extra, SecondExtra)
  SELECT DISTINCT a.Clone, g.Name, g.Value, g.Type, g.Extra, g.SecondExtra FROM cc_ab_moves a JOIN ModifierArguments g ON g.ModifierId = a.ModifierId;
INSERT OR IGNORE INTO ModifierStrings (ModifierId, Context, Text)
  SELECT DISTINCT a.Clone, s.Context, s.Text FROM cc_ab_moves a JOIN ModifierStrings s ON s.ModifierId = a.ModifierId;

-- Swap the attachment: the civ's trait gets the copy instead of the original.
DELETE FROM TraitModifiers WHERE EXISTS
  (SELECT 1 FROM cc_ab_moves a WHERE a.TraitType = TraitModifiers.TraitType AND a.ModifierId = TraitModifiers.ModifierId);
INSERT OR IGNORE INTO TraitModifiers (TraitType, ModifierId) SELECT TraitType, Clone FROM cc_ab_moves;

DROP TABLE cc_ab_moves;
DROP TABLE cc_ab_patterns;
DROP TABLE cc_civ_ability_rows;
