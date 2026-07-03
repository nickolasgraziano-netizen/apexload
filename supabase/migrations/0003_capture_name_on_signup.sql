-- Capture the display name entered at signup (passed via
-- auth.signUp({ options: { data: { full_name } } })) instead of always
-- falling back to the account's email.
--
-- Also fixes a latent bug in the original trigger: SECURITY DEFINER
-- functions don't reliably inherit the caller's search_path, so the
-- unqualified table references here could fail to resolve depending on
-- how the trigger is invoked (this only surfaced once a real signup went
-- through the auth service rather than being created directly).

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));

  insert into public.user_rotation (user_id, muscle_group_id, sort_order)
    select new.id, mg.id, x.ord
    from (values
      ('Legs & Lower Body', 1), ('Chest', 2), ('Shoulders', 3),
      ('Biceps & Triceps', 4), ('Back', 5)
    ) as x(group_name, ord)
    join public.muscle_groups mg on mg.name = x.group_name;

  return new;
end;
$$;
