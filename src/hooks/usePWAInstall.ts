import { useState, useEffect, useCallback } from 'react';

export interface PWAInstallState {
  canInstall: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  isIOS: boolean;
  isTelegram: boolean;
  isInstalling: boolean;
  showSuccessModal: boolean;
  setShowSuccessModal: (show: boolean) => void;
  showIOSModal: boolean;
  setShowIOSModal: (show: boolean) => void;
  triggerInstall: () => Promise<'accepted' | 'dismissed' | 'ios' | 'unsupported'>;
  openApp: () => void;
}

export function usePWAInstall(): PWAInstallState {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState<boolean>(true);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isTelegram, setIsTelegram] = useState<boolean>(false);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
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

    const previouslyInstalled = localStorage.getItem('sonic_agent_pwa_installed') === 'true';
    if (standaloneMode || previouslyInstalled) {
      setIsInstalled(true);
    }

    if (standaloneMode) {
      setCanInstall(false);
      return;
    }

    // 4. Chromium BeforeInstallPrompt Event Listener
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!telegramActive && !standaloneMode) {
        setCanInstall(true);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalling(false);
      setIsInstalled(true);
      setShowSuccessModal(true);
      setCanInstall(false);
      setDeferredPrompt(null);
      localStorage.setItem('sonic_agent_pwa_installed', 'true');
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
        setIsInstalling(true);
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;

        if (choice.outcome === 'accepted') {
          // Android is now building WebAPK in background. Keep active progress and show success modal
          setTimeout(() => {
            setIsInstalling(false);
            setIsInstalled(true);
            setShowSuccessModal(true);
            localStorage.setItem('sonic_agent_pwa_installed', 'true');
          }, 3200);
          return 'accepted';
        } else {
          setIsInstalling(false);
          return 'dismissed';
        }
      } catch (err) {
        setIsInstalling(false);
        console.warn('⚠️ [PWA] Install prompt failed:', err);
        setShowIOSModal(true);
        return 'unsupported';
      }
    }

    // If prompt not ready or already dismissed, show universal step-by-step guide
    setShowIOSModal(true);
    return 'unsupported';
  }, [isIOS, deferredPrompt]);

  const openApp = useCallback(() => {
    try {
      window.location.hash = '#/agent-portal';
      window.location.reload();
    } catch (e) {
      console.warn('Failed to reload in standalone:', e);
    }
  }, []);

  return {
    canInstall: canInstall && !isStandalone && !isTelegram,
    isInstalled,
    isStandalone,
    isIOS,
    isTelegram,
    isInstalling,
    showSuccessModal,
    setShowSuccessModal,
    showIOSModal,
    setShowIOSModal,
    triggerInstall,
    openApp,
  };
}
