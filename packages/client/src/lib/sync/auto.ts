import { canUseLocalData } from "../crypto";
import { hasAccessToken } from "../token-store";
import { pullCohort } from "./pull";
import { drain, pendingCount } from "./queue";

/**
 * One place that decides when the device talks to the server on its own.
 *
 * Field phones spend most of the day offline, so sync cannot wait for someone
 * to open Settings:
 * - reconnecting to a network pushes the queue and pulls the cohort;
 * - returning to the app does the same, because Android can suspend the WebView
 *   and drop the `online` event entirely;
 * - while the app is open, a slow tick pushes whatever is still queued.
 *
 * Every entry point is idempotent: `drain()` refuses to run twice at once, and
 * a short gap keeps a burst of events from firing three requests.
 */

/** Collapse a burst of triggers (wifi + resume + visibility) into one exchange. */
const MIN_GAP_MS = 5_000;
/** How often a queued change gets another push attempt while the app is open. */
const TICK_MS = 60_000;

let started = false;
let ticker: ReturnType<typeof setInterval> | null = null;
let running = false;
let lastRun = 0;

function canSync(): boolean {
  return hasAccessToken() && canUseLocalData();
}

/**
 * Push the queue, then pull the cohort.
 *
 * Push first: pulling before an accepted edit would briefly show the older
 * server copy winning.
 */
export async function runAutoSync(): Promise<void> {
  if (running || !canSync()) return;
  const now = Date.now();
  if (now - lastRun < MIN_GAP_MS) return;
  lastRun = now;
  running = true;
  try {
    await drain();
    await pullCohort();
  } catch (error) {
    // A forgotten network is the normal case here, not an error worth a banner.
    console.warn("[sync] automatic sync failed", error);
  } finally {
    running = false;
  }
}

/** Push only, and only when something is actually waiting. */
async function pushQueued(): Promise<void> {
  if (!canSync()) return;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  try {
    if ((await pendingCount()) === 0) return;
    await drain();
  } catch (error) {
    console.warn("[sync] retry tick failed", error);
  }
}

/**
 * Wire the web triggers once. Returns a stop function for tests and unmounts.
 *
 * The native build adds Capacitor's own network/app-state listeners on top;
 * they are the reliable signal when the WebView's `online` flag goes stale.
 */
export function startAutoSync(): () => void {
  if (started) return () => {};
  started = true;

  const onOnline = () => {
    void runAutoSync();
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") void runAutoSync();
  };

  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisibility);
  ticker = setInterval(() => {
    void pushQueued();
  }, TICK_MS);

  return () => {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisibility);
    if (ticker) clearInterval(ticker);
    ticker = null;
    started = false;
  };
}
