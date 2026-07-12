'use server';

import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const SignupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').trim(),
  email: z.string().email('Please enter a valid email address').trim().toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .trim(),
});

export type SignupState = {
  errors?: {
    name?: string[];
    email?: string[];
    password?: string[];
  };
  message?: string;
  success?: boolean;
} | null;

export async function signupAction(prevState: SignupState, formData: FormData): Promise<SignupState> {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const validated = SignupSchema.safeParse({ name, email, password });

  if (!validated.success) {
    return {
      errors: validated.error.flatten().fieldErrors,
      success: false,
    };
  }

  try {
    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: validated.data.email },
    });

    if (existingUser) {
      return {
        message: 'A user with this email address already exists.',
        success: false,
      };
    }

    // Hash password with bcrypt cost factor 12
    const hashedPassword = await bcrypt.hash(validated.data.password, 12);

    // Create user in DB
    await db.user.create({
      data: {
        name: validated.data.name,
        email: validated.data.email,
        passwordHash: hashedPassword,
        settings: {
          create: {}, // Auto create default settings
        },
      },
    });

    return {
      success: true,
    };
  } catch (error) {
    console.error('Signup error:', error);
    return {
      message: 'Something went wrong during registration. Please try again.',
      success: false,
    };
  }
}
