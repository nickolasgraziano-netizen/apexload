-- Distance covered, tracked alongside duration/calories for cardio entries.
-- Miles, one total per logged entry (no per-interval splits).
alter table sets add column distance_miles numeric;
