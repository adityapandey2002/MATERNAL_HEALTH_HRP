-- 008_device_registry.sql
-- Devices that hold a copy of the field database.
--
-- A phone that has synced carries patient records in its own storage, so a
-- lost, stolen or reassigned handset is a data-loss event. Each install
-- registers a client-generated id when it signs in; the auth and sync paths
-- refuse a device whose `revoked_at` is set, and the app wipes its local
-- database when it sees that refusal.
--
-- The id comes from the client because it has to be stable before the first
-- successful login (the PIN wraps a key that is independent of the account).
-- It is a UUID, so a forged value cannot be walked to reach another device.

create table if not exists devices (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  label text,
  platform text not null default 'web' check (platform in ('web', 'android')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- The supervision screens list devices per user, and the auth hook looks up a
-- single id on every request that carries one.
create index if not exists idx_devices_user on devices (user_id);
create index if not exists idx_devices_active on devices (user_id) where revoked_at is null;
