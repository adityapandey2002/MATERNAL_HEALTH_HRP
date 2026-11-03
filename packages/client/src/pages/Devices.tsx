import type { Device } from "@hrp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import { useState } from "react";
import { EmptyState } from "../components/ui/EmptyState";
import { InfoIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel, PanelHeader } from "../components/ui/Panel";
import { type ApiError, api } from "../lib/api";
import { ROLE_LABEL } from "../lib/session";

/**
 * Devices that hold a copy of the field database.
 *
 * The point of this screen is the lost-phone case: a BHM or DHS officer marks
 * the handset revoked, the next request from it is refused, and the app wipes
 * its local patients. Revoking does not disable the person's account, so a
 * replacement ANM can sign in on a new phone under the same area.
 */
export default function DevicesPage() {
  const queryClient = useQueryClient();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["devices"],
    queryFn: () => api.devices.list(),
    retry: false,
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.devices.revoke(id),
    onSuccess: () => {
      setConfirmingId(null);
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });

  const devices = data?.data ?? [];
  const active = devices.filter((device) => !device.revokedAt);
  const revoked = devices.filter((device) => device.revokedAt);
  const error = revokeMutation.error as ApiError | null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Account"
        title="Devices"
        description="Phones and browsers that hold patient data for this block"
      />

      {error ? (
        <p
          className="rounded border border-triage-red-line bg-triage-red-bg px-3 py-2 text-sm text-triage-red"
          role="alert"
        >
          {error.message || "Could not revoke that device. Try again."}
        </p>
      ) : null}

      <Panel aria-labelledby="devices-heading">
        <PanelHeader
          id="devices-heading"
          title="Registered devices"
          description="Revoke a device the moment it is lost, stolen or handed over"
          action={<span className="badge badge-gray">{active.length} active</span>}
        />

        {isLoading ? (
          <div className="space-y-2 p-3 sm:p-4" aria-busy="true" aria-label="Loading devices">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-12 animate-pulse rounded bg-line-soft" />
            ))}
          </div>
        ) : null}

        {!isLoading && isError ? (
          <EmptyState
            title="Devices could not load"
            description="The device registry is unavailable right now."
          />
        ) : null}

        {!isLoading && !isError && devices.length === 0 ? (
          <EmptyState
            title="No devices yet"
            description="A device appears here the first time it signs in."
          />
        ) : null}

        {!isLoading && !isError && devices.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  <th scope="col">Platform</th>
                  <th scope="col">Last seen</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...active, ...revoked].map((device) => (
                  <DeviceRow
                    key={device.id}
                    device={device}
                    confirming={confirmingId === device.id}
                    pending={revokeMutation.isPending}
                    onAsk={() => setConfirmingId(device.id)}
                    onCancel={() => setConfirmingId(null)}
                    onRevoke={() => revokeMutation.mutate(device.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>

      <div className="flex items-start gap-2 rounded border border-info-line bg-info-bg px-4 py-3">
        <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        <p className="text-xs leading-relaxed text-ink-muted">
          Revoking stops the device from syncing and makes the app erase its local patients on the
          next request. Records already sent to the server are kept. If the phone is offline, it
          erases as soon as it reconnects.
        </p>
      </div>
    </div>
  );
}

function DeviceRow({
  device,
  confirming,
  pending,
  onAsk,
  onCancel,
  onRevoke,
}: {
  device: Device;
  confirming: boolean;
  pending: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onRevoke: () => void;
}) {
  const lastSeen = new Date(device.lastSeenAt);

  return (
    <tr className={device.revokedAt ? "opacity-60" : ""}>
      <td>
        <p className="font-medium text-ink">{device.userName ?? "—"}</p>
        <p className="tnum text-2xs text-ink-subtle">
          {device.employeeId ?? "—"}
          {device.userRole ? ` · ${ROLE_LABEL[device.userRole]}` : ""}
        </p>
      </td>
      <td className="text-xs text-ink-muted">
        {device.platform === "android" ? "Android app" : "Browser"}
      </td>
      <td className="text-xs text-ink-muted">
        <time dateTime={lastSeen.toISOString()} title={format(lastSeen, "dd MMM yyyy, HH:mm")}>
          {formatDistanceToNowStrict(lastSeen, { addSuffix: true })}
        </time>
      </td>
      <td>
        {device.revokedAt ? (
          <span className="badge badge-red">Revoked</span>
        ) : (
          <span className="badge badge-green">Active</span>
        )}
      </td>
      <td className="text-right">
        {device.revokedAt ? (
          <span className="text-2xs text-ink-subtle">—</span>
        ) : confirming ? (
          <div className="flex flex-wrap justify-end gap-1.5">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={pending}
              onClick={onRevoke}
            >
              Confirm revoke
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onAsk}
            aria-label={`Revoke device for ${device.userName ?? "this user"}`}
          >
            Revoke
          </button>
        )}
      </td>
    </tr>
  );
}
