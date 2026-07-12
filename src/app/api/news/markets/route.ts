import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { logger } from '@/services/LogService';

/**
 * GET /api/news/markets
 *
 * Fetches real live prices for major market indicators using Yahoo Finance.
 * Yahoo Finance is free, doesn't require an API key, and supports:
 *   - Indian indices: ^NSEI (NIFTY 50), ^BSESN (SENSEX)
 *   - US indices: ^GSPC (S&P 500), ^IXIC (NASDAQ), ^DJI (Dow)
 *   - Commodities: GC=F (Gold), SI=F (Silver), CL=F (Crude Oil)
 *   - Forex: DX-Y.NYB (Dollar Index), USDINR=X (USD/INR)
 *   - Crypto: BTC-USD, ETH-USD (via CoinGecko for consistency)
 */

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || '';

interface MarketItem {
  label: string;
  ticker: string;
  price: number | null;
  currency: 'INR' | 'USD';
  change: number;
  category: string;
}

// In-memory cache (5 min)
let cache: { data: MarketItem[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

const YAHOO_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

/**
 * Fetch price from Yahoo Finance chart API.
 * Works for indices, commodities, forex, and ETFs.
 */
async function fetchYahoo(symbol: string): Promise<{ price: number; change: number; prevClose: number } | null> {
  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: YAHOO_HEADERS,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose || price;
    if (!price || price === 0) return null;

    const change = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
    return { price, change, prevClose };
  } catch {
    return null;
  }
}

async function fetchCryptoPrices(): Promise<Record<string, { price: number; change: number }>> {
  const result: Record<string, { price: number; change: number }> = {};

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true${COINGECKO_API_KEY ? `&x_cg_demo_api_key=${COINGECKO_API_KEY}` : ''}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: COINGECKO_API_KEY ? { 'x-cg-demo-api-key': COINGECKO_API_KEY } : {},
    });
    if (!res.ok) return result;
    const data = await res.json();

    if (data?.bitcoin?.usd) {
      result.BTC = { price: data.bitcoin.usd, change: data.bitcoin.usd_24h_change || 0 };
    }
    if (data?.ethereum?.usd) {
      result.ETH = { price: data.ethereum.usd, change: data.ethereum.usd_24h_change || 0 };
    }
  } catch {
    // Fall through
  }

  return result;
}

export async function GET(request: NextRequest) {
  const authResult = requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json({ markets: cache.data });
  }

  try {
    // Fetch all in parallel using Yahoo Finance + CoinGecko
    const [
      crypto, nifty, sensex, sp500, nasdaq, dow,
      gold, silver, oil, usdinr,
    ] = await Promise.allSettled([
      fetchCryptoPrices(),
      fetchYahoo('^NSEI'),       // NIFTY 50
      fetchYahoo('^BSESN'),      // SENSEX
      fetchYahoo('^GSPC'),       // S&P 500
      fetchYahoo('^IXIC'),       // NASDAQ
      fetchYahoo('^DJI'),        // Dow Jones
      fetchYahoo('GC=F'),        // Gold futures
      fetchYahoo('SI=F'),        // Silver futures
      fetchYahoo('CL=F'),        // Crude Oil futures
      fetchYahoo('USDINR=X'),    // USD/INR
    ]);

    const items: MarketItem[] = [];

    // Crypto
    if (crypto.status === 'fulfilled') {
      const c = crypto.value;
      if (c.BTC) items.push({ label: 'BTC', ticker: 'BTC', price: c.BTC.price, currency: 'USD', change: c.BTC.change, category: 'crypto' });
      else items.push({ label: 'BTC', ticker: 'BTC', price: null, currency: 'USD', change: 0, category: 'crypto' });
      if (c.ETH) items.push({ label: 'ETH', ticker: 'ETH', price: c.ETH.price, currency: 'USD', change: c.ETH.change, category: 'crypto' });
      else items.push({ label: 'ETH', ticker: 'ETH', price: null, currency: 'USD', change: 0, category: 'crypto' });
    }

    // India indices
    if (nifty.status === 'fulfilled' && nifty.value) {
      items.push({ label: 'NIFTY 50', ticker: 'NIFTY', price: nifty.value.price, currency: 'INR', change: nifty.value.change, category: 'index' });
    } else {
      items.push({ label: 'NIFTY 50', ticker: 'NIFTY', price: null, currency: 'INR', change: 0, category: 'index' });
    }

    if (sensex.status === 'fulfilled' && sensex.value) {
      items.push({ label: 'SENSEX', ticker: 'SENSEX', price: sensex.value.price, currency: 'INR', change: sensex.value.change, category: 'index' });
    } else {
      items.push({ label: 'SENSEX', ticker: 'SENSEX', price: null, currency: 'INR', change: 0, category: 'index' });
    }

    // US indices
    if (sp500.status === 'fulfilled' && sp500.value) {
      items.push({ label: 'S&P 500', ticker: 'SPX', price: sp500.value.price, currency: 'USD', change: sp500.value.change, category: 'index' });
    } else {
      items.push({ label: 'S&P 500', ticker: 'SPX', price: null, currency: 'USD', change: 0, category: 'index' });
    }

    if (nasdaq.status === 'fulfilled' && nasdaq.value) {
      items.push({ label: 'NASDAQ', ticker: 'IXIC', price: nasdaq.value.price, currency: 'USD', change: nasdaq.value.change, category: 'index' });
    } else {
      items.push({ label: 'NASDAQ', ticker: 'IXIC', price: null, currency: 'USD', change: 0, category: 'index' });
    }

    if (dow.status === 'fulfilled' && dow.value) {
      items.push({ label: 'Dow Jones', ticker: 'DJI', price: dow.value.price, currency: 'USD', change: dow.value.change, category: 'index' });
    } else {
      items.push({ label: 'Dow Jones', ticker: 'DJI', price: null, currency: 'USD', change: 0, category: 'index' });
    }

    // Commodities
    if (gold.status === 'fulfilled' && gold.value) {
      items.push({ label: 'Gold', ticker: 'GOLD', price: gold.value.price, currency: 'USD', change: gold.value.change, category: 'commodity' });
    } else {
      items.push({ label: 'Gold', ticker: 'GOLD', price: null, currency: 'USD', change: 0, category: 'commodity' });
    }

    if (silver.status === 'fulfilled' && silver.value) {
      items.push({ label: 'Silver', ticker: 'SILVER', price: silver.value.price, currency: 'USD', change: silver.value.change, category: 'commodity' });
    } else {
      items.push({ label: 'Silver', ticker: 'SILVER', price: null, currency: 'USD', change: 0, category: 'commodity' });
    }

    if (oil.status === 'fulfilled' && oil.value) {
      items.push({ label: 'Oil', ticker: 'OIL', price: oil.value.price, currency: 'USD', change: oil.value.change, category: 'commodity' });
    } else {
      items.push({ label: 'Oil', ticker: 'OIL', price: null, currency: 'USD', change: 0, category: 'commodity' });
    }

    // Forex
    if (usdinr.status === 'fulfilled' && usdinr.value) {
      items.push({ label: 'USD/INR', ticker: 'USDINR', price: usdinr.value.price, currency: 'INR', change: usdinr.value.change, category: 'forex' });
    } else {
      items.push({ label: 'USD/INR', ticker: 'USDINR', price: null, currency: 'INR', change: 0, category: 'forex' });
    }

    cache = { data: items, timestamp: Date.now() };

    return NextResponse.json({ markets: items });
  } catch (err) {
    logger.error('Error fetching market data', err);
    return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
  }
}
