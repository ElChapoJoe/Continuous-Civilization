-- Continuous Civilization - Exploration Age rules, per player, from their personal Age.
-- In vanilla these come with the common trait every Exploration civilization has (TRAIT_EXPLORATION_CIV in
-- civilizations-exploration.xml). Nobody changes civilization here, so they are attached to each major player
-- once that player is "in Exploration" (70-personal-age.sql: any Exploration root tech researched).
-- Definitions come from the imported Exploration civilizations-common-gameeffects.xml and tech gameeffects.
-- Left out: Age-transition "advanced start" bonuses, free ship and advanced-start GDP (they reward entering a new Age).
-- Phase 3: as in vanilla, where a civ loses its Exploration trait at the Modern transition, most rules end once the
-- player is in their personal Modern Age (EndsAtModern = 1); 74-modern-rules.sql attaches the Modern ones.

-- Tunable: Exploration rules switched on per player.
DROP TABLE IF EXISTS cc_exploration_rules;
CREATE TABLE cc_exploration_rules (ModifierId TEXT PRIMARY KEY, EndsAtModern INTEGER NOT NULL DEFAULT 1);
INSERT INTO cc_exploration_rules (ModifierId) VALUES
  ('MOD_TECH_OCEAN_TRAVEL'),                      -- naval units may enter Deep Ocean (nothing else grants it here)
  ('MOD_EX_DEEP_OCEAN_TRADE'),                    -- trade units safe on deep water
  ('MOD_EXPLORATION_EMBARKATION'),                -- land units embark onto shallow water (Antiquity: rivers)
  ('TRAIT_MOD_BAZAAR_RESOURCE_CAP'),              -- +1 resource slot with a Bazaar
  ('TRAIT_MOD_WHARF_RESOURCE_CAP'),               -- +2 resource slots with a Wharf
  ('TRAIT_MOD_EXPLORATION_CIV_DIPLOMACY_TOKENS'), -- +2 envoys
  ('TRAIT_MOD_DEFAULT_YIELD_20'),                 -- base +20 Science, Culture, Influence (Antiquity: +10)
  ('CC_EX_DEFAULT_GOLD_10'),                      -- base +10 Gold (Antiquity: +5); defined below
  ('TRAIT_MOD_GOLD_INSTANCE_COUNT'),              -- Gold and Silver count per instance
  ('TRAIT_MOD_SILVER_INSTANCE_COUNT'),
  ('TRAIT_MOD_TOWN_TRADE_PROJECT'),               -- trade focus for Distant Lands towns
  ('TRAIT_AI_SIGHT'),                             -- AI naval units +1 sight (as for AI Exploration civs)
  ('CC_EX_SETTLEMENT_CAP');                       -- settlement cap at least 8 (Antiquity: 3); defined below
-- Economic victory scoring ("GDP"): switches on the victory point trackers every Exploration civ has. Modern civs
-- have the same four, so they stay on.
INSERT INTO cc_exploration_rules (ModifierId, EndsAtModern) VALUES
  ('TRAIT_BONUS_RESOURCE_GDP', 0),                -- slotted bonus resources
  ('TRAIT_CITY_RESOURCE_GDP', 0),                 -- slotted city resources
  ('TRAIT_GOLD_BUILDING_GDP', 0),                 -- Gold buildings
  ('TRAIT_IMPORTED_RESOURCE_GDP', 0);             -- imported resources

-- Exploration's own +10 Gold modifier re-uses the id TRAIT_MOD_DEFAULT_YIELD_10, which Antiquity uses for its
-- +10 Science/Culture/Influence (Antiquity keeps its version), so the Gold one is a CC_ copy.
INSERT INTO Modifiers (ModifierId, ModifierType)
  SELECT 'CC_EX_DEFAULT_GOLD_10', ModifierType FROM Modifiers WHERE ModifierId = 'TRAIT_MOD_DEFAULT_YIELD_5';
INSERT INTO ModifierArguments (ModifierId, Name, Value) VALUES
  ('CC_EX_DEFAULT_GOLD_10', 'YieldType', 'YIELD_GOLD'), ('CC_EX_DEFAULT_GOLD_10', 'Amount', '10'),
  ('CC_EX_DEFAULT_GOLD_10', 'Tooltip', 'LOC_DEFAULT_YIELD');

-- Each Age's settlement cap re-uses the id TRAIT_INITIAL_SETTLEMENT_CAP, and Antiquity keeps its version (+3; it is
-- parked and put back in 55), so Exploration's ("at least 8") is a CC_ copy. Found missing in Phase 3: before this,
-- no player ever got Exploration's cap.
INSERT INTO Modifiers (ModifierId, ModifierType)
  SELECT 'CC_EX_SETTLEMENT_CAP', ModifierType FROM Modifiers WHERE ModifierId = 'TRAIT_INITIAL_SETTLEMENT_CAP';
INSERT INTO ModifierArguments (ModifierId, Name, Value) VALUES
  ('CC_EX_SETTLEMENT_CAP', 'Amount', '8'), ('CC_EX_SETTLEMENT_CAP', 'Minimum', 'true');

-- Values vanilla keeps in the global Ages table (base-standard/data/ages.xml), raised per player instead (audit #5,
-- #6). They stay through Modern (EndsAtModern = 0); 74-modern-rules.sql adds Modern's step on top.
--   Trade route range, land/sea: Antiquity 10/30, Exploration 15/45, Modern 20/60 -> +5 land, +15 sea here.
--   Embarked land unit strength: Antiquity 5, Exploration 20, Modern 50 -> +15 here.
INSERT OR IGNORE INTO Types (Type, Kind) VALUES
  ('CC_MODTYPE_CITIES_TRADE_RANGE', 'KIND_MODIFIER'), ('CC_MODTYPE_PLAYER_EMBARKED_STRENGTH', 'KIND_MODIFIER');
INSERT OR IGNORE INTO DynamicModifiers (ModifierType, CollectionType, EffectType) VALUES
  ('CC_MODTYPE_CITIES_TRADE_RANGE', 'COLLECTION_PLAYER_CITIES', 'EFFECT_CITY_ADJUST_TRADE_ROUTE_RANGE'),
  ('CC_MODTYPE_PLAYER_EMBARKED_STRENGTH', 'COLLECTION_PLAYER_COMBAT', 'EFFECT_ADJUST_UNIT_EMBARKED_STRENGTH_MODIFIER');
INSERT INTO Modifiers (ModifierId, ModifierType) VALUES
  ('CC_EX_TRADE_RANGE_LAND', 'CC_MODTYPE_CITIES_TRADE_RANGE'), ('CC_EX_TRADE_RANGE_SEA', 'CC_MODTYPE_CITIES_TRADE_RANGE'),
  ('CC_EX_EMBARKED_STRENGTH', 'CC_MODTYPE_PLAYER_EMBARKED_STRENGTH');
INSERT INTO ModifierArguments (ModifierId, Name, Value) VALUES
  ('CC_EX_TRADE_RANGE_LAND', 'DomainType', 'DOMAIN_LAND'), ('CC_EX_TRADE_RANGE_LAND', 'Amount', '5'),
  ('CC_EX_TRADE_RANGE_SEA', 'DomainType', 'DOMAIN_SEA'), ('CC_EX_TRADE_RANGE_SEA', 'Amount', '15'),
  ('CC_EX_EMBARKED_STRENGTH', 'Amount', '15');
INSERT INTO ModifierStrings (ModifierId, Context, Text) VALUES
  ('CC_EX_EMBARKED_STRENGTH', 'Preview', 'LOC_CC_EX_EMBARKED_STRENGTH_PREVIEW');
INSERT INTO cc_exploration_rules (ModifierId, EndsAtModern) VALUES
  ('CC_EX_TRADE_RANGE_LAND', 0), ('CC_EX_TRADE_RANGE_SEA', 0), ('CC_EX_EMBARKED_STRENGTH', 0);

DELETE FROM cc_exploration_rules WHERE ModifierId NOT IN (SELECT ModifierId FROM Modifiers);

-- Wrappers: game-wide, attach each rule to every major player in their personal Exploration.
INSERT INTO Modifiers (ModifierId, ModifierType, SubjectRequirementSetId)
  SELECT 'CC_EXRULE_' || ModifierId, 'CC_MODTYPE_MAJORS_ATTACH', 'CC_REQSET_TEST_IN_EXPLORATION' FROM cc_exploration_rules;
-- Rules that end at Modern: the attached (player-owned) modifier itself checks "not in Modern" and is not
-- permanent, so it switches off when the player enters Modern (as done for Antiquity's base yields below).
-- A rule that already has its own subject condition gets a new set: "its condition AND not in Modern".
INSERT INTO Requirements (RequirementId, RequirementType)
  SELECT 'CC_REQ_EXRULE_' || m.ModifierId, 'REQUIREMENT_REQUIREMENTSET_IS_MET'
  FROM Modifiers m JOIN cc_exploration_rules r ON r.ModifierId = m.ModifierId
  WHERE r.EndsAtModern = 1 AND m.SubjectRequirementSetId IS NOT NULL;
INSERT INTO RequirementArguments (RequirementId, Name, Value)
  SELECT 'CC_REQ_EXRULE_' || m.ModifierId, 'RequirementSetId', m.SubjectRequirementSetId
  FROM Modifiers m JOIN cc_exploration_rules r ON r.ModifierId = m.ModifierId
  WHERE r.EndsAtModern = 1 AND m.SubjectRequirementSetId IS NOT NULL;
INSERT INTO RequirementSets (RequirementSetId, RequirementSetType)
  SELECT 'CC_REQSET_EXRULE_' || m.ModifierId, 'REQUIREMENTSET_TEST_ALL'
  FROM Modifiers m JOIN cc_exploration_rules r ON r.ModifierId = m.ModifierId
  WHERE r.EndsAtModern = 1 AND m.SubjectRequirementSetId IS NOT NULL;
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId)
  SELECT 'CC_REQSET_EXRULE_' || m.ModifierId, 'CC_REQ_EXRULE_' || m.ModifierId
  FROM Modifiers m JOIN cc_exploration_rules r ON r.ModifierId = m.ModifierId
  WHERE r.EndsAtModern = 1 AND m.SubjectRequirementSetId IS NOT NULL;
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId)
  SELECT 'CC_REQSET_EXRULE_' || m.ModifierId, 'CC_REQ_NOT_IN_MODERN'
  FROM Modifiers m JOIN cc_exploration_rules r ON r.ModifierId = m.ModifierId
  WHERE r.EndsAtModern = 1 AND m.SubjectRequirementSetId IS NOT NULL;
UPDATE Modifiers SET SubjectRequirementSetId = 'CC_REQSET_EXRULE_' || ModifierId, Permanent = 0
  WHERE ModifierId IN (SELECT ModifierId FROM cc_exploration_rules WHERE EndsAtModern = 1)
    AND SubjectRequirementSetId IS NOT NULL;
-- Rules without a condition just get "not in Modern".
UPDATE Modifiers SET SubjectRequirementSetId = 'CC_REQSET_NOT_IN_MODERN', Permanent = 0
  WHERE ModifierId IN (SELECT ModifierId FROM cc_exploration_rules WHERE EndsAtModern = 1)
    AND SubjectRequirementSetId IS NULL;
INSERT INTO ModifierArguments (ModifierId, Name, Value)
  SELECT 'CC_EXRULE_' || ModifierId, 'ModifierId', ModifierId FROM cc_exploration_rules;
INSERT INTO GameModifiers (ModifierId) SELECT 'CC_EXRULE_' || ModifierId FROM cc_exploration_rules;

-- Antiquity's base yields (+5 Gold, +10 Science/Culture/Influence) end once a player is in Exploration, where
-- the Exploration ones above take over (as when a vanilla civ changes Age). Not permanent, so they detach.
INSERT INTO Requirements (RequirementId, RequirementType, Inverse) VALUES ('CC_REQ_NOT_IN_EXPLORATION', 'REQUIREMENT_REQUIREMENTSET_IS_MET', 1);
INSERT INTO RequirementArguments (RequirementId, Name, Value) VALUES ('CC_REQ_NOT_IN_EXPLORATION', 'RequirementSetId', 'CC_REQSET_PERSONAL_AGE_EXPLORATION');
INSERT INTO RequirementSets (RequirementSetId, RequirementSetType) VALUES ('CC_REQSET_NOT_IN_EXPLORATION', 'REQUIREMENTSET_TEST_ALL');
INSERT INTO RequirementSetRequirements (RequirementSetId, RequirementId) VALUES ('CC_REQSET_NOT_IN_EXPLORATION', 'CC_REQ_NOT_IN_EXPLORATION');
UPDATE Modifiers SET SubjectRequirementSetId = 'CC_REQSET_NOT_IN_EXPLORATION', Permanent = 0
  WHERE ModifierId IN ('TRAIT_MOD_DEFAULT_YIELD_5', 'TRAIT_MOD_DEFAULT_YIELD_10') AND SubjectRequirementSetId IS NULL;

-- Antiquity makes Ocean invalid terrain for every unit of every player (AGE_ANTIQUITY_MOD_OCEAN_TERRAIN_INVALID, a
-- PlayerModifiers row in advanced-start.xml). Vanilla drops it with the Age; here it never ended, so the deep-water
-- embarkation from Cartography (civilians, commanders) and Shipbuilding mastery (all land units) had no effect and
-- land units could not cross Ocean. It now ends once the player is in Exploration, where vanilla's own rules take
-- over (naval units: MOD_TECH_OCEAN_TRAVEL above; land units: embarkation from the techs). The condition is on the
-- owner (the player): the subjects are units, and "player has tech" is only reliable on a player.
-- Found by beta testers (v0.1.0-beta).
UPDATE Modifiers SET OwnerRequirementSetId = 'CC_REQSET_NOT_IN_EXPLORATION', Permanent = 0
  WHERE ModifierId = 'AGE_ANTIQUITY_MOD_OCEAN_TERRAIN_INVALID' AND OwnerRequirementSetId IS NULL;

-- Distant Lands. While the game Age is Antiquity the engine closes the Distant Lands (land that needs an Ocean
-- crossing from the player's capital, mostly the other hemisphere) to everyone: land units can't enter or be placed
-- there, no plot there is a valid settlement spot, and civilizations there can't be met, so their leaders never
-- appear in the diplomacy ribbon. The switch is the Ages column NoVictoriesSecondaryHemisphere (only Antiquity has it
-- on; verified live: with it off, settle spots and meetings across the Ocean work). There is no per-player version
-- (Tonga's "meet Distant Lands civs" effect only covers meeting, not land), so it is off for everyone. Players still
-- need their personal Exploration to cross Ocean (above), so in practice only islands reachable along the Coast open
-- up earlier than in vanilla. Found by beta testers (v0.1.0-beta).
UPDATE Ages SET NoVictoriesSecondaryHemisphere = 0 WHERE AgeType = 'AGE_ANTIQUITY';
