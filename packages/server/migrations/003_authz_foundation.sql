alter table facilities drop constraint if exists facilities_level_check;
alter table facilities add constraint facilities_level_check
  check (level in ('STATE', 'DISTRICT', 'BLOCK', 'CHC', 'PHC', 'HWC', 'HSC', 'VILLAGE'));

alter table users drop constraint if exists users_role_check;
update users set role = 'BHM' where role = 'MO';
update users set role = 'DHS' where role = 'DISTRICT_ADMIN';
update users set is_active = false where role in ('ASHA', 'STATE_ADMIN');
alter table users add constraint users_role_check
  check (
    role in ('ANM', 'CHO', 'BHM', 'DHS')
    or (is_active = false and role in ('ASHA', 'STATE_ADMIN'))
  );

create table if not exists responsibilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  responsibility varchar(40) not null,
  scope_facility_id uuid not null references facilities(id),
  granted_by uuid not null references users(id),
  granted_at timestamptz not null default now(),
  constraint responsibilities_type_check
    check (responsibility in ('REFERRAL_NODAL')),
  constraint responsibilities_user_type_scope_key
    unique (user_id, responsibility, scope_facility_id)
);

create index if not exists idx_responsibilities_user on responsibilities (user_id);
create index if not exists idx_responsibilities_scope on responsibilities (scope_facility_id);
create index if not exists idx_responsibilities_type on responsibilities (responsibility);

update sync_queue
set facility_id = patients.facility_id
from patients
where sync_queue.facility_id is null
  and sync_queue.entity_type = 'PATIENT'
  and patients.id = sync_queue.entity_id;

update sync_queue
set facility_id = visits.facility_id
from visits
where sync_queue.facility_id is null
  and sync_queue.entity_type = 'VISIT'
  and visits.id = sync_queue.entity_id;

update sync_queue
set facility_id = referrals.from_facility_id
from referrals
where sync_queue.facility_id is null
  and sync_queue.entity_type = 'REFERRAL'
  and referrals.id = sync_queue.entity_id;
