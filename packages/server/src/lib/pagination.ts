export interface Pagination {
  page: number;
  limit: number;
  offset: number;
}

export interface SortSpec {
  column: string;
  order: "asc" | "desc";
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

export function parsePagination(
  query: Record<string, unknown>,
  allowedSortColumns: readonly string[],
  defaultSortColumn: string
): Pagination & { sort: SortSpec } {
  const rawPage = Number(query.page);
  const rawLimit = Number(query.limit);

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
      : DEFAULT_LIMIT;

  const requestedSort = typeof query.sortBy === "string" ? query.sortBy : "";
  const column = allowedSortColumns.includes(requestedSort) ? requestedSort : defaultSortColumn;

  const order = query.sortOrder === "asc" || query.sortOrder === "desc" ? query.sortOrder : "desc";

  return { page, limit, offset: (page - 1) * limit, sort: { column, order } };
}

export function toBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return undefined;
}

export function toInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : undefined;
}

/**
 * Narrows an untrusted query string value to one of a fixed set of literals.
 * Returns undefined when the value is not allowed, so callers can reject it
 * instead of forwarding an arbitrary string to the database.
 */
export function oneOf<const T extends readonly string[]>(
  value: unknown,
  allowed: T
): T[number] | undefined {
  if (typeof value !== "string") return undefined;
  return allowed.find((candidate) => candidate === value);
}
