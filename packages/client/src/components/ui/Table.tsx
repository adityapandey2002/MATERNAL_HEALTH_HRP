import type { ReactNode } from "react";

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
  hoverable?: boolean;
  /** Accessible name for the table region. */
  label?: string;
  className?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "No data",
  hoverable = true,
  label = "Data table",
  className,
}: TableProps<T>) {
  return (
    <section className={`table-container ${className ?? ""}`} aria-label={label}>
      {data.length > 0 ? (
        <table className="table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} scope="col" className={col.headerClassName}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={keyExtractor(row)} className={hoverable ? "hover:bg-gray-50" : ""}>
                {columns.map((col) => (
                  <td key={col.key} className={col.className}>
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="p-8 text-center text-gray-500">{emptyMessage}</p>
      )}
    </section>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  disabled,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <nav
      className="flex flex-col gap-2 border-t border-line-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Pagination"
    >
      <p className="tnum text-2xs text-ink-subtle">
        Showing {start}–{end} of {total}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1 || disabled}
          aria-label="Previous page"
        >
          Previous
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages || disabled}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </nav>
  );
}
