-- Continuous Civilization - text for the Dedications attribute tree (data/83-dedications.sql).
INSERT OR REPLACE INTO LocalizedText (Language, Tag, Text) VALUES
  ('en_US', 'LOC_CC_ATTRIBUTE_DEDICATION', 'Dedications'),
  ('en_US', 'LOC_CC_ATTRIBUTE_DEDICATION_DESCRIPTION', 'Major Triumphs unlock Dedications. You get 3 Dedication points when you enter your personal Exploration Age and 3 more in your Modern Age. Antiquity Triumphs'' Dedications can be chosen from Exploration on, Exploration Triumphs'' from Modern on.');
INSERT OR REPLACE INTO LocalizedText (Language, Tag, Text) VALUES
  ('en_US', 'LOC_CC_DEDICATION_POPUP_TITLE', 'Choose Dedications'),
  ('en_US', 'LOC_CC_DEDICATION_POPUP_INTRO', 'Your Major Triumphs have earned these Dedications. Choose up to {1_Num} more. Any you skip stay available on the Dedications tab of the attribute screen.'),
  ('en_US', 'LOC_CC_DEDICATION_POPUP_FROM', 'From {1_Name: upper}'),
  ('en_US', 'LOC_CC_DEDICATION_POPUP_CONFIRM', 'Confirm'),
  ('en_US', 'LOC_CC_DEDICATION_POPUP_CONFIRM_NONE', 'Select a Dedication'),
  ('en_US', 'LOC_CC_DEDICATION_POPUP_LATER', 'Later');
