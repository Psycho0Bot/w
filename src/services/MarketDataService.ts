import { getStockQuote, getCryptoPrices, getMutualFundNAV, getUsdInrRate, cryptoIdMap } from '@/services/marketService';

export interface PriceQuote {
  price: number;
  changePercent: number;
  currency: string;
}

export interface HistoricalPrice {
  time: string | number; // YYYY-MM-DD or Unix timestamp
  value: number;
}

export interface LivePriceProvider {
  getQuote(ticker: string, category: string): Promise<PriceQuote>;
}

export interface HistoryProvider {
  getHistory(ticker: string, category: string, range: string): Promise<HistoricalPrice[]>;
}

// ==================== Live Price Providers ====================

class StockLiveProvider implements LivePriceProvider {
  public async getQuote(ticker: string, category: string): Promise<PriceQuote> {
    const isUS = category.toLowerCase() === 'stock_us';
    const res = await getStockQuote(ticker, isUS);
    return {
      price: res.price,
      changePercent: res.changePercent,
      currency: isUS ? 'USD' : 'INR',
    };
  }
}

class CryptoLiveProvider implements LivePriceProvider {
  public async getQuote(symbol: string): Promise<PriceQuote> {
    const prices = await getCryptoPrices([symbol]);
    const normalized = symbol.toUpperCase();
    if (prices[normalized]) {
      return {
        price: prices[normalized].usdPrice,
        changePercent: prices[normalized].usdChange24h,
        currency: 'USD',
      };
    }
    return { price: 0, changePercent: 0, currency: 'USD' };
  }
}

class CommodityLiveProvider implements LivePriceProvider {
  public async getQuote(ticker: string): Promise<PriceQuote> {
    const res = await getStockQuote(ticker, true);
    return {
      price: res.price,
      changePercent: res.changePercent,
      currency: 'USD',
    };
  }
}

class MutualFundLiveProvider implements LivePriceProvider {
  public async getQuote(schemeCode: string): Promise<PriceQuote> {
    const res = await getMutualFundNAV(schemeCode);
    const nav = res.nav;
    const prevNav = res.previousNav || nav;
    const changePercent = prevNav > 0 ? ((nav - prevNav) / prevNav) * 100 : 0;
    return {
      price: nav,
      changePercent,
      currency: 'INR',
    };
  }
}

// ==================== History Providers (Server-Only) ====================

class YahooHistoryProvider implements HistoryProvider {
  public async getHistory(ticker: string, category: string, range: string): Promise<HistoricalPrice[]> {
    try {
      let yahooTicker = ticker.toUpperCase();
      const isCommodity = category.toLowerCase() === 'commodity' || category.toLowerCase() === 'gold';
      if (isCommodity) {
        const commodityYahooMap: Record<string, string> = {
          'GOLD': 'GC=F',
          'SILVER': 'SI=F',
          'CRUDEOIL': 'CL=F',
          'CRUDE': 'CL=F',
          'CRUDE_OIL': 'CL=F',
          'WTI': 'CL=F',
          'BRENT': 'BZ=F',
          'NATURALGAS': 'NG=F',
          'NATGAS': 'NG=F',
          'COPPER': 'HG=F',
          'PLATINUM': 'PL=F',
          'PALLADIUM': 'PA=F',
        };
        yahooTicker = commodityYahooMap[yahooTicker] || yahooTicker;
      }
      
      const usTickers = ['AAPL', 'TSLA', 'MSFT', 'SPY', 'VOO', 'QQQ', 'GOLD', 'SILVER'];
      const isUS = usTickers.includes(ticker.toUpperCase()) || category.toLowerCase() === 'stock_us' || isCommodity;
      
      if (!isUS && !yahooTicker.includes('.')) {
        yahooTicker = yahooTicker + '.NS';
      }

      // Range to Interval Mapping
      let interval = '1d';
      if (range === '1d') interval = '5m';
      else if (range === '5d') interval = '15m';

      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?range=${range}&interval=${interval}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      if (!res.ok) return [];

      const json = await res.json();
      const result = json?.chart?.result?.[0];
      if (!result) return [];

      const timestamps = result.timestamp || [];
      const closes = result.indicators?.quote?.[0]?.close || [];

      const data: HistoricalPrice[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const time = timestamps[i];
        const val = closes[i];
        if (typeof val === 'number' && val > 0) {
          data.push({ time, value: val });
        }
      }
      return data;
    } catch (e) {
      console.error(`Yahoo History failed for ${ticker}`, e);
      return [];
    }
  }
}

class MutualFundHistoryProvider implements HistoryProvider {
  public async getHistory(schemeCode: string, category: string, range: string): Promise<HistoricalPrice[]> {
    try {
      const response = await fetch(`https://api.mfapi.in/mf/${schemeCode}`);
      if (!response.ok) return [];
      const json = await response.json();
      const rawData = json?.data || [];
      
      // Filter by range if needed
      // data in rawData is in reverse chronological order (latest first)
      // Let's reverse it to chronological order (oldest first)
      const data = [...rawData].reverse();
      
      const parsedData: HistoricalPrice[] = [];
      const now = Date.now();
      let limitDays = 365;
      if (range === '1d') limitDays = 1;
      else if (range === '5d') limitDays = 5;
      else if (range === '1mo' || range === '1M') limitDays = 30;
      else if (range === '3mo' || range === '3M') limitDays = 90;
      else if (range === '6mo' || range === '6M') limitDays = 180;
      else if (range === '5y') limitDays = 1825;
      else if (range === 'max' || range === 'all') limitDays = 99999;

      const cutoffTime = now - (limitDays * 24 * 60 * 60 * 1000);

      for (const item of data) {
        if (!item.date || !item.nav) continue;
        const parts = item.date.split('-'); // DD-MM-YYYY
        const dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        const timeMs = dateObj.getTime();
        if (timeMs < cutoffTime) continue;
        
        const value = parseFloat(item.nav);
        if (!isNaN(value) && value > 0) {
          parsedData.push({
            time: Math.floor(timeMs / 1000),
            value
          });
        }
      }
      return parsedData;
    } catch (e) {
      console.error(`Mutual Fund History failed for ${schemeCode}`, e);
      return [];
    }
  }
}

class CryptoHistoryProvider implements HistoryProvider {
  public async getHistory(id: string, category: string, range: string): Promise<HistoricalPrice[]> {
    try {
      let days = '365';
      if (range === '1d') days = '1';
      else if (range === '5d') days = '5';
      else if (range === '1mo') days = '30';
      else if (range === '3mo') days = '90';
      else if (range === '6mo') days = '180';
      else if (range === '5y') days = '1825';
      else if (range === 'max') days = 'max';

      const CG_API_KEY = process.env.COINGECKO_API_KEY || 'CG-wy2js5fvykQb1PHju87y2QrZ';
      const apiKeyParam = CG_API_KEY.startsWith('CG-')
        ? `x_cg_demo_api_key=${CG_API_KEY}`
        : `x_cg_api_key=${CG_API_KEY}`;

      // Resolve standard ticker (e.g. BTC) to coingecko id centrally
      const upperId = id.toUpperCase();
      const coinId = cryptoIdMap[upperId] || id.toLowerCase();

      const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&${apiKeyParam}`;
      const res = await fetch(url);
      if (!res.ok) return [];

      const json = await res.json();
      const prices = json.prices || [];

      return prices.map((p: [number, number]) => {
        const time = Math.floor(p[0] / 1000);
        const value = p[1];
        return { time, value };
      });
    } catch (e) {
      console.error(`Crypto History failed for ${id}`, e);
      return [];
    }
  }
}

// ==================== Unified Registry ====================

class MarketDataService {
  // Provider Registry
  private priceProviders: Record<string, LivePriceProvider> = {
    stock_in: new StockLiveProvider(),
    stock_us: new StockLiveProvider(),
    etf: new StockLiveProvider(),
    crypto: new CryptoLiveProvider(),
    commodity: new CommodityLiveProvider(),
    mutual_fund: new MutualFundLiveProvider(),
  };

  private yahooHistory = new YahooHistoryProvider();
  private cryptoHistory = new CryptoHistoryProvider();
  private mfHistory = new MutualFundHistoryProvider();

  public async getPrice(ticker: string, category: string): Promise<PriceQuote> {
    const cat = category.toLowerCase();
    const provider = this.priceProviders[cat] || this.priceProviders['stock_in'];
    return provider.getQuote(ticker, category);
  }

  public async getHistory(ticker: string, category: string, range = '1y'): Promise<HistoricalPrice[]> {
    // If client-side, fetch from our REST API route
    if (typeof window !== 'undefined') {
      try {
        const response = await fetch(`/api/v1/market/history?ticker=${ticker}&category=${category}&range=${range}`);
        if (response.ok) {
          const data = await response.json();
          return data || [];
        }
      } catch (err) {
        console.error('Failed to fetch client history API', err);
      }
      return [];
    }

    // Server-side provider resolution
    const cat = category.toLowerCase();
    if (cat === 'crypto') {
      return this.cryptoHistory.getHistory(ticker, category, range);
    } else if (cat === 'mutual_fund' || cat === 'mutualfund') {
      return this.mfHistory.getHistory(ticker, category, range);
    } else {
      // Stocks, ETFs, commodities resolve via YahooHistory
      return this.yahooHistory.getHistory(ticker, category, range);
    }
  }

  public async getUsdInrRate(): Promise<number> {
    return getUsdInrRate();
  }
}

export const marketDataService = new MarketDataService();
export default MarketDataService;
