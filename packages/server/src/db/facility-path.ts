/**
 * Facility scope paths.
 *
 * `facilities.path` is the dotted chain of facility codes from the state down
 * to the facility itself, for example `BIHAR.ARARIA.ARR_RANIGANJ.ARR_RANIGANJ_SIKTI`.
 * Every authorization check compares paths by equality or by a `scope.` prefix
 * (`facilityScopePredicate`, `isPathInSubtree`), so a child row that stores only
 * its own code is invisible to every role above it: the block BHM and the
 * district DHS see no field registrations at all.
 *
 * Keep this the single place that builds a path so a new seed cannot invent a
 * flat convention again.
 */
export function facilityPathFor(parentPath: string | null | undefined, code: string): string {
  const parent = parentPath?.trim();
  const own = code.trim();
  return parent ? `${parent}.${own}` : own;
}
