-- Low/high interval structure for a cardio entry (e.g. "2 min low / 2 min
-- high x 6 rounds"), stored as JSON since it's descriptive metadata shown
-- alongside a cardio entry rather than a value that feeds aggregate stats.
alter table sets add column interval_data jsonb;
