import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { verifyCsrfToken } from '@/lib/csrf';
import { db } from '@/lib/db';
import { logger } from '@/services/LogService';
import { userRepository } from '@/repositories/UserRepository';

/**
 * Ensures a User row exists with the given userId (Supabase ID).
 * If no row exists, creates one. This prevents FK violations on
 * Settings and AuditLog when the user was created by Supabase but
 * not yet mirrored into Prisma (e.g. before the sync-session fix).
 */
async function ensureUserExists(userId: string): Promise<void> {
  const existing = await userRepository.findById(userId);
  if (!existing) {
    // Create a minimal user record so FK constraints pass.
    // The email may not be known here — use a placeholder that
    // sync-session will correct on next login.
    await db.user.create({
      data: {
        id: userId,
        email: `user-${userId.slice(0, 8)}@migrate.local`,
        passwordHash: '',
        name: 'Migrated User',
        settings: { create: {} },
      },
    });
  }
}

// GET — load portfolio data from DB (Settings.portfolioData)
export async function GET(request: NextRequest) {
  const authResult = requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  try {
    // Ensure user exists to prevent FK errors
    await ensureUserExists(userId);

    const settings = await db.settings.findUnique({ where: { userId } });
    if (!settings || !settings.portfolioData) {
      return NextResponse.json({ data: null });
    }
    return NextResponse.json({ data: JSON.parse(settings.portfolioData) });
  } catch (err) {
    logger.error('Failed to load portfolio data', err, { userId });
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 });
  }
}

// POST — save portfolio data to DB
export async function POST(request: NextRequest) {
  const authResult = requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { userId, ip } = authResult;

  // CSRF check
  const csrfToken = request.headers.get('x-csrf-token') || '';
  const cookieToken = request.cookies.get('csrf-token')?.value || '';
  if (!verifyCsrfToken(csrfToken) || csrfToken !== cookieToken) {
    logger.warn('CSRF token mismatch on portfolio save', { userId, ip });
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  try {
    const body = await request.json();

    // Basic size limit: 5MB JSON max
    const jsonStr = JSON.stringify(body);
    if (jsonStr.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Data too large' }, { status: 413 });
    }

    // Ensure user exists before upserting settings (FK constraint)
    await ensureUserExists(userId);

    // Upsert settings with portfolio data
    await db.settings.upsert({
      where: { userId },
      create: {
        userId,
        portfolioData: jsonStr,
        currencyPref: body.currencyPref || 'BOTH',
        googleSheetUrl: body.googleSheetUrl || null,
      },
      update: {
        portfolioData: jsonStr,
        currencyPref: body.currencyPref || undefined,
        googleSheetUrl: body.googleSheetUrl !== undefined ? body.googleSheetUrl : undefined,
      },
    });

    // Audit log — best-effort, don't fail the save if logging fails
    try {
      await userRepository.createAuditLog({
        userId,
        action: 'PORTFOLIO_SAVE',
        details: `Saved ${body.assets?.length || 0} assets`,
        ipAddress: ip,
      });
    } catch (logErr) {
      logger.warn('Failed to create portfolio audit log', { userId });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('Failed to save portfolio data', err, { userId });
    return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
  }
}
