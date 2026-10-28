import { type ReactNode, useEffect, useRef } from "react";
import { XIcon } from "./Icons";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}

/**
 * Bottom sheet used for the mobile "More" menu. Focus moves into the sheet on
 * open, Escape and backdrop clicks close it, and body scrolling is locked so
 * the page behind cannot drift while it is open.
 */
export function Sheet({ open, onClose, title, description, children }: SheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:hidden">
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
      />
      <dialog
        open
        aria-modal="true"
        aria-labelledby="sheet-title"
        aria-describedby={description ? "sheet-description" : undefined}
        className="static m-0 w-full max-w-lg rounded-t-xl border border-line bg-surface p-0 shadow-overlay"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line-soft px-4 py-3">
          <div>
            <h2 id="sheet-title" className="text-sm font-semibold text-ink">
              {title}
            </h2>
            {description ? (
              <p id="sheet-description" className="mt-0.5 text-xs text-ink-subtle">
                {description}
              </p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="btn btn-ghost -mr-1 min-h-control min-w-touch px-2"
            aria-label="Close menu"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="pb-safe max-h-[70vh] overflow-y-auto px-2 py-2">{children}</div>
      </dialog>
    </div>
  );
}
