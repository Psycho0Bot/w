import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { sendOtpEmail } from '@/services/emailService';
import { authRateLimiter } from '@/lib/rateLimit';
import { getClientIp } from '@/lib/serverAuth';
import { createHash, randomInt } from 'crypto';
import { logger } from '@/services/LogService';

const SendOtpSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
});

// Hash the OTP before storing it in the database (never store plaintext)
function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex');
}

export async function POST(request: NextRequest) {
  // ── Rate limit: 5 requests per ~60 seconds per IP ──
  const ip = getClientIp(request);
  if (!authRateLimiter.isAllowed(ip, 1)) {
    return NextResponse.json(
      { success: false, message: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  try {
    const body = await request.json();
    const validated = SendOtpSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({
        success: false,
        message: validated.error.issues[0].message
      }, { status: 400 });
    }

    const { email } = validated.data;

    // Check if user already exists in DB
    const existingUser = await db.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      // Generic message to prevent email enumeration
      return NextResponse.json({
        success: true,
        message: 'If this email is not already registered, an OTP has been sent. Please check your email inbox.'
      });
    }

    // Generate a 6-digit OTP code using cryptographically secure random
    const otp = String(randomInt(100000, 1000000));
    const expires = new Date(Date.now() + 1000 * 60 * 10); // 10 minutes expiry

    // Delete any existing OTP for this email
    await db.verificationToken.deleteMany({
      where: { identifier: email }
    });

    // Save HASHED OTP to DB (never store plaintext)
    await db.verificationToken.create({
      data: {
        identifier: email,
        token: hashOtp(otp),
        expires
      }
    });

    // Send the OTP email (real or simulated)
    await sendOtpEmail(email, otp);

    return NextResponse.json({
      success: true,
      message: 'If this email is not already registered, an OTP has been sent. Please check your email inbox.'
      // OTP is NEVER returned in the response — check server logs in dev mode
    });

  } catch (error: any) {
    console.error('Send OTP Error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to send OTP. Please try again.'
    }, { status: 500 });
  }
}
