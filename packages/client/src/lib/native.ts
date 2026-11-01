import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";
import { useEffect } from "react";
import { pullCohort } from "./sync/pull";
import { drain } from "./sync/queue";

/**
 * A page can claim the hardware back button. Returning `true` means the page
 * handled the press (usually by asking "discard this form?"), so the app must
 * not navigate away.
 */
type BackGuard = () => boolean;

let backGuard: BackGuard | null = null;
let registered = false;

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Guard against losing a half-filled form to the hardware back button. Only one
 * page can be on screen, so only the latest registration is kept; React calls
 * the cleanup on unmount.
 */
export function setNativeBackGuard(guard: BackGuard | null): void {
  backGuard = guard;
}

/**
 * Native lifecycle wiring, called once at startup.
 *
 * Android can stop the WebView at any moment, and `navigator.onLine` is
 * unreliable right after a phone wakes up. The Capacitor plugins report the
 * real state, so the queue is drained on resume and on reconnect instead of
 * waiting for the user to open a screen.
 */
export async function registerNativeLifecycle(): Promise<void> {
  if (registered || !isNativeApp()) return;
  registered = true;

  try {
    await App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) return;
      void drain();
      void pullCohort();
    });

    await Network.addListener("networkStatusChange", (status) => {
      if (!status.connected) return;
      void drain();
      void pullCohort();
    });

    await App.addListener("backButton", () => {
      if (backGuard?.()) return;
      if (window.location.pathname !== "/") {
        window.history.back();
        return;
      }
      // At the home screen, keep the app warm in the background: an ANM who
      // taps back once should not have to wait through a cold start.
      void App.minimizeApp();
    });
  } catch (error) {
    // A platform without these APIs (or a web preview) must still run.
    console.warn("[native] lifecycle listeners unavailable:", error);
  }
}

/**
 * On Android an unsaved registration form is one back-tap away from being lost.
 * While `isDirty` is true the hardware back button asks before discarding; on
 * the web there is no such button and this is a no-op.
 */
export function useUnsavedChangesGuard(
  isDirty: boolean,
  message = "Discard this form? Nothing has been saved yet."
): void {
  useEffect(() => {
    if (!isDirty || !isNativeApp()) {
      setNativeBackGuard(null);
      return;
    }
    setNativeBackGuard(() => {
      // Always consume the press: either the user stays, or we navigate
      // ourselves after a confirmed discard.
      if (window.confirm(message)) {
        setNativeBackGuard(null);
        window.history.back();
      }
      return true;
    });
    return () => setNativeBackGuard(null);
  }, [isDirty, message]);
}
