import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, checkRateLimit } from '@/lib/serverAuth';
import { globalRateLimiter } from '@/lib/rateLimit';

// No hardcoded API key fallback — require env var
const CG_API_KEY = process.env.COINGECKO_API_KEY || '';

// ---------- fetch with timeout ----------
const FETCH_TIMEOUT_MS = 10_000; // 10 seconds

function fetchWithTimeout(url: string, opts: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

// ---------- SSRF protection for sheet endpoint ----------
function isAllowedSheetUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    // Only allow HTTPS
    if (parsed.protocol !== 'https:') return false;
    // Only allow Google Docs / Google Sheets domains
    const allowedHosts = [
      'docs.google.com',
      'spreadsheets.google.com',
      'drive.google.com',
    ];
    return allowedHosts.some((h) => parsed.hostname === h || parsed.hostname.endsWith('.' + h));
  } catch {
    return false;
  }
}

// ---------- server-side in-memory cache ----------
interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const globalKey = '__wealthos_api_cache__';

function getServerCache(): Record<string, CacheEntry> {
  if (!(globalThis as any)[globalKey]) {
    (globalThis as any)[globalKey] = {};
  }
  return (globalThis as any)[globalKey];
}

const CACHE_TTL_GF   =  1 * 60 * 1000; // 1 minute for Google Finance scraper
const CACHE_TTL_CG   =  5 * 60 * 1000; // 5 minutes for CoinGecko
const CACHE_TTL_MF   = 60 * 60 * 1000; // 60 minutes for Mutual Fund NAVs (update once daily)
const CACHE_TTL_FX   =  5 * 60 * 1000; // 5 minutes for forex

function getCached(key: string, ttl: number): unknown | null {
  const cache = getServerCache();
  const entry = cache[key];
  if (entry && (Date.now() - entry.timestamp) < ttl) {
    return entry.data;
  }
  return null;
}

function setCache(key: string, data: unknown): void {
  const cache = getServerCache();
  cache[key] = { data, timestamp: Date.now() };
}

function getStaleFallback(key: string): unknown | null {
  const cache = getServerCache();
  return cache[key]?.data ?? null;
}

// ---------- Google Finance scraper helper ----------
function getMarketStatus(exchange: string): "OPEN" | "CLOSED" {
  const date = new Date();
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  if (day === 0 || day === 6) return "CLOSED";

  const cleanEx = exchange.toUpperCase();
  if (cleanEx === 'NSE' || cleanEx === 'BSE') {
    // Indian market: 9:15 AM to 3:30 PM IST (UTC +5.5)
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const ist = new Date(utc + (3600000 * 5.5));
    const hours = ist.getHours();
    const minutes = ist.getMinutes();
    const time = hours * 100 + minutes;
    if (time >= 915 && time <= 1530) return "OPEN";
    return "CLOSED";
  } else {
    // US market: 9:30 AM to 4:00 PM EST (UTC -5 or -4 depending on DST)
    const est = new Date(date.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const hours = est.getHours();
    const minutes = est.getMinutes();
    const time = hours * 100 + minutes;
    if (time >= 930 && time <= 1600) return "OPEN";
    return "CLOSED";
  }
}

// ---------- Google Finance scraper helper ----------
async function scrapeGoogleFinance(query: string): Promise<{ price: number; name: string; currency: string; changePercent: number; previousClose?: number; marketStatus: "OPEN" | "CLOSED" } | null> {
  try {
    const url = `https://www.google.com/finance/quote/${query}`;
    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!response.ok) return null;
    const html = await response.text();

    const parts = query.split(':');
    const cleanTicker = parts[0];
    const exchange = parts[1] || 'NASDAQ';

    // Pattern 1: [["TICKER","EXCHANGE"],"Name",0,"CURRENCY",[price, change, changePercent,...]]
    const regexA = new RegExp(`\\[\\s*["']${cleanTicker}["']\\s*,\\s*["']([^"']+)["']\\s*\\]\\s*,\\s*["']([^"']+)["']\\s*,\\s*\\d+\\s*,\\s*["']([A-Z]{3})["']\\s*,\\s*\\[\\s*([0-9.-]+)\\s*,\\s*([0-9.-]+)\\s*,\\s*([0-9.-]+)`, 'i');
    const matchA = html.match(regexA);
    if (matchA) {
      const price = parseFloat(matchA[4]);
      const change = parseFloat(matchA[5]);
      return {
        currency: matchA[3].toUpperCase(),
        name: matchA[2],
        price,
        changePercent: parseFloat(matchA[6]),
        previousClose: price - change,
        marketStatus: getMarketStatus(matchA[1])
      };
    }

    // Pattern 2 (Fallback B)
    const regexB = new RegExp(`\\[\\s*["']${cleanTicker}["']\\s*,\\s*["']([^"']+)["']\\s*\\]\\s*\\]\\s*,\\s*null\\s*,\\s*[0-9.-]+\\s*,\\s*["']/[^"']+["']\\s*,\\s*[0-9.-]+\\s*,\\s*[0-9.-]+\\s*,\\s*([0-9.-]+)\\s*,\\s*\\d+\\s*,\\s*([0-9.-]+)\\s*,\\s*\\d+\\s*,\\s*([0-9.-]+)`, 'i');
    const matchB = html.match(regexB);
    if (matchB) {
      const price = parseFloat(matchB[2]);
      const change = parseFloat(matchB[3]);
      return {
        currency: 'USD',
        name: cleanTicker,
        price,
        changePercent: parseFloat(matchB[4]),
        previousClose: price - change,
        marketStatus: getMarketStatus(matchB[1])
      };
    }

    // Legacy fallback regexes (just in case)
    const escapedTicker = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regexLegacy = new RegExp(`["']([A-Z]{3})["']\\s*,\\s*["']${escapedTicker}["']\\s*,\\s*["']([^"']+)["']\\s*,\\s*([0-9.]+)`, 'i');
    const matchLegacy = html.match(regexLegacy);
    if (matchLegacy) {
      const price = parseFloat(matchLegacy[3]);
      return {
        currency: matchLegacy[1].toUpperCase(),
        name: matchLegacy[2],
        price,
        changePercent: 0,
        previousClose: price,
        marketStatus: getMarketStatus(exchange)
      };
    }
  } catch (e) {
    console.error(`Error scraping Google Finance for ${query}`, e);
  }
  return null;
}

// ---------- Yahoo Finance previousClose fetcher ----------
// Returns the exact exchange closing price — matches broker apps
async function fetchYahooPreviousClose(ticker: string): Promise<{ previousClose: number; regularMarketPrice: number } | null> {
  try {
    // Resolve ticker to Yahoo Finance format
    let yahooTicker = ticker.toUpperCase();
    // Indian tickers: keep .NS suffix
    if (!yahooTicker.includes('.') && !yahooTicker.match(/^[A-Z]{1,5}$/)) {
      // Likely Indian ticker without suffix — add .NS
      yahooTicker = yahooTicker + '.NS';
    }
    // Commodity futures → use Yahoo equivalents
    const yahooCommodityMap: Record<string, string> = {
      'GOLD': 'GC=F', 'GCW00': 'GC=F',
      'SILVER': 'SI=F', 'SIW00': 'SI=F',
      'CRUDEOIL': 'CL=F', 'CLW00': 'CL=F',
      'BRENT': 'BZ=F', 'BZW00': 'BZ=F',
    };
    const cleanUpper = ticker.toUpperCase().replace(/\.(NS|BOM)$/, '');
    if (yahooCommodityMap[cleanUpper]) {
      yahooTicker = yahooCommodityMap[cleanUpper];
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?range=2d&interval=1d`;
    const res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const previousClose = meta.chartPreviousClose;
    const regularMarketPrice = meta.regularMarketPrice;
    if (typeof previousClose === 'number' && previousClose > 0) {
      return { previousClose, regularMarketPrice };
    }
  } catch (e) {
    console.error(`Yahoo Finance previousClose fetch failed for ${ticker}`, e);
  }
  return null;
}

// ---------- Exchange/ticker resolution ----------
function resolveExchanges(ticker: string): { cleanTicker: string; exchanges: string[] } {
  let cleanTicker = ticker.toUpperCase().replace(/\.NS$/, '').replace(/\.BOM$/, '');

  // ---- Commodities → COMEX / NYMEX futures ----
  const commodityMap: Record<string, { ticker: string; exchange: string }> = {
    'GOLD':       { ticker: 'GCW00',  exchange: 'COMEX' },
    'SILVER':     { ticker: 'SIW00',  exchange: 'COMEX' },
    'CRUDEOIL':   { ticker: 'CLW00',  exchange: 'NYMEX' },
    'CRUDE':      { ticker: 'CLW00',  exchange: 'NYMEX' },
    'CRUDE_OIL':  { ticker: 'CLW00',  exchange: 'NYMEX' },
    'WTI':        { ticker: 'CLW00',  exchange: 'NYMEX' },
    'BRENT':      { ticker: 'BZW00',  exchange: 'NYMEX' },
    'NATURALGAS': { ticker: 'NGW00',  exchange: 'NYMEX' },
    'NATGAS':     { ticker: 'NGW00',  exchange: 'NYMEX' },
    'COPPER':     { ticker: 'HGW00',  exchange: 'COMEX' },
    'PLATINUM':   { ticker: 'PLW00',  exchange: 'NYMEX' },
    'PALLADIUM':  { ticker: 'PAW00',  exchange: 'NYMEX' },
  };
  if (commodityMap[cleanTicker]) {
    return { cleanTicker: commodityMap[cleanTicker].ticker, exchanges: [commodityMap[cleanTicker].exchange] };
  }

  // ---- Indian assets (client sends .NS or .BOM suffix) ----
  if (ticker.endsWith('.NS')) return { cleanTicker, exchanges: ['NSE', 'BSE'] };
  if (ticker.endsWith('.BOM')) return { cleanTicker, exchanges: ['BSE', 'NSE'] };

  // ---- Everything else: try US exchanges first, then Indian as fallback ----
  // Since Indian tickers already come with .NS suffix from the client,
  // any ticker WITHOUT a suffix is most likely a US stock/ETF.
  return { cleanTicker, exchanges: ['NASDAQ', 'NYSE', 'NYSEARCA', 'NSE', 'BSE'] };
}

// ---------- route handler ----------
export async function GET(request: NextRequest) {
  // ── Auth check ──
  const authResult = requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  // ── Rate limit ──
  const rateLimitResponse = checkRateLimit(request, globalRateLimiter);
  if (rateLimitResponse) return rateLimitResponse;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  try {
    // ---- Forex (USD/INR) via Google Finance ----
    if (type === 'forex') {
      const cacheKey = 'sv_forex_usdinr';
      const cached = getCached(cacheKey, CACHE_TTL_FX);
      if (cached) return NextResponse.json(cached);

      // Scrape Google Finance for USD-INR currency pair
      const result = await scrapeGoogleFinance('USD-INR');
      if (result && result.price > 0) {
        // Return in Alpha Vantage-compatible format so the client code doesn't break
        const data = {
          'Realtime Currency Exchange Rate': {
            '5. Exchange Rate': result.price.toString()
          }
        };
        setCache(cacheKey, data);
        return NextResponse.json(data);
      }

      // Fallback: return stale cache or hardcoded rate
      const stale = getStaleFallback(cacheKey);
      if (stale) return NextResponse.json(stale);

      return NextResponse.json({
        'Realtime Currency Exchange Rate': {
          '5. Exchange Rate': '95.15'
        }
      });
    }

    // ---- Stock / ETF / Commodity quote via Google Finance ----
    if (type === 'stock') {
      const ticker = searchParams.get('ticker') || '';
      if (!ticker || ticker.length > 20) {
        return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 });
      }
      const cacheKey = `sv_stock_${ticker}`;
      const cached = getCached(cacheKey, CACHE_TTL_GF);
      if (cached) return NextResponse.json(cached);

      const { cleanTicker, exchanges } = resolveExchanges(ticker);

      let price = 0;
      let changePercent = 0;
      let previousClose = 0;
      let marketStatus: "OPEN" | "CLOSED" = "CLOSED";

      for (const ex of exchanges) {
        const query = `${cleanTicker}:${ex}`;
        const result = await scrapeGoogleFinance(query);
        if (result && result.price > 0) {
          price = result.price;
          changePercent = result.changePercent;
          previousClose = result.previousClose || result.price;
          marketStatus = result.marketStatus;
          break;
        }
      }

      // Enhance price and previousClose with Yahoo Finance's exact exchange data
      if (price > 0) {
        const yahooCacheKey = `sv_yahoo_pc_${ticker}`;
        const yahooCached = getCached(yahooCacheKey, CACHE_TTL_GF) as { previousClose: number; regularMarketPrice: number } | null;
        if (yahooCached && yahooCached.previousClose > 0) {
          previousClose = yahooCached.previousClose;
          if (yahooCached.regularMarketPrice > 0) {
            price = yahooCached.regularMarketPrice;
          }
          // Recalculate changePercent using Yahoo's exact previous close
          changePercent = previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : changePercent;
        } else {
          const yahooData = await fetchYahooPreviousClose(ticker);
          if (yahooData) {
            previousClose = yahooData.previousClose;
            if (yahooData.regularMarketPrice > 0) {
              price = yahooData.regularMarketPrice;
            }
            changePercent = previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : changePercent;
            setCache(yahooCacheKey, yahooData);
          }
        }
      }

      if (price > 0) {
        const data = {
          "Global Quote": {
            "01. symbol": ticker,
            "05. price": price.toString(),
            "10. change percent": `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
            "previousClose": previousClose.toString(),
            "marketStatus": marketStatus
          }
        };
        setCache(cacheKey, data);
        return NextResponse.json(data);
      }

      const stale = getStaleFallback(cacheKey);
      if (stale) return NextResponse.json(stale);

      return NextResponse.json({ error: 'Failed to retrieve price from Google Finance' }, { status: 404 });
    }

    // ---- Mutual Fund Details via Groww ----
    if (type === 'mf_details') {
      const schemeCode = searchParams.get('scheme_code') || '';
      const name = searchParams.get('name') || '';
      if (!schemeCode && !name) {
        return NextResponse.json({ error: 'scheme_code or name required' }, { status: 400 });
      }

      const cacheKey = `sv_mf_details_${schemeCode || name}`;
      const cached = getCached(cacheKey, 24 * 60 * 60 * 1000); // 24-hour cache
      if (cached) return NextResponse.json(cached);

      try {
        let searchId = '';

        // 1. FIRST try building slug directly from fund name — most accurate
        // The Groww URL is just the name slugified: edelweiss-us-technology-equity-fof-direct-growth
        // This is more reliable than search which often returns wrong funds
        if (name) {
          const slug = name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
          const directUrl = `https://groww.in/mutual-funds/${slug}`;
          const directRes = await fetch(directUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          });
          if (directRes.ok) {
            const html = await directRes.text();
            if (html.includes('__NEXT_DATA__') && html.includes('mfServerSideData')) {
              // Direct URL works — use this as the searchId
              searchId = slug;
            }
          }
        }

        // 2. If slug didn't work, try search API as fallback
        if (!searchId) {
          const searchQuery = name || schemeCode;
          const searchUrl = `https://groww.in/v1/api/search/v1/entity?app=groww&entity_type=scheme&query=${encodeURIComponent(searchQuery)}`;
          const searchRes = await fetch(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          const searchJson = await searchRes.json();
          const schemeEntity = searchJson?.content?.find((e: any) =>
            e.entity_type === 'Scheme' || e.sub_entity_type === 'Scheme'
          ) || searchJson?.content?.[0];

          if (schemeEntity && schemeEntity.search_id) {
            searchId = schemeEntity.search_id;
          }
        }

        if (searchId) {
          // 2. Fetch scheme detail page HTML from Groww
          const detailUrl = `https://groww.in/mutual-funds/${searchId}`;
          const detailRes = await fetch(detailUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          const html = await detailRes.text();
          
          // 3. Extract __NEXT_DATA__
          const indexNextData = html.indexOf('id="__NEXT_DATA__"');
          if (indexNextData !== -1) {
            const start = html.indexOf('>', indexNextData) + 1;
            const end = html.indexOf('</script>', start);
            const jsonText = html.slice(start, end);
            const data = JSON.parse(jsonText);
            const mfData = data?.props?.pageProps?.mfServerSideData;
            
            if (mfData) {
              const aumRaw = parseFloat(mfData.aum);
              const aumStr = isNaN(aumRaw) ? '—' : `₹${aumRaw.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr`;
              const expenseRatioStr = mfData.expense_ratio ? `${mfData.expense_ratio}%` : '—';

              let managerName = '—';
              if (Array.isArray(mfData.fund_manager_details) && mfData.fund_manager_details.length > 0) {
                managerName = mfData.fund_manager_details.map((m: any) => m.person_name).join(' & ');
              } else if (mfData.fund_manager) {
                managerName = mfData.fund_manager;
              }

              const exitLoadText = mfData.exit_load || '—';

              // Crisil/rating
              let categoryRankStr = '—';
              if (mfData.stats?.crisil_rank) {
                categoryRankStr = `${mfData.stats.crisil_rank} in category`;
              } else if (mfData.crisil_rating) {
                categoryRankStr = `${mfData.crisil_rating} star rating`;
              } else if (mfData.groww_rating) {
                categoryRankStr = `${mfData.groww_rating}/5 Groww Rating`;
              }

              const ratingVal = mfData.groww_rating || mfData.crisil_rating || 0;

              // Extract returns from return_stats or simple_return
              const returns = mfData.return_stats?.[0] || mfData.simple_return?.[0] || {};
              const stats = mfData.stats?.find((s: any) => s.type === 'FUND_RETURN') || {};
              const catStats = mfData.stats?.find((s: any) => s.type === 'CATEGORY_RETURN') || {};

              // Extract holdings (top 5)
              const topHoldings = (mfData.holdings || [])
                .filter((h: any) => h.nature_name !== 'CASH' && h.nature_name !== 'CASH & DERIVATIVES')
                .slice(0, 5)
                .map((h: any) => ({
                  name: h.company_name,
                  sector: h.sector_name,
                  weight: h.percentage || h.weight,
                }));

              // Extract sector allocation (top 5)
              const sectorMap: Record<string, number> = {};
              (mfData.holdings || []).forEach((h: any) => {
                if (h.sector_name && h.sector_name !== 'Unspecified') {
                  sectorMap[h.sector_name] = (sectorMap[h.sector_name] || 0) + (h.percentage || h.weight || 0);
                }
              });
              const topSectors = Object.entries(sectorMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, weight]) => ({ name, weight: Math.round(weight * 100) / 100 }));

              // Peer comparison
              const peers = (mfData.peerComparison || []).slice(0, 5).map((p: any) => ({
                name: p.fund_name || p.scheme_name || p.search_id,
                aum: p.aum,
                return1Y: p.return_1y,
                return3Y: p.return_3y,
              }));

              // Analysis points (pros/cons)
              const analysis = (mfData.analysis || []).slice(0, 4).map((a: any) => ({
                type: a.analysis_type, // PRO or CON
                subject: a.analysis_subject,
                desc: a.analysis_desc,
              }));

              const details = {
                manager: managerName,
                aum: aumStr,
                expenseRatio: expenseRatioStr,
                exitLoad: exitLoadText,
                categoryRank: categoryRankStr,
                ratingStars: ratingVal > 0 ? '★'.repeat(ratingVal) + '☆'.repeat(5 - ratingVal) : '—',
                // New enriched fields
                nav: mfData.nav ? `₹${mfData.nav}` : '—',
                navDate: mfData.nav_date || '—',
                benchmark: mfData.benchmark || mfData.benchmark_name || '—',
                category: mfData.category || '—',
                subCategory: mfData.sub_category || '—',
                fundHouse: mfData.fund_house || mfData.amc || '—',
                launchDate: mfData.launch_date || '—',
                minInvestment: mfData.min_investment_amount ? `₹${mfData.min_investment_amount}` : '—',
                minSIP: mfData.min_sip_investment ? `₹${mfData.min_sip_investment}` : '—',
                planType: mfData.plan_type || '—',
                schemeType: mfData.scheme_type || '—',
                portfolioTurnover: mfData.portfolio_turnover ? `${mfData.portfolio_turnover}%` : '—',
                riskLevel: mfData.nfo_risk || '—',
                returns: {
                  '1D': returns.return1d,
                  '1W': returns.return1w,
                  '1M': returns.return1m,
                  '3M': returns.return3m,
                  '6M': returns.return6m,
                  '1Y': returns.return1y,
                  '3Y': stats.stat_3y,
                  '5Y': stats.stat_5y,
                  all: stats.stat_all,
                },
                categoryReturns: {
                  '1Y': catStats.stat_1y,
                  '3Y': catStats.stat_3y,
                  '5Y': catStats.stat_5y,
                },
                topHoldings,
                topSectors,
                peers,
                analysis,
              };

              setCache(cacheKey, details);
              return NextResponse.json(details);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching dynamic mutual fund details:', err);
      }

      return NextResponse.json({ error: 'Failed to retrieve mutual fund factsheet from Groww' }, { status: 404 });
    }

    // ---- ETF Details via Groww (Indian ETFs) ----
    if (type === 'etf_details') {
      const ticker = (searchParams.get('ticker') || '').toUpperCase();
      const name = searchParams.get('name') || '';
      if (!ticker && !name) {
        return NextResponse.json({ error: 'Ticker or name required' }, { status: 400 });
      }

      const cacheKey = `sv_etf_details_${ticker}`;
      const cached = getCached(cacheKey, CACHE_TTL_MF); // 60 min cache
      if (cached) return NextResponse.json(cached);

      try {
        // 1. Search for ETF on Groww
        const searchQuery = ticker || name;
        const searchUrl = `https://groww.in/v1/api/search/v1/entity?app=groww&entity_type=etf&query=${encodeURIComponent(searchQuery)}`;
        const searchRes = await fetch(searchUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const searchJson = await searchRes.json();
        const searchResult = searchJson?.content?.find((e: any) =>
          e.entity_type === 'ETF' || e.sub_entity_type === 'ETF'
        ) || searchJson?.content?.[0];

        if (searchResult?.search_id) {
          // 2. Fetch ETF detail page
          const detailUrl = `https://groww.in/etfs/${searchResult.search_id}`;
          const detailRes = await fetch(detailUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          });
          const html = await detailRes.text();

          // 3. Extract __NEXT_DATA__
          const idx = html.indexOf('id="__NEXT_DATA__"');
          if (idx !== -1) {
            const start = html.indexOf('>', idx) + 1;
            const end = html.indexOf('</script>', start);
            const jsonText = html.slice(start, end);
            const data = JSON.parse(jsonText);
            const props = data?.props?.pageProps;

            if (props) {
              const fund = props.fundamentalsData || {};
              const etfInfo = props.etfInfoData || {};
              const holdings = props.etfHoldingsData?.holdings || [];
              const sectors = props.sectorsData?.etfSectorSummary?.sectors || [];
              const returns = props.categoryReturnsData || {};

              // Top 5 holdings
              const topHoldings = holdings.slice(0, 5).map((h: any) => ({
                isin: h.isin,
                weight: h.holdingSharePercentage,
              }));

              // Top 3 sectors
              const topSectors = sectors.slice(0, 3).map((s: any) => ({
                name: s.sectorName,
                weight: s.sectorSharePercentage,
              }));

              const details = {
                expenseRatio: fund.expenseRatio ? `${fund.expenseRatio}%` : null,
                trackingError: fund.trackingError ? `${fund.trackingError}%` : null,
                aum: fund.aumInCrores ? `₹${Number(fund.aumInCrores).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr` : null,
                nav: fund.nav ? `₹${fund.nav}` : null,
                fundManager: etfInfo.fundManagers?.join(', ') || null,
                topHoldings,
                topSectors,
                returns: {
                  '1M': returns.return1M,
                  '3M': returns.return3M,
                  '6M': returns.return6M,
                  '1Y': returns.return1Y,
                  '3Y': returns.return3Y,
                  '5Y': returns.return5Y,
                },
                categoryReturns: {
                  '1Y': returns.categoryReturn1Y,
                  '3Y': returns.categoryReturn3Y,
                  '5Y': returns.categoryReturn5Y,
                },
              };

              setCache(cacheKey, details);
              return NextResponse.json(details);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching ETF details from Groww:', err);
      }

      return NextResponse.json({ error: 'Failed to retrieve ETF details' }, { status: 404 });
    }

    // ---- Crypto via CoinGecko ----
    if (type === 'crypto') {
      const ids = searchParams.get('ids') || '';
      if (!ids) {
        return NextResponse.json({ error: 'IDs parameter required' }, { status: 400 });
      }
      const cacheKey = `sv_crypto_${ids}`;
      const cached = getCached(cacheKey, CACHE_TTL_CG);
      if (cached) return NextResponse.json(cached);

      if (!CG_API_KEY) {
        return NextResponse.json({ error: 'CoinGecko API key not configured' }, { status: 503 });
      }

      const apiKeyParam = CG_API_KEY.startsWith('CG-')
        ? `x_cg_demo_api_key=${CG_API_KEY}`
        : `x_cg_api_key=${CG_API_KEY}`;

      const response = await fetchWithTimeout(
        `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd,inr&include_24hr_change=true&${apiKeyParam}`
      );
      const data = await response.json();

      if (data && typeof data === 'object' && !data.status?.error_message) {
        setCache(cacheKey, data);
      }

      return NextResponse.json(data);
    }

    // ---- Crypto Details via CoinGecko ----
    if (type === 'crypto-details') {
      const id = searchParams.get('id') || '';
      if (!id) {
        return NextResponse.json({ error: 'ID parameter required' }, { status: 400 });
      }
      const cacheKey = `sv_crypto_details_${id}`;
      const cached = getCached(cacheKey, CACHE_TTL_CG);
      if (cached) return NextResponse.json(cached);

      if (!CG_API_KEY) {
        return NextResponse.json({ error: 'CoinGecko API key not configured' }, { status: 503 });
      }

      const apiKeyParam = CG_API_KEY.startsWith('CG-')
        ? `x_cg_demo_api_key=${CG_API_KEY}`
        : `x_cg_api_key=${CG_API_KEY}`;

      const response = await fetchWithTimeout(
        `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false&${apiKeyParam}`
      );
      const data = await response.json();

      if (data && typeof data === 'object' && !data.status?.error_message) {
        setCache(cacheKey, data);
      }

      return NextResponse.json(data);
    }

    // ---- Mutual Fund NAV via AMFI ----
    if (type === 'mf') {
      const scheme = searchParams.get('scheme') || '';
      if (!scheme || scheme.length > 20) {
        return NextResponse.json({ error: 'Invalid scheme code' }, { status: 400 });
      }
      const cacheKey = `sv_mf_${scheme}`;
      const cached = getCached(cacheKey, CACHE_TTL_MF);
      if (cached) return NextResponse.json(cached);

      const response = await fetchWithTimeout(`https://api.mfapi.in/mf/${encodeURIComponent(scheme)}`);
      const data = await response.json();

      if (data?.data?.[0]) {
        setCache(cacheKey, data);
      }

      return NextResponse.json(data);
    }

    // ---- Google Sheet CSV (SSRF-protected) ----
    if (type === 'sheet') {
      const url = searchParams.get('url') || '';
      if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });

      // SSRF protection: only allow Google Docs/Sheets domains over HTTPS
      if (!isAllowedSheetUrl(url)) {
        return NextResponse.json(
          { error: 'URL must be a valid HTTPS Google Sheets/Docs URL' },
          { status: 400 }
        );
      }

      const response = await fetchWithTimeout(url);
      if (!response.ok) {
        throw new Error(`Google Sheet returned status ${response.status}`);
      }
      const csv = await response.text();
      return NextResponse.json({ csv });
    }
  } catch (err: unknown) {
    // Don't leak internal error details to client
    console.error('Market data API error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch market data' },
      { status: 500 }
    );
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}
