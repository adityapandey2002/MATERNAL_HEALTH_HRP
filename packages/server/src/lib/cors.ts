/**
 * Capacitor serves the bundled app from a local origin. These are part of the
 * app itself, so they are always allowed with credentials; any remote web
 * origin still has to be listed in CORS_ORIGINS.
 */
export const APP_ORIGINS = ["https://localhost", "capacitor://localhost"];

/**
 * `true` reflects any origin, which is only safe for local development with no
 * allowlist configured. Every deployed environment gets an explicit list.
 */
export function corsOriginOption(origins: string[], nodeEnv: string): string[] | true {
  if (nodeEnv !== "production" && origins.length === 0) return true;
  return [...new Set([...origins, ...APP_ORIGINS])];
}
