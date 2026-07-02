-- ApexLoad core schema
-- Apply via the Supabase MCP connector (apply_migration), the Supabase CLI
-- (`supabase db push`), or paste directly into the SQL editor.

create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES (extends auth.users; also doubles as future "is_trainer" flag holder)
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
create policy "profiles: user reads/writes own row"
  on profiles for all using (auth.uid() = id) with check (auth.uid() = id);
-- allow reading a trainer's/client's own counterpart display name later if needed
create policy "profiles: linked trainer or client can read display name"
  on profiles for select using (
    id = auth.uid()
    or exists (select 1 from trainer_clients tc where tc.status = 'active'
      and ((tc.trainer_id = auth.uid() and tc.client_id = profiles.id)
        or (tc.client_id = auth.uid() and tc.trainer_id = profiles.id)))
  );

-- ============================================================
-- MUSCLE GROUPS: global shared taxonomy (NOT user-owned).
-- Every user references these same rows; per-user ordering lives in
-- user_rotation below. This is what lets the global exercise catalog
-- classify exercises without depending on any one user's private data.
-- ============================================================
create table muscle_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,             -- "Legs & Lower Body", "Chest", ...
  is_global boolean not null default true
);

create table sub_muscles (
  id uuid primary key default gen_random_uuid(),
  muscle_group_id uuid not null references muscle_groups(id) on delete cascade,
  name text not null
);

-- readable by everyone (signed-in), not user-scoped
alter table muscle_groups enable row level security;
alter table sub_muscles enable row level security;
create policy "muscle_groups: readable by any authenticated user"
  on muscle_groups for select using (auth.role() = 'authenticated');
create policy "sub_muscles: readable by any authenticated user"
  on sub_muscles for select using (auth.role() = 'authenticated');

-- ============================================================
-- USER ROTATION: each user's personal ordering through the muscle groups.
-- Defaults to the 5-group split below but is fully editable per user,
-- and users can add/remove groups from their own cycle.
-- ============================================================
create table user_rotation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  muscle_group_id uuid not null references muscle_groups(id),
  sort_order int not null,
  created_at timestamptz not null default now(),
  unique (user_id, sort_order),
  unique (user_id, muscle_group_id)
);

alter table user_rotation enable row level security;
create policy "user_rotation: owner only"
  on user_rotation for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- EXERCISES (global catalog + user custom exercises)
-- ============================================================
create table exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade, -- null = global catalog
  muscle_group_id uuid not null references muscle_groups(id),
  sub_muscle_id uuid references sub_muscles(id) on delete set null,
  name text not null,
  is_custom boolean not null default false,
  default_rest_seconds int not null default 90,
  created_at timestamptz not null default now()
);
create index exercises_muscle_group_idx on exercises (muscle_group_id);
create index exercises_owner_idx on exercises (owner_id);

alter table exercises enable row level security;
create policy "exercises: read global catalog or own custom exercises"
  on exercises for select
  using (owner_id is null or owner_id = auth.uid());
create policy "exercises: insert own custom exercises"
  on exercises for insert
  with check (owner_id = auth.uid() and is_custom = true);
create policy "exercises: update own custom exercises"
  on exercises for update using (owner_id = auth.uid());
create policy "exercises: delete own custom exercises"
  on exercises for delete using (owner_id = auth.uid());

-- ============================================================
-- EXERCISE ALTERNATIVES (self-referencing link, e.g. DB Bench <-> Chest Press Machine)
-- ============================================================
create table exercise_alternatives (
  exercise_id uuid not null references exercises(id) on delete cascade,
  alternative_exercise_id uuid not null references exercises(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  primary key (exercise_id, alternative_exercise_id, user_id)
);

alter table exercise_alternatives enable row level security;
create policy "exercise_alternatives: owner only"
  on exercise_alternatives for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- TRAINER / CLIENT RELATIONSHIPS (schema ready now, PT UI later)
-- ============================================================
create type trainer_relationship_status as enum ('pending', 'active', 'revoked');

create table trainer_clients (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references profiles(id) on delete cascade,
  client_id uuid not null references profiles(id) on delete cascade,
  status trainer_relationship_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (trainer_id, client_id)
);

alter table trainer_clients enable row level security;
create policy "trainer_clients: either party can view"
  on trainer_clients for select
  using (auth.uid() = trainer_id or auth.uid() = client_id);
create policy "trainer_clients: client controls the relationship status"
  on trainer_clients for update using (auth.uid() = client_id);
create policy "trainer_clients: trainer can initiate request"
  on trainer_clients for insert with check (auth.uid() = trainer_id);

create or replace function is_active_trainer_of(client uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from trainer_clients
    where trainer_id = auth.uid() and client_id = client and status = 'active'
  );
$$;

-- ============================================================
-- MACHINE PHOTOS (private by default; explicit opt-in for trainer visibility)
-- ============================================================
create table machine_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  exercise_id uuid references exercises(id) on delete set null,
  storage_path text not null,            -- object path in 'machine-photos' bucket
  visible_to_trainer boolean not null default false,
  created_at timestamptz not null default now()
);

alter table machine_photos enable row level security;
create policy "machine_photos: owner reads/writes"
  on machine_photos for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "machine_photos: trainer can view if shared"
  on machine_photos for select
  using (visible_to_trainer and is_active_trainer_of(user_id));

-- ============================================================
-- SESSIONS (one per workout)
-- ============================================================
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  muscle_group_id uuid not null references muscle_groups(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  time_budget_minutes int,               -- set if the user used the hard time-limit override
  created_at timestamptz not null default now()
);
create index sessions_user_started_idx on sessions (user_id, started_at desc);

alter table sessions enable row level security;
create policy "sessions: owner only"
  on sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sessions: linked trainer can view"
  on sessions for select using (is_active_trainer_of(user_id));

-- ============================================================
-- SETS (individual logged sets; training_variant isolates TUT vs standard)
-- ============================================================
create type training_variant as enum ('standard', 'tut');
create type set_difficulty as enum ('easy', 'moderate', 'difficult', 'failed');

create table sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  training_variant training_variant not null default 'standard',
  set_number int not null,
  target_reps int not null default 15,
  actual_reps int,
  weight numeric(6,2),
  weight_unit text not null default 'lb',
  difficulty set_difficulty,
  logged_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table sets enable row level security;
create policy "sets: owner only"
  on sets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sets: linked trainer can view"
  on sets for select using (is_active_trainer_of(user_id));

create index sets_user_exercise_variant_idx
  on sets (user_id, exercise_id, training_variant, logged_at desc);
create index sets_session_idx on sets (session_id);

-- ============================================================
-- ASSIGNED WORKOUT PLANS (schema ready for future PT mode)
-- ============================================================
create table assigned_plans (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references profiles(id) on delete cascade,
  client_id uuid not null references profiles(id) on delete cascade,
  muscle_group_id uuid not null references muscle_groups(id),
  notes text,
  created_at timestamptz not null default now()
);

alter table assigned_plans enable row level security;
create policy "assigned_plans: trainer or client can view"
  on assigned_plans for select using (auth.uid() = trainer_id or auth.uid() = client_id);
create policy "assigned_plans: trainer creates for an active client"
  on assigned_plans for insert
  with check (auth.uid() = trainer_id and is_active_trainer_of(client_id));

-- ============================================================
-- STORAGE: private bucket for machine photos, folder-scoped by user id
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('machine-photos', 'machine-photos', false)
  on conflict (id) do nothing;

create policy "machine photo files: owner manages own folder"
  on storage.objects for all
  using (bucket_id = 'machine-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'machine-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- SEED: global muscle group taxonomy + sub-muscles + starter catalog
-- ============================================================
insert into muscle_groups (name) values
  ('Legs & Lower Body'), ('Chest'), ('Shoulders'), ('Biceps & Triceps'), ('Back');

insert into sub_muscles (muscle_group_id, name)
  select id, sub.name from muscle_groups, lateral (values
    ('Legs & Lower Body', 'Quads'), ('Legs & Lower Body', 'Hamstrings'),
    ('Legs & Lower Body', 'Glutes'), ('Legs & Lower Body', 'Calves'),
    ('Chest', 'Upper Chest'), ('Chest', 'Mid Chest'), ('Chest', 'Lower Chest'),
    ('Shoulders', 'Front Delt'), ('Shoulders', 'Side Delt'), ('Shoulders', 'Rear Delt'),
    ('Biceps & Triceps', 'Biceps'), ('Biceps & Triceps', 'Triceps'),
    ('Back', 'Lats'), ('Back', 'Traps'), ('Back', 'Lower Back')
  ) as sub(group_name, name)
  where muscle_groups.name = sub.group_name;

insert into exercises (owner_id, muscle_group_id, sub_muscle_id, name, is_custom, default_rest_seconds)
  select null, mg.id, sm.id, x.name, false, x.rest
  from (values
    ('Legs & Lower Body', 'Quads', 'Barbell Back Squat', 120),
    ('Legs & Lower Body', 'Quads', 'Leg Press', 90),
    ('Legs & Lower Body', 'Hamstrings', 'Romanian Deadlift', 120),
    ('Legs & Lower Body', 'Hamstrings', 'Leg Curl Machine', 60),
    ('Legs & Lower Body', 'Glutes', 'Walking Lunge', 60),
    ('Legs & Lower Body', 'Calves', 'Standing Calf Raise', 60),
    ('Chest', 'Upper Chest', 'Incline Dumbbell Press', 90),
    ('Chest', 'Mid Chest', 'Barbell Bench Press', 120),
    ('Chest', 'Mid Chest', 'Chest Press Machine', 90),
    ('Chest', 'Lower Chest', 'Decline Cable Fly', 60),
    ('Chest', 'Mid Chest', 'Push-Up', 60),
    ('Shoulders', 'Front Delt', 'Overhead Barbell Press', 90),
    ('Shoulders', 'Side Delt', 'Dumbbell Lateral Raise', 60),
    ('Shoulders', 'Rear Delt', 'Rear Delt Fly', 60),
    ('Biceps & Triceps', 'Biceps', 'Barbell Curl', 60),
    ('Biceps & Triceps', 'Biceps', 'Hammer Curl', 60),
    ('Biceps & Triceps', 'Triceps', 'Tricep Rope Pushdown', 60),
    ('Biceps & Triceps', 'Triceps', 'Skull Crusher', 60),
    ('Back', 'Lats', 'Pull-Up', 120),
    ('Back', 'Lats', 'Lat Pulldown', 90),
    ('Back', 'Traps', 'Barbell Row', 90),
    ('Back', 'Lower Back', 'Seated Cable Row', 90),
    ('Back', 'Traps', 'Face Pull', 60)
  ) as x(group_name, sub_name, name, rest)
  join muscle_groups mg on mg.name = x.group_name
  join sub_muscles sm on sm.muscle_group_id = mg.id and sm.name = x.sub_name;

-- ============================================================
-- AUTO-SEED: create profile + default rotation for every new signup
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, display_name) values (new.id, new.email);

  insert into user_rotation (user_id, muscle_group_id, sort_order)
    select new.id, mg.id, x.ord
    from (values
      ('Legs & Lower Body', 1), ('Chest', 2), ('Shoulders', 3),
      ('Biceps & Triceps', 4), ('Back', 5)
    ) as x(group_name, ord)
    join muscle_groups mg on mg.name = x.group_name;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
