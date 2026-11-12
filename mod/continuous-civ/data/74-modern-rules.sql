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

DELETE FROM cc_modern_rules WHERE ModifierId NOT IN (SELECT ModifierId FROM Modifiers);

-- Wrappers: game-wide, attach each rule to every major player in their personal Modern Age.
INSERT INTO Modifiers (ModifierId, ModifierType, SubjectRequirementSetId)
  SELECT 'CC_MORULE_' || ModifierId, 'CC_MODTYPE_MAJORS_ATTACH', 'CC_REQSET_TEST_IN_MODERN' FROM cc_modern_rules;
INSERT INTO ModifierArguments (ModifierId, Name, Value)
  SELECT 'CC_MORULE_' || ModifierId, 'ModifierId', ModifierId FROM cc_modern_rules;
INSERT INTO GameModifiers (ModifierId) SELECT 'CC_MORULE_' || ModifierId FROM cc_modern_rules;
