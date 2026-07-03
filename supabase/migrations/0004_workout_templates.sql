-- Workout templates: a reusable, named exercise list (with optional
-- superset pairings) a user can save from a real workout and relaunch
-- later. Deliberately muscle-group-agnostic — a template can span the
-- whole body in one session, so it sits outside the rotation/"Suggested
-- for today" system entirely rather than trying to fit into it.

alter table sessions
  alter column muscle_group_id drop not null;

create table workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table workout_templates enable row level security;
create policy "workout_templates: owner only"
  on workout_templates for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table workout_template_exercises (
  template_id uuid not null references workout_templates(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  position int not null,
  primary key (template_id, exercise_id)
);

alter table workout_template_exercises enable row level security;
create policy "workout_template_exercises: owner only (via template)"
  on workout_template_exercises for all
  using (exists (
    select 1 from workout_templates t
    where t.id = workout_template_exercises.template_id and t.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from workout_templates t
    where t.id = workout_template_exercises.template_id and t.user_id = auth.uid()
  ));

create table workout_template_superset_groups (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references workout_templates(id) on delete cascade
);

alter table workout_template_superset_groups enable row level security;
create policy "workout_template_superset_groups: owner only (via template)"
  on workout_template_superset_groups for all
  using (exists (
    select 1 from workout_templates t
    where t.id = workout_template_superset_groups.template_id and t.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from workout_templates t
    where t.id = workout_template_superset_groups.template_id and t.user_id = auth.uid()
  ));

create table workout_template_superset_group_exercises (
  group_id uuid not null references workout_template_superset_groups(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  position int not null,
  primary key (group_id, exercise_id)
);

alter table workout_template_superset_group_exercises enable row level security;
create policy "workout_template_superset_group_exercises: owner only (via template)"
  on workout_template_superset_group_exercises for all
  using (exists (
    select 1 from workout_template_superset_groups g
    join workout_templates t on t.id = g.template_id
    where g.id = workout_template_superset_group_exercises.group_id and t.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from workout_template_superset_groups g
    join workout_templates t on t.id = g.template_id
    where g.id = workout_template_superset_group_exercises.group_id and t.user_id = auth.uid()
  ));

-- Track which template (if any) launched a session, and let templates be
-- deleted without deleting the sessions they created.
alter table sessions
  add column template_id uuid references workout_templates(id) on delete set null;
