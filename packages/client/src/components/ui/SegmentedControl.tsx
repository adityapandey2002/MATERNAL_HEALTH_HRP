interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Optional counter shown after the label, e.g. "High risk (4)". */
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group. */
  label: string;
  className?: string;
}

/**
 * Filter chips implemented as pressed buttons rather than ARIA tabs, because
 * they filter a list in place instead of swapping panels.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedControlProps<T>) {
  return (
    <fieldset
      aria-label={label}
      className={`no-scrollbar m-0 flex min-w-0 flex-wrap gap-1.5 border-0 p-0 ${className ?? ""}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`inline-flex min-h-control shrink-0 items-center gap-1.5 rounded border px-3 text-xs font-semibold transition-colors ${
              selected
                ? "border-primary bg-primary text-white"
                : "border-line bg-surface text-ink-muted hover:bg-canvas"
            }`}
          >
            {option.label}
            {typeof option.count === "number" ? (
              <span
                className={`tnum rounded px-1 text-2xs ${
                  selected ? "bg-white/20 text-white" : "bg-canvas text-ink-subtle"
                }`}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </fieldset>
  );
}
