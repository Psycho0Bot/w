import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { globalRateLimiter, authRateLimiter } from '@/lib/rateLimit';
import { verifyCsrfToken } from '@/lib/csrf';

/**
 * Server-side auth utilities.
 *
 * The middleware (proxy.ts) checks for a signed HttpOnly cookie `auth-session`
 * that is set by /api/auth/sync-session after the Supabase client-side login
 * succeeds. This cookie is HMAC-signed with AUTH_SECRET so it cannot be forged.
 */

const COOKIE_NAME = 'auth-session';

/* ---------- signed cookie helpers ---------- */

function getSigningKey(): string {
  return process.env.AUTH_SECRET || 'dev-insecure-secret-change-me';
}

export function signValue(value: string): string {
  const key = getSigningKey();
  const mac = createHmac('sha256', key).update(value).digest('hex');
  return `${value}.${mac}`;
}

export function verifySignedValue(signed: string): string | null {
  const idx = signed.lastIndexOf('.');
  if (idx === -1) return null;
  const value = signed.substring(0, idx);
  const mac = signed.substring(idx + 1);

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

/* ---------- cookie set / clear helpers ---------- */

const COOKIE_OPTS =
  'Path=/; HttpOnly; SameSite=Lax; Max-Age=604800'; // 7 days

export function setAuthCookie(res: NextResponse, userId: string): NextResponse {
  const signed = signValue(userId);
  res.headers.append('Set-Cookie', `${COOKIE_NAME}=${signed}; ${COOKIE_OPTS}`);
  if (process.env.NODE_ENV === 'production') {
    // Append Secure flag separately for production
    res.headers.append(
      'Set-Cookie',
      `${COOKIE_NAME}=${signed}; ${COOKIE_OPTS}; Secure`
    );
  }
  return res;
}

export function clearAuthCookie(res: NextResponse): NextResponse {
  res.headers.append(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
  return res;
}

/* ---------- requireAuth guard for API routes ---------- */

export interface AuthenticatedRequest {
  userId: string;
  ip: string;
}

export function getAuthUserId(req: NextRequest): string | null {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) return null;
  return verifySignedValue(cookie);
}

/**
 * Call at the top of any API route handler to enforce authentication.
 * Returns the userId + IP on success, or a 401 NextResponse on failure.
 */
export function requireAuth(req: NextRequest): AuthenticatedRequest | NextResponse {
  const userId = getAuthUserId(req);
  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }
  return { userId, ip: getClientIp(req) };
}

/* ---------- IP extraction ---------- */

export function getClientIp(req: NextRequest): string {
  const headers = req.headers;
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}

/* ---------- rate-limit convenience wrappers ---------- */

export function checkRateLimit(
  req: NextRequest,
  limiter: typeof globalRateLimiter | typeof authRateLimiter = globalRateLimiter,
  limit = 1
): NextResponse | null {
  const ip = getClientIp(req);
  if (!limiter.isAllowed(ip, limit)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }
  return null;
}

/* ---------- CSRF guard for API routes ---------- */

/**
 * Call after requireAuth on POST/PUT/DELETE routes to enforce CSRF protection.
 * Uses the double-submit cookie pattern: the `csrf-token` cookie value must
 * match the `x-csrf-token` header, and both must have a valid HMAC signature.
 *
 * Returns null on success, or a 403 NextResponse on failure.
 */
export function requireCsrf(req: NextRequest): NextResponse | null {
  const headerToken = req.headers.get('x-csrf-token') || '';
  const cookieToken = req.cookies.get('csrf-token')?.value || '';

  if (!headerToken || !cookieToken) {
    return NextResponse.json({ error: 'CSRF token missing' }, { status: 403 });
  }

  if (headerToken !== cookieToken) {
    return NextResponse.json({ error: 'CSRF token mismatch' }, { status: 403 });
  }

  if (!verifyCsrfToken(headerToken)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  return null;
}
