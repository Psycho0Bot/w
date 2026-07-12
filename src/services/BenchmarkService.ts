import { BENCHMARKS, BENCHMARK_NAMES, TICKER_BENCHMARK_OVERRIDES, OVERRIDE_BENCHMARK_NAMES } from '@/config/benchmarks';

export interface BenchmarkDetails {
  ticker: string;
  name: string;
}

export class BenchmarkService {
  /**
   * Resolves the correct benchmark details for a given asset.
   * Matches specific tickers first, then category fallbacks.
   */
  public getBenchmark(asset: { ticker: string; category: string }): BenchmarkDetails {
    const cleanTicker = asset.ticker.toUpperCase().replace(/\.(NS|BOM)$/, '');
    
    // Check specific ticker overrides
    if (TICKER_BENCHMARK_OVERRIDES[cleanTicker]) {
      const benchmarkTicker = TICKER_BENCHMARK_OVERRIDES[cleanTicker];
      const name = OVERRIDE_BENCHMARK_NAMES[benchmarkTicker] || BENCHMARK_NAMES[benchmarkTicker] || benchmarkTicker;
      return {
        ticker: benchmarkTicker,
        name
      };
    }

    // Fall back to category-based defaults
    const categoryKey = asset.category.toLowerCase();
    const defaultTicker = (BENCHMARKS as any)[categoryKey] || 'NIFTY50';
    const name = BENCHMARK_NAMES[defaultTicker] || defaultTicker;

    return {
      ticker: defaultTicker,
      name
    };
  }

  /**
   * Translates a benchmark ticker into a formatted Yahoo/scraper-ready ticker if querying history
   */
  public getBenchmarkQueryTicker(benchmarkTicker: string): string {
    switch (benchmarkTicker) {
      case 'NIFTY50':
        return '^NSEI';
      case 'NIFTY500':
        return '^CRSLDX';
      case 'S&P500':
        return '^GSPC';
      case 'NASDAQ100':
        return '^NDX';
      case 'NYSE_FANG':
        return '^NYFACT';
      case 'BTC':
        return 'bitcoin'; // Used for CoinGecko
      case 'XAUUSD':
        return 'GOLD'; // Comex Spot Gold
      case 'XAGUSD':
        return 'SILVER'; // Comex Spot Silver
      default:
        return benchmarkTicker;
    }
  }
}

export const benchmarkService = new BenchmarkService();
export default BenchmarkService;
