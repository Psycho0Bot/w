import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authRateLimiter } from '@/lib/rateLimit';
import { getClientIp } from '@/lib/serverAuth';
import { createHash } from 'crypto';
import { logger } from '@/services/LogService';

const VerifyOtpSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').trim(),
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters long').regex(/[a-zA-Z]/, 'Password must contain at least one letter').regex(/[0-9]/, 'Password must contain at least one number').trim(),
  otp: z.string().length(6, 'OTP must be 6 digits').trim(),
});

// Hash the OTP the same way send-otp does, for comparison
function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex');
}

export async function POST(request: NextRequest) {
  // ── Rate limit: 5 attempts per ~60 seconds per IP ──
  const ip = getClientIp(request);
  if (!authRateLimiter.isAllowed(ip, 1)) {
    return NextResponse.json(
      { success: false, message: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  try {
    const body = await request.json();
    const validated = VerifyOtpSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({
        success: false,
        message: validated.error.issues[0].message
      }, { status: 400 });
    }

    const { name, email, password, otp } = validated.data;

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json({
        success: false,
        message: 'A user with this email address already exists.'
      }, { status: 400 });
    }

    // Retrieve active OTP token — lookup by identifier+hashedToken
    const hashedOtp = hashOtp(otp);
    const tokenRecord = await db.verificationToken.findFirst({
      where: { identifier: email, token: hashedOtp }
    });

    if (!tokenRecord) {
      return NextResponse.json({
        success: false,
        message: 'Invalid OTP code. Please try again.'
      }, { status: 400 });
    }

    // Check expiry
    if (tokenRecord.expires < new Date()) {
      // Clean up expired token
      await db.verificationToken.delete({
        where: { id: tokenRecord.id }
      });
      return NextResponse.json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      }, { status: 400 });
    }

    // OTP is valid! Clean it up from database
    await db.verificationToken.delete({
      where: { id: tokenRecord.id }
    });

    // Hash password with bcrypt cost factor 12
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user in DB
    await db.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
        settings: {
          create: {}, // Auto create default settings
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Account verified and created successfully!'
    });

  } catch (error: any) {
    console.error('Verify OTP / Register Error:', error);
    return NextResponse.json({
      success: false,
      message: 'Verification failed. Please try again.'
    }, { status: 500 });
  }
}
