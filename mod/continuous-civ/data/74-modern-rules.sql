-- Continuous Civilization - Modern Age rules, per player, from their personal Modern Age (Phase 3.3).
-- In vanilla these come with the common trait every Modern civilization has (TRAIT_MODERN_CIV in
-- civilizations-modern.xml). Same technique as 72-exploration-rules.sql: game-wide wrappers attach each rule to
-- every major player once they are "in Modern" (70-personal-age.sql: any Modern root tech researched).
-- Definitions come from the imported Modern civilizations-common-gameeffects.xml and tech gameeffects.
-- Left out: Age-transition "advanced start" bonuses; rules every Age's civ trait already has (settlement-cap
-- penalty, influence for conquered/razed settlements, flanking, town farming/fishing/growth/urban projects);
-- civ-specific ones (Staatseisenbahn, Ortoo). Economic victory scoring carries on from 72.

-- Tunable: Modern rules switched on per player.
DROP TABLE IF EXISTS cc_modern_rules;
CREATE TABLE cc_modern_rules (ModifierId TEXT PRIMARY KEY);
INSERT INTO cc_modern_rules VALUES
  ('MOD_MODERN_OCEAN_TRAVEL'),                  -- naval units in Deep Ocean (replaces Exploration's)
  ('MOD_MODERN_EMBARKATION'),                   -- land units embark (replaces Exploration's)
  ('MOD_TECH_MO_EMBARKATION'),
  ('TRAIT_MOD_MODERN_CIV_DIPLOMACY_TOKENS'),    -- envoys (replaces Exploration's +2)
  ('TRAIT_MOD_DEPARTMENT_STORE_RESOURCE_CAP'),  -- resource slots with a Department Store
  ('TRAIT_MOD_PORT_RESOURCE_CAP'),              -- resource slots with a Port
  ('TRAIT_MOD_FACTORY_RESOURCE_CAP'),           -- resource slots with a Factory
  ('TRAIT_MOD_DEFAULT_YIELD_15'),               -- base +15 Gold (Exploration: +10)
  ('TRAIT_MOD_DEFAULT_YIELD_30'),               -- base +30 Science, Culture, Influence (Exploration: +20)
  ('TRAIT_MOD_TOWN_FACTORY_PROJECT'),           -- Factory Town focus
  ('TRAIT_MOD_IDEOLOGIES_AGENDA'),              -- AI ideology agendas
  ('DIPLOMACY_MOD_UNLOCK_COUNTER_SPY'),         -- counter-espionage action
  ('CC_MO_SETTLEMENT_CAP');                     -- settlement cap at least 16 (Exploration: 8); defined below

-- Modern's settlement cap re-uses the id TRAIT_INITIAL_SETTLEMENT_CAP (Antiquity keeps its version), so it is a CC_ copy.
INSERT INTO Modifiers (ModifierId, ModifierType)
  SELECT 'CC_MO_SETTLEMENT_CAP', ModifierType FROM Modifiers WHERE ModifierId = 'TRAIT_INITIAL_SETTLEMENT_CAP';
INSERT INTO ModifierArguments (ModifierId, Name, Value) VALUES
  ('CC_MO_SETTLEMENT_CAP', 'Amount', '16'), ('CC_MO_SETTLEMENT_CAP', 'Minimum', 'true');

-- Modern's step of the per-Age values in the global Ages table (types defined in 72; audit #5, #6), on top of
-- Exploration's: trade route range +5 land, +15 sea (to 20/60); embarked land unit strength +30 (to 50).
INSERT INTO Modifiers (ModifierId, ModifierType) VALUES
  ('CC_MO_TRADE_RANGE_LAND', 'CC_MODTYPE_CITIES_TRADE_RANGE'), ('CC_MO_TRADE_RANGE_SEA', 'CC_MODTYPE_CITIES_TRADE_RANGE'),
  ('CC_MO_EMBARKED_STRENGTH', 'CC_MODTYPE_PLAYER_EMBARKED_STRENGTH');
INSERT INTO ModifierArguments (ModifierId, Name, Value) VALUES
  ('CC_MO_TRADE_RANGE_LAND', 'DomainType', 'DOMAIN_LAND'), ('CC_MO_TRADE_RANGE_LAND', 'Amount', '5'),
  ('CC_MO_TRADE_RANGE_SEA', 'DomainType', 'DOMAIN_SEA'), ('CC_MO_TRADE_RANGE_SEA', 'Amount', '15'),
  ('CC_MO_EMBARKED_STRENGTH', 'Amount', '30');
INSERT INTO ModifierStrings (ModifierId, Context, Text) VALUES
  ('CC_MO_EMBARKED_STRENGTH', 'Preview', 'LOC_CC_MO_EMBARKED_STRENGTH_PREVIEW');
INSERT INTO cc_modern_rules VALUES ('CC_MO_TRADE_RANGE_LAND'), ('CC_MO_TRADE_RANGE_SEA'), ('CC_MO_EMBARKED_STRENGTH');

-- Modern's step of the city balance (types and values in 72): growth -230%, specialist cap +3, town upgrades 3x
-- in total.
INSERT INTO Modifiers (ModifierId, ModifierType) VALUES
  ('CC_MO_GROWTH', 'CC_MODTYPE_CITIES_GROWTH'), ('CC_MO_WORKER_CAP', 'CC_MODTYPE_CITIES_WORKER_CAP'),
  ('CC_MO_TOWN_UPGRADE', 'CC_MODTYPE_CITIES_TOWN_UPGRADE');
INSERT INTO ModifierArguments (ModifierId, Name, Value) VALUES
  ('CC_MO_GROWTH', 'Percent', '-140'), ('CC_MO_WORKER_CAP', 'Amount', '2'),
  ('CC_MO_TOWN_UPGRADE', 'Percent', '-100');
INSERT INTO cc_modern_rules VALUES ('CC_MO_GROWTH'), ('CC_MO_WORKER_CAP'), ('CC_MO_TOWN_UPGRADE');

-- AI difficulty bonuses of Modern (age-modern/data/difficulties.xml): +20% yields and production for the AI, and
-- free Defensive Fortifications (after Military Science, by difficulty), by personal Modern Age (see 72).
DELETE FROM TraitModifiers WHERE ModifierId LIKE 'MO_HANDICAP_%' AND TraitType = 'TRAIT_LEADER_MAJOR_CIV';
INSERT INTO cc_modern_rules SELECT ModifierId FROM Modifiers WHERE ModifierId LIKE 'MO_HANDICAP_%';

DELETE FROM cc_modern_rules WHERE ModifierId NOT IN (SELECT ModifierId FROM Modifiers);

-- Wrappers: game-wide, attach each rule to every major player in their personal Modern Age.
INSERT INTO Modifiers (ModifierId, ModifierType, SubjectRequirementSetId)
  SELECT 'CC_MORULE_' || ModifierId, 'CC_MODTYPE_MAJORS_ATTACH', 'CC_REQSET_TEST_IN_MODERN' FROM cc_modern_rules;
INSERT INTO ModifierArguments (ModifierId, Name, Value)
  SELECT 'CC_MORULE_' || ModifierId, 'ModifierId', ModifierId FROM cc_modern_rules;
INSERT INTO GameModifiers (ModifierId) SELECT 'CC_MORULE_' || ModifierId FROM cc_modern_rules;
-- Cost steps follow the world Age (see 72-exploration-rules.sql).
UPDATE Modifiers SET SubjectRequirementSetId = 'CC_REQSET_WORLD_IN_MODERN'
  WHERE ModifierId IN ('CC_MORULE_CC_MO_GROWTH', 'CC_MORULE_CC_MO_TOWN_UPGRADE');
