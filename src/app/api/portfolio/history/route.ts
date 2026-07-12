import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { logger } from '@/services/LogService';

/**
 * GET /api/portfolio/history?range=1Y&usdInrRate=85&assets=[...]
 *
 * Fetches REAL portfolio net worth history by:
 * 1. Fetching historical prices for each asset via Yahoo/CoinGecko/mfapi
 * 2. Computing portfolio value at each timestamp: Σ(quantity × price)
 * 3. Normalizing: the last point always equals the real current portfolio value
 *
 * Key fix: assets that fail to fetch history use their current price as a flat line
 * so the total is always correct regardless of which APIs succeed.
 */

const YAHOO_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

interface AssetInput {
  ticker: string;
  quantity: number;
  category: string;
  currency: string;
  avgBuyPrice: number;
  currentPrice: number; // used as fallback if history fetch fails
}

interface PricePoint {
  time: number;
  value: number;
}

const RANGE_MAP: Record<string, { yahooRange: string; interval: string; maxPoints: number }> = {
  '1D': { yahooRange: '1d', interval: '5m', maxPoints: 24 },
  '7D': { yahooRange: '5d', interval: '15m', maxPoints: 35 },
  '1M': { yahooRange: '1mo', interval: '1d', maxPoints: 30 },
  '3M': { yahooRange: '3mo', interval: '1d', maxPoints: 30 },
  '6M': { yahooRange: '6mo', interval: '1d', maxPoints: 30 },
  'YTD': { yahooRange: 'ytd', interval: '1d', maxPoints: 60 },
  '1Y': { yahooRange: '1y', interval: '1d', maxPoints: 52 },
  '5Y': { yahooRange: '5y', interval: '1wk', maxPoints: 60 },
  'ALL': { yahooRange: 'max', interval: '1wk', maxPoints: 60 },
};

async function fetchYahooHistory(ticker: string, category: string, yahooRange: string, interval: string): Promise<PricePoint[]> {
  try {
    let yahooTicker = ticker.toUpperCase();
    const commodityMap: Record<string, string> = {
      'GOLD': 'GC=F', 'SILVER': 'SI=F', 'CRUDEOIL': 'CL=F', 'CRUDE': 'CL=F',
    };
    const isCommodity = category.toLowerCase() === 'gold' || category.toLowerCase() === 'commodity';
    if (isCommodity) {
      yahooTicker = commodityMap[ticker.toUpperCase()] || yahooTicker;
    }

    const isUS = category.toLowerCase() === 'stock_us' || (category.toLowerCase() === 'etf' && !ticker.toUpperCase().endsWith('BEES') && !ticker.toUpperCase().endsWith('ETF'));
    if (!isUS && !yahooTicker.includes('.') && !isCommodity) {
      yahooTicker = yahooTicker + '.NS';
    }

    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?range=${yahooRange}&interval=${interval}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: YAHOO_HEADERS });
    if (!res.ok) return [];

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return [];

    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];

    const points: PricePoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (typeof closes[i] === 'number' && closes[i] > 0) {
        points.push({ time: timestamps[i], value: closes[i] });
      }
    }
    return points;
  } catch {
    return [];
  }
}

async function fetchCryptoHistory(ticker: string, yahooRange: string): Promise<PricePoint[]> {
  try {
    const coinIdMap: Record<string, string> = {
      'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana', 'BNB': 'binancecoin',
      'XRP': 'ripple', 'ADA': 'cardano', 'DOGE': 'dogecoin', 'AVAX': 'avalanche-2',
      'DOT': 'polkadot', 'LINK': 'chainlink', 'MATIC': 'polygon-ecosystem-token',
      'USDT': 'tether', 'USDC': 'usd-coin', 'TRX': 'tron', 'ATOM': 'cosmos',
      'LTC': 'litecoin', 'UNI': 'uniswap', 'SHIB': 'shiba-inu', 'HBAR': 'hedera-hashgraph',
    };
    const coinId = coinIdMap[ticker.toUpperCase()] || ticker.toLowerCase();

    const daysMap: Record<string, string> = {
      '1d': '1', '5d': '7', '1mo': '30', '3mo': '90', '6mo': '180',
      '1y': '365', '5y': '1825', 'max': 'max', 'ytd': '120',
    };
    const days = daysMap[yahooRange] || '365';

    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];

    const json = await res.json();
    const prices = json?.prices || [];
    return prices.map((p: [number, number]) => ({ time: Math.floor(p[0] / 1000), value: p[1] }));
  } catch {
    return [];
  }
}

async function fetchMfHistory(schemeCode: string, yahooRange: string): Promise<PricePoint[]> {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];

    const json = await res.json();
    const data = json?.data || [];

    const daysMap: Record<string, number> = {
      '1d': 1, '5d': 7, '1mo': 30, '3mo': 90, '6mo': 180,
      '1y': 365, '5y': 1825, 'max': 99999, 'ytd': 180,
    };
    const limitDays = daysMap[yahooRange] || 365;
    const cutoff = Date.now() - limitDays * 24 * 60 * 60 * 1000;

    const points: PricePoint[] = [];
    for (const item of data) {
      if (!item.date || !item.nav) continue;
      const parts = item.date.split('-');
      const dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      if (dateObj.getTime() < cutoff) continue;
      const nav = parseFloat(item.nav);
      if (!isNaN(nav) && nav > 0) {
        points.push({ time: Math.floor(dateObj.getTime() / 1000), value: nav });
      }
    }
    return points.reverse();
  } catch {
    return [];
  }
}

async function fetchAssetHistory(asset: AssetInput, yahooRange: string, interval: string): Promise<PricePoint[]> {
  const cat = asset.category.toLowerCase();
  let history: PricePoint[] = [];

  if (cat === 'crypto') {
    history = await fetchCryptoHistory(asset.ticker, yahooRange);
  } else if (cat === 'mutual_fund' || cat === 'mutualfund') {
    history = await fetchMfHistory(asset.ticker, yahooRange);
  } else {
    history = await fetchYahooHistory(asset.ticker, asset.category, yahooRange, interval);
  }

  // CRITICAL FIX: If history fetch failed, use current price as a flat line
  // This ensures the total is always correct even if one API fails
  if (history.length === 0 && asset.currentPrice > 0) {
    const now = Math.floor(Date.now() / 1000);
    const daysBack = yahooRange === '1d' ? 1 : yahooRange === '5d' ? 7 : yahooRange === '1mo' ? 30 :
      yahooRange === '3mo' ? 90 : yahooRange === '6mo' ? 180 : yahooRange === '1y' ? 365 :
      yahooRange === '5y' ? 1825 : 365;
    const start = now - daysBack * 24 * 60 * 60;
    // Generate flat line at current price
    history = [
      { time: start, value: asset.currentPrice },
      { time: now, value: asset.currentPrice },
    ];
  }

  return history;
}

function computePortfolioValue(
  assets: AssetInput[],
  histories: PricePoint[][],
  usdInrRate: number,
  maxPoints: number,
): { time: number; usd: number; inr: number; dateLabel: string }[] {
  if (assets.length === 0) return [];

  // Group all price points by day (YYYY-MM-DD) for each asset
  // This aligns different data sources (crypto hourly, stocks 15min, MF daily)
  const dayToPrices: Record<string, { assetIndex: number; price: number }[]> = {};

  histories.forEach((history, assetIndex) => {
    if (!history || history.length === 0) return;

    // For each asset, pick the last price of each day (close price)
    const dayToPrice: Record<string, number> = {};
    for (const point of history) {
      const date = new Date(point.time * 1000);
      const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      dayToPrice[dayKey] = point.value; // later points overwrite, giving us close
    }

    for (const [dayKey, price] of Object.entries(dayToPrice)) {
      if (!dayToPrices[dayKey]) dayToPrices[dayKey] = [];
      dayToPrices[dayKey].push({ assetIndex, price });
    }
  });

  // Sort days chronologically
  const sortedDays = Object.keys(dayToPrices).sort();

  if (sortedDays.length === 0) return [];

  // Sample down to maxPoints
  const step = Math.max(1, Math.floor(sortedDays.length / maxPoints));
  const sampledDays: string[] = [];
  for (let i = 0; i < sortedDays.length; i += step) {
    sampledDays.push(sortedDays[i]);
  }
  // Always include last day
  if (sampledDays[sampledDays.length - 1] !== sortedDays[sortedDays.length - 1]) {
    sampledDays.push(sortedDays[sortedDays.length - 1]);
  }

  // For each day, compute total portfolio value
  // Use last known price for assets that don't have data on that day
  const lastKnownPrices: number[] = new Array(assets.length).fill(0);

  const result: { time: number; usd: number; inr: number; dateLabel: string }[] = [];

  for (const dayKey of sampledDays) {
    // Update last known prices with today's data
    const todayPrices = dayToPrices[dayKey];
    if (todayPrices) {
      for (const { assetIndex, price } of todayPrices) {
        lastKnownPrices[assetIndex] = price;
      }
    }

    // Compute total value using last known prices
    let totalUsd = 0;
    let hasData = false;

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      const price = lastKnownPrices[i];

      if (price > 0) {
        hasData = true;
        const value = asset.quantity * price;
        const valueUsd = asset.currency === 'USD' ? value : value / usdInrRate;
        totalUsd += valueUsd;
      }
    }

    if (hasData && totalUsd > 0) {
      const date = new Date(dayKey + 'T00:00:00Z');
      result.push({
        time: Math.floor(date.getTime() / 1000),
        usd: Math.round(totalUsd),
        inr: Math.round(totalUsd * usdInrRate),
        dateLabel: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }),
      });
    }
  }

  // CRITICAL: Append the real current portfolio value as the last point
  const currentTotalUsd = assets.reduce((sum, a) => {
    const val = a.quantity * a.currentPrice;
    return sum + (a.currency === 'USD' ? val : val / usdInrRate);
  }, 0);

  if (currentTotalUsd > 0 && result.length > 0) {
    const now = Math.floor(Date.now() / 1000);
    const lastPoint = result[result.length - 1];
    if (now - lastPoint.time > 12 * 3600) {
      result.push({
        time: now,
        usd: Math.round(currentTotalUsd),
        inr: Math.round(currentTotalUsd * usdInrRate),
        dateLabel: 'Now',
      });
    } else {
      lastPoint.usd = Math.round(currentTotalUsd);
      lastPoint.inr = Math.round(currentTotalUsd * usdInrRate);
    }
  }

  return result;
}

export async function GET(request: NextRequest) {
  const authResult = requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '1Y';
    const usdInrRate = parseFloat(searchParams.get('usdInrRate') || '85');
    const assetsParam = searchParams.get('assets') || '[]';
    const assets: AssetInput[] = JSON.parse(assetsParam);

    if (assets.length === 0) {
      return NextResponse.json({ history: [] });
    }

    const rangeConfig = RANGE_MAP[range] || RANGE_MAP['1Y'];
    const { yahooRange, interval, maxPoints } = rangeConfig;

    // Fetch history for all assets in parallel
    const histories = await Promise.all(
      assets.map(asset => fetchAssetHistory(asset, yahooRange, interval))
    );

    // Compute portfolio value over time
    const history = computePortfolioValue(assets, histories, usdInrRate, maxPoints);

    return NextResponse.json({ history, range, assetCount: assets.length });
  } catch (err) {
    logger.error('Error fetching portfolio history', err);
    return NextResponse.json({ error: 'Failed to fetch portfolio history' }, { status: 500 });
  }
}
