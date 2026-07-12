/**
 * Market Service for WealthOS.
 * Fetches live prices via Google Finance (stocks/ETFs/forex/commodities),
 * CoinGecko (crypto), and AMFI (mutual funds).
 */


// Cache structure in milliseconds
const CACHE_EXPIRY = 60 * 1000 * 15; // 15 minutes cache (matches server-side TTL for Alpha Vantage)

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// In-memory fallback/cache
const memoryCache: Record<string, CacheEntry<any>> = {};

// Hardcoded base rates
let USD_INR_RATE = 95.15;

/**
 * Get item from cache if valid
 */
function getCache<T>(key: string, customExpiry?: number): T | null {
  if (typeof window === 'undefined') return null;
  const expiry = customExpiry !== undefined ? customExpiry : CACHE_EXPIRY;
  
  // Try memory cache first
  if (memoryCache[key]) {
    const elapsed = Date.now() - memoryCache[key].timestamp;
    if (elapsed < expiry) {
      return memoryCache[key].data as T;
    }
  }

  // Try local storage
  try {
    const stored = localStorage.getItem(`cache_${key}`);
    if (stored) {
      const entry = JSON.parse(stored) as CacheEntry<T>;
      const elapsed = Date.now() - entry.timestamp;
      if (elapsed < expiry) {
        // Hydrate memory cache
        memoryCache[key] = entry;
        return entry.data;
      }
    }
  } catch (e) {
    console.error('Cache read error', e);
  }
  return null;
}

/**
 * Save item to cache
 */
function setCache<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = { data, timestamp: Date.now() };
  memoryCache[key] = entry;
  
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify(entry));
    } catch (e) {
      console.error('Cache write error', e);
    }
  }
}

/**
 * Fetch USD/INR Exchange Rate
 */
export async function getUsdInrRate(): Promise<number> {
  const cacheKey = 'usd_inr';
  const cached = getCache<number>(cacheKey);
  if (cached) {
    USD_INR_RATE = cached;
    return cached;
  }

  try {
    const response = await fetch('/api/market-data?type=forex');
    const data = await response.json();
    
    // Alpha Vantage response parsing
    const rateStr = data?.['Realtime Currency Exchange Rate']?.['5. Exchange Rate'];
    if (rateStr) {
      const rate = parseFloat(rateStr);
      if (!isNaN(rate) && rate > 0) {
        setCache(cacheKey, rate);
        USD_INR_RATE = rate;
        return rate;
      }
    }
    
    // Check if error message (e.g. rate limit)
    if (data?.Note || data?.Information) {
      console.warn('Alpha Vantage Rate Limit Hit. Using cached or fallback rate.', data);
    }
  } catch (err) {
    console.error('Error fetching forex rate', err);
  }

  return USD_INR_RATE;
}

/**
 * Get Stock/ETF/Commodity price via Google Finance scraper
 */
export async function getStockQuote(ticker: string, isUS = true): Promise<{ price: number; changePercent: number; previousClose: number; marketStatus: "OPEN" | "CLOSED" }> {
  // Normalize tickers (e.g. AAPL, Reliance -> RELIANCE.BOM / RELIANCE.NS)
  const queryTicker = isUS ? ticker : `${ticker}.NS`;
  const cacheKey = `stock_quote_${queryTicker}`;
  
  // Bypass cache for GOLD and SILVER to ensure they update instantly
  const isGoldOrSilver = ['GOLD', 'SILVER'].includes(ticker.toUpperCase());
  if (!isGoldOrSilver) {
    const cached = getCache<{ price: number; changePercent: number; previousClose: number; marketStatus: "OPEN" | "CLOSED" }>(cacheKey);
    if (cached) return cached;
  }

  try {
    const response = await fetch(`/api/market-data?type=stock&ticker=${queryTicker}`);
    const data = await response.json();
    
    const quote = data?.['Global Quote'];
    if (quote && quote['05. price']) {
      const price = parseFloat(quote['05. price']);
      const changeStr = quote['10. change percent'];
      const changePercent = parseFloat(changeStr.replace('%', ''));
      const prevClose = quote['previousClose'] ? parseFloat(quote['previousClose']) : price;
      const marketStatus = quote['marketStatus'] || 'CLOSED';
      
      if (!isNaN(price)) {
        const result = { 
          price, 
          changePercent: isNaN(changePercent) ? 0 : changePercent,
          previousClose: isNaN(prevClose) ? price : prevClose,
          marketStatus
        };
        setCache(cacheKey, result);
        return result;
      }
    }

    if (data?.Note || data?.Information) {
      console.warn(`Alpha Vantage Rate Limit Hit for ${ticker}. Falling back to simulated price.`);
    }
  } catch (err) {
    console.error(`Error fetching stock quote for ${ticker}`, err);
  }

  // Fallback / Simulated Market Feeds for testability
  return getSimulatedPrice(ticker, isUS ? 'USD' : 'INR');
}

/**
 * Maps common crypto symbols to CoinGecko IDs
 */
export const cryptoIdMap: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  ARB: 'arbitrum',
  MATIC: 'polygon-ecosystem-token',
  POL: 'polygon-ecosystem-token',
  USDT: 'tether',
  USDC: 'usd-coin',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  XRP: 'ripple',
  AVAX: 'avalanche-2',
  DOT: 'polkadot',
  LINK: 'chainlink',
  SHIB: 'shiba-inu',
  ATOM: 'cosmos',
  LTC: 'litecoin',
  AO: 'ao-computer',
  BCH: 'bitcoin-cash',
  GRAM: 'the-open-network',
  SEI: 'sei-network',
  HBAR: 'hedera-hashgraph',
  HEDERA: 'hedera-hashgraph',
  IMX: 'immutable-x',
  KCS: 'kucoin-shares',
  SUI: 'sui',
  PEPE: 'pepe',
  APT: 'aptos',
  ZK: 'zksync',
  XLM: 'stellar',
  MAJOR: 'major',
  TRX: 'tron',
  XPL: 'plasma',
  SOMI: 'somnia',
  AVNT: 'avantis',
  UNI: 'uniswap',
  KGEN: 'kgen',
};

/**
 * Fetch Crypto prices from CoinGecko
 */
export async function getCryptoPrices(symbols: string[]): Promise<Record<string, { usdPrice: number; inrPrice: number; usdChange24h: number; inrChange24h: number }>> {
  const ids = symbols.map(s => cryptoIdMap[s.toUpperCase()] || s.toLowerCase()).filter(Boolean);
  const cacheKey = `crypto_prices_${ids.join('_')}`;

  const cached = getCache<Record<string, { usdPrice: number; inrPrice: number; usdChange24h: number; inrChange24h: number }>>(cacheKey, 60 * 1000);
  if (cached) return cached;

  const result: Record<string, { usdPrice: number; inrPrice: number; usdChange24h: number; inrChange24h: number }> = {};
  
  try {
    const idParam = ids.join(',');
    const usdInr = await getUsdInrRate();
    const response = await fetch(`/api/market-data?type=crypto&ids=${idParam}`);
    const data = await response.json();

    if (data && typeof data === 'object') {
      symbols.forEach(sym => {
        const cgId = cryptoIdMap[sym.toUpperCase()] || sym.toLowerCase();
        if (data[cgId]) {
          result[sym.toUpperCase()] = {
            usdPrice: data[cgId].usd || 0,
            inrPrice: data[cgId].inr || (data[cgId].usd * usdInr) || 0,
            usdChange24h: data[cgId].usd_24h_change || 0,
            inrChange24h: data[cgId].inr_24h_change || 0,
          };
        }
      });
    }

    if (Object.keys(result).length > 0) {
      setCache(cacheKey, result);
      return result;
    }
  } catch (err) {
    console.error('Error fetching crypto prices from CoinGecko', err);
  }

  // Fallback to simulated pricing for crypto
  const usdInr = await getUsdInrRate();
  symbols.forEach(sym => {
    const sim = getSimulatedPrice(sym, 'USD');
    result[sym.toUpperCase()] = {
      usdPrice: sim.price,
      inrPrice: sim.price * usdInr,
      usdChange24h: sim.changePercent,
      inrChange24h: sim.changePercent,
    };
  });
  return result;
}

/**
 * Simulated price engine fallback
 */
const simulatedBasePrices: Record<string, number> = {
  AAPL: 191.24,
  TSLA: 182.40,
  MSFT: 421.90,
  RELIANCE: 2940.50,
  TCS: 3820.00,
  HDFCBANK: 1610.15,
  INFY: 1540.30,
  BTC: 60500.00,
  ETH: 3350.00,
  SOL: 135.50,
  BNB: 560.20,
  ARB: 0.85,
  MATIC: 0.073,
  POL: 0.073,
  ADA: 0.45,
  DOGE: 0.12,
  XRP: 0.52,
  AVAX: 35.50,
  DOT: 7.20,
  LINK: 14.80,
  SHIB: 0.000009,
  ATOM: 9.50,
  LTC: 84.20,
  BCH: 236.27,
  GRAM: 1.67,
  SEI: 0.049,
  HBAR: 0.071,
  HEDERA: 0.071,
  IMX: 0.139,
  KCS: 13.22,
  TRX: 0.16,
  XPL: 0.092,
  SOMI: 1.06,
  AVNT: 0.88,
  UNI: 9.00,
  KGEN: 0.167,
  SPY: 545.50,
  QQQ: 478.20,
  VOO: 502.40,
  NIFTYBEES: 277.05,
  GOLDBEES: 118.50,
  JUNIORBEES: 70.40,
  NIFTYAXIS: 269.09,
  BNKETFAXIS: 599.68,
  AXISBPSETF: 13.33,
  SETFNIF50: 261.98,
  MON100: 327.28,
  MONQ50: 145.29,
  MOM50: 277.05,
  MOM100: 29.50,
  MONIFTY500: 28.50,
  MAFANG: 191.78,
  MASPTOP50: 77.97,
  MAHKTECH: 22.02,
  ICICIB22: 118.11,
  HNGSNGBEES: 482.60,
  BANKBEES: 52.75,
  SETFNN50: 73.80,
  SETFGOLD: 63.50,
  SILVERBEES: 78.20,
  INF204KB14I2: 277.05,
  INF204KB19I1: 482.60,
  INF769K01HF4: 191.78,
  AXISNIFTY: 269.09,
  AXISBPETF: 599.68,
  SETFNIFTY: 261.98,
  MASP500: 77.97,
  BHARAT22: 118.11,
  '122639': 78.40,
  '118989': 84.10,
  '120847': 115.30,
  '148918': 32.50,
  GOLD: 4100.00, // Spot Gold per Oz in USD
  SILVER: 48.50,  // Spot Silver per Oz in USD
  SGB: 14160.00,   // Sovereign Gold Bond per gram in INR
  GOLD_24K: 14449.00,
  GOLD_22K: 13235.00,
  DIGI_GOLD: 14449.00,
};

export function isMarketOpen(ticker: string, category: string): "OPEN" | "CLOSED" {
  const t = ticker.toUpperCase();
  const cat = category.toLowerCase();
  
  // Crypto trades 24/7
  if (cat === 'crypto' || ['BTC', 'ETH', 'SOL', 'BNB', 'HBAR', 'KGEN'].includes(t)) {
    return "OPEN";
  }

  // International spot commodities (Gold, Silver, Oil, Copper, etc.)
  // COMEX/ICE trade Sunday 6pm ET → Friday 5pm ET (nearly 23/5)
  // Treat as OPEN whenever it's a weekday OR Sunday evening (US time)
  const spotCommodities = ['GOLD', 'SILVER', 'CRUDEOIL', 'CRUDE', 'NATURALGAS', 'NATGAS', 'COPPER', 'PLATINUM', 'PALLADIUM', 'BRENT'];
  if (spotCommodities.includes(t) && cat !== 'etf') {
    // Spot commodities trade almost 24h on weekdays
    const est = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    const estDay = est.getDay(); // 0 = Sunday
    const estTime = est.getHours() * 100 + est.getMinutes();
    // Sunday 6pm ET onwards, Mon-Thu all day, Friday until 5pm ET
    if (estDay === 0 && estTime >= 1800) return "OPEN"; // Sunday evening
    if (estDay >= 1 && estDay <= 4) return "OPEN"; // Mon-Thu
    if (estDay === 5 && estTime < 1700) return "OPEN"; // Friday before 5pm
    return "CLOSED";
  }

  const date = new Date();
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  if (day === 0 || day === 6) return "CLOSED";

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const time = hours * 100 + minutes;

  const isUS = ['AAPL', 'TSLA', 'MSFT', 'SPY', 'VOO', 'QQQ'].includes(t) || cat === 'stock_us';
  if (cat === 'mutual_fund' || cat === 'mutualfund') {
    return (time >= 915 && time <= 1530) ? "OPEN" : "CLOSED";
  }

  if (isUS) {
    const est = new Date(date.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const estHours = est.getHours();
    const estMins = est.getMinutes();
    const estTime = estHours * 100 + estMins;
    return (estTime >= 930 && estTime <= 1600) ? "OPEN" : "CLOSED";
  } else {
    // Indian stocks & ETFs (including GOLD ETFs like GOLDBEES, SETFGOLD, SILVERBEES)
    return (time >= 915 && time <= 1530) ? "OPEN" : "CLOSED";
  }
}

export function getSimulatedPrice(ticker: string, currency = 'USD', category = 'stock_in'): { price: number; changePercent: number; previousClose: number; marketStatus: "OPEN" | "CLOSED" } {
  const t = ticker.toUpperCase();
  const base = simulatedBasePrices[t] || 100.0;
  
  const seconds = new Date().getSeconds();
  const seed = Math.sin(t.charCodeAt(0) + seconds) * 0.008; // Max 0.8% drift
  const price = base * (1 + seed);
  const changePercent = seed * 100;
  const previousClose = base;

  return {
    price,
    changePercent,
    previousClose,
    marketStatus: isMarketOpen(ticker, category)
  };
}

/**
 * Fetch Indian Mutual Fund NAV from AMFI
 * (AMFI publishes daily mutual fund NAV values on a public text endpoint)
 */
export async function getMutualFundNAV(schemeCode: string): Promise<{ nav: number; previousNav?: number }> {
  const cacheKey = `mf_nav_${schemeCode}`;
  const cached = getCache<{ nav: number; previousNav?: number }>(cacheKey, 60 * 60 * 1000);
  if (cached) return cached;

  try {
    const response = await fetch(`/api/market-data?type=mf&scheme=${schemeCode}`);
    const data = await response.json();
    
    if (data && data.data && data.data[0]) {
      const nav = parseFloat(data.data[0].nav);
      const prevNav = data.data[1] ? parseFloat(data.data[1].nav) : undefined;
      if (!isNaN(nav)) {
        const result = { nav, previousNav: prevNav && !isNaN(prevNav) ? prevNav : nav };
        setCache(cacheKey, result);
        return result;
      }
    }
  } catch (err) {
    console.error(`Error fetching MF NAV for scheme ${schemeCode}`, err);
  }

  // Simulated fallback nav based on scheme code
  const codeNum = parseInt(schemeCode) || 120000;
  const baseNav = (codeNum % 150) + 25.0; // Random stable NAV between 25 and 175
  const seconds = new Date().getSeconds();
  const seed = Math.sin(codeNum + seconds) * 0.002;
  const nav = baseNav * (1 + seed);
  return { nav, previousNav: nav };
}

/**
 * Fetch and parse Google Sheet CSV for prices
 */
export async function getGoogleSheetPrices(url: string): Promise<{ prices: Record<string, number>; previousCloses: Record<string, number> }> {
  try {
    const encodedUrl = encodeURIComponent(url);
    const response = await fetch(`/api/market-data?type=sheet&url=${encodedUrl}`);
    if (!response.ok) {
      throw new Error('Failed to fetch Google Sheet data');
    }
    const data = await response.json();
    if (!data.csv) return { prices: {}, previousCloses: {} };

    const rows = data.csv.split(/\r?\n/);
    const prices: Record<string, number> = {};
    const previousCloses: Record<string, number> = {};

    for (const row of rows) {
      // Split by comma ignoring commas inside quotes
      const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c: string) => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length >= 2) {
        const ticker = cols[0].trim().toUpperCase();
        const priceStr = cols[1].trim();
        const price = parseFloat(priceStr.replace(/,/g, ''));
        if (ticker && !isNaN(price)) {
          if (ticker.endsWith('_PREV_CLOSE') || ticker.endsWith('_PREVIOUS_CLOSE') || ticker.endsWith('_CLOSEYEST')) {
            const cleanT = ticker.replace(/_PREV_CLOSE|_PREVIOUS_CLOSE|_CLOSEYEST/, '');
            previousCloses[cleanT] = price;
          } else {
            prices[ticker] = price;
          }
        }
        
        // Third column support for previous close
        if (cols.length >= 3) {
          const prevCloseStr = cols[2].trim();
          const prevClose = parseFloat(prevCloseStr.replace(/,/g, ''));
          if (ticker && !isNaN(prevClose)) {
            previousCloses[ticker] = prevClose;
          }
        }
      }
    }

    return { prices, previousCloses };
  } catch (err) {
    console.error('Error fetching/parsing Google Sheet prices:', err);
    return { prices: {}, previousCloses: {} };
  }
}

