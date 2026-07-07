-- Lets a user hide any exercise (built-in or their own custom one) from
-- their personal catalog view without deleting it — safe even for
-- exercises with logged history, and doesn't affect anyone else's catalog.
create table hidden_exercises (
  user_id uuid not null references profiles(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

alter table hidden_exercises enable row level security;
create policy "hidden_exercises: owner reads/writes"
  on hidden_exercises for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
