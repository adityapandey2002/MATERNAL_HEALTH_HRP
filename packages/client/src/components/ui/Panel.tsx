import type { HTMLAttributes, ReactNode } from "react";

interface PanelProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

/** Bordered surface used for every content module. Depth comes from the border. */
export function Panel({ children, className, ...rest }: PanelProps) {
  return (
    <section className={`panel ${className ?? ""}`} {...rest}>
      {children}
    </section>
  );
}

interface PanelHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Heading level, so the page keeps a single h1 and ordered sections. */
  level?: 2 | 3;
  id?: string;
  className?: string;
}

export function PanelHeader({
  title,
  description,
  action,
  level = 2,
  id,
  className,
}: PanelHeaderProps) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className={`panel-header ${className ?? ""}`}>
      <div className="min-w-0">
        <Heading
          id={id}
          className="text-sm font-semibold tracking-tight text-ink sm:text-base"
        >
          {title}
        </Heading>
        {description ? <p className="mt-0.5 text-xs text-ink-subtle">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function PanelBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`panel-body ${className ?? ""}`}>{children}</div>;
}

export function PanelFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`panel-footer ${className ?? ""}`}>{children}</div>;
}
