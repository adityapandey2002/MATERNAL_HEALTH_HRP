import { useEffect, useState } from "react";
import { isOnline, onOnlineChange } from "../utils/sw";

export default function OfflinePage() {
  const [online, setOnline] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="card p-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
            <svg
              aria-hidden="true"
              className="w-10 h-10 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">You're Offline</h1>
          <p className="text-gray-500 mb-6">
            High-Risk Pregnancy Tracking of Araria works offline. Your data is saved locally and
            will sync automatically when you're back online.
          </p>

          <div className="space-y-4 mb-6 p-4 rounded-lg bg-gray-50 text-left">
            <h3 className="font-medium text-gray-900 mb-3">What you can do offline:</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 flex-shrink-0 text-green-600">✓</span>Register new patients
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 flex-shrink-0 text-green-600">✓</span>Record ANC visits
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 flex-shrink-0 text-green-600">✓</span>Flag danger signs
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 flex-shrink-0 text-green-600">✓</span>Create referrals
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 flex-shrink-0 text-green-600">✓</span>View patient history
              </li>
            </ul>
          </div>

          {lastSync && <p className="text-xs text-gray-400">Last synced: {lastSync}</p>}

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">Waiting for connection…</p>
            <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gray-400 animate-pulse" style={{ width: "100%" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
