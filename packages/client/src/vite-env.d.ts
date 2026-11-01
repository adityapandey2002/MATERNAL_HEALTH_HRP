/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin. `/api` for the web build; absolute for the bundled app. */
  readonly VITE_API_URL?: string;
  /** "true" in the Capacitor build, which cannot use the refresh cookie. */
  readonly VITE_NATIVE_APP?: string;
  /** "false" hides the shared demo logins in a pilot APK. */
  readonly VITE_DEMO_MODE?: string;
}
