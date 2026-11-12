-- Continuous Civilization - put back the Antiquity resource tooltips parked by 00-pre-dedupe-text.sql
-- (Exploration's ResourcesText files are imported only for the tooltips of resources new to Antiquity).
INSERT OR REPLACE INTO LocalizedText SELECT * FROM cc_park_text;
DROP TABLE IF EXISTS cc_park_text;
