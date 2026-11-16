-- Continuous Civilization - runs first in the Modern import's text (before modern-2-dedupe.sql).
-- Modern's ResourcesText files are imported only for the tooltips of resources new to the game (Coal, Oil, ...).
-- They also re-define earlier resources' tooltips, so keep every resource tooltip loaded so far;
-- modern-3-restore-tooltips.sql puts these back after the import (Antiquity's own
-- tooltips are then restored by restore-parked-tooltips.sql, as before).
DROP TABLE IF EXISTS cc_park_modres_text;
CREATE TABLE cc_park_modres_text AS SELECT * FROM LocalizedText WHERE Tag LIKE 'LOC\_%RESOURCE%' ESCAPE '\';
