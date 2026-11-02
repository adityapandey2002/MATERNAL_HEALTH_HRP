import { useEffect, useState } from "react";
import { BrandMark } from "../components/ui/BrandMark";
import { LockIcon } from "../components/ui/Icons";

interface LockScreenProps {
  /** Called when the PIN is verified successfully. */
  onUnlock: () => void;
  /** Called when the device is wiped (10 failed attempts). */
  onWiped: () => void;
  /** If true, show PIN setup instead of entry. */
  setupMode?: boolean;
  /** Called when PIN setup is complete. */
  onSetupComplete?: () => void;
}

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

export default function LockScreen({
  onUnlock,
  onWiped,
  setupMode = false,
  onSetupComplete,
}: LockScreenProps) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [step, setStep] = useState<"enter" | "confirm">(setupMode ? "enter" : "enter");
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [shaking, setShaking] = useState(false);

  const isSetup = setupMode;
  const targetLength = 6;

  useEffect(() => {
    if (pin.length === targetLength && !isSetup) {
      void handleVerify();
    }
    if (pin.length === targetLength && isSetup && step === "enter") {
      setStep("confirm");
      setConfirmPin("");
    }
    if (confirmPin.length === targetLength && isSetup && step === "confirm") {
      void handleSetup();
    }
  }, [pin, confirmPin, isSetup, step]);

  async function handleVerify() {
    const { verifyPin } = await import("../lib/lock");
    const ok = await verifyPin(pin);
    if (ok) {
      onUnlock();
    } else {
      const { getFailedAttempts } = await import("../lib/lock");
      const a = getFailedAttempts();
      setAttempts(a);
      setError(a >= 10 ? "Device wiped for security." : `Wrong PIN. ${10 - a} attempts left.`);
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      setPin("");
      if (a >= 10) onWiped();
    }
  }

  async function handleSetup() {
    if (pin !== confirmPin) {
      setError("PINs don't match. Try again.");
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      setPin("");
      setConfirmPin("");
      setStep("enter");
      return;
    }
    const { setupPin } = await import("../lib/lock");
    await setupPin(pin);
    onSetupComplete?.();
  }

  function handleDigit(digit: string) {
    if (digit === "back") {
      if (isSetup && step === "confirm") {
        setConfirmPin((p) => p.slice(0, -1));
      } else {
        setPin((p) => p.slice(0, -1));
      }
      setError("");
      return;
    }
    if (digit === "") return;

    if (isSetup && step === "confirm") {
      if (confirmPin.length < targetLength) setConfirmPin((p) => p + digit);
    } else {
      if (pin.length < targetLength) setPin((p) => p + digit);
    }
    setError("");
  }

  const displayPin = isSetup && step === "confirm" ? confirmPin : pin;
  const title = isSetup
    ? step === "enter"
      ? "Create your PIN"
      : "Confirm your PIN"
    : "Enter your PIN";
  const subtitle = isSetup
    ? step === "enter"
      ? "Choose a 6-digit PIN to protect this device."
      : "Enter the same PIN again."
    : "This device is locked. Enter your 6-digit PIN.";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-xs">
        <div className="mb-8 flex flex-col items-center gap-3">
          <BrandMark size={48} variant="full" title={null} />
          <div className="text-center">
            <p className="text-sm font-semibold leading-tight text-ink">Matru Suraksha</p>
            <p className="text-2xs uppercase tracking-wider text-ink-subtle">Araria district</p>
          </div>
        </div>

        <div className="panel px-5 py-6 text-center">
          <div className="mb-4 flex justify-center">
            <LockIcon className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">{subtitle}</p>

          {/* PIN dots */}
          <div
            className={`mt-5 flex justify-center gap-3 ${shaking ? "animate-shake" : ""}`}
            aria-label={`${displayPin.length} of ${targetLength} digits entered`}
          >
            <span
              key="d0"
              className={`h-3 w-3 rounded-full border-2 transition-colors ${0 < displayPin.length ? "border-primary bg-primary" : "border-line bg-transparent"}`}
            />
            <span
              key="d1"
              className={`h-3 w-3 rounded-full border-2 transition-colors ${1 < displayPin.length ? "border-primary bg-primary" : "border-line bg-transparent"}`}
            />
            <span
              key="d2"
              className={`h-3 w-3 rounded-full border-2 transition-colors ${2 < displayPin.length ? "border-primary bg-primary" : "border-line bg-transparent"}`}
            />
            <span
              key="d3"
              className={`h-3 w-3 rounded-full border-2 transition-colors ${3 < displayPin.length ? "border-primary bg-primary" : "border-line bg-transparent"}`}
            />
            <span
              key="d4"
              className={`h-3 w-3 rounded-full border-2 transition-colors ${4 < displayPin.length ? "border-primary bg-primary" : "border-line bg-transparent"}`}
            />
            <span
              key="d5"
              className={`h-3 w-3 rounded-full border-2 transition-colors ${5 < displayPin.length ? "border-primary bg-primary" : "border-line bg-transparent"}`}
            />
          </div>

          {error && (
            <p className="mt-3 text-sm font-medium text-triage-red" role="alert">
              {error}
            </p>
          )}

          {attempts > 0 && attempts < 10 && !isSetup && (
            <p className="mt-1 text-xs text-ink-subtle">{attempts} of 10 attempts used</p>
          )}

          {/* Number pad */}
          <div className="mt-6 grid grid-cols-3 gap-2">
            {DIGITS.map((d) => {
              if (d === "") return <div key="empty" />;
              if (d === "back") {
                return (
                  <button
                    key="backspace"
                    type="button"
                    onClick={() => handleDigit("back")}
                    className="flex h-12 items-center justify-center rounded-lg border border-line bg-surface text-ink-muted hover:bg-canvas"
                    aria-label="Backspace"
                  >
                    ←
                  </button>
                );
              }
              return (
                <button
                  key={`digit-${d}`}
                  type="button"
                  onClick={() => handleDigit(d)}
                  className="flex h-12 items-center justify-center rounded-lg border border-line bg-surface text-lg font-semibold text-ink hover:bg-canvas"
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        <p className="mt-4 text-center text-2xs text-ink-subtle">
          {isSetup
            ? "This PIN protects all data on this device. Don't forget it — 10 wrong attempts wipes everything."
            : "Enter your PIN to access the app. 10 wrong attempts wipes all data."}
        </p>
      </div>
    </div>
  );
}
