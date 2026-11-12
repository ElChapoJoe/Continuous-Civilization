-- Continuous Civilization - Age clock (validated in Phase 1).
-- EndsAge = 0      : reaching max progress never ends the Age (verified live: 14 turns past max, no transition).
-- MaxPoints huge   : engine adds a hard-coded +1/turn; with 1,000,000 the meter stays ~0%, so the
--                    end-of-age countdown, warning popups and %-based crises never trigger.
-- Event points = 0 : legacy milestones / Future Tech no longer advance the clock.
UPDATE AgeProgressions
   SET EndsAge = 0,
       MaxPoints_Abbreviated = 1000000,
       MaxPoints_Standard    = 1000000,
       MaxPoints_Long        = 1000000;
UPDATE AgeProgressionEvents SET Points = 0;
UPDATE AgeProgressionEventMapSizeOverrides SET Points = 0;
