import { createHmac, timingSafeEqual, randomBytes } from 'crypto';

/**
 * CSRF protection using the double-submit cookie pattern.
 *
 * 1. On login (sync-session), the server sets a `csrf-token` cookie
 *    (HttpOnly=false so JS can read it) containing a signed random token.
 * 2. Client JS reads the cookie and sends the token in an `x-csrf-token` header
 *    on every POST/PUT/DELETE request.
 * 3. Server verifies: header token == cookie token AND signature is valid.
 *
 * An attacker cannot read the cookie (different origin) so they cannot
 * forge the header, even if they can make the victim's browser send the cookie.
 */

const CSRF_COOKIE_NAME = 'csrf-token';

function getSigningKey(): string {
  return process.env.AUTH_SECRET || 'dev-insecure-secret-change-me';
}

/**
 * Generates a new CSRF token: random value + HMAC signature.
 * Returns the signed token string.
 */
export function generateCsrfToken(): string {
  const value = randomBytes(32).toString('hex');
  const mac = createHmac('sha256', getSigningKey()).update(value).digest('hex');
  return `${value}.${mac}`;
}

/**
 * Verifies a CSRF token's signature.
 * Returns the unsigned value if valid, null otherwise.
 */
export function verifyCsrfToken(token: string): string | null {
  if (!token) return null;
  const idx = token.lastIndexOf('.');
  if (idx === -1) return null;
  const value = token.substring(0, idx);
  const mac = token.substring(idx + 1);

  const expectedMac = createHmac('sha256', getSigningKey())
    .update(value)
    .digest('hex');

  if (mac.length !== expectedMac.length) return null;
  try {
    if (timingSafeEqual(Buffer.from(mac), Buffer.from(expectedMac))) {
      return value;
    }
  } catch {
    /* lengths differ */
  }
  return null;
}

/**
 * Sets the CSRF cookie on a NextResponse.
 * The cookie is NOT HttpOnly — client JS must read it to send the header.
 */
export function setCsrfCookie(res: import('next/server').NextResponse, token: string): import('next/server').NextResponse {
  const opts = `Path=/; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
  res.headers.append('Set-Cookie', `${CSRF_COOKIE_NAME}=${token}; ${opts}`);
  return res;
}

/**
 * Clears the CSRF cookie.
 */
export function clearCsrfCookie(res: import('next/server').NextResponse): import('next/server').NextResponse {
  res.headers.append('Set-Cookie', `${CSRF_COOKIE_NAME}=; Path=/; SameSite=Lax; Max-Age=0`);
  return res;
}

export const CSRF_COOKIE = CSRF_COOKIE_NAME;
