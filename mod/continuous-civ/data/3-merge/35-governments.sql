-- Continuous Civilization - Exploration and Modern governments in a permanent Antiquity.
-- governments.xml and golden-ages(-gameeffects).xml are imported in cc-import-exploration (Feudal Monarchy,
-- Plutocracy, Theocracy, their celebrations and abilities; the crisis-only revolutionary governments come along
-- but are never offered).
--
-- Engine facts (verified live, see docs): after Chiefdom the engine accepts CHANGE_GOVERNMENT at any time, for
-- any government; vanilla only limits it through the UI. So:
--   * Exploration governments are NOT starting governments: neither the Chiefdom choice nor the AI sees them.
--   * Each one unlocks at a civic. The mapping lives in requirement sets CC_GOVUNLOCK_<government>
--     ("player has completed <civic>"), which ui/cc-governments.js reads: it adds unlocked Exploration
--     governments to the local player's government chooser and opens the chooser when one unlocks.

DELETE FROM StartingGovernments WHERE AgeType <> 'AGE_ANTIQUITY';

-- Tunable: government -> civic that unlocks it.
DROP TABLE IF EXISTS cc_government_unlocks;
CREATE TABLE cc_government_unlocks (GovernmentType TEXT PRIMARY KEY, ProgressionTreeNodeType TEXT NOT NULL);
INSERT INTO cc_government_unlocks VALUES
  ('GOVERNMENT_THEOCRACY',      'NODE_CIVIC_EX_MAIN_PIETY'),
  ('GOVERNMENT_PLUTOCRACY',     'NODE_CIVIC_EX_MAIN_MERCANTILISM'),
  ('GOVERNMENT_FEUDAL_MONARCHY', 'NODE_CIVIC_EX_MAIN_AUTHORITY'),
  -- Modern (Phase 3.4; governments.xml and golden-ages imported in cc-import-modern)
  ('GOVERNMENT_BUREAUCRATIC_MONARCHY', 'NODE_CIVIC_MO_MAIN_MODERNIZATION'),
  ('GOVERNMENT_ELECTIVE_REPUBLIC',     'NODE_CIVIC_MO_MAIN_SOCIAL_QUESTION'),
  ('GOVERNMENT_AUTHORITARIANISM',      'NODE_CIVIC_MO_MAIN_POLITICAL_THEORY');
DELETE FROM cc_government_unlocks
  WHERE GovernmentType NOT IN (SELECT GovernmentType FROM Governments)
     OR ProgressionTreeNodeType NOT IN (SELECT ProgressionTreeNodeType FROM ProgressionTreeNodes);

INSERT INTO Requirements (RequirementId, RequirementType)
  SELECT 'CC_REQ_GOVUNLOCK_' || GovernmentType, 'REQUIREMENT_PLAYER_HAS_COMPLETED_PROGRESSION_TREE_NODE'
  FROM cc_government_unlocks;
INSERT INTO RequirementArguments (RequirementId, Name, Value)
  SELECT 'CC_REQ_GOVUNLOCK_' || GovernmentType, 'ProgressionTreeNodeType', ProgressionTreeNodeType
  FROM cc_government_unlocks;
INSERT INTO RequirementSets (RequirementSetId, RequirementSetType)
  SELECT 'CC_GOVUNLOCK_' || GovernmentType, 'REQUIREMENTSET_TEST_ALL' FROM cc_government_unlocks;
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId)
  SELECT 'CC_GOVUNLOCK_' || GovernmentType, 'CC_REQ_GOVUNLOCK_' || GovernmentType FROM cc_government_unlocks;

-- AI. The engine AI picks a government once, at Chiefdom, from ALL governments (verified live: AIs chose
-- Plutocracy, Feudal Monarchy and Theocracy around turn 10), and never reopens the choice. Two rules, applied
-- with EFFECT_PLAYER_SET_GOVERNMENT (the effect vanilla's crises and narrative events use):
--   * revert: right after its Chiefdom pick (before Mysticism), an AI on an Exploration or crisis-only government goes back to
--     a matching Antiquity government;
--   * switch: an AI on an Antiquity government that has the mapped civic moves to its Exploration one.
-- REQUIREMENT_PLAYER_HAS_GOVERNMENT checks the modifier's OWNER (verified: it never matched on a game-wide
-- modifier), so each rule is a game-wide wrapper (AI + civic condition) that attaches a player-owned inner
-- modifier carrying the government check and the effect. Not permanent: it detaches once the rule stops
-- matching. Classical Republic AIs switch to Theocracy at Piety. Vanilla does not require a religion for
-- Theocracy either, and AIs found one soon after Piety (Temple). A "has founded a religion" condition was tried
-- and does not work here: REQUIREMENT_FOUNDED_NO_RELIGION, REQUIREMENT_PLAYER_FOUNDED_RELIGION and
-- REQUIREMENT_PLAYER_IS_RELIGION_FOUNDER never matched a player, neither on a game-wide nor on a player-owned
-- modifier (verified live; Firaxis only uses them on unit/city subjects or for tree reveal).
DROP TABLE IF EXISTS cc_ai_government_rules;
CREATE TABLE cc_ai_government_rules (FromGovernment TEXT NOT NULL, ToGovernment TEXT NOT NULL,
  Kind TEXT NOT NULL,          -- SWITCH needs the civic of CivicGovernment; REVERT applies before Mysticism
  CivicGovernment TEXT,        -- government whose unlock civic is tested (NULL: no civic condition)
  PRIMARY KEY (FromGovernment, Kind));
INSERT INTO cc_ai_government_rules VALUES
  ('GOVERNMENT_DESPOTISM',                     'GOVERNMENT_FEUDAL_MONARCHY',    'SWITCH', 'GOVERNMENT_FEUDAL_MONARCHY'),
  ('GOVERNMENT_OLIGARCHY',                     'GOVERNMENT_PLUTOCRACY',         'SWITCH', 'GOVERNMENT_PLUTOCRACY'),
  ('GOVERNMENT_CLASSICAL_REPUBLIC',            'GOVERNMENT_THEOCRACY',          'SWITCH', 'GOVERNMENT_THEOCRACY'),
  ('GOVERNMENT_FEUDAL_MONARCHY',               'GOVERNMENT_DESPOTISM',          'REVERT', 'GOVERNMENT_FEUDAL_MONARCHY'),
  ('GOVERNMENT_PLUTOCRACY',                    'GOVERNMENT_OLIGARCHY',          'REVERT', 'GOVERNMENT_PLUTOCRACY'),
  ('GOVERNMENT_THEOCRACY',                     'GOVERNMENT_CLASSICAL_REPUBLIC', 'REVERT', 'GOVERNMENT_THEOCRACY'),
  ('GOVERNMENT_REVOLUTIONARY_AUTHORITARIANISM', 'GOVERNMENT_DESPOTISM',          'REVERT', NULL),
  ('GOVERNMENT_CONSTITUTIONAL_MONARCHY',       'GOVERNMENT_OLIGARCHY',          'REVERT', NULL),
  ('GOVERNMENT_REVOLUTIONARY_REPUBLIC',        'GOVERNMENT_CLASSICAL_REPUBLIC', 'REVERT', NULL),
  -- Modern (Phase 3.4): Exploration governments move on to a Modern one at its civic; a Chiefdom pick of a Modern
  -- government is reverted like the Exploration ones.
  ('GOVERNMENT_FEUDAL_MONARCHY',               'GOVERNMENT_BUREAUCRATIC_MONARCHY', 'SWITCH', 'GOVERNMENT_BUREAUCRATIC_MONARCHY'),
  ('GOVERNMENT_PLUTOCRACY',                    'GOVERNMENT_ELECTIVE_REPUBLIC',     'SWITCH', 'GOVERNMENT_ELECTIVE_REPUBLIC'),
  ('GOVERNMENT_THEOCRACY',                     'GOVERNMENT_AUTHORITARIANISM',      'SWITCH', 'GOVERNMENT_AUTHORITARIANISM'),
  ('GOVERNMENT_BUREAUCRATIC_MONARCHY',         'GOVERNMENT_DESPOTISM',          'REVERT', 'GOVERNMENT_BUREAUCRATIC_MONARCHY'),
  ('GOVERNMENT_ELECTIVE_REPUBLIC',             'GOVERNMENT_CLASSICAL_REPUBLIC', 'REVERT', 'GOVERNMENT_ELECTIVE_REPUBLIC'),
  ('GOVERNMENT_AUTHORITARIANISM',              'GOVERNMENT_OLIGARCHY',          'REVERT', 'GOVERNMENT_AUTHORITARIANISM');
DELETE FROM cc_ai_government_rules
  WHERE FromGovernment NOT IN (SELECT GovernmentType FROM Governments)
     OR ToGovernment NOT IN (SELECT GovernmentType FROM Governments)
     OR (CivicGovernment IS NOT NULL AND CivicGovernment NOT IN (SELECT GovernmentType FROM cc_government_unlocks));

-- Requirements: player is AI; player (owner) has government X; player lacks the civic of government X.
INSERT INTO Requirements (RequirementId, RequirementType, Inverse) VALUES ('CC_REQ_PLAYER_IS_AI', 'REQUIREMENT_PLAYER_IS_HUMAN', 1);
INSERT INTO Requirements (RequirementId, RequirementType)
  SELECT DISTINCT 'CC_REQ_HAS_GOV_' || FromGovernment, 'REQUIREMENT_PLAYER_HAS_GOVERNMENT' FROM cc_ai_government_rules;
INSERT INTO RequirementArguments (RequirementId, Name, Value)
  SELECT DISTINCT 'CC_REQ_HAS_GOV_' || FromGovernment, 'GovernmentType', FromGovernment FROM cc_ai_government_rules;
-- REVERT only applies in the window right after the Chiefdom pick: before the AI researches Mysticism (the
-- civic after Chiefdom). A "civic missing" condition raced with the matching SWITCH on the turn that civic
-- completed (verified in long runs 2 and 4: Egypt Oligarchy -> Plutocracy -> Oligarchy, France Classical
-- Republic -> Theocracy -> Classical Republic, both on one turn), even when repeated on the inner modifier.
-- The switch civics sit at the end of the civic tree, far from Mysticism, so the two can never coincide.
INSERT INTO Requirements (RequirementId, RequirementType, Inverse)
  VALUES ('CC_REQ_BEFORE_MYSTICISM', 'REQUIREMENT_PLAYER_HAS_COMPLETED_PROGRESSION_TREE_NODE', 1);
INSERT INTO RequirementArguments (RequirementId, Name, Value)
  VALUES ('CC_REQ_BEFORE_MYSTICISM', 'ProgressionTreeNodeType', 'NODE_CIVIC_AQ_MAIN_MYSTICISM');
INSERT INTO Requirements (RequirementId, RequirementType, Inverse)
  SELECT 'CC_REQ_NOT_GOVUNLOCK_' || GovernmentType, 'REQUIREMENT_PLAYER_HAS_COMPLETED_PROGRESSION_TREE_NODE', 1 FROM cc_government_unlocks;
INSERT INTO RequirementArguments (RequirementId, Name, Value)
  SELECT 'CC_REQ_NOT_GOVUNLOCK_' || GovernmentType, 'ProgressionTreeNodeType', ProgressionTreeNodeType FROM cc_government_unlocks;

-- Wrapper conditions (game-wide, subject = player): AI + civic condition.
INSERT INTO RequirementSets (RequirementSetId, RequirementSetType)
  SELECT 'CC_REQSET_AIW_' || FromGovernment || '_' || Kind, 'REQUIREMENTSET_TEST_ALL' FROM cc_ai_government_rules;
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId)
  SELECT 'CC_REQSET_AIW_' || FromGovernment || '_' || Kind, 'CC_REQ_PLAYER_IS_AI' FROM cc_ai_government_rules
  UNION ALL SELECT 'CC_REQSET_AIW_' || FromGovernment || '_' || Kind, 'CC_REQ_GOVUNLOCK_' || CivicGovernment
    FROM cc_ai_government_rules WHERE Kind = 'SWITCH'
  UNION ALL SELECT 'CC_REQSET_AIW_' || FromGovernment || '_' || Kind, 'CC_REQ_BEFORE_MYSTICISM'
    FROM cc_ai_government_rules WHERE Kind = 'REVERT';
-- Inner condition (player-owned): current government.
INSERT INTO RequirementSets (RequirementSetId, RequirementSetType)
  SELECT 'CC_REQSET_AIG_' || FromGovernment || '_' || Kind, 'REQUIREMENTSET_TEST_ALL' FROM cc_ai_government_rules;
-- The civic condition is repeated here: the wrapper's condition is re-evaluated later than the inner one, so
-- without it a REVERT inner (attached while the civic was missing) fired right after the matching SWITCH
-- (verified in a 150-turn run: Egypt went Oligarchy -> Plutocracy -> Oligarchy on the same turn).
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId)
  SELECT 'CC_REQSET_AIG_' || FromGovernment || '_' || Kind, 'CC_REQ_HAS_GOV_' || FromGovernment FROM cc_ai_government_rules
  UNION ALL SELECT 'CC_REQSET_AIG_' || FromGovernment || '_' || Kind, 'CC_REQ_GOVUNLOCK_' || CivicGovernment
    FROM cc_ai_government_rules WHERE Kind = 'SWITCH'
  UNION ALL SELECT 'CC_REQSET_AIG_' || FromGovernment || '_' || Kind, 'CC_REQ_BEFORE_MYSTICISM'
    FROM cc_ai_government_rules WHERE Kind = 'REVERT';

INSERT OR IGNORE INTO Types (Type, Kind) VALUES ('CC_MODTYPE_OWNER_SET_GOVERNMENT', 'KIND_MODIFIER');
INSERT OR IGNORE INTO DynamicModifiers (ModifierType, CollectionType, EffectType)
  VALUES ('CC_MODTYPE_OWNER_SET_GOVERNMENT', 'COLLECTION_OWNER', 'EFFECT_PLAYER_SET_GOVERNMENT');
INSERT OR IGNORE INTO Types (Type, Kind) VALUES ('CC_MODTYPE_MAJORS_ATTACH', 'KIND_MODIFIER');
INSERT OR IGNORE INTO DynamicModifiers (ModifierType, CollectionType, EffectType)
  VALUES ('CC_MODTYPE_MAJORS_ATTACH', 'COLLECTION_MAJOR_PLAYERS', 'EFFECT_ATTACH_MODIFIERS');

INSERT INTO Modifiers (ModifierId, ModifierType, SubjectRequirementSetId)
  SELECT 'CC_AI_SETGOV_' || FromGovernment || '_' || Kind, 'CC_MODTYPE_OWNER_SET_GOVERNMENT', 'CC_REQSET_AIG_' || FromGovernment || '_' || Kind
  FROM cc_ai_government_rules;
INSERT INTO ModifierArguments (ModifierId, Name, Value)
  SELECT 'CC_AI_SETGOV_' || FromGovernment || '_' || Kind, 'GovernmentType', ToGovernment FROM cc_ai_government_rules;
INSERT INTO Modifiers (ModifierId, ModifierType, SubjectRequirementSetId)
  SELECT 'CC_AI_GOVRULE_' || FromGovernment || '_' || Kind, 'CC_MODTYPE_MAJORS_ATTACH', 'CC_REQSET_AIW_' || FromGovernment || '_' || Kind
  FROM cc_ai_government_rules;
INSERT INTO ModifierArguments (ModifierId, Name, Value)
  SELECT 'CC_AI_GOVRULE_' || FromGovernment || '_' || Kind, 'ModifierId', 'CC_AI_SETGOV_' || FromGovernment || '_' || Kind FROM cc_ai_government_rules;
INSERT INTO GameModifiers (ModifierId) SELECT 'CC_AI_GOVRULE_' || FromGovernment || '_' || Kind FROM cc_ai_government_rules;
