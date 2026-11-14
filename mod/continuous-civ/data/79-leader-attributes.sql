-- Continuous Civilization - leader attribute points for each new personal Age (audit #7).
-- In vanilla each leader gets attribute points for its favoured attributes at every Age transition: the leader
-- traits TRAIT_LEADER_ATTRIBUTE_* carry MOD_TRAIT_LEADER_ATTRIBUTE_* (base-standard/data/attributes.xml), and each
-- Age's attributes-gameeffects.xml defines them (Exploration +1, Modern +2, one-off). Ibn Battuta's ability
-- (IBN_BATTUTA_MOD_WILDCARD_ATTRIBUTE) adds 4 Wildcard points in Exploration and 6 in Modern. Only Antiquity's
-- definitions load here, and those are "do nothing" placeholders, so these points never arrived.
-- CC_ copies with the Exploration and Modern amounts, attached to the same traits and granted once when the player
-- enters that personal Age (owner condition, permanent).

INSERT OR IGNORE INTO Types (Type, Kind) VALUES ('CC_MODTYPE_OWNER_ATTRIBUTE', 'KIND_MODIFIER');
INSERT OR IGNORE INTO DynamicModifiers (ModifierType, CollectionType, EffectType)
  VALUES ('CC_MODTYPE_OWNER_ATTRIBUTE', 'COLLECTION_OWNER', 'EFFECT_PLAYER_ATTRIBUTE');

-- Tunable: points per favoured attribute in each personal Age, and Ibn Battuta's Wildcard points.
DROP TABLE IF EXISTS cc_age_attributes;
CREATE TABLE cc_age_attributes (ModifierId TEXT PRIMARY KEY, TraitType TEXT, AttributeType TEXT, Amount INTEGER, AgeSet TEXT);
INSERT INTO cc_age_attributes (ModifierId, TraitType, AttributeType, Amount, AgeSet)
  SELECT 'CC_' || a.Age || '_ATTR_' || t.Attr, 'TRAIT_LEADER_ATTRIBUTE_' || t.Attr, 'ATTRIBUTE_' || t.Attr, a.Amount, a.AgeSet
  FROM (SELECT 'CULTURAL' AS Attr UNION ALL SELECT 'POLITICAL' UNION ALL SELECT 'ECONOMIC' UNION ALL SELECT 'EXPANSIONIST'
        UNION ALL SELECT 'MILITARISTIC' UNION ALL SELECT 'SCIENTIFIC' UNION ALL SELECT 'WILDCARD') t
  CROSS JOIN (SELECT 'EX' AS Age, 1 AS Amount, 'CC_REQSET_PERSONAL_AGE_EXPLORATION' AS AgeSet
              UNION ALL SELECT 'MO', 2, 'CC_REQSET_PERSONAL_AGE_MODERN') a;
INSERT INTO cc_age_attributes (ModifierId, TraitType, AttributeType, Amount, AgeSet) VALUES
  ('CC_EX_IBN_BATTUTA_WILDCARD', 'TRAIT_LEADER_IBN_BATTUTA_ABILITY', 'ATTRIBUTE_WILDCARD', 4, 'CC_REQSET_PERSONAL_AGE_EXPLORATION'),
  ('CC_MO_IBN_BATTUTA_WILDCARD', 'TRAIT_LEADER_IBN_BATTUTA_ABILITY', 'ATTRIBUTE_WILDCARD', 6, 'CC_REQSET_PERSONAL_AGE_MODERN');
DELETE FROM cc_age_attributes WHERE TraitType NOT IN (SELECT TraitType FROM Traits)
  OR AttributeType NOT IN (SELECT AttributeType FROM Attributes);

INSERT INTO Modifiers (ModifierId, ModifierType, OwnerRequirementSetId, Permanent)
  SELECT ModifierId, 'CC_MODTYPE_OWNER_ATTRIBUTE', AgeSet, 1 FROM cc_age_attributes;
INSERT INTO ModifierArguments (ModifierId, Name, Value)
  SELECT ModifierId, 'AttributeType', AttributeType FROM cc_age_attributes
  UNION ALL SELECT ModifierId, 'Amount', CAST(Amount AS TEXT) FROM cc_age_attributes;
INSERT INTO TraitModifiers (TraitType, ModifierId) SELECT TraitType, ModifierId FROM cc_age_attributes;
