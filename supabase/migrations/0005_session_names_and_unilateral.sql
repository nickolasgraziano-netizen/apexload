-- Custom, user-editable name for a workout/session (separate from the
-- muscle group or template name it might already show).
alter table sessions add column name text;

-- Unilateral exercises (trained one side at a time, e.g. single-arm
-- pulldown) — flagged on the exercise itself, with each logged set
-- recording which side it was.
alter table exercises add column is_unilateral boolean not null default false;
alter table sets add column side text check (side in ('left', 'right'));
