import { getDeviceId } from "./device-id";

/**
 * Support diagnostics.
 *
 * Everything a helpdesk needs to triage a "it is not syncing" report, with
 * nothing that identifies a patient. Names, phones, ABHA numbers, addresses
 * and free-text notes never leave the device through this path.
 */

export interface DiagnosticSnapshot {
  deviceId: string | null;
  appVersion: string;
  platform: "android" | "web";
  online: boolean;
  pendingChanges: number;
  conflicts: number;
  lastSync: string | null;
  lastError: string | null;
  userAgent: string;
  generatedAt: string;
}

export interface DiagnosticInput {
  pendingChanges: number;
  conflicts: number;
  lastSync: string | null;
  lastError: string | null;
}

/** Builds a redacted snapshot. Pure apart from reading the device id. */
export function buildDiagnostics(input: DiagnosticInput): DiagnosticSnapshot {
  return {
    deviceId: getDeviceId(),
    appVersion: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "0.1.0-mvp",
    platform: import.meta.env.VITE_NATIVE_APP === "true" ? "android" : "web",
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    pendingChanges: input.pendingChanges,
    conflicts: input.conflicts,
    lastSync: input.lastSync,
    lastError: input.lastError,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    generatedAt: new Date().toISOString(),
  };
}

/** Renders the snapshot as plain text, safe to paste into a ticket. */
export function formatDiagnostics(snapshot: DiagnosticSnapshot): string {
  return [
    "Matru Suraksha diagnostics",
    `Generated: ${snapshot.generatedAt}`,
    `Device ID: ${snapshot.deviceId ?? "unknown"}`,
    `App version: ${snapshot.appVersion}`,
    `Platform: ${snapshot.platform}`,
    `Online: ${snapshot.online}`,
    `Pending changes: ${snapshot.pendingChanges}`,
    `Conflicts: ${snapshot.conflicts}`,
    `Last sync: ${snapshot.lastSync ?? "never"}`,
    `Last error: ${snapshot.lastError ?? "none"}`,
    `User agent: ${snapshot.userAgent}`,
  ].join("\n");
}

/**
 * Copies the diagnostics to the clipboard. Returns the text so the caller can
 * show it even when the clipboard API is unavailable (older WebView).
 */
export async function copyDiagnostics(input: DiagnosticInput): Promise<string> {
  const text = formatDiagnostics(buildDiagnostics(input));
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fall through: the caller still gets the text to display.
  }
  return text;
}
