-- 005_hrp_follow_up.sql
-- Add HRP-specific columns to patients and create follow-up tables.

-- New columns on patients for HRP identification and automated follow-up scheduling.
alter table patients add column if not exists hrp_complication varchar(40);
alter table patients add column if not exists is_hrp boolean not null default false;
alter table patients add column if not exists follow_up_track varchar(40);
alter table patients add column if not exists follow_up_scheduled_date timestamptz;
alter table patients add column if not exists follow_up_status varchar(20) not null default 'PENDING';

create index if not exists idx_patients_is_hrp on patients (is_hrp);
create index if not exists idx_patients_follow_up_status on patients (follow_up_status);
create index if not exists idx_patients_follow_up_scheduled on patients (follow_up_scheduled_date);

-- Follow-up records: automated scheduling + manual status updates by ANM/CHO/nodal.
create table if not exists follow_ups (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  assigned_to_user_id uuid not null references users(id),
  assigned_by_user_id uuid not null references users(id),
  level varchar(20) not null check (level in ('BLOCK_NODAL', 'CHO', 'ANM')),
  status varchar(20) not null default 'PENDING' check (status in ('PENDING', 'COMPLETE', 'NOT_REACHABLE')),
  track varchar(40) not null check (track in ('IMMEDIATE_7_DAYS', 'PMSMA_SESSION', 'VHSND_COMMUNITY')),
  scheduled_date timestamptz not null,
  completed_at timestamptz,
  completed_by_user_id uuid references users(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_follow_ups_patient on follow_ups (patient_id);
create index if not exists idx_follow_ups_assigned_to on follow_ups (assigned_to_user_id);
create index if not exists idx_follow_ups_status on follow_ups (status);
create index if not exists idx_follow_ups_scheduled on follow_ups (scheduled_date);

-- Nodal designations: Block Nodal / District Nodal scoped to a facility.
create table if not exists user_nodal_designations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  nodal_level varchar(20) not null check (nodal_level in ('BLOCK', 'DISTRICT')),
  facility_id uuid not null references facilities(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_nodal_designations_unique unique (user_id, nodal_level, facility_id)
);

create index if not exists idx_user_nodal_designations_user on user_nodal_designations (user_id);
create index if not exists idx_user_nodal_designations_facility on user_nodal_designations (facility_id);

-- Field-level follow-up activation: district-controlled, only visible when active.
create table if not exists field_level_lists (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  district_list_id uuid not null,
  activated_by uuid not null references users(id),
  activated_at timestamptz not null default now(),
  is_active boolean not null default true,
  constraint field_level_lists_unique unique (facility_id, is_active)
);

create index if not exists idx_field_level_lists_facility on field_level_lists (facility_id);
create index if not exists idx_field_level_lists_active on field_level_lists (is_active);
