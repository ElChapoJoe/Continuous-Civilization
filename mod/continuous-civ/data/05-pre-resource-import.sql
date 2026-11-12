-- Continuous Civilization - runs inside cc-import-exploration, right before Exploration's resource GameEffects
-- files. Records the modifier ids that exist at that point, so 60-resources.sql can tell which modifiers the
-- resource import added.
DROP TABLE IF EXISTS cc_pre_res_mods;
CREATE TABLE cc_pre_res_mods AS SELECT ModifierId FROM Modifiers;
