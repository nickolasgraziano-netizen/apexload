-- Freeform notes on a workout session (e.g. how it felt, gym conditions,
-- anything the lifter wants to remember) and on a saved template.
alter table sessions add column notes text;
alter table workout_templates add column notes text;
