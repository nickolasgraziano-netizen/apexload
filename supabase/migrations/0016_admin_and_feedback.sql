begin;

-- Roles and access are deliberately separate from user-editable profiles.
create table public.admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_members enable row level security;
create function public.is_apex_admin() returns boolean language sql stable security definer
set search_path = '' as $$ select exists(select 1 from public.admin_members where user_id = auth.uid()); $$;
revoke all on function public.is_apex_admin() from public;
grant execute on function public.is_apex_admin() to authenticated;
create policy "admin membership: own read" on public.admin_members for select to authenticated using(user_id=auth.uid());
insert into public.admin_members(user_id)
select id from auth.users where id='508dce3c-0047-4268-bcaa-ebe8adba4896' and lower(email)='nickolas.graziano@gmail.com';
do $$ begin if not exists(select 1 from public.admin_members) then raise exception 'Verified owner account not found'; end if; end $$;

create table public.account_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 status text not null check(status in ('active','pending','suspended','revoked')),
 updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
alter table public.account_access enable row level security;
create policy "access: own or admin read" on public.account_access for select to authenticated using(user_id=auth.uid() or public.is_apex_admin());
create function public.apex_access_allowed() returns boolean language sql stable security definer
set search_path = '' as $$ select auth.uid() is not null and not exists(select 1 from public.account_access where user_id=auth.uid() and status <> 'active'); $$;
revoke all on function public.apex_access_allowed() from public;
grant execute on function public.apex_access_allowed() to authenticated, anon;

create table public.app_features (
 key text primary key check(key in ('feedback','shared_templates','announcements')),
 audience text not null default 'everyone' check(audience in ('off','admin','everyone')),
 updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
alter table public.app_features enable row level security;
create policy "features: signed in read" on public.app_features for select to authenticated using(public.apex_access_allowed());
insert into public.app_features(key) values('feedback'),('shared_templates'),('announcements');
create function public.apex_feature_enabled(feature text) returns boolean language sql stable security definer set search_path = '' as $$
 select public.apex_access_allowed() and exists(select 1 from public.app_features where key=feature and (audience='everyone' or (audience='admin' and public.is_apex_admin())));
$$;
revoke all on function public.apex_feature_enabled(text) from public;
grant execute on function public.apex_feature_enabled(text) to authenticated;

create table public.feedback_reports (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 category text not null check(category in ('issue','idea')),
 title text not null check(length(trim(title)) between 1 and 120),
 description text not null check(length(trim(description)) between 1 and 4000),
 screen text not null check(length(screen) <= 200), platform text not null check(length(platform)<=40),
 app_version text not null check(length(app_version)<=40), screenshot_path text,
 status text not null default 'new' check(status in ('new','reviewing','planned','resolved')),
 priority text not null default 'normal' check(priority in ('low','normal','high')),
 admin_note text not null default '' check(length(admin_note)<=2000),
 updated_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index feedback_reports_recent on public.feedback_reports(created_at desc);
alter table public.feedback_reports enable row level security;
create policy "feedback: own or admin read" on public.feedback_reports for select to authenticated using(user_id=auth.uid() or public.is_apex_admin());
-- Submissions go through a validating server endpoint. Users cannot set triage fields.

create table public.admin_invitations (
 id uuid primary key default gen_random_uuid(), email text not null, display_name text not null,
 user_id uuid references auth.users(id), message text not null default '',
 status text not null default 'sending' check(status in ('sending','pending','accepted','revoked','failed')),
 expires_at timestamptz not null default (now()+interval '7 days'), sent_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id), delivery_error text
);
create unique index invitation_open_email on public.admin_invitations(lower(email)) where status in ('sending','pending');
alter table public.admin_invitations enable row level security;
create policy "invitations: admin read" on public.admin_invitations for select to authenticated using(public.is_apex_admin());

alter table public.exercises add column equipment text not null default '', add column instructions text not null default '', add column demonstration_url text not null default '', add column updated_by uuid references auth.users(id);
create table public.shared_workout_templates (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 120),
 description text not null default '' check(length(description)<=1500), exercise_ids uuid[] not null check(cardinality(exercise_ids) between 1 and 50),
 published boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
alter table public.shared_workout_templates enable row level security;
create policy "shared templates: published or admin" on public.shared_workout_templates for select to authenticated using(public.is_apex_admin() or (published and public.apex_feature_enabled('shared_templates')));
create table public.app_content (
 key text primary key check(key in ('announcement','encouragement')), title text not null default '' check(length(title)<=120),
 body text not null default '' check(length(body)<=1500), published boolean not null default false,
 updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
alter table public.app_content enable row level security;
create policy "content: published or admin" on public.app_content for select to authenticated using(public.is_apex_admin() or (published and public.apex_feature_enabled('announcements')));
insert into public.app_content(key) values('announcement'),('encouragement');
create table public.admin_activity (
 id bigint generated always as identity primary key, actor_id uuid references auth.users(id),
 action text not null, entity text not null, entity_id text not null, created_at timestamptz not null default now()
);
alter table public.admin_activity enable row level security;
create policy "activity: admin read" on public.admin_activity for select to authenticated using(public.is_apex_admin());
create function public.audit_apex_admin() returns trigger language plpgsql security definer set search_path='' as $$
declare rowdata jsonb; actor uuid;
begin
 rowdata=to_jsonb(new); actor=(rowdata->>'updated_by')::uuid;
 if auth.role() is distinct from 'service_role' then actor=auth.uid(); end if;
 if not exists(select 1 from public.admin_members where user_id=actor) then actor=null; end if;
 if actor is not null then
  insert into public.admin_activity(actor_id,action,entity,entity_id) values(actor,
   lower(TG_OP)||coalesce(': '||(rowdata->>'status'), ': '||(rowdata->>'audience'), ''),TG_TABLE_NAME,coalesce(rowdata->>'id',rowdata->>'key',rowdata->>'user_id'));
 end if;
 return new;
end $$;
revoke all on function public.audit_apex_admin() from public;
do $$ declare t text; begin
 foreach t in array array['account_access','app_features','feedback_reports','admin_invitations','shared_workout_templates','app_content','exercises'] loop
  execute format('create trigger audit_admin_change after insert or update on public.%I for each row execute function public.audit_apex_admin()',t);
 end loop;
end $$;

-- Restrictive policies compose with all existing owner/trainer policies.
-- Existing JWTs cannot bypass an account pause by calling PostgREST directly.
do $$ declare t text; begin
 foreach t in array array['profiles','muscle_groups','sub_muscles','user_rotation','exercises','exercise_alternatives','trainer_clients','machine_photos','sessions','sets','assigned_plans','workout_templates','workout_template_exercises','workout_template_superset_groups','workout_template_superset_group_exercises','superset_groups','superset_group_exercises','hidden_exercises','feedback_reports','admin_invitations','app_features','shared_workout_templates','app_content','admin_activity'] loop
  if to_regclass('public.'||t) is not null then
   execute format('create policy "account access required" on public.%I as restrictive for all to public using(public.apex_access_allowed()) with check(public.apex_access_allowed())',t);
  end if;
 end loop;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('feedback-screenshots','feedback-screenshots',false,5242880,array['image/png','image/jpeg','image/webp']);
-- Only server service credentials upload/read screenshots; signed URLs expire in 5 minutes.
create policy "storage requires active account" on storage.objects as restrictive for all to authenticated
using(public.apex_access_allowed()) with check(public.apex_access_allowed());

create function public.copy_shared_workout(template uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare source public.shared_workout_templates; copied uuid;
begin
 if not public.apex_feature_enabled('shared_templates') then raise exception 'Shared templates are unavailable'; end if;
 select * into source from public.shared_workout_templates where id=template and published;
 if not found then raise exception 'Template not found'; end if;
 if exists(select 1 from unnest(source.exercise_ids) x left join public.exercises e on e.id=x where e.id is null or e.owner_id is not null) then raise exception 'Template contains unavailable exercises'; end if;
 insert into public.workout_templates(user_id,name,notes) values(auth.uid(),source.name,source.description) returning id into copied;
 insert into public.workout_template_exercises(template_id,exercise_id,position) select copied,x.id,x.ord-1 from unnest(source.exercise_ids) with ordinality x(id,ord);
 return copied;
end $$;
revoke all on function public.copy_shared_workout(uuid) from public;
grant execute on function public.copy_shared_workout(uuid) to authenticated;

create function public.gate_invited_user() returns trigger language plpgsql security definer set search_path='' as $$
declare invitation uuid;
begin
 select id into invitation from public.admin_invitations where id::text=new.raw_user_meta_data->>'apex_invitation_id' and lower(email)=lower(new.email) and status='sending';
 if invitation is not null then
  insert into public.account_access(user_id,status) values(new.id,'pending');
  update public.admin_invitations set user_id=new.id where id=invitation;
 end if;
 return new;
end $$;
revoke all on function public.gate_invited_user() from public;
create trigger apex_invited_user after insert on auth.users for each row execute function public.gate_invited_user();
create function public.accept_apex_invitation() returns void language plpgsql security definer set search_path='' as $$
declare invitation public.admin_invitations;
begin
 select * into invitation from public.admin_invitations where user_id=auth.uid() and status='pending' for update;
 if not found or invitation.expires_at <= now() then raise exception 'Invitation expired or revoked'; end if;
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and lower(email)=lower(invitation.email)) then raise exception 'Verify the invited email first'; end if;
 if not exists(select 1 from public.account_access where user_id=auth.uid() and status='pending') then raise exception 'Account is not awaiting setup'; end if;
 update public.admin_invitations set status='accepted',updated_at=now(),updated_by=null where id=invitation.id;
 update public.account_access set status='active',updated_at=now(),updated_by=null where user_id=auth.uid();
end $$;
revoke all on function public.accept_apex_invitation() from public;
grant execute on function public.accept_apex_invitation() to authenticated;
create function public.revoke_apex_invitation(invitation_id uuid,actor uuid) returns void language plpgsql security definer set search_path='' as $$
declare invitation public.admin_invitations;
begin
 if not exists(select 1 from public.admin_members where user_id=actor) then raise exception 'Admin required'; end if;
 select * into invitation from public.admin_invitations where id=invitation_id for update;
 if not found or invitation.status not in ('pending','failed') then raise exception 'Invitation cannot be revoked'; end if;
 update public.admin_invitations set status='revoked',updated_by=actor,updated_at=now() where id=invitation_id;
 if invitation.user_id is not null then update public.account_access set status='revoked',updated_by=actor,updated_at=now() where user_id=invitation.user_id and status='pending'; end if;
end $$;
revoke all on function public.revoke_apex_invitation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.revoke_apex_invitation(uuid,uuid) to service_role;

create function public.apex_invitation_info() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('message',message,'expires_at',expires_at,'display_name',display_name) from public.admin_invitations
 where user_id=auth.uid() and status='pending' and expires_at>now();
$$;
revoke all on function public.apex_invitation_info() from public;
grant execute on function public.apex_invitation_info() to authenticated;

-- Prevent future grants/default privileges from exposing privileged writes.
revoke all on public.admin_members,public.account_access,public.feedback_reports,public.admin_invitations,public.app_features,public.shared_workout_templates,public.app_content,public.admin_activity from anon,authenticated;
grant select on public.admin_members,public.account_access,public.feedback_reports,public.admin_invitations,public.app_features,public.shared_workout_templates,public.app_content,public.admin_activity to authenticated;
commit;
