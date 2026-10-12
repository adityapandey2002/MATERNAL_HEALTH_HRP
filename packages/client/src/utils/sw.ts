export async function registerSW(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      console.log('[SW] Registered:', registration.scope);

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[SW] New version available');
              if (confirm('A new version of HRP Tracker is available. Reload to update?')) {
                window.location.reload();
              }
            }
          });
        }
      });
    } catch (error) {
      console.error('[SW] Registration failed:', error);
    }
  }
}

export function requestNotificationPermission(): Promise<NotificationPermission> {
  if ('Notification' in window) {
    return Notification.requestPermission();
  }
  return Promise.resolve('denied');
}

export function showNotification(title: string, options?: NotificationOptions): void {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { icon: '/pwa-192.png', badge: '/pwa-192.png', ...options });
  }
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function onOnlineChange(callback: (online: boolean) => void): () => void {
  const handler = () => callback(navigator.onLine);
  window.addEventListener('online', handler);
  window.addEventListener('offline', handler);
  return () => {
    window.removeEventListener('online', handler);
    window.removeEventListener('offline', handler);
  };
}