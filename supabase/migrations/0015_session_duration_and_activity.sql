alter table sessions
  add column if not exists last_activity_at timestamptz,
  add column if not exists auto_ended_at timestamptz,
  add column if not exists end_reason text not null default 'manual',
  add column if not exists activity_type text not null default 'strength';

update sessions
set last_activity_at = coalesce(ended_at, started_at)
where last_activity_at is null;

alter table sessions
  alter column last_activity_at set default now(),
  alter column last_activity_at set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sessions_end_reason_check'
  ) then
    alter table sessions
      add constraint sessions_end_reason_check
      check (end_reason in ('manual', 'auto_inactivity', 'edited'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'sessions_activity_type_check'
  ) then
    alter table sessions
      add constraint sessions_activity_type_check
      check (activity_type in ('strength', 'cardio', 'mixed', 'mobility', 'other'));
  end if;
end $$;

create index if not exists sessions_open_last_activity_idx
  on sessions (user_id, last_activity_at)
  where ended_at is null;
