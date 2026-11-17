/**
 * ⚡ Safe PWA Service Worker Registration
 * Handles registration for the Sonic Agent Portal PWA with safety guards:
 * - Completely suppressed inside Telegram Mini App (zero interference with Telegram SDK)
 * - Safe error handling and lifecycle logging
 */

export function registerPwaServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // 🛑 FIREWALL 2: Suppress inside Telegram Mini App
  // Telegram has its own client caching and webview container.
  const isTelegramMiniApp = !!(window as any).Telegram?.WebApp?.initData;
  if (isTelegramMiniApp) {
    return;
  }

  // Register only when window loads to avoid competing with initial bundle parsing
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('⚡ [PWA] Service Worker registered with scope:', registration.scope);

        // Check for updates
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('⚡ [PWA] New version available! Content updated in background.');
              }
            };
          }
        };
      })
      .catch((error) => {
        // Non-fatal, keep application functioning perfectly
        console.warn('⚠️ [PWA] Service Worker registration skipped or failed:', error);
      });
  });
}

