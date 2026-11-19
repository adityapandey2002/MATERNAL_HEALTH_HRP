import { useEffect, useState } from "react";
import { isEncryptionRequired } from "../lib/crypto";
import { migrateLocalData } from "../lib/db/repositories";
import {
  isLocked,
  isPinSet,
  onLockChange,
  registerAutoLock,
  removePin,
  unlockWithDeviceKey,
} from "../lib/lock";
import { runAutoSync } from "../lib/sync/auto";
import LockScreen from "../pages/LockScreen";

/**
 * Prepares the device data key before any screen renders.
 *
 * The PIN is switched off for the pilot build: a fresh device loads (or
 * creates) a device-held key and goes straight in. A device that still has a
 * PIN from an older build is asked for it once, then the PIN is removed and the
 * same key is kept, so records already on the phone stay readable.
 *
 * Demo builds carry synthetic data only and run without a key at all.
 */
export function LockGate({ children }: { children: React.ReactNode }) {
  const [booting, setBooting] = useState(true);
  const [pinOnce, setPinOnce] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    registerAutoLock();
    return onLockChange((locked) => {
      if (locked) setPinOnce(true);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!isEncryptionRequired()) {
        if (!cancelled) {
          setReady(true);
          setBooting(false);
        }
        return;
      }

      if (isPinSet() && isLocked()) {
        if (!cancelled) {
          setPinOnce(true);
          setBooting(false);
        }
        return;
      }

      if (isPinSet()) {
        // Already unlocked in this session by an older build: finish the
        // migration quietly instead of showing a screen for a PIN nobody needs.
        await removePin();
      } else {
        await unlockWithDeviceKey();
      }

      if (!cancelled) {
        setReady(true);
        setBooting(false);
      }
    }

    void boot().catch((error: unknown) => {
      console.warn("[lock] could not prepare the device key", error);
      if (!cancelled) setBooting(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Encrypt legacy rows once the key is in memory. Repositories read plaintext
  // transparently, so a device that upgrades mid-shift keeps working while the
  // rewrite runs. Then push anything that queued while the app was closed.
  useEffect(() => {
    if (!ready) return;
    void migrateLocalData().catch((error: unknown) => {
      console.warn(
        "[lock] local data migration failed:",
        error instanceof Error ? error.message : error
      );
    });
    void runAutoSync();
  }, [ready]);

  if (pinOnce) {
    return (
      <LockScreen
        onUnlock={() => {
          void removePin().then(
            () => {
              setPinOnce(false);
              setReady(true);
            },
            (error: unknown) => {
              console.warn("[lock] could not remove the PIN", error);
              setPinOnce(false);
              setReady(true);
            }
          );
        }}
        onWiped={() => {
          setPinOnce(false);
          void unlockWithDeviceKey().then(() => setReady(true));
        }}
      />
    );
  }

  if (booting || !ready) return null;

  return <>{children}</>;
}
