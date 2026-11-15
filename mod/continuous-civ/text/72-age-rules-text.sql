-- Continuous Civilization - text for the per-Age rules in 72 and 74 (combat preview lines), and the Culture victory
-- lines for Exploration and Modern wonders (80-triumphs.sql), and building over older buildings (ui/cc-overbuild.js).
INSERT OR REPLACE INTO LocalizedText (Language, Tag, Text) VALUES
  ('en_US', 'LOC_CC_EX_EMBARKED_STRENGTH_PREVIEW', '+15 Embarked (Exploration Age)'),
  ('en_US', 'LOC_CC_MO_EMBARKED_STRENGTH_PREVIEW', '+30 Embarked (Modern Age)'),
  ('en_US', 'LOC_CC_VICTORY_WONDER_EXPLORATION_NAME', 'Exploration Age Wonder'),
  ('en_US', 'LOC_CC_VICTORY_WONDER_MODERN_NAME', 'Modern Age Wonder'),
  ('en_US', 'LOC_CC_OVERBUILD_BODY', 'The {1_OldName} is from an earlier Age. It will be removed now to make room for the {2_NewName}.'),
  ('en_US', 'LOC_CC_OVERBUILD_CONFIRM', 'Replace'),
  ('en_US', 'LOC_CC_OVERBUILD_CHOOSE_TITLE', 'Which Building to Replace?'),
  ('en_US', 'LOC_CC_OVERBUILD_CHOOSE_BODY', 'Both buildings on this tile are from an earlier Age. Choose the one the {1_NewName} will replace; the panel then shows the result.'),
  ('en_US', 'LOC_CC_OVERBUILD_REPLACE', 'Replace {1_OldName}'),
  ('en_US', 'LOC_CC_OVERBUILD_FAILED_TITLE', 'Building Not Placed'),
  ('en_US', 'LOC_CC_OVERBUILD_FAILED', 'The {1_NewName} could not be placed on this tile, so the {2_OldName} was put back.');
