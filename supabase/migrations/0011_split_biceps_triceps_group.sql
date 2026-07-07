-- "Biceps & Triceps" was one combined global group; split it into two so
-- they can be picked/filtered independently. Reuse the existing group's id
-- as "Biceps" (renaming in place, so nothing referencing it by id — old
-- sessions, user_rotation rows, etc. — breaks), and create a new global
-- "Triceps" group, moving the actually-triceps exercises (and the
-- "Triceps" sub_muscle row) over to it by name.
update muscle_groups set name = 'Biceps' where id = '7f8bf9cc-6095-422b-ac7a-a1fbd90a854d';

insert into muscle_groups (id, name, is_global, owner_id)
values (gen_random_uuid(), 'Triceps', true, null);

do $$
declare
  triceps_id uuid;
begin
  select id into triceps_id from muscle_groups where name = 'Triceps' and is_global = true;

  update exercises
  set muscle_group_id = triceps_id
  where muscle_group_id = '7f8bf9cc-6095-422b-ac7a-a1fbd90a854d'
    and name in (
      'BB Skull Crusher', 'Cable Rope Extension', 'Cable Rope Pushdown',
      'Close-Grip Bench Press', 'DB Tricep Kickback',
      'Overhead Tricep Extension', 'Skull Crusher', 'Tricep Dip',
      'Tricep Rope Pushdown'
    );

  update sub_muscles
  set muscle_group_id = triceps_id
  where muscle_group_id = '7f8bf9cc-6095-422b-ac7a-a1fbd90a854d'
    and name = 'Triceps';
end $$;
