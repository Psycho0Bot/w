export { AssetMetricProvider, type MetricCardData } from './base';

import { AssetMetricProvider } from './base';
import { StockMetrics } from './StockMetrics';
import { ETFMetrics } from './ETFMetrics';
import { MutualFundMetrics } from './MutualFundMetrics';
import { CryptoMetrics } from './CryptoMetrics';
import { FixedIncomeMetrics } from './FixedIncomeMetrics';

export class AssetMetricRegistry {
  public static getProvider(category: string): AssetMetricProvider {
    const cat = category.toLowerCase();
    switch (cat) {
      case 'stock_in':
      case 'stock_us':
        return new StockMetrics();
      case 'etf':
        return new ETFMetrics();
      case 'mutual_fund':
        return new MutualFundMetrics();
      case 'crypto':
        return new CryptoMetrics();
      case 'fixed_income':
      case 'gold':
      case 'real_estate':
      case 'cash':
        return new FixedIncomeMetrics();
      default:
        return new StockMetrics(); // default fallback
    }
  }
}
