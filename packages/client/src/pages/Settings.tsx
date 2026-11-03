import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { type FormEvent, useEffect, useState } from "react";
import { BrandMark } from "../components/ui/BrandMark";
import { BellIcon, CheckIcon, InfoIcon, SyncIcon, UserIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "../components/ui/Panel";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { api } from "../lib/api";
import { changePin, isPinSet, wipeDevice } from "../lib/lock";
import { copyDiagnostics } from "../lib/diagnostics";
import { initialsFor } from "../lib/nav";
import { ROLE_LABEL } from "../lib/session";
import { syncNow, useSyncStatus } from "../lib/sync/engine";

type SettingsTab = "profile" | "sync" | "notifications" | "about";

const NOTIFICATION_PREFS = [
  {
    id: "due_visits",
    label: "Due visit reminders",
    description: "Get notified when ANC visits are due",
  },
  {
    id: "high_risk",
    label: "High-risk alerts",
    description: "Immediate alerts for red-flagged patients",
  },
  {
    id: "sync_status",
    label: "Sync status",
    description: "Know when sync completes or fails",
  },
] as const;

type NotificationId = (typeof NOTIFICATION_PREFS)[number]["id"];

const DEFAULT_PREFS: Record<NotificationId, boolean> = {
  due_visits: true,
  high_risk: true,
  sync_status: true,
};

function readPrefs(): Record<NotificationId, boolean> {
  try {
    const stored = localStorage.getItem("hrp.notificationPrefs");
    if (!stored) return DEFAULT_PREFS;
    const parsed = JSON.parse(stored) as Partial<Record<NotificationId, boolean>>;
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return DEFAULT_PREFS;
  }
}

function pluralChanges(count: number): string {
  return `${count} ${count === 1 ? "change" : "changes"}`;
}

/**
 * One honest sentence about the device, in the order that matters to a field
 * worker: a conflict needs a human, then "you are offline", then "still
 * sending", and only then "all clear".
 */
function describeSyncState({
  online,
  pendingChanges,
  conflicts,
}: {
  online: boolean;
  pendingChanges: number;
  conflicts: number;
}): { title: string; detail: string; tone: "green" | "amber" | "red" } {
  if (conflicts > 0) {
    return {
      title: "Some changes need your review",
      detail:
        "The server kept a newer version of these records. Your copy is still on this device — open the patient, check the details, and re-enter anything that is still missing.",
      tone: "red",
    };
  }
  if (!online) {
    return {
      title: "Offline — records are saved on this device",
      detail:
        pendingChanges > 0
          ? `${pluralChanges(pendingChanges)} will be sent automatically when the connection returns.`
          : "Anything you record now stays on this phone and syncs later.",
      tone: "amber",
    };
  }
  if (pendingChanges > 0) {
    return {
      title: `${pluralChanges(pendingChanges)} waiting to sync`,
      detail: "They are sent automatically. You can also send them now.",
      tone: "amber",
    };
  }
  return {
    title: "Everything is synced",
    detail: "No records are waiting on this device.",
    tone: "green",
  };
}

function ChangePinForm() {
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (newPin.length !== 6 || !/^\d+$/.test(newPin)) {
      setError("New PIN must be exactly 6 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      setError("New PINs don't match.");
      return;
    }

    setSaving(true);
    try {
      const ok = await changePin(oldPin, newPin);
      if (ok) {
        setMessage("PIN changed successfully.");
        setOldPin("");
        setNewPin("");
        setConfirmPin("");
      } else {
        setError("Current PIN is incorrect.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change PIN.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="old-pin" className="label">
          Current PIN
        </label>
        <input
          id="old-pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={oldPin}
          onChange={(e) => setOldPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="input"
          autoComplete="current-password"
        />
      </div>
      <div>
        <label htmlFor="new-pin" className="label">
          New PIN (6 digits)
        </label>
        <input
          id="new-pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={newPin}
          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="input"
          autoComplete="new-password"
        />
      </div>
      <div>
        <label htmlFor="confirm-pin" className="label">
          Confirm new PIN
        </label>
        <input
          id="confirm-pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="input"
          autoComplete="new-password"
        />
      </div>
      {error && <p className="text-sm font-medium text-triage-red">{error}</p>}
      {message && <p className="text-sm font-medium text-triage-green">{message}</p>}
      <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
        {saving ? "Changing…" : "Change PIN"}
      </button>
    </form>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [prefs, setPrefs] = useState<Record<NotificationId, boolean>>(DEFAULT_PREFS);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [diagnosticsMessage, setDiagnosticsMessage] = useState<string | null>(null);
  const [wiping, setWiping] = useState(false);

  useEffect(() => {
    setPrefs(readPrefs());
  }, []);

  const { data: user } = useQuery({ queryKey: ["auth", "me"], queryFn: api.auth.me });
  const { data: facilities } = useQuery({ queryKey: ["facilities"], queryFn: api.facilities.list });
  const sync = useSyncStatus();

  const pendingChanges = sync?.pending ?? 0;
  const conflicts = sync?.conflicts ?? 0;
  const online = sync?.online ?? true;
  const syncState = describeSyncState({ online, pendingChanges, conflicts });

  const runSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    await syncNow();
    setSyncMessage("Sync finished. Anything rejected stays here until you resend it.");
    setSyncing(false);
  };

  const copySupportDiagnostics = async () => {
    setDiagnosticsMessage(null);
    const text = await copyDiagnostics({
      pendingChanges,
      conflicts,
      lastSync: sync?.lastSync ?? null,
      lastError: sync?.lastError ?? null,
    });
    setDiagnosticsMessage("Copied. Paste it into the support ticket — no patient data is included.");
    // Keep the text around for environments without a clipboard API.
    try {
      localStorage.setItem("hrp.lastDiagnostics", text);
    } catch {
      // ignore
    }
  };

  const wipeThisDevice = async () => {
    if (!window.confirm("Erase all records on this device? The server keeps its copy.")) return;
    setWiping(true);
    try {
      await wipeDevice();
    } finally {
      setWiping(false);
    }
  };

  const facilityList = Array.isArray(facilities) ? facilities : [];
  const facilityName = facilityList.find((f) => f.id === user?.facilityId)?.name;

  const togglePref = (id: NotificationId, value: boolean) => {
    const next = { ...prefs, [id]: value };
    setPrefs(next);
    try {
      localStorage.setItem("hrp.notificationPrefs", JSON.stringify(next));
    } catch {
      // A full or blocked storage quota must not break the settings screen.
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Your profile, device sync and notification preferences"
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Panel className="lg:sticky lg:top-20">
            <div className="p-2">
              <SegmentedControl
                className="lg:hidden"
                label="Settings sections"
                value={activeTab}
                onChange={setActiveTab}
                options={[
                  { value: "profile", label: "Profile" },
                  { value: "sync", label: "Sync" },
                  { value: "notifications", label: "Alerts" },
                  { value: "about", label: "About" },
                ]}
              />
              <nav aria-label="Settings sections" className="hidden lg:block">
                <ul className="space-y-0.5">
                  {[
                    { id: "profile" as const, label: "Profile", icon: UserIcon },
                    { id: "sync" as const, label: "Sync", icon: SyncIcon },
                    { id: "notifications" as const, label: "Notifications", icon: BellIcon },
                    { id: "about" as const, label: "About", icon: InfoIcon },
                  ].map((tab) => {
                    const selected = activeTab === tab.id;
                    return (
                      <li key={tab.id}>
                        <button
                          type="button"
                          onClick={() => setActiveTab(tab.id)}
                          aria-pressed={selected}
                          className={`flex min-h-touch w-full items-center gap-2.5 rounded px-3 text-sm font-medium transition-colors ${
                            selected
                              ? "bg-primary text-white"
                              : "text-ink-muted hover:bg-canvas hover:text-ink"
                          }`}
                        >
                          <tab.icon className={`h-4 w-4 ${selected ? "" : "text-ink-subtle"}`} />
                          {tab.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>
          </Panel>
        </div>

        <div className="lg:col-span-3">
          {activeTab === "profile" && (
            <Panel>
              <PanelHeader title="Profile" description="Identity issued by your facility" />
              <PanelBody className="space-y-5">
                <div className="flex items-center gap-4">
                  <span
                    aria-hidden="true"
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-white"
                  >
                    {initialsFor(user?.name)}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-ink">
                      {user?.name ?? "Health Worker"}
                    </h2>
                    <p className="text-sm text-ink-subtle">
                      {user ? ROLE_LABEL[user.role] : "Field worker"}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-subtle">
                      Employee ID: {user?.employeeId ?? "—"}
                    </p>
                  </div>
                </div>

                <dl className="grid gap-x-6 sm:grid-cols-2">
                  <div className="field-row">
                    <dt>Phone</dt>
                    <dd>{user?.phone ?? "Not set"}</dd>
                  </div>
                  <div className="field-row">
                    <dt>Facility</dt>
                    <dd className="truncate">{facilityName ?? "Not assigned"}</dd>
                  </div>
                  <div className="field-row">
                    <dt>Language</dt>
                    <dd>{user?.language ?? "Hindi"}</dd>
                  </div>
                  <div className="field-row">
                    <dt>Account status</dt>
                    <dd>
                      {user?.isActive === false ? (
                        <span className="badge badge-red">Inactive</span>
                      ) : (
                        <span className="badge badge-green">Active</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </PanelBody>
            </Panel>
          )}

          {activeTab === "profile" && isPinSet() && (
            <Panel>
              <PanelHeader
                title="Device PIN"
                description="Change the PIN that protects this device"
              />
              <PanelBody className="space-y-4">
                <ChangePinForm />
              </PanelBody>
            </Panel>
          )}

          {activeTab === "sync" && (
            <Panel>
              <PanelHeader
                title="Sync"
                description="What is on this device and what the server has"
              />
              <PanelBody className="space-y-5">
                <div
                  className={
                    syncState.tone === "red"
                      ? "rounded border border-triage-red-line bg-triage-red-bg px-4 py-3"
                      : syncState.tone === "amber"
                        ? "rounded border border-triage-amber-line bg-triage-amber-bg px-4 py-3"
                        : "rounded border border-triage-green-line bg-triage-green-bg px-4 py-3"
                  }
                >
                  <h3
                    className={
                      syncState.tone === "red"
                        ? "text-sm font-semibold text-triage-red"
                        : syncState.tone === "amber"
                          ? "text-sm font-semibold text-triage-amber"
                          : "text-sm font-semibold text-triage-green"
                    }
                  >
                    {syncState.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">{syncState.detail}</p>
                </div>

                <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  <div className="field-row">
                    <dt>Waiting to sync</dt>
                    <dd className="tnum">{pluralChanges(pendingChanges)}</dd>
                  </div>
                  <div className="field-row">
                    <dt>Needs review</dt>
                    <dd className="tnum">{conflicts > 0 ? `${conflicts} to review` : "Nothing"}</dd>
                  </div>
                  <div className="field-row">
                    <dt>Last successful sync</dt>
                    <dd className="tnum">
                      {sync?.lastSync ? format(new Date(sync.lastSync), "d MMM, HH:mm") : "Not yet"}
                    </dd>
                  </div>
                  <div className="field-row">
                    <dt>Records stored</dt>
                    <dd>This device only</dd>
                  </div>
                </dl>

                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={() => void runSync()}
                  disabled={syncing || !online}
                >
                  {syncing ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                      />
                      Sending…
                    </>
                  ) : (
                    <>
                      <SyncIcon className="h-4 w-4" />
                      Send now
                    </>
                  )}
                </button>

                {syncMessage ? (
                  <output className="flex items-center justify-center gap-1.5 text-sm text-triage-green">
                    <CheckIcon className="h-4 w-4" />
                    {syncMessage}
                  </output>
                ) : null}

                {sync?.lastError ? (
                  <p className="rounded border border-line bg-canvas px-3 py-2 text-xs leading-relaxed text-ink-muted">
                    Last attempt could not reach the server. Nothing was lost: those records stay on
                    this device and are retried automatically.
                  </p>
                ) : null}
              </PanelBody>
            </Panel>
          )}

          {activeTab === "notifications" && (
            <Panel>
              <PanelHeader
                title="Notification preferences"
                description="Saved on this device only"
              />
              <PanelBody>
                <div className="space-y-2">
                  {NOTIFICATION_PREFS.map((pref) => (
                    <label
                      key={pref.id}
                      htmlFor={`pref-${pref.id}`}
                      className="flex min-h-touch cursor-pointer items-center justify-between gap-4 rounded border border-line px-3 py-2.5 hover:bg-canvas"
                    >
                      <span>
                        <span className="block text-sm font-medium text-ink">{pref.label}</span>
                        <span className="block text-xs text-ink-subtle">{pref.description}</span>
                      </span>
                      <input
                        id={`pref-${pref.id}`}
                        type="checkbox"
                        checked={prefs[pref.id]}
                        onChange={(e) => togglePref(pref.id, e.target.checked)}
                        className="h-5 w-5 shrink-0 rounded-sm border-line-strong text-primary focus:ring-primary-ring"
                      />
                    </label>
                  ))}
                </div>
              </PanelBody>
            </Panel>
          )}

          {activeTab === "about" && (
            <Panel>
              <PanelHeader title="About" description="Build and platform information" />
              <PanelBody className="space-y-5">
                <div className="flex items-center gap-4 rounded border border-line-soft bg-canvas p-4">
                  <BrandMark size={44} variant="full" title={null} />
                  <div>
                    <h2 className="text-sm font-semibold text-ink">Matru Suraksha</h2>
                    <p className="text-xs text-ink-subtle">
                      High-risk pregnancy care · Araria · Version 0.1.0 (MVP)
                    </p>
                  </div>
                </div>

                <dl className="grid gap-x-6 sm:grid-cols-2">
                  <div className="field-row">
                    <dt>Build</dt>
                    <dd>Development</dd>
                  </div>
                  <div className="field-row">
                    <dt>Platform</dt>
                    <dd>PWA (offline-first)</dd>
                  </div>
                  <div className="field-row">
                    <dt>Database</dt>
                    <dd>IndexedDB + PostgreSQL</dd>
                  </div>
                  <div className="field-row">
                    <dt>Sync</dt>
                    <dd>Background / manual</dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-2 border-t border-line-soft pt-4">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void copySupportDiagnostics()}
                  >
                    Copy diagnostics
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void wipeThisDevice()}
                    disabled={wiping}
                  >
                    {wiping ? "Erasing..." : "Erase this device"}
                  </button>
                </div>

                {diagnosticsMessage ? (
                  <output className="block text-xs text-triage-green">{diagnosticsMessage}</output>
                ) : null}

                <p className="border-t border-line-soft pt-4 text-xs leading-relaxed text-ink-subtle">
                  Built for India's National Health Mission. This deployment carries synthetic demo
                  data only and must not be used for real patient records.
                </p>
              </PanelBody>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
