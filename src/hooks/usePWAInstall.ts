import { useState, useEffect, useCallback } from 'react';

export interface PWAInstallState {
  canInstall: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  isIOS: boolean;
  isTelegram: boolean;
  showIOSModal: boolean;
  setShowIOSModal: (show: boolean) => void;
  triggerInstall: () => Promise<'accepted' | 'dismissed' | 'ios' | 'unsupported'>;
}

export function usePWAInstall(): PWAInstallState {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isTelegram, setIsTelegram] = useState<boolean>(false);
  const [showIOSModal, setShowIOSModal] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Detect if running inside Telegram Mini App
    const telegramActive = !!(window as any).Telegram?.WebApp?.initData;
    setIsTelegram(telegramActive);

    // 2. Detect iOS / iPadOS
    const userAgent = window.navigator.userAgent || '';
    const platform = window.navigator.platform || '';
    const iosDevice =
      /iPad|iPhone|iPod/.test(userAgent) ||
      (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(iosDevice);

    // 3. Detect Standalone PWA Mode
    const standaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');
    setIsStandalone(standaloneMode);

    if (standaloneMode) {
      setIsInstalled(true);
      setCanInstall(false);
      return;
    }

    // 4. On iOS, if not standalone and not inside Telegram, install is always possible via Share menu
    if (iosDevice && !telegramActive) {
      setCanInstall(true);
    }

    // 5. Chromium BeforeInstallPrompt Event Listener
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent browser default mini-infobar
      e.preventDefault();
      setDeferredPrompt(e);
      // Only show install if not inside Telegram
      if (!telegramActive) {
        setCanInstall(true);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
      console.log('🎉 [PWA] Sonic Agent Terminal successfully installed!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'ios' | 'unsupported'> => {
    // If running on iOS Safari, display the interactive visual guide modal
    if (isIOS) {
      setShowIOSModal(true);
      return 'ios';
    }

    // If on Android/Desktop Chromium with captured prompt
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setCanInstall(false);
          setDeferredPrompt(null);
          return 'accepted';
        }
        return 'dismissed';
      } catch (err) {
        console.warn('⚠️ [PWA] Install prompt failed:', err);
        return 'unsupported';
      }
    }

    // If unsupported browser or prompt not fired, show iOS/universal instructions modal
    setShowIOSModal(true);
    return 'unsupported';
  }, [isIOS, deferredPrompt]);

  return {
    canInstall: canInstall && !isStandalone && !isTelegram,
    isInstalled,
    isStandalone,
    isIOS,
    isTelegram,
    showIOSModal,
    setShowIOSModal,
    triggerInstall,
  };
}

