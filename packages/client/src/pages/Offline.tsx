import { useEffect, useState } from "react";
import { BrandMark } from "../components/ui/BrandMark";
import { SyncIcon, WifiOffIcon } from "../components/ui/Icons";
import { isOnline, onOnlineChange } from "../utils/sw";

/**
 * Shown to oversight roles (block, district) when the connection drops.
 *
 * Those screens read live district data from the server, so they cannot be
 * served from the device. Field staff never see this page: ANM and CHO keep
 * working from the on-device store and their changes sync later.
 */
export default function OfflinePage() {
  const [online, setOnline] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    setOnline(isOnline());
    const cleanup = onOnlineChange(setOnline);
    const stored = localStorage.getItem("lastSyncTime");
    if (stored) setLastSync(new Date(Number(stored)).toLocaleString());
    return cleanup;
  }, []);

  useEffect(() => {
    if (online) {
      window.location.reload();
    }
  }, [online]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <BrandMark size={40} variant="full" title={null} />
          <div>
            <p className="text-sm font-semibold leading-tight text-ink">Matru Suraksha</p>
            <p className="text-2xs uppercase tracking-wider text-ink-subtle">Araria district</p>
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-triage-amber-line bg-triage-amber-bg px-5 py-3">
            <p className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wider text-triage-amber">
              <WifiOffIcon className="h-4 w-4" />
              No connection
            </p>
          </div>

          <div className="px-5 py-6 sm:px-6">
            <h1 className="text-xl font-semibold tracking-tight text-ink">You're Offline</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
              This view reads live data from the district server, so it needs a connection. Field
              workers on the mobile app can keep registering patients and recording visits and
              follow-ups offline; those changes sync when the connection returns.
            </p>

            {lastSync && (
              <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-subtle">
                <SyncIcon className="h-3.5 w-3.5" />
                Last synced: {lastSync}
              </p>
            )}

            <div className="mt-5 border-t border-line-soft pt-4">
              <p className="text-xs font-medium text-ink-subtle">Waiting for connection…</p>
              <div
                aria-hidden="true"
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-line-soft"
              >
                <div className="h-full w-1/2 animate-pulse rounded-full bg-triage-amber-solid" />
              </div>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-block mt-4"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-2xs text-ink-subtle">
          Your session stays signed in on this device.
        </p>
      </div>
    </div>
  );
}
