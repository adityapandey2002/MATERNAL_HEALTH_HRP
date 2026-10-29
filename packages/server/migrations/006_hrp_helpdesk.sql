-- 006_hrp_helpdesk.sql
-- HRP Helpdesk staff accounts provisioned by the Block Nodal authority.
--
-- Helpdesk operators sign in with an email address instead of an employee ID,
-- so users get a nullable, case-insensitively unique email column.

alter table users add column if not exists email varchar(120);

create unique index if not exists users_email_unique
  on users (lower(email))
  where email is not null;

alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (
    role in ('ANM', 'CHO', 'BHM', 'DHS', 'HELPDESK')
    or (is_active = false and role in ('ASHA', 'STATE_ADMIN'))
  );

-- Dispatch creates one follow-up per patient, so the block panel filters by
-- both the assignee and the track.
create index if not exists idx_follow_ups_assigned_track
  on follow_ups (assigned_to_user_id, track);
