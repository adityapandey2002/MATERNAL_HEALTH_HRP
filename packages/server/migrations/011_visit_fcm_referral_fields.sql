-- 011_visit_fcm_referral_fields.sql
-- Persist FCM administration and referral destination at the visit level so each
-- ANC follow-up encounter clearly records intervention vitals and destinations.

alter table visits add column if not exists fcm_administered boolean not null default false;
alter table visits add column if not exists referral_facility_type varchar(20);
