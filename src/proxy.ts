import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Middleware — verifies the HMAC-signed HttpOnly `auth-session` cookie
 * set by /api/auth/sync-session after Supabase login.
 *
 * This replaces the old `sb-session-active` cookie which was set from
 * JavaScript (forgeable by anyone).
 */

const COOKIE_NAME = 'auth-session';

function getSigningKey(): string {
  return process.env.AUTH_SECRET || 'dev-insecure-secret-change-me';
}

function verifySignedCookie(signed: string): string | null {
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

export default function middleware(req: NextRequest) {
  const { nextUrl, cookies } = req;

  // Check the signed HttpOnly cookie
  const authCookie = cookies.get(COOKIE_NAME)?.value;
  const isLoggedIn = authCookie ? verifySignedCookie(authCookie) !== null : false;

  const hasAuthParams = nextUrl.searchParams.has('code') || nextUrl.searchParams.has('token_hash');

  const isAuthRoute = ['/login', '/signup'].includes(nextUrl.pathname);
  // Allow auth API routes (sync-session, OTP, NextAuth) without the cookie
  const isApiAuthRoute = nextUrl.pathname.startsWith('/api/v1/auth') || nextUrl.pathname.startsWith('/api/auth');

  if (isApiAuthRoute || hasAuthParams) {
    return NextResponse.next();
  }

  if (isAuthRoute) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL('/', nextUrl));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/login', nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  // Protect everything except static assets and API routes
  // (API routes do their own auth checks via requireAuth)
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|public).*)'],
};
