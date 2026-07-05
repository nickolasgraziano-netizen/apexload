-- Cardio exercises (elliptical, stairmaster, treadmill, etc.) are logged
-- by duration + freeform intensity/style notes rather than sets of
-- reps/weight. Duration is structured (chartable later); intensity
-- varies too much per machine to model rigidly, so it stays freeform.
alter table exercises add column is_cardio boolean not null default false;
alter table sets add column duration_seconds int;
alter table sets add column notes text;
