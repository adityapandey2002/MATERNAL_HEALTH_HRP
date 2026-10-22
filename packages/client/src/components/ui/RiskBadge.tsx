import type { RiskLevel } from "@hrp/shared";
import { AlertTriangleIcon, CheckIcon, InfoIcon } from "./Icons";

interface RiskBadgeProps {
  level: RiskLevel;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

const config: Record<RiskLevel, { class: string; label: string; icon: React.ReactNode }> = {
  RED: { class: "badge-red", label: "High Risk", icon: <AlertTriangleIcon className="w-3 h-3" /> },
  AMBER: {
    class: "badge-amber",
    label: "Medium Risk",
    icon: <InfoIcon className="w-3 h-3" />,
  },
  GREEN: { class: "badge-green", label: "Low Risk", icon: <CheckIcon className="w-3 h-3" /> },
};

const sizeClasses: Record<"sm" | "md" | "lg", string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
  lg: "px-3 py-1.5 text-base",
};

const colors: Record<RiskLevel, string> = {
  RED: "bg-red-500",
  AMBER: "bg-amber-500",
  GREEN: "bg-green-500",
};

const sizes: Record<"sm" | "md" | "lg", string> = {
  sm: "w-2 h-2",
  md: "w-3 h-3",
  lg: "w-4 h-4",
};

const levelNames: Record<RiskLevel, string> = {
  RED: "High risk",
  AMBER: "Medium risk",
  GREEN: "Low risk",
};

export function RiskBadge({ level, showLabel = true, size = "md" }: RiskBadgeProps) {
  const c = config[level];
  return (
    <span
      data-testid="risk-badge"
      className={`inline-flex items-center gap-1 rounded-full font-medium ${c.class} ${sizeClasses[size]}`}
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
