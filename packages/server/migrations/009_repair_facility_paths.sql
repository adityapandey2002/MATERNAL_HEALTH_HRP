-- Repair flat facility scope paths.
--
-- The Raniganj pilot seed stored each facility's own code as its whole path
-- (`path = 'ARR_RANIGANJ_SIKTI'`), but every authorization query scopes a role
-- by equality or a `scope.` prefix. A BHM at `ARR_RANIGANJ` and a DHS at
-- `ARARIA` therefore matched no HSC below them: field registrations reached the
-- server and the ANM's own device, yet never appeared at block or district
-- level, and a referred HRP's first follow-up could not find its block
-- helpdesk owner.
--
-- Rebuild every path from `parent_id` instead. The recursive walk is bounded
-- and cycle-safe so a malformed parent chain cannot hang the migration, and
-- rows that already hold the correct path are left untouched.

with recursive tree as (
  select
    id,
    code,
    code::text as new_path,
    1 as depth,
    array[id] as seen
  from facilities
  where parent_id is null

  union all

  select
    child.id,
    child.code,
    tree.new_path || '.' || child.code,
    tree.depth + 1,
    tree.seen || child.id
  from facilities child
  join tree on child.parent_id = tree.id
  where tree.depth < 12
    and not (child.id = any (tree.seen))
)
update facilities
set path = tree.new_path
from tree
where facilities.id = tree.id
  and facilities.path is distinct from tree.new_path;
