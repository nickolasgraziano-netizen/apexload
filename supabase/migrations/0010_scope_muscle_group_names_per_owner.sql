-- The global UNIQUE(name) constraint on muscle_groups blocked custom
-- (per-user) groups from sharing a name with anyone else's private group,
-- even though RLS hides other users' custom groups from you entirely — so
-- two different users both naming a group "Cardio" would silently fail
-- whichever one created it second, with no visible error (the insert just
-- doesn't return a row). Scope uniqueness to match visibility: global
-- groups unique among themselves, custom groups unique per owner.
alter table muscle_groups drop constraint muscle_groups_name_key;

create unique index muscle_groups_global_name_idx on muscle_groups (name) where is_global = true;
create unique index muscle_groups_owner_name_idx on muscle_groups (owner_id, name) where is_global = false;
