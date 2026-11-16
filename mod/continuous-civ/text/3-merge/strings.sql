-- Continuous Civilization - the mod's own strings (en_US): government chooser (ui/cc-governments.js), per-Age combat
-- preview lines (72/74 rules), Culture victory wonder lines (80-triumphs), building over older buildings
-- (ui/cc-overbuild.js) and the Dedications tree and popup (83-dedications, ui/cc-dedication*.js).
INSERT OR REPLACE INTO LocalizedText (Language, Tag, Text) VALUES
  ('en_US', 'LOC_CC_CHANGE_GOVERNMENT', 'Change Government'),
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
  ('en_US', 'LOC_CC_OVERBUILD_FAILED', 'The {1_NewName} could not be placed on this tile, so the {2_OldName} was put back.'),
  ('en_US', 'LOC_CC_ATTRIBUTE_DEDICATION', 'Dedications'),
  ('en_US', 'LOC_CC_ATTRIBUTE_DEDICATION_DESCRIPTION', 'Major Triumphs unlock Dedications. You get 3 Dedication points when you enter your personal Exploration Age and 3 more in your Modern Age. Antiquity Triumphs'' Dedications can be chosen from Exploration on, Exploration Triumphs'' from Modern on.'),
  ('en_US', 'LOC_CC_DEDICATION_POPUP_TITLE', 'Choose Dedications'),
  ('en_US', 'LOC_CC_DEDICATION_POPUP_INTRO', 'Your Major Triumphs have earned these Dedications. Choose up to {1_Num} more. Any you skip stay available on the Dedications tab of the attribute screen.'),
  ('en_US', 'LOC_CC_DEDICATION_POPUP_FROM', 'From {1_Name: upper}'),
  ('en_US', 'LOC_CC_DEDICATION_POPUP_CONFIRM', 'Confirm'),
  ('en_US', 'LOC_CC_DEDICATION_POPUP_CONFIRM_NONE', 'Select a Dedication'),
  ('en_US', 'LOC_CC_DEDICATION_POPUP_LATER', 'Later');
