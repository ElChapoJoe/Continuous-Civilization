-- Continuous Civilization - runs BEFORE the Exploration import (LoadOrder 400), before 00-pre-dedupe.sql.
-- 1) Remember which units/constructibles already existed, so later steps can tell what was imported.
-- 2) Back up Antiquity "global" balance rows that Exploration's constructibles-no-persist.xml overrides;
--    50-restore-antiquity-globals.sql puts them back. All cc_* tables are dropped in 99-cleanup.sql.

DROP TABLE IF EXISTS cc_pre_units;
DROP TABLE IF EXISTS cc_pre_constructibles;
DROP TABLE IF EXISTS cc_bak_worker_yields;
DROP TABLE IF EXISTS cc_bak_worker_yields_age;
DROP TABLE IF EXISTS cc_bak_constructible_yields;

DROP TABLE IF EXISTS cc_pre_warehouse;
DROP TABLE IF EXISTS cc_pre_adjacency;
CREATE TABLE cc_pre_units          AS SELECT UnitType FROM Units;
CREATE TABLE cc_pre_constructibles AS SELECT ConstructibleType FROM Constructibles;
CREATE TABLE cc_pre_warehouse      AS SELECT ID FROM Warehouse_YieldChanges;
CREATE TABLE cc_pre_adjacency      AS SELECT ID FROM Adjacency_YieldChanges;

CREATE TABLE cc_bak_worker_yields      AS SELECT * FROM WorkerYields;
CREATE TABLE cc_bak_worker_yields_age  AS SELECT * FROM WorkerYields_AgeModifier;
CREATE TABLE cc_bak_constructible_yields AS SELECT * FROM Constructible_YieldChanges;
