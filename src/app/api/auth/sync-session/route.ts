import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { setAuthCookie, clearAuthCookie, getClientIp } from '@/lib/serverAuth';
import { generateCsrfToken, setCsrfCookie, clearCsrfCookie } from '@/lib/csrf';
import { authRateLimiter } from '@/lib/rateLimit';
import { db } from '@/lib/db';
import { userRepository } from '@/repositories/UserRepository';
import { logger } from '@/services/LogService';

/**
 * POST /api/auth/sync-session
 *
 * Called by the client immediately after Supabase login succeeds.
 * Verifies the Supabase access token server-side, then sets:
 *   1. An HttpOnly HMAC-signed `auth-session` cookie (for middleware auth)
 *   2. A readable `csrf-token` cookie (for double-submit CSRF protection)
 */
export async function POST(request: NextRequest) {
  // Rate-limit this endpoint
  const ip = getClientIp(request);
  if (!authRateLimiter.isAllowed(ip, 1)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  try {
    const body = await request.json();
    const accessToken = body?.accessToken;

    if (!accessToken || typeof accessToken !== 'string') {
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 400 }
      );
    }

    // Verify the Supabase JWT server-side
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server authentication is not configured' },
        { status: 500 }
      );
    }

    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // Ensure user exists in our Prisma database with the Supabase user ID as PK.
    // We check by ID (not email) because the DB may have an old user row with
    // a different auto-generated UUID from before the sync-session fix.
    const userEmail = user.email || '';
    if (userEmail) {
      const existingById = await userRepository.findById(user.id);
      if (!existingById) {
        // Check if there's an old user with the same email but different ID
        const existingByEmail = await userRepository.findByEmail(userEmail);
        if (existingByEmail) {
          // Delete the old mismatched user row and re-create with correct Supabase ID
          await db.user.delete({ where: { id: existingByEmail.id } });
        }
        const userMetadata = user.user_metadata || {};
        await userRepository.createUser({
          id: user.id,
          email: userEmail,
          passwordHash: '', // OAuth/Supabase-managed — no local password
          name: userMetadata.name || userEmail.split('@')[0],
        });
      }
    }

    // Set the signed HttpOnly cookie with the Supabase user ID
    let res: NextResponse = NextResponse.json({ success: true });
    res = setAuthCookie(res, user.id);

    // Set the CSRF token cookie (readable by JS, not HttpOnly)
    const csrfToken = generateCsrfToken();
    res = setCsrfCookie(res, csrfToken);

    // Audit log — best-effort, never break login if this fails
    try {
      await userRepository.createAuditLog({
        userId: user.id,
        action: 'USER_LOGIN',
        ipAddress: ip,
      });
    } catch (logErr) {
      logger.warn('Failed to create login audit log', { userId: user.id, error: logErr });
    }
    logger.info('User logged in', { userId: user.id, ip });

    return res;
  } catch (err) {
    logger.error('Sync session error', err);
    return NextResponse.json(
      { error: 'Failed to sync session' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/sync-session
 * Clears both the auth cookie and CSRF cookie on logout.
 */
export async function DELETE(request: NextRequest) {
  // Audit log logout if we can identify the user
  const authCookie = request.cookies.get('auth-session')?.value;
  if (authCookie) {
    // Best-effort audit log — don't block logout if it fails
    try {
      const { verifySignedValue } = await import('@/lib/serverAuth');
      const userId = verifySignedValue(authCookie);
      if (userId) {
        await userRepository.createAuditLog({
          userId,
          action: 'USER_LOGOUT',
          ipAddress: getClientIp(request),
        });
      }
    } catch {
      /* ignore */
    }
  }

  const res = NextResponse.json({ success: true });
  clearAuthCookie(res);
  clearCsrfCookie(res);
  return res;
}
