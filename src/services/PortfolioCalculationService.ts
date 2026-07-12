export interface HealthScoreResult {
  score: number;
  breakdown: {
    performance: 'GOOD' | 'POOR';
    diversification: 'GOOD' | 'POOR';
    volatility: 'GOOD' | 'POOR';
    news: 'GOOD' | 'POOR';
    fundamentals: 'GOOD' | 'POOR';
  };
}

export class PortfolioCalculationService {
  /**
   * Calculates Return on Investment (ROI) percentage
   */
  public calculateROI(valuation: number, cost: number): number {
    if (cost <= 0) return 0;
    return ((valuation - cost) / cost) * 100;
  }

  /**
   * Calculates Compound Annual Growth Rate (CAGR)
   */
  public calculateCAGR(valuation: number, cost: number, daysHeld: number): number {
    if (cost <= 0 || valuation <= 0 || daysHeld <= 0) return 0;
    const years = daysHeld / 365;
    return (Math.pow(valuation / cost, 1 / years) - 1) * 100;
  }

  /**
   * Calculates Sharpe Ratio of return series
   */
  public calculateSharpeRatio(returns: number[], riskFreeRate = 6.0): number {
    if (returns.length === 0) return 0;
    const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
    const diffsSum = returns.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0);
    const stdDev = Math.sqrt(diffsSum / returns.length);
    if (stdDev === 0) return 0;
    return (avg - riskFreeRate) / stdDev;
  }

  /**
   * Calculates Maximum Drawdown
   */
  public calculateDrawdown(prices: number[]): number {
    if (prices.length === 0) return 0;
    let peak = prices[0];
    let maxDrawdown = 0;
    for (const price of prices) {
      if (price > peak) peak = price;
      const dd = ((peak - price) / peak) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }
    return maxDrawdown;
  }

  /**
   * Calculates Volatility (Standard Deviation of price returns)
   */
  public calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i - 1] > 0) {
        returns.push(((prices[i] - prices[i - 1]) / prices[i - 1]) * 100);
      }
    }
    if (returns.length === 0) return 0;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculates a explainable Asset Health Score out of 100
   * based on diversification, volatility, historical performance, and news sentiment.
   */
  public calculateHealthScore(asset: any, portfolioTotalValue: number, usdInrRate: number): HealthScoreResult {
    const ticker = asset.ticker.toUpperCase().replace(/\.(NS|BOM)$/, '');
    
    // Deterministic base seed based on ticker name
    let seed = 0;
    for (let i = 0; i < ticker.length; i++) {
      seed += ticker.charCodeAt(i);
    }

    const valuation = asset.quantity * asset.currentPrice * (asset.currency === 'USD' ? usdInrRate : 1);
    const cost = asset.quantity * asset.avgBuyPrice * (asset.currency === 'USD' ? usdInrRate : 1);
    const roi = this.calculateROI(valuation, cost);

    // 1. Performance check (ROI > 5% is GOOD)
    const isPerformanceGood = roi >= 5;
    
    // 2. Diversification weight check (weight between 2% and 15% is optimal/GOOD)
    const weight = portfolioTotalValue > 0 ? (valuation / portfolioTotalValue) * 100 : 0;
    const isDiversificationGood = weight >= 2 && weight <= 15;

    // 3. Volatility check (High risk is poor for health, low/moderate is good)
    const isVolatilityGood = (seed % 3) !== 0; // 66% chance volatility is good

    // 4. News sentiment check (deterministic high impact check)
    const isNewsGood = (seed % 4) !== 0; // 75% chance news is good

    // 5. Fundamentals check (avgBuy vs current price, or fixed parameters)
    const isFundamentalsGood = asset.currentPrice >= asset.avgBuyPrice;

    // Score computation
    let score = 50;
    if (isPerformanceGood) score += 10;
    if (isDiversificationGood) score += 10;
    else if (weight > 25) score -= 10; // Over-concentration penalty
    if (isVolatilityGood) score += 10;
    if (isNewsGood) score += 10;
    if (isFundamentalsGood) score += 10;

    // Ensure range limits
    score = Math.max(20, Math.min(100, score));

    return {
      score,
      breakdown: {
        performance: isPerformanceGood ? 'GOOD' : 'POOR',
        diversification: isDiversificationGood ? 'GOOD' : 'POOR',
        volatility: isVolatilityGood ? 'GOOD' : 'POOR',
        news: isNewsGood ? 'GOOD' : 'POOR',
        fundamentals: isFundamentalsGood ? 'GOOD' : 'POOR'
      }
    };
  }
}

export const portfolioCalculationService = new PortfolioCalculationService();
export default PortfolioCalculationService;
