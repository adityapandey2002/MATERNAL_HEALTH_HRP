import type { ReactNode } from "react";

type Tone = "neutral" | "primary" | "red" | "amber" | "green";

const toneClasses: Record<Tone, string> = {
  neutral: "text-ink",
  primary: "text-primary",
  red: "text-triage-red",
  amber: "text-triage-amber",
  green: "text-triage-green",
};

const iconToneClasses: Record<Tone, string> = {
  neutral: "bg-canvas text-ink-subtle",
  primary: "bg-primary-light text-primary-dark",
  red: "bg-triage-red-bg text-triage-red",
  amber: "bg-triage-amber-bg text-triage-amber",
  green: "bg-triage-green-bg text-triage-green",
};

interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  /** Renders the value smaller, for text values such as "Synced". */
  compact?: boolean;
}

/** Single clinical counter. Values use tabular figures so columns line up. */
export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  compact = false,
}: StatTileProps) {
  return (
    <div className="panel flex items-start gap-3 p-3 sm:p-4">
      {icon ? (
        <span
          aria-hidden="true"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded ${iconToneClasses[tone]}`}
        >
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-subtle">{label}</p>
        <p
          className={`tnum mt-0.5 font-semibold leading-tight ${compact ? "text-lg" : "text-2xl"} ${toneClasses[tone]}`}
        >
          {value}
        </p>
        {hint ? <p className="mt-0.5 text-2xs text-ink-subtle">{hint}</p> : null}
      </div>
    </div>
  );
}
