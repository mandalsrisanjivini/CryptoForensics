/**
 * Centralized API Base URL and fetch resolution for CryptoForensics.
 * 
 * - Production: defaults to live Railway backend https://cryptoforensics-production.up.railway.app
 *   (or custom override from import.meta.env.VITE_API_BASE_URL).
 * - Local development: defaults to '' (uses Vite proxy to http://127.0.0.1:8000).
 */

const PRODUCTION_DEFAULT_URL = 'https://cryptoforensics-production.up.railway.app';

const rawBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? PRODUCTION_DEFAULT_URL : '')
).trim();

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

if (API_BASE_URL) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = function (resource, init) {
    if (typeof resource === 'string' && resource.startsWith('/api')) {
      return originalFetch(`${API_BASE_URL}${resource}`, init);
    }
    if (resource instanceof Request) {
      try {
        const urlObj = new URL(resource.url, window.location.origin);
        if (urlObj.pathname.startsWith('/api')) {
          const targetUrl = `${API_BASE_URL}${urlObj.pathname}${urlObj.search}`;
          return originalFetch(new Request(targetUrl, resource), init);
        }
      } catch (e) {
        // Fallback to default fetch
      }
    }
    return originalFetch(resource, init);
  };
  console.log(`[CryptoForensics] Production API connected to: ${API_BASE_URL}`);
} else {
  console.log('[CryptoForensics] Using local development API proxy (/api -> http://127.0.0.1:8000)');
}
