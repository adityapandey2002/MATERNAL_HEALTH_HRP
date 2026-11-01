import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Sideloaded Android build of the field app.
 *
 * The WebView is served from `https://localhost`, so the API URL must be
 * absolute (`VITE_API_URL`) and the server must allow that origin (see
 * `packages/server/src/lib/cors.ts`). Cleartext HTTP stays off: a pilot device
 * must never cache patient data over a plain-text connection.
 */
const config: CapacitorConfig = {
  appId: "in.gov.araria.matrusuraksha",
  appName: "Matru Suraksha",
  webDir: "dist",
  android: {
    // Never load mixed content: an https WebView pulling http resources.
    allowMixedContent: false,
    // The device store (IndexedDB) must not be backed up off-device.
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: "https",
    cleartext: false,
  },
};

export default config;
