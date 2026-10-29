import type { UserRole } from "@hrp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BrandMark } from "../components/ui/BrandMark";
import { BellIcon, CheckIcon, InfoIcon, SyncIcon, UserIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "../components/ui/Panel";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { api } from "../lib/api";
import { initialsFor } from "../lib/nav";

type SettingsTab = "profile" | "sync" | "notifications" | "about";

const ROLE_LABEL: Record<UserRole, string> = {
  ANM: "ANM · field worker",
  CHO: "CHO · facility",
  BHM: "Block nodal officer",
  DHS: "District officer",
  HELPDESK: "HRP Helpdesk",
};

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

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [prefs, setPrefs] = useState<Record<NotificationId, boolean>>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefs(readPrefs());
  }, []);

  const { data: user } = useQuery({ queryKey: ["auth", "me"], queryFn: api.auth.me });
  const { data: facilities } = useQuery({ queryKey: ["facilities"], queryFn: api.facilities.list });

  const syncMutation = useMutation({
    mutationFn: api.sync.push,
    onSuccess: () => {
      localStorage.setItem("lastSyncTime", String(Date.now()));
      queryClient.invalidateQueries({ queryKey: ["sync"] });
    },
  });

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

          {activeTab === "sync" && (
            <Panel>
              <PanelHeader title="Sync" description="Device data and server synchronisation" />
              <PanelBody className="space-y-5">
                <div className="rounded border border-info-line bg-info-bg px-4 py-3">
                  <h3 className="text-sm font-semibold text-info">Automatic sync is on</h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    Records save on this device first and sync when the connection returns. Use the
                    button below to force a sync now.
                  </p>
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={() => syncMutation.mutate({ patients: [], visits: [], referrals: [] })}
                  disabled={syncMutation.isPending}
                >
                  {syncMutation.isPending ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                      />
                      Syncing…
                    </>
                  ) : (
                    <>
                      <SyncIcon className="h-4 w-4" />
                      Sync Now
                    </>
                  )}
                </button>

                {syncMutation.isSuccess && (
                  <p className="flex items-center justify-center gap-1.5 text-sm text-triage-green">
                    <CheckIcon className="h-4 w-4" />
                    Sync complete
                  </p>
                )}

                <dl className="grid gap-x-6 sm:grid-cols-2">
                  <div className="field-row">
                    <dt>Storage</dt>
                    <dd>IndexedDB on this device</dd>
                  </div>
                  <div className="field-row">
                    <dt>Server</dt>
                    <dd>PostgreSQL</dd>
                  </div>
                  <div className="field-row">
                    <dt>Mode</dt>
                    <dd>Background / manual</dd>
                  </div>
                  <div className="field-row">
                    <dt>Offline access</dt>
                    <dd>
                      <span className="badge badge-green">Enabled</span>
                    </dd>
                  </div>
                </dl>
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
                    <h2 className="text-sm font-semibold text-ink">
                      High-Risk Pregnancy Tracking of Araria
                    </h2>
                    <p className="text-xs text-ink-subtle">Version 0.1.0 (MVP)</p>
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
