alter table sync_queue add column if not exists facility_id uuid references facilities(id);

alter table facilities drop constraint if exists facilities_level_check;
alter table facilities add constraint facilities_level_check
  check (level in ('STATE', 'DISTRICT', 'BLOCK', 'CHC', 'PHC', 'HWC', 'VILLAGE'));

create index if not exists idx_facilities_path_pattern on facilities (path text_pattern_ops);
create index if not exists idx_facilities_parent on facilities (parent_id);
create index if not exists idx_users_facility on users (facility_id);
create index if not exists idx_patients_facility_updated on patients (facility_id, updated_at desc);
create index if not exists idx_visits_facility_updated on visits (facility_id, updated_at desc);
create index if not exists idx_referrals_from_status on referrals (from_facility_id, status, created_at);
create index if not exists idx_referrals_to_status on referrals (to_facility_id, status, created_at);
create index if not exists idx_supervision_facility_ack on supervision_alerts (facility_id, acknowledged, created_at);
create index if not exists idx_sync_queue_facility_status on sync_queue (facility_id, status, created_at);
