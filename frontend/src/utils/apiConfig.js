/**
 * Centralized API Base URL and fetch resolution for CryptoForensics.
 * 
 * - Local development: defaults to '' (uses Vite proxy to http://127.0.0.1:8000).
 * - Production on Vercel: uses import.meta.env.VITE_API_BASE_URL.
 * 
 * When VITE_API_BASE_URL is set, all relative `/api/...` fetch calls across the
 * entire application automatically resolve to the deployed backend URL.
 */

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
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
        // Fallback to default
      }
    }
    return originalFetch(resource, init);
  };
  console.log(`[CryptoForensics] Production API connected to: ${API_BASE_URL}`);
} else {
  console.log('[CryptoForensics] Using local development API proxy (/api -> http://127.0.0.1:8000)');
}
