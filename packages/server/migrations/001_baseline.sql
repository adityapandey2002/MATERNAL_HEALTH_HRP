create table if not exists facilities (
  id uuid primary key default gen_random_uuid(),
  code varchar(50) not null unique,
  name varchar(255) not null,
  level varchar(20) not null,
  parent_id uuid references facilities(id),
  path text not null,
  state varchar(100) not null,
  district varchar(100) not null,
  block varchar(100) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  employee_id varchar(50) not null unique,
  name varchar(255) not null,
  phone varchar(20) not null,
  password_hash text not null,
  role varchar(30) not null,
  facility_id uuid not null references facilities(id),
  language varchar(10) not null default 'hi',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  abha_id varchar(14) unique,
  facility_id uuid not null references facilities(id),
  registered_by uuid not null references users(id),
  name varchar(255) not null,
  age integer not null,
  phone varchar(20),
  address text,
  lmp date,
  edd date,
  gravida integer not null default 0,
  para integer not null default 0,
  abortions integer not null default 0,
  risk_factors jsonb not null default '[]',
  risk_level varchar(10) not null default 'GREEN',
  risk_score integer not null default 0,
  is_high_risk boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table patients add column if not exists hrp_reason varchar(40);
alter table patients add column if not exists asha_name varchar(255);
alter table patients add column if not exists asha_phone varchar(20);
alter table patients add column if not exists referred boolean not null default false;

create table if not exists visits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  facility_id uuid not null references facilities(id),
  conducted_by uuid not null references users(id),
  visit_number integer not null,
  gestational_weeks integer not null,
  visit_date date not null,
  bp_systolic integer,
  bp_diastolic integer,
  hb real,
  weight real,
  fundal_height integer,
  fetal_heart_rate integer,
  danger_signs jsonb not null default '[]',
  ifa_given boolean not null default false,
  calcium_given boolean not null default false,
  albendazole_given boolean not null default false,
  referred boolean not null default false,
  referral_reason text,
  referral_facility_id uuid references facilities(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  from_facility_id uuid not null references facilities(id),
  to_facility_id uuid not null references facilities(id),
  referred_by uuid not null references users(id),
  reason text not null,
  urgency varchar(10) not null,
  status varchar(20) not null default 'PENDING',
  responded_at timestamptz,
  responded_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sync_queue (
  id uuid primary key default gen_random_uuid(),
  entity_type varchar(20) not null,
  entity_id uuid not null,
  operation varchar(10) not null,
  payload jsonb not null,
  status varchar(20) not null default 'PENDING',
  retry_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists supervision_alerts (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  type varchar(30) not null,
  severity varchar(10) not null,
  message text not null,
  related_entity_id uuid,
  acknowledged boolean not null default false,
  acknowledged_by uuid references users(id),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_patients_facility on patients (facility_id);
create index if not exists idx_patients_risk_level on patients (risk_level);
create index if not exists idx_visits_patient on visits (patient_id);
create index if not exists idx_referrals_status on referrals (status);
create index if not exists idx_sync_queue_status on sync_queue (status);
create index if not exists idx_supervision_facility on supervision_alerts (facility_id);
