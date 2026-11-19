import { useEffect, useState } from "react";
import { IS_NATIVE_APP } from "../lib/api";
import { type UpdateInfo, checkForUpdate } from "../lib/update-check";
import { applyUpdate, onUpdateReady } from "../utils/sw";

const DISMISSED_KEY = "hrp-update-dismissed";

/** Version the user tapped "Later" on, so a resume does not nag again. */
function dismissedVersion(): string | null {
  try {
    return sessionStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

function rememberDismissed(version: string): void {
  try {
    sessionStorage.setItem(DISMISSED_KEY, version);
  } catch {
    // Private mode or a locked-down WebView: dismissing still hides the
    // banner for this mount, it just may return on the next resume.
  }
}

/**
 * Capacitor maps the `_system` target to the Android browser, which owns the
 * download and the install prompt. A plain anchor would navigate the WebView
 * itself and render the APK as a broken page.
 */
function openInBrowser(url: string): void {
  window.open(url, "_system", "noopener,noreferrer");
}

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
    if (!IS_NATIVE_APP) return onUpdateReady(() => setSwReady(true));

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const clearRetry = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const check = () => {
      void checkForUpdate().then((info) => {
        if (cancelled) return;
        if (info?.downloadUrl && dismissedVersion() !== info.version) {
          setAppUpdate(info);
          attempts = 0;
          return;
        }
        // No answer yet (server asleep, no network, or no newer release).
        // Retry a few times with backoff so a phone that opened while Render
        // was cold still learns about the update once it wakes up.
        if (attempts < 5) {
          attempts += 1;
          const delay = Math.min(30_000 * attempts, 120_000);
          clearRetry();
          retryTimer = setTimeout(check, delay);
        }
      });
    };

    check();

    // Phones stay open for days in the field; checking only on mount means an
    // ANM who never closes the app never learns about a release.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        attempts = 0;
        check();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearRetry();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (IS_NATIVE_APP) {
    const downloadUrl = appUpdate?.downloadUrl;
    if (!appUpdate || !downloadUrl) return null;

    return (
      <output className="fixed inset-x-4 bottom-16 z-50 mx-auto block max-w-md rounded-lg border border-info-line bg-info-bg px-4 py-3 shadow-lg lg:bottom-4">
        <p className="text-sm font-semibold text-ink">Update available (v{appUpdate.version})</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
          A newer version is ready. Tap to download, then install the APK. Records on this device
          are kept.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => openInBrowser(downloadUrl)}
          >
            Download update
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              rememberDismissed(appUpdate.version);
              setAppUpdate(null);
            }}
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
