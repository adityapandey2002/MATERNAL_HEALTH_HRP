interface BrandMarkProps {
  /** Rendered width and height in pixels. */
  size?: number;
  /**
   * "full" draws the monitoring pulse through the heart and is used at larger
   * sizes (login, splash). "compact" drops the pulse so the mark stays
   * legible in the sidebar and on small screens.
   */
  variant?: "full" | "compact";
  /** Accessible name. Pass null when the mark sits next to a visible wordmark. */
  title?: string | null;
  className?: string;
}

/**
 * High-Risk Pregnancy Tracking of Araria brand mark.
 *
 * A heart outline carrying a monitoring pulse. The pulse is the dominant
 * stroke so the mark reads as "maternal vitals under watch" rather than as a
 * generic shield, and it stays legible at sidebar size.
 */
export function BrandMark({
  size = 40,
  variant = "full",
  title = "High-Risk Pregnancy Tracking of Araria",
  className,
}: BrandMarkProps) {
  const gradientId = `brand-mark-gradient-${variant}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title ?? undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>
      </defs>

      <rect width="40" height="40" rx="9" fill={`url(#${gradientId})`} />

      <g
        transform="translate(8.8 7.2)"
        fill="none"
        stroke="#ffffff"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          strokeWidth={1.7}
          d="M12 20.6s-6.4-4-8.3-7.6C2.1 10.4 3.3 6.9 6.4 5.1c2.2-1.3 4.8-.6 5.6 1.7.8-2.3 3.4-3 5.6-1.7 3.1 1.8 4.3 5.3 2.7 7.9-1.9 3.6-8.3 7.6-8.3 7.6z"
        />
        {variant === "full" ? (
          <path strokeWidth={1.9} d="M5.5 12.5h3l1.5-3 2.3 6 1.9-3.6 1.3 1.9h2.2" />
        ) : null}
      </g>
    </svg>
  );
}

interface BrandLockupProps {
  size?: number;
  variant?: "full" | "compact";
  className?: string;
}

/** Brand mark paired with the product wordmark. */
export function BrandLockup({ size = 40, variant = "full", className }: BrandLockupProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <BrandMark size={size} variant={variant} title={null} />
      <div className="min-w-0">
        <p className="truncate text-base font-bold leading-tight text-gray-900">
          High-Risk Pregnancy Tracking of Araria
        </p>
        <p className="truncate text-xs leading-tight text-gray-500">Maternal Risk Monitoring</p>
      </div>
    </div>
  );
}
