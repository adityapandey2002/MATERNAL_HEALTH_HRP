/**
 * Build identity, baked in by the release workflow.
 *
 * It lives in one module so the About tab, the mobile menu footer and the
 * crash panel all report the same string. When a field phone shows a blank or
 * odd screen, "which APK is this?" is the first question to answer.
 */
export const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "dev";
export const APP_GIT_SHA: string | undefined = import.meta.env.VITE_GIT_SHA;

/** `1.0.6-pilot (a1b2c3d)` or just `dev` when no SHA was injected. */
export function buildLabel(): string {
  return APP_GIT_SHA ? `${APP_VERSION} (${APP_GIT_SHA.slice(0, 7)})` : APP_VERSION;
}
