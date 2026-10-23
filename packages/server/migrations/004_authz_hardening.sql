-- Facility paths identify a single subtree, so duplicate paths would make
-- scope checks ambiguous.
create unique index if not exists facilities_path_key on facilities (path);

-- The responsibilities unique constraint already leads with user_id, so the
-- dedicated user index only adds write cost.
drop index if exists idx_responsibilities_user;

-- 003 backfilled sync_queue.facility_id from the referenced entities. Make the
-- scope column mandatory so an unscoped queue row cannot be written.
alter table sync_queue alter column facility_id set not null;

-- Deactivate active users whose remapped role cannot work at their facility:
-- ANM=VILLAGE/HSC, CHO=HWC, BHM=BLOCK/CHC, DHS=DISTRICT.
update users
set is_active = false,
    updated_at = now()
from facilities
where facilities.id = users.facility_id
  and users.is_active = true
  and not (
    (users.role = 'ANM' and facilities.level in ('VILLAGE', 'HSC'))
    or (users.role = 'CHO' and facilities.level = 'HWC')
    or (users.role = 'BHM' and facilities.level in ('BLOCK', 'CHC'))
    or (users.role = 'DHS' and facilities.level = 'DISTRICT')
  );
