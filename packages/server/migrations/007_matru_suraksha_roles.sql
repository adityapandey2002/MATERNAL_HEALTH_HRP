-- 007_matru_suraksha_roles.sql
-- Matru Suraksha role hierarchy and the single 15-day follow-up cycle.
--
-- The standalone HELPDESK role becomes HRP_HELPDESK_BLOCK, the district
-- helpdesk joins as HRP_HELPDESK_DISTRICT, and the three old follow-up tracks
-- collapse into the block-owned first cycle and the repeating field cycle.

-- ---------------------------------------------------------------------------
-- Users: retire HELPDESK, add the two HRP helpdesk tiers
-- ---------------------------------------------------------------------------

-- 006 named the constraint explicitly; a database that skipped it may still
-- carry an auto-generated name, so find any check that mentions HELPDESK.
do $$
declare
  existing_constraint text;
begin
  for existing_constraint in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'users'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%HELPDESK%'
  loop
    execute format('alter table users drop constraint %I', existing_constraint);
  end loop;
end $$;

update users
set role = 'HRP_HELPDESK_BLOCK',
    updated_at = now()
where role = 'HELPDESK';

alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (
    role in (
      'ANM',
      'CHO',
      'HRP_HELPDESK_BLOCK',
      'BHM',
      'HRP_HELPDESK_DISTRICT',
      'DHS'
    )
    or (is_active = false and role in ('ASHA', 'STATE_ADMIN'))
  );

-- ---------------------------------------------------------------------------
-- Follow-ups: schedule stages instead of the old PMSMA/VHSND tracks
-- ---------------------------------------------------------------------------

-- 005 defined the track check inline, so its name is auto-generated.
do $$
declare
  existing_constraint text;
begin
  for existing_constraint in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'follow_ups'
      and con.contype = 'c'
      and (
        pg_get_constraintdef(con.oid) like '%IMMEDIATE_7_DAYS%'
        or pg_get_constraintdef(con.oid) like '%PMSMA_SESSION%'
      )
  loop
    execute format('alter table follow_ups drop constraint %I', existing_constraint);
  end loop;
end $$;

update follow_ups
set track = case track
  when 'IMMEDIATE_7_DAYS' then 'BLOCK_15_DAY'
  else 'FIELD_15_DAY'
end
where track in ('IMMEDIATE_7_DAYS', 'PMSMA_SESSION', 'VHSND_COMMUNITY');

update patients
set follow_up_track = case follow_up_track
  when 'IMMEDIATE_7_DAYS' then 'BLOCK_15_DAY'
  else 'FIELD_15_DAY'
end
where follow_up_track in ('IMMEDIATE_7_DAYS', 'PMSMA_SESSION', 'VHSND_COMMUNITY');

alter table follow_ups drop constraint if exists follow_ups_track_check;
alter table follow_ups add constraint follow_ups_track_check
  check (track in ('BLOCK_15_DAY', 'FIELD_15_DAY'));

-- Overdue and escalation views filter on both columns together.
create index if not exists idx_follow_ups_scheduled_status
  on follow_ups (scheduled_date, status);
