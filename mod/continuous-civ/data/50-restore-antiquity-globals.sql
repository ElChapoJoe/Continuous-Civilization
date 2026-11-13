-- Continuous Civilization - undo the global (non-building-specific) overrides that Exploration's
-- constructibles-no-persist.xml applies (worker yields, Palace / City Hall yields). The per-building data
-- from that file (University modifiers, tags, warehouse yields of Exploration buildings) is kept.

DELETE FROM WorkerYields;
INSERT INTO WorkerYields SELECT * FROM cc_bak_worker_yields;

DELETE FROM WorkerYields_AgeModifier;
INSERT INTO WorkerYields_AgeModifier SELECT * FROM cc_bak_worker_yields_age;

-- Constructible_YieldChanges: restore every row that existed before the import to its Antiquity value
-- (the import only UPDATEs Palace / City Hall and INSERTs rows for new Exploration buildings).
INSERT OR REPLACE INTO Constructible_YieldChanges SELECT * FROM cc_bak_constructible_yields;

-- Diplomacy: shared actions keep Antiquity's costs and responses; actions new to Exploration and Modern keep theirs.
INSERT OR REPLACE INTO DiplomaticActionInfluenceCosts SELECT * FROM cc_bak_dip_costs;
INSERT OR REPLACE INTO DiplomaticActionResponses SELECT * FROM cc_bak_dip_responses;
INSERT OR REPLACE INTO DiplomaticActionResponseModifiers SELECT * FROM cc_bak_dip_response_mods;
INSERT OR REPLACE INTO DiplomacyFavorsGrievancesEventsData SELECT * FROM cc_bak_dip_grievances;
