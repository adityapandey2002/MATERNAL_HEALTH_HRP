import { useEffect, useState } from "react";
import { applyUpdate, onUpdateReady } from "../utils/sw";

/**
 * Non-blocking update notice.
 *
 * A field worker may be mid-registration when a new build lands, so the app
 * never reloads by itself. The new service worker waits until the worker taps
 * "Reload now"; "Later" dismisses the notice for this session.
 */
export function UpdatePrompt() {
  const [ready, setReady] = useState(false);

  useEffect(() => onUpdateReady(() => setReady(true)), []);

  if (!ready) return null;

  return (
    <output className="fixed inset-x-4 bottom-16 z-50 mx-auto block max-w-md rounded-lg border border-info-line bg-info-bg px-4 py-3 shadow-lg lg:bottom-4">
      <p className="text-sm font-semibold text-ink">A new version is ready</p>
      <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
        Reload when you are not in the middle of a form. Records saved on this device are kept.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => applyUpdate()}>
          Reload now
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setReady(false)}>
          Later
        </button>
      </div>
    </output>
  );
}
