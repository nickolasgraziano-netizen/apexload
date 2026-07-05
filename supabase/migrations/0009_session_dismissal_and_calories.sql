-- Lets a lifter manually hide an unfinished session from Home without
-- ending it (they can still resume it from History for a few days).
alter table sessions add column dismissed_at timestamptz;

-- Calories burned, tracked alongside duration/notes for cardio entries.
alter table sets add column calories int;
