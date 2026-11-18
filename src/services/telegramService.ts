import { TelegramUser, TelegramWebApp } from '../types/telegram';

export class TelegramService {
  private static instance: TelegramService;

  private constructor() {}

  public static getInstance(): TelegramService {
    if (!TelegramService.instance) {
      TelegramService.instance = new TelegramService();
    }
    return TelegramService.instance;
  }

  public get webApp(): TelegramWebApp | null {
    if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
      return window.Telegram.WebApp;
    }
    return null;
  }

  public isTelegram(): boolean {
    const tg = this.webApp;
    return !!(
      (tg && (tg.initData?.length > 0 || tg.initDataUnsafe?.user)) ||
      (typeof window !== 'undefined' && (
        window.location.hash.includes('tgWebAppData') ||
        window.location.search.includes('tgWebAppData') ||
        window.location.search.includes('tg_id')
      ))
    );
  }

  /**
   * Resilient Multi-Layer Telegram User Retrieval
   * 1. Direct WebApp initDataUnsafe.user
   * 2. Raw WebApp initData query string
   * 3. URL hash (#tgWebAppData=...)
   * 4. URL query parameters (?tg_id=... or ?tgWebAppData=...)
   * 5. Session storage fallback
   */
  public getTelegramUser(): TelegramUser | null {
    // 1. Direct Telegram WebApp SDK Object
    const tg = this.webApp;
    if (tg?.initDataUnsafe?.user?.id) {
      this.cacheTelegramUser(tg.initDataUnsafe.user);
      return tg.initDataUnsafe.user;
    }

    // 2. Parse raw initData query string if user not yet unpacked
    if (tg?.initData && tg.initData.length > 0) {
      try {
        const params = new URLSearchParams(tg.initData);
        const userStr = params.get('user');
        if (userStr) {
          const parsed = JSON.parse(decodeURIComponent(userStr));
          if (parsed?.id) {
            this.cacheTelegramUser(parsed);
            return parsed;
          }
        }
      } catch (e) {
        console.warn('Failed parsing tg.initData user:', e);
      }
    }

    if (typeof window === 'undefined') return null;

    // 3. Parse URL Hash fragment (#tgWebAppData=...)
    try {
      const hash = window.location.hash.replace(/^#/, '');
      if (hash.includes('tgWebAppData') || hash.includes('user=')) {
        const hashParams = new URLSearchParams(hash);
        const dataStr = hashParams.get('tgWebAppData') || hash;
        const innerParams = new URLSearchParams(dataStr);
        const userJson = innerParams.get('user');
        if (userJson) {
          const parsed = JSON.parse(decodeURIComponent(userJson));
          if (parsed?.id) {
            this.cacheTelegramUser(parsed);
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('Failed parsing hash tgWebAppData user:', e);
    }

    // 4. Parse URL Query Parameters (?tg_id=... or ?tgWebAppData=...)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tgDataQuery = urlParams.get('tgWebAppData');
      if (tgDataQuery) {
        const innerParams = new URLSearchParams(tgDataQuery);
        const userJson = innerParams.get('user');
        if (userJson) {
          const parsed = JSON.parse(decodeURIComponent(userJson));
          if (parsed?.id) {
            this.cacheTelegramUser(parsed);
            return parsed;
          }
        }
      }

      // Check direct bot launcher query parameter fallback (?tg_id=...)
      const directTgId = urlParams.get('tg_id');
      if (directTgId && !isNaN(Number(directTgId))) {
        const fallbackUser: TelegramUser = {
          id: Number(directTgId),
          first_name: urlParams.get('first_name') || urlParams.get('name') || 'Telegram Player',
          username: urlParams.get('username') || undefined
        };
        this.cacheTelegramUser(fallbackUser);
        return fallbackUser;
      }
    } catch (e) {
      console.warn('Failed parsing query tgWebAppData user:', e);
    }

    // 5. Session Storage Cache fallback
    try {
      const cached = sessionStorage.getItem('sonic_tg_user');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.id) return parsed;
      }
    } catch {}

    return null;
  }

  private cacheTelegramUser(user: TelegramUser) {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem('sonic_tg_user', JSON.stringify(user));
    } catch {}
  }

  /**
   * Poll briefly (up to maxWaitMs) in case telegram-web-app.js takes 50-100ms to parse hash on first load
   */
  public async waitForTelegramUser(maxWaitMs = 350): Promise<TelegramUser | null> {
    const immediate = this.getTelegramUser();
    if (immediate) return immediate;

    const startTime = Date.now();
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const user = this.getTelegramUser();
        if (user || Date.now() - startTime >= maxWaitMs) {
          clearInterval(interval);
          resolve(user);
        }
      }, 40);
    });
  }

  public getStartParam(): string | null {
    const tg = this.webApp;
    if (tg?.initDataUnsafe?.start_param) {
      return tg.initDataUnsafe.start_param;
    }
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const param = urlParams.get('startapp') || urlParams.get('ref') || urlParams.get('tgWebAppStartParam');
      if (param) return param;
    }
    return null;
  }

  public initWebApp() {
    const tg = this.webApp;
    if (!tg) return;

    try {
      tg.ready();
      tg.expand();

      if (tg.setHeaderColor) {
        tg.setHeaderColor('#fffdf8');
      }

      if (tg.setBackgroundColor) {
        tg.setBackgroundColor('#fefce8');
      }

      if (tg.enableClosingConfirmation) {
        tg.enableClosingConfirmation();
      }

      console.log('🚀 Telegram Mini App initialized:', {
        platform: tg.platform,
        version: tg.version,
        user: tg.initDataUnsafe?.user?.username || tg.initDataUnsafe?.user?.first_name
      });
    } catch (err) {
      console.warn('Telegram WebApp init notice:', err);
    }
  }

  /**
   * Request verified phone number from Telegram
   */
  public async requestTelegramPhone(): Promise<string | null> {
    const tg = this.webApp;
    if (!tg) return null;

    return new Promise((resolve) => {
      if (tg.requestContact) {
        tg.requestContact((shared: boolean, event?: any) => {
          if (shared) {
            const rawPhone =
              event?.response?.phone_number ||
              event?.phone_number ||
              tg.initDataUnsafe?.user?.id?.toString() ||
              '';
            console.log('📱 Telegram phone shared successfully:', rawPhone);
            resolve(rawPhone || null);
          } else {
            console.log('User declined Telegram phone sharing');
            resolve(null);
          }
        });
      } else {
        // Not supported on older client versions
        resolve(null);
      }
    });
  }

  /**
   * Haptic vibration feedback for ball calls and wins
   */
  public triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') {
    const tg = this.webApp;
    if (!tg || !tg.HapticFeedback) return;

    try {
      if (type === 'success' || type === 'warning' || type === 'error') {
        tg.HapticFeedback.notificationOccurred(type);
      } else {
        tg.HapticFeedback.impactOccurred(type);
      }
    } catch (e) {
      // Haptics not supported on desktop
    }
  }

  /**
   * Open Telegram Channel or Community Link
   */
  public openTelegramLink(url: string) {
    const tg = this.webApp;
    if (tg && tg.openTelegramLink) {
      tg.openTelegramLink(url);
    } else if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  }

  /**
   * Register listener for Telegram WebApp viewport changes (e.g. app expanded or resumed)
   */
  public onViewportChanged(callback: (eventData?: any) => void): () => void {
    const tg = this.webApp;
    if (!tg || !tg.onEvent) return () => {};

    try {
      tg.onEvent('viewportChanged', callback);
      return () => {
        if (tg.offEvent) {
          tg.offEvent('viewportChanged', callback);
        }
      };
    } catch {
      return () => {};
    }
  }

  /**
   * Detect if running on PC / Desktop (Telegram Desktop, macOS Telegram, Telegram Web, or Desktop browser)
   */
  public isDesktopPlatform(): boolean {
    const tg = this.webApp;
    if (tg?.platform) {
      const p = tg.platform.toLowerCase();
      if (['tdesktop', 'macos', 'web', 'weba', 'webk'].includes(p)) {
        return true;
      }
      if (['android', 'ios'].includes(p)) {
        return false;
      }
    }
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent || '';
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      if (isMobileUA) return false;
      return window.innerWidth >= 460 || window.matchMedia('(pointer: fine)').matches;
    }
    return false;
  }
}

export const telegramService = TelegramService.getInstance();
