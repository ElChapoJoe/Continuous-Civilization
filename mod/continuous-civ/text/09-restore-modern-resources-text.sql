-- Continuous Civilization - last in the Modern import's text: keep Modern's tooltips only for
-- resources that had none, and put every earlier resource tooltip back (snapshot in 08-pre-modern-text.sql).
INSERT OR REPLACE INTO LocalizedText SELECT * FROM cc_park_modres_text;
DROP TABLE IF EXISTS cc_park_modres_text;
