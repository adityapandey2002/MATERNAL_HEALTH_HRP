import { type ReactNode, useEffect, useRef } from "react";
import { XIcon } from "./Icons";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Pinned strip below the scrolling items, e.g. the build label. */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Old WebViews ship `<dialog>` without `showModal`/`close`. The sheet still has
 * to open there, so fall back to toggling the `open` attribute; Escape, the X
 * button and tab focus keep working either way.
 */
function openDialog(dialog: HTMLDialogElement): void {
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
    return;
  }
  dialog.setAttribute("open", "");
}

function closeDialog(dialog: HTMLDialogElement): void {
  if (typeof dialog.close === "function") {
    dialog.close();
    return;
  }
  dialog.removeAttribute("open");
}

/**
 * Bottom sheet used for the mobile "More" menu.
 *
 * A native modal `<dialog>` puts the panel in the browser's top layer, so the
 * page behind cannot scroll, an opaque surface is guaranteed, and Escape and
 * focus containment come from the platform rather than from hand-written
 * listeners that drift between WebView versions.
 */
export function Sheet({ open, onClose, title, description, footer, children }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      restoreRef.current = document.activeElement as HTMLElement | null;
      if (!dialog.open) openDialog(dialog);
    } else if (dialog.open) {
      closeDialog(dialog);
      restoreRef.current?.focus?.();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="sheet-title"
      aria-describedby={description ? "sheet-description" : undefined}
      onCancel={(event) => {
        // Keep the element open until React closes it, otherwise the browser
        // and the `open` prop disagree and the sheet cannot reopen.
        event.preventDefault();
        onClose();
      }}
      className="fixed inset-0 z-50 m-0 mt-auto h-fit max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-xl border-x border-t border-line bg-surface p-0 text-ink shadow-overlay open:flex"
    >
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line-soft bg-surface px-4 py-3">
        <div className="min-w-0">
          <h2 id="sheet-title" className="text-base font-semibold text-ink">
            {title}
          </h2>
          {description ? (
            <p id="sheet-description" className="mt-0.5 text-xs leading-relaxed text-ink-muted">
              {description}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost -mr-1 min-h-touch min-w-touch px-2"
          aria-label="Close menu"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-surface px-2 py-2">{children}</div>
      {footer ? (
        <div className="shrink-0 border-t border-line-soft bg-canvas px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 text-2xs text-ink-subtle">
          {footer}
        </div>
      ) : (
        <div aria-hidden="true" className="h-[env(safe-area-inset-bottom)] shrink-0 bg-surface" />
      )}
    </dialog>
  );
}
