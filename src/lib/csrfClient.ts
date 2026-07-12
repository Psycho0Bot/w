/**
 * Client-side utility for getting the CSRF token from the cookie.
 * The token is set by /api/auth/sync-session as a non-HttpOnly cookie.
 * It must be sent in the `x-csrf-token` header on all POST/PUT/DELETE requests.
 */
export function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const cookie = document.cookie
    .split('; ')
    .find(c => c.startsWith('csrf-token='));
  return cookie ? cookie.split('=')[1] : '';
}

/**
 * Returns the headers object with the CSRF token added.
 * Usage: `fetch('/api/route', { method: 'POST', headers: getCsrfHeaders() })`
 */
export function getCsrfHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-csrf-token': getCsrfToken(),
  };
}
