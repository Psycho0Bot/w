import type { NextConfig } from "next";

const dev = process.env.NODE_ENV === 'development';

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    // CSP: 'unsafe-eval' is included ONLY in development mode because
    // React uses eval() for debugging features (call stack reconstruction).
    // In production, 'unsafe-eval' is excluded for maximum security.
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://s3.tradingview.com https://*.tradingview.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: https://*.google.com https://*.googleusercontent.com https://s3.tradingview.com",
      "font-src 'self'",
      "connect-src 'self' https://*.google.com https://*.googleapis.com https://*.coingecko.com https://*.mfapi.in https://*.supabase.co https://query1.finance.yahoo.com https://api.mfapi.in https://finnhub.io https://newsdata.io wss://*.supabase.co wss://*.finnhub.io",
      "frame-src https://s3.tradingview.com https://*.tradingview.com https://tradingview-widget.com https://*.tradingview-widget.com",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
