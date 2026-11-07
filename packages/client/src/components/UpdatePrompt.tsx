import { useEffect, useState } from "react";
import { IS_NATIVE_APP } from "../lib/api";
import { type UpdateInfo, checkForUpdate } from "../lib/update-check";
import { applyUpdate, onUpdateReady } from "../utils/sw";

/**
 * Non-blocking update notice.
 *
 * Web builds: a new service worker is waiting; reload when ready.
 * Native (APK) builds: the server reports a newer version; offer a
 * download link since sideloaded APKs cannot be installed silently.
 */
export function UpdatePrompt() {
  const [swReady, setSwReady] = useState(false);
  const [appUpdate, setAppUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    if (IS_NATIVE_APP) {
      void checkForUpdate().then((info) => {
        if (info) setAppUpdate(info);
      });
      return;
    }
    return onUpdateReady(() => setSwReady(true));
  }, []);

  if (IS_NATIVE_APP) {
    if (!appUpdate) return null;
    return (
      <output className="fixed inset-x-4 bottom-16 z-50 mx-auto block max-w-md rounded-lg border border-info-line bg-info-bg px-4 py-3 shadow-lg lg:bottom-4">
        <p className="text-sm font-semibold text-ink">Update available (v{appUpdate.version})</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
          A newer version is ready. Tap to download, then install the APK. Records on this device
          are kept.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {appUpdate.downloadUrl ? (
            <a
              href={appUpdate.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-sm"
            >
              Download update
            </a>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setAppUpdate(null)}
          >
            Later
          </button>
        </div>
      </output>
    );
  }

  if (!swReady) return null;

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
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setSwReady(false)}
        >
          Later
        </button>
      </div>
    </output>
  );
}
