-- 010_anemia_fcm_referral_fields.sql
-- Persist anemia/FCM/referral fields introduced by the multi-complication
-- registration redesign so they survive sync and server-side reads.

alter table patients add column if not exists hrp_complications jsonb not null default '[]'::jsonb;
alter table patients add column if not exists registration_hb numeric;
alter table patients add column if not exists anemia_grade varchar(20);
alter table patients add column if not exists referral_facility_type varchar(20);

alter table follow_ups add column if not exists fcm_administered boolean;