import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** "row" fits inside a table body, "block" fills a panel. */
  variant?: "block" | "row";
}

export function EmptyState({ icon, title, description, action, variant = "block" }: EmptyStateProps) {
  if (variant === "row") {
    return (
      <div role="status" className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <p className="text-sm font-medium text-ink-muted">{title}</p>
        {description ? <p className="max-w-sm text-xs text-ink-subtle">{description}</p> : null}
        {action}
      </div>
    );
  }

  return (
    <div role="status" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      {icon ? (
        <span
          aria-hidden="true"
          className="flex h-11 w-11 items-center justify-center rounded bg-canvas text-ink-subtle"
        >
          {icon}
        </span>
      ) : null}
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description ? (
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-subtle">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
