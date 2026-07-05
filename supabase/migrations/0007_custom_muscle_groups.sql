-- Let users create their own groups (e.g. "Cardio", "Elliptical", "Stair
-- Climber") alongside the global taxonomy, so exercises/workouts aren't
-- limited to the built-in muscle groups. Mirrors how custom exercises
-- already work (owner_id null = global, is_custom-style flag = is_global).
alter table muscle_groups add column owner_id uuid references profiles(id) on delete cascade;

drop policy "muscle_groups: readable by any authenticated user" on muscle_groups;
create policy "muscle_groups: read global or own custom groups"
  on muscle_groups for select
  using (is_global = true or owner_id = auth.uid());
create policy "muscle_groups: insert own custom groups"
  on muscle_groups for insert
  with check (owner_id = auth.uid() and is_global = false);
create policy "muscle_groups: delete own custom groups"
  on muscle_groups for delete using (owner_id = auth.uid());
