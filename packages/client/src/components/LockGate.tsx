import { useEffect, useState } from "react";
import { isLocked, isPinSet, onLockChange, registerAutoLock } from "../lib/lock";
import LockScreen from "../pages/LockScreen";

const IS_DEMO = import.meta.env.VITE_DEMO_MODE !== "false";

/**
 * Gates the entire app behind the device PIN.
 *
 * - First run (no PIN set): shows setup screen. In demo mode a "Skip" option
 *   is available; in a pilot build the PIN is mandatory.
 * - PIN set and locked: shows the lock screen.
 * - Unlocked: renders children.
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

  // Still loading
  if (pinSet === null) return null;

  // No PIN set yet
  if (!pinSet) {
    if (IS_DEMO) {
      // Demo mode: allow skipping PIN setup
      return (
        <>
          <LockScreen
            setupMode
            onUnlock={() => {}}
            onWiped={() => {}}
            onSetupComplete={() => {
              setPinSet(true);
              setLocked(false);
            }}
          />
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setPinSet(true);
                setLocked(false);
              }}
            >
              Skip (demo only)
            </button>
          </div>
        </>
      );
    }
    // Pilot mode: PIN is mandatory
    return (
      <LockScreen
        setupMode
        onUnlock={() => {}}
        onWiped={() => {}}
        onSetupComplete={() => {
          setPinSet(true);
          setLocked(false);
        }}
      />
    );
  }

  // PIN set but locked
  if (locked) {
    return (
      <LockScreen
        onUnlock={() => setLocked(false)}
        onWiped={() => {
          setPinSet(false);
          setLocked(false);
        }}
      />
    );
  }

  // Unlocked
  return <>{children}</>;
}
