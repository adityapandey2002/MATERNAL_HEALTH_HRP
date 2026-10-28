import type { RiskLevel } from "@hrp/shared";
import { AlertTriangleIcon, CheckIcon, InfoIcon } from "./Icons";

interface RiskBadgeProps {
  level: RiskLevel;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

const config: Record<RiskLevel, { class: string; label: string; icon: React.ReactNode }> = {
  RED: { class: "badge-red", label: "High risk", icon: <AlertTriangleIcon className="h-3 w-3" /> },
  AMBER: {
    class: "badge-amber",
    label: "Moderate",
    icon: <InfoIcon className="h-3 w-3" />,
  },
  GREEN: { class: "badge-green", label: "Routine", icon: <CheckIcon className="h-3 w-3" /> },
};

const sizeClasses: Record<"sm" | "md" | "lg", string> = {
  sm: "px-1.5 py-0 text-2xs",
  md: "",
  lg: "px-2.5 py-1 text-xs",
};
const colors: Record<RiskLevel, string> = {
  RED: "bg-triage-red-solid",
  AMBER: "bg-triage-amber-solid",
  GREEN: "bg-triage-green-solid",
};

const sizes: Record<"sm" | "md" | "lg", string> = {
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
  lg: "h-2.5 w-2.5",
};

const levelNames: Record<RiskLevel, string> = {
  RED: "High risk",
  AMBER: "Moderate risk",
  GREEN: "Routine risk",
};

export function RiskBadge({ level, showLabel = true, size = "md" }: RiskBadgeProps) {
  const c = config[level];
  return (
    <span
      data-testid="risk-badge"
      className={`badge whitespace-nowrap ${c.class} ${sizeClasses[size]}`}
    >
      <span aria-hidden="true" className="inline-flex">
        {c.icon}
      </span>
      {showLabel ? <span>{c.label}</span> : <span className="sr-only">{c.label}</span>}
    </span>
  );
}

export function RiskDot({ level, size = "md" }: { level: RiskLevel; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      data-testid="risk-dot"
      role="img"
      aria-label={levelNames[level]}
      className={`inline-block rounded-full ${colors[level]} ${sizes[size]}`}
    />
  );
}

/**
 * Left edge stripe used on patient cards so the triage level is readable from
 * arm's length without relying on the badge text alone.
 */
export function RiskStripe({ level }: { level: RiskLevel }) {
  const stripe: Record<RiskLevel, string> = {
    RED: "bg-triage-red-solid",
    AMBER: "bg-triage-amber-solid",
    GREEN: "bg-triage-green-solid",
  };
  return <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${stripe[level]}`} />;
}
