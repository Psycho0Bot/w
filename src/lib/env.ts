import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL must be a valid connection string'),
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET must be at least 16 characters long'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Market data API keys (optional — services degrade gracefully without them)
  COINGECKO_API_KEY: z.string().optional(),
  FMP_API_KEY: z.string().optional(),
  FINNHUB_API_KEY: z.string().optional(),
  FRED_API_KEY: z.string().optional(),
  NEWSDATA_API_KEY: z.string().optional(),

  // AI / Gemini
  GEMINI_API_KEY: z.string().optional(),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

// Validate process.env on startup
const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  NODE_ENV: process.env.NODE_ENV,
  COINGECKO_API_KEY: process.env.COINGECKO_API_KEY,
  FMP_API_KEY: process.env.FMP_API_KEY,
  FINNHUB_API_KEY: process.env.FINNHUB_API_KEY,
  FRED_API_KEY: process.env.FRED_API_KEY,
  NEWSDATA_API_KEY: process.env.NEWSDATA_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw new Error('Invalid environment variables config');
}

export const env = parsed.data;
