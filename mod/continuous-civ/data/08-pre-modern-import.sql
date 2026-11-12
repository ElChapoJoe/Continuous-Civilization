-- Continuous Civilization - snapshot before the Modern import (first item of cc-import-modern).
-- 30-buildings.sql and 40-units.sql gate what each import adds; this tells Exploration's additions (present
-- now) from Modern's (added after this file).
DROP TABLE IF EXISTS cc_pre_modern_units;
CREATE TABLE cc_pre_modern_units AS SELECT UnitType FROM Units;
DROP TABLE IF EXISTS cc_pre_modern_constructibles;
CREATE TABLE cc_pre_modern_constructibles AS SELECT ConstructibleType FROM Constructibles;
