import { useEffect, useState } from "react";
import { isEncryptionRequired } from "../lib/crypto";
import { migrateLocalData } from "../lib/db/repositories";
import { isLocked, isPinSet, onLockChange, registerAutoLock } from "../lib/lock";
import LockScreen from "../pages/LockScreen";

/**
 * Gates the entire app behind the device PIN.
 *
 * - Pilot build, first run: PIN setup is mandatory before any screen renders.
 * - PIN set and locked: the lock screen covers the app.
 * - Unlocked: children render, and any rows written before encryption are
 *   rewritten under the data key in the background.
 * - Demo build: synthetic data only, so the gate stays out of the way and the
 *   public demo does not ask every visitor to invent a PIN.
 */
export function LockGate({ children }: { children: React.ReactNode }) {
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(true);

  useEffect(() => {
    registerAutoLock();
    const set = isPinSet();
    setPinSet(set);
    setLocked(set ? isLocked() : false);

    const unsub = onLockChange((l) => setLocked(l));
    return unsub;
  }, []);

  // Encrypt legacy rows once the key is in memory. Repositories read plaintext
  // transparently, so a device that upgrades mid-shift keeps working while the
  // rewrite runs.
  useEffect(() => {
    if (!pinSet || locked) return;
    void migrateLocalData().catch((error: unknown) => {
      console.warn(
        "[lock] local data migration failed:",
        error instanceof Error ? error.message : error
      );
    });
  }, [pinSet, locked]);

  if (pinSet === null) return null;

  if (!pinSet) {
    if (!isEncryptionRequired()) return <>{children}</>;
    return (
      <LockScreen
        setupMode
        onUnlock={() => {}}
        onWiped={() => setPinSet(false)}
        onSetupComplete={() => {
          setPinSet(true);
          setLocked(false);
        }}
      />
    );
  }

  if (locked) {
    return (
      <LockScreen
        onUnlock={() => setLocked(false)}
        onWiped={() => {
          setPinSet(false);
          setLocked(true);
        }}
      />
    );
  }

  return <>{children}</>;
}
