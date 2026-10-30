/**
 * Centralized Environment & URL Configuration
 * Ensures robust connectivity across Localhost, Telegram Mini App (iOS/Android/Desktop),
 * Netlify, Vercel, Render, and custom domains.
 */

export const LIVE_BACKEND_ORIGIN = 'https://sonic-bingo-enod.onrender.com';

/**
 * Returns the authoritative backend origin for Socket.IO and REST API calls.
 */
export const getBackendOrigin = (): string => {
  if (typeof window === 'undefined') return 'http://localhost:5000';

  const hostname = window.location.hostname;

  // Local development environments & test tunnels (e.g. loca.lt, ngrok)
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.loca.lt') ||
    hostname.endsWith('.trycloudflare.com') ||
    hostname.endsWith('.lhr.life') ||
    hostname.includes('pinggy') ||
    hostname.includes('ngrok') ||
    hostname.includes('localtunnel')
  ) {
    return window.location.origin;
  }

  // If running directly on any Render domain, dynamically use current origin
  if (hostname.endsWith('.onrender.com')) {
    return window.location.origin;
  }

  // Allow explicit override via environment variable if defined
  const envUrl = (import.meta as any).env?.VITE_BACKEND_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.startsWith('http')) {
    return envUrl.replace(/\/+$/, '');
  }

  // Deployed production environment (Telegram WebApp on iOS/Android/Desktop, Netlify, Render, Vercel)
  return LIVE_BACKEND_ORIGIN;
};

/**
 * Returns the base URL for REST API endpoints (/api).
 * In local dev, uses relative '/api' proxied by Vite.
 * In production / Telegram Mini App, uses the full backend URL to prevent 404s on static hosts.
 */
export const getApiBase = (): string => {
  if (typeof window === 'undefined') return 'http://localhost:5000/api';

  const hostname = window.location.hostname;
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.loca.lt') ||
    hostname.endsWith('.trycloudflare.com') ||
    hostname.endsWith('.lhr.life') ||
    hostname.includes('ngrok') ||
    hostname.includes('localtunnel')
  ) {
    return '/api';
  }

  return `${getBackendOrigin()}/api`;
};
