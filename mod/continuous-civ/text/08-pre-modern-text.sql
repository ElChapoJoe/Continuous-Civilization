-- Continuous Civilization - runs first in the Modern import's text (before 09-dedupe-cc-import-modern-text.sql).
-- Modern's ResourcesText files are imported only for the tooltips of resources new to the game (Coal, Oil, ...).
-- They also re-define earlier resources' tooltips, so keep every resource tooltip loaded so far;
-- 09-restore-modern-resources-text.sql puts these back after the import (Antiquity's own
-- tooltips are then restored by 55-restore-parked-text.sql, as before).
DROP TABLE IF EXISTS cc_park_modres_text;
CREATE TABLE cc_park_modres_text AS SELECT * FROM LocalizedText WHERE Tag LIKE 'LOC\_%RESOURCE%' ESCAPE '\';
