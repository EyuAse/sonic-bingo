/**
 * Client Version & Cache Freshness Guard
 * Ensures Telegram Desktop and Mobile WebViews immediately synchronize
 * with the latest deployed build, invalidating any stale local storage states.
 */
export const CLIENT_BUILD_VERSION = '20261025_ORGANIC_BOTS_SCURVE_V3';

class VersionService {
  private static instance: VersionService;

  private constructor() {
    this.ensureFreshness();
  }

  public static getInstance(): VersionService {
    if (!VersionService.instance) {
      VersionService.instance = new VersionService();
    }
    return VersionService.instance;
  }

  public ensureFreshness() {
    try {
      const storedVersion = localStorage.getItem('sonic_app_client_version');
      if (storedVersion !== CLIENT_BUILD_VERSION) {
        console.log(`🚀 [VersionService] New build detected: ${storedVersion || 'none'} -> ${CLIENT_BUILD_VERSION}. Synchronizing cache...`);
        // Invalidate stale ticket cache from older builds so round state rehydrates fresh from server
        localStorage.removeItem('betika_bingo_active_ticket');
        localStorage.setItem('sonic_app_client_version', CLIENT_BUILD_VERSION);
      }
    } catch (e) {
      console.warn('[VersionService] Cache guard check skipped:', e);
    }
  }

  public getVersion(): string {
    return CLIENT_BUILD_VERSION;
  }
}

export const versionService = VersionService.getInstance();
