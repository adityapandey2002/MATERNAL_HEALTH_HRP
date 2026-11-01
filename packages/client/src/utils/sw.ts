type UpdateListener = () => void;

let waitingWorker: ServiceWorker | null = null;
let reloading = false;
const updateListeners = new Set<UpdateListener>();

/**
 * Notifies the UI that a new build is installed and waiting.
 *
 * The app never reloads on its own: a field worker may be halfway through a
 * registration form, so applying the update is always an explicit tap.
 */
export function onUpdateReady(callback: UpdateListener): () => void {
  updateListeners.add(callback);
  if (waitingWorker) callback();
  return () => {
    updateListeners.delete(callback);
  };
}

/** Activates the waiting build. The page reloads once it takes control. */
export function applyUpdate(): void {
  if (!waitingWorker) return;
  reloading = true;
  waitingWorker.postMessage({ type: "SKIP_WAITING" });
}

function announce(worker: ServiceWorker | null): void {
  if (!worker) return;
  const check = () => {
    if (worker.state !== "installed") return;
    // No controller means this is the first install, not an update.
    if (!navigator.serviceWorker.controller) return;
    waitingWorker = worker;
    for (const listener of updateListeners) listener();
  };
  check();
  worker.addEventListener("statechange", check);
}

export async function registerSW(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) window.location.reload();
    });

    if (registration.waiting) {
      waitingWorker = registration.waiting;
      for (const listener of updateListeners) listener();
    }

    registration.addEventListener("updatefound", () => announce(registration.installing));
    announce(registration.installing);
  } catch (error) {
    console.error("[SW] Registration failed:", error);
  }
}

export function requestNotificationPermission(): Promise<NotificationPermission> {
  if ("Notification" in window) {
    return Notification.requestPermission();
  }
  return Promise.resolve("denied");
}

export function showNotification(title: string, options?: NotificationOptions): void {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { icon: "/pwa-192x192.png", badge: "/pwa-192x192.png", ...options });
  }
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function onOnlineChange(callback: (online: boolean) => void): () => void {
  const handler = () => callback(navigator.onLine);
  window.addEventListener("online", handler);
  window.addEventListener("offline", handler);
  return () => {
    window.removeEventListener("online", handler);
    window.removeEventListener("offline", handler);
  };
}
