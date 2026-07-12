import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { logger } from '@/services/LogService';

/**
 * GET /api/news/macro
 *
 * Fetches real macro indicators:
 *   - Fear & Greed Index (alternative.me API — free, no key)
 *   - VIX (Finnhub quote)
 *   - Dollar Index / DXY (Finnhub or FRED)
 *   - 10Y Treasury Yield (FRED)
 *
 * Results are cached in-memory for 15 minutes.
 */

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';
const FRED_API_KEY = process.env.FRED_API_KEY || '';

interface MacroData {
  fearGreed: { value: number; label: string; color: string } | null;
  vix: { value: number; label: string; color: string } | null;
  dollarIndex: { value: number; change: number; label: string; color: string } | null;
  treasury10Y: { value: number; change: number; label: string; color: string } | null;
}

// In-memory cache (15 min)
let cache: { data: MacroData; timestamp: number } | null = null;
const CACHE_TTL = 15 * 60 * 1000;

function getFearGreedLabel(value: number): { label: string; color: string } {
  if (value <= 25) return { label: 'Extreme Fear', color: 'text-rose-400' };
  if (value <= 45) return { label: 'Fear', color: 'text-amber-400' };
  if (value <= 55) return { label: 'Neutral', color: 'text-gray-400' };
  if (value <= 75) return { label: 'Greed', color: 'text-emerald-400' };
  return { label: 'Extreme Greed', color: 'text-teal-400' };
}

function getVixLabel(value: number): { label: string; color: string } {
  if (value < 15) return { label: 'Low Volatility', color: 'text-emerald-400' };
  if (value < 20) return { label: 'Normal', color: 'text-emerald-400' };
  if (value < 30) return { label: 'Elevated', color: 'text-amber-400' };
  return { label: 'High Fear', color: 'text-rose-400' };
}

function getTrendLabel(change: number): { label: string; color: string } {
  if (change > 0) return { label: `+${change.toFixed(2)}`, color: 'text-emerald-400' };
  if (change < 0) return { label: change.toFixed(2), color: 'text-rose-400' };
  return { label: '0.00', color: 'text-gray-400' };
}

async function fetchFearGreed(): Promise<MacroData['fearGreed']> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=2', {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const current = data?.data?.[0];
    if (!current) return null;
    const value = parseInt(current.value, 10);
    const { label, color } = getFearGreedLabel(value);
    return { value, label, color };
  } catch {
    return null;
  }
}

async function fetchVIX(): Promise<MacroData['vix']> {
  if (!FRED_API_KEY) return null;
  try {
    // VIXCLS = CBOE Volatility Index VIX from FRED
    const res = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=VIXCLS&api_key=${FRED_API_KEY}&file_type=json&limit=2&sort_order=desc`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const observations = data?.observations;
    if (!observations || observations.length < 1) return null;

    const value = parseFloat(observations[0].value);
    if (isNaN(value)) return null;

    const { label, color } = getVixLabel(value);
    return { value, label, color };
  } catch {
    return null;
  }
}

async function fetchTreasury10Y(): Promise<MacroData['treasury10Y']> {
  if (!FRED_API_KEY) return null;
  try {
    // DGS10 = 10-Year Treasury Constant Maturity Rate
    const res = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=${FRED_API_KEY}&file_type=json&limit=2&sort_order=desc`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const observations = data?.observations;
    if (!observations || observations.length < 1) return null;

    const latest = parseFloat(observations[0].value);
    const prev = observations.length > 1 ? parseFloat(observations[1].value) : latest;
    if (isNaN(latest)) return null;

    const change = latest - prev;
    const { label, color } = getTrendLabel(change);
    return { value: latest, change, label, color };
  } catch {
    return null;
  }
}

async function fetchDollarIndex(): Promise<MacroData['dollarIndex']> {
  try {
    // Compute ICE DXY from component currency rates using open.er-api.com (free, no key needed)
    // DXY = 50.14348112 × EUR/USD^(-0.576) × USD/JPY^(0.136) × GBP/USD^(-0.119) × USD/CAD^(0.091) × USD/SEK^(0.042) × USD/CHF^(0.036)
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const rates = data?.rates;
    if (!rates || !rates.EUR || !rates.GBP || !rates.JPY || !rates.CAD || !rates.SEK || !rates.CHF) return null;

    // rates are: how many foreign currency per 1 USD
    // EUR/USD = 1/rates.EUR, GBP/USD = 1/rates.GBP
    // USD/JPY = rates.JPY, USD/CAD = rates.CAD, USD/SEK = rates.SEK, USD/CHF = rates.CHF
    const eurUsd = 1 / rates.EUR;
    const gbpUsd = 1 / rates.GBP;
    const usdJpy = rates.JPY;
    const usdCad = rates.CAD;
    const usdSek = rates.SEK;
    const usdChf = rates.CHF;

    const dxy = 50.14348112 *
      Math.pow(eurUsd, -0.576) *
      Math.pow(usdJpy, 0.136) *
      Math.pow(gbpUsd, -0.119) *
      Math.pow(usdCad, 0.091) *
      Math.pow(usdSek, 0.042) *
      Math.pow(usdChf, 0.036);

    if (isNaN(dxy)) return null;

    // Use previous day's cached value for change calculation
    const prevDxy = cache?.data?.dollarIndex?.value || dxy;
    const change = ((dxy - prevDxy) / prevDxy) * 100;

    const { label, color } = getTrendLabel(change);
    return { value: dxy, change, label, color };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const authResult = requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  // Check cache
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const [fearGreed, vix, treasury10Y, dollarIndex] = await Promise.all([
      fetchFearGreed(),
      fetchVIX(),
      fetchTreasury10Y(),
      fetchDollarIndex(),
    ]);

    const data: MacroData = { fearGreed, vix, dollarIndex, treasury10Y };
    cache = { data, timestamp: Date.now() };

    return NextResponse.json(data);
  } catch (err) {
    logger.error('Error fetching macro indicators', err);
    return NextResponse.json({ error: 'Failed to fetch macro data' }, { status: 500 });
  }
}
