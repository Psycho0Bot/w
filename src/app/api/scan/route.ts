import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, checkRateLimit } from '@/lib/serverAuth';
import { globalRateLimiter } from '@/lib/rateLimit';

// Maximum image size: 10 MB base64 (~7.5 MB actual)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  // ── Auth check ──
  const authResult = requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  // ── Rate limit ──
  const rateLimitResponse = checkRateLimit(request, globalRateLimiter);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { image } = await request.json();
    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Size limit to prevent DoS
    if (image.length > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: 'Image too large. Maximum 10MB.' }, { status: 413 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Generic fallback — no real user data
    const fallbackAssets: Array<{ id: string; category: string; name: string; ticker: string; qty: number; buyPrice: number; currency: string }> = [];

    if (!apiKey) {
      return NextResponse.json({ assets: fallbackAssets, note: 'Demo mode active. Provide GEMINI_API_KEY in .env for live AI OCR.' });
    }

    // Call real Gemini API — API key in header, not URL
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;
    
    // Extract base64 part
    const match = image.match(/^data:(image\/[a-zA-Z0-9.-]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ error: 'Invalid image format' }, { status: 400 });
    }

    const mimeType = match[1];
    const base64Data = match[2];

    const systemPrompt = `You are a financial holding screenshot parser. Analyze the uploaded image and extract all holdings shown in it.
Extract: Ticker, Name, Quantity (Qty/Units), and Buy Price (Avg cost / Avg price).
Output a clean, valid JSON array of objects representing the extracted assets. Do NOT wrap the JSON in \`\`\`json or markdown tags. Return ONLY the raw JSON string.

Each object must have the following fields:
- category: one of 'stock_us', 'stock_in', 'etf', 'mutual_fund', 'crypto', 'gold', 'fixed_income', 'cash', 'real_estate'
- name: string (e.g. 'Ethereum', 'Bitcoin')
- ticker: string (e.g. 'ETH', 'BTC')
- qty: number (quantity owned)
- buyPrice: number (average cost basis price in the currency of the asset)
- currency: 'USD' or 'INR'

If you cannot read or find any assets in the image, return an empty array [].`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey, // API key in header, not URL
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data
                }
              },
              { text: systemPrompt }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      console.error('Gemini OCR API Error:', await response.text());
      return NextResponse.json({ assets: fallbackAssets, note: 'AI service unavailable. Please try again later.' });
    }

    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Clean code blocks if LLM still included them
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const parsedAssets = JSON.parse(text);
      if (Array.isArray(parsedAssets)) {
        const finalAssets = parsedAssets.map((asset, idx) => ({
          id: (idx + 1).toString(),
          category: asset.category || 'crypto',
          name: asset.name || asset.ticker,
          ticker: asset.ticker || 'UNKNOWN',
          qty: Number(asset.qty) || 0,
          buyPrice: Number(asset.buyPrice) || 0,
          currency: asset.currency || 'USD'
        }));
        return NextResponse.json({ assets: finalAssets });
      }
    } catch (parseErr) {
      console.error('Failed to parse Gemini OCR response:', text, parseErr);
    }

    return NextResponse.json({ assets: fallbackAssets });
  } catch (err: any) {
    console.error('Error in scan API:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
