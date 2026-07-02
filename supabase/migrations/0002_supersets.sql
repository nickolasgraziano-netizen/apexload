-- Supersets: 2-3 exercises linked into a rotating cycle within a session.
-- Rest timing is derived at the app layer (short between exercises in a
-- cycle, long after completing a full round) rather than stored — only the
-- grouping itself and which cycle each set belonged to are persisted.

create table superset_groups (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index superset_groups_session_idx on superset_groups (session_id);

alter table superset_groups enable row level security;
create policy "superset_groups: owner only"
  on superset_groups for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table superset_group_exercises (
  group_id uuid not null references superset_groups(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  position int not null,
  primary key (group_id, exercise_id)
);

alter table superset_group_exercises enable row level security;
create policy "superset_group_exercises: owner only (via group)"
  on superset_group_exercises for all
  using (exists (
    select 1 from superset_groups g
    where g.id = superset_group_exercises.group_id and g.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from superset_groups g
    where g.id = superset_group_exercises.group_id and g.user_id = auth.uid()
  ));

alter table sets
  add column superset_group_id uuid references superset_groups(id) on delete set null,
  add column superset_cycle int;
create index sets_superset_group_idx on sets (superset_group_id);
