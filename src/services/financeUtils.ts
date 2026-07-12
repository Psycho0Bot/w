/**
 * Finance calculations and utility methods for WealthOS.
 */

export interface CashFlow {
  amount: number; // Negative for buy (outflow), Positive for sell/dividend/current valuation (inflow)
  date: Date;
}

/**
 * Calculates the XIRR (Internal Rate of Return) for a series of irregular cash flows.
 * Uses a robust bisection solver.
 */
export function calculateXIRR(cashFlows: CashFlow[]): number {
  if (cashFlows.length < 2) return 0;

  // Filter out invalid transactions and clone
  const flows = cashFlows
    .map(cf => ({ amount: cf.amount, date: new Date(cf.date) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Must have at least one negative (investment) and one positive (current value/returns) flow
  const hasNegative = flows.some(f => f.amount < 0);
  const hasPositive = flows.some(f => f.amount > 0);
  if (!hasNegative || !hasPositive) return 0;

  const firstDate = flows[0].date;

  // Equation function: sum of flow / (1 + r)^t_i
  const equation = (r: number): number => {
    let sum = 0;
    for (const flow of flows) {
      const years = (flow.date.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      sum += flow.amount / Math.pow(1 + r, years);
    }
    return sum;
  };

  // Bisection search bounds
  let rMin = -0.9999;
  let rMax = 5.0; // 500% cap for search initialization
  let fMin = equation(rMin);
  let fMax = equation(rMax);

  // If root is not bracketed, expand bounds
  if (fMin * fMax > 0) {
    let found = false;
    for (let i = 0; i < 15; i++) {
      rMax *= 2;
      fMax = equation(rMax);
      if (fMin * fMax <= 0) {
        found = true;
        break;
      }
    }
    if (!found) {
      // If it doesn't bracket, compute absolute ROI instead of XIRR
      return calculateAbsoluteReturn(flows);
    }
  }

  // Solve using Bisection
  const maxIterations = 100;
  const tolerance = 1e-6;
  let rate = 0;

  for (let i = 0; i < maxIterations; i++) {
    rate = (rMin + rMax) / 2;
    const fVal = equation(rate);

    if (Math.abs(fVal) < tolerance) {
      return rate;
    }

    if (fVal * fMin < 0) {
      rMax = rate;
      fMax = fVal;
    } else {
      rMin = rate;
      fMin = fVal;
    }
  }

  return rate;
}

/**
 * Calculates absolute return/ROI for a simple check.
 */
function calculateAbsoluteReturn(flows: CashFlow[]): number {
  let invested = 0;
  let returns = 0;
  for (const f of flows) {
    if (f.amount < 0) {
      invested += Math.abs(f.amount);
    } else {
      returns += f.amount;
    }
  }
  if (invested === 0) return 0;
  return (returns - invested) / invested;
}

/**
 * Calculates the CAGR (Compound Annual Growth Rate).
 */
export function calculateCAGR(initialValue: number, currentValue: number, years: number): number {
  if (initialValue <= 0 || currentValue < 0 || years <= 0) return 0;
  return Math.pow(currentValue / initialValue, 1 / years) - 1;
}

/**
 * Volatility (Standard Deviation of returns)
 */
export function calculateVolatility(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  return Math.sqrt(variance);
}

/**
 * Sharpe Ratio
 * (Portfolio Return - Risk Free Rate) / Volatility
 */
export function calculateSharpeRatio(portfolioReturn: number, volatility: number, riskFreeRate = 0.06): number {
  if (volatility === 0) return 0;
  return (portfolioReturn - riskFreeRate) / volatility;
}

/**
 * Sortino Ratio
 * (Portfolio Return - Risk Free Rate) / Downside Deviation
 */
export function calculateSortinoRatio(portfolioReturn: number, returns: number[], riskFreeRate = 0.06): number {
  const downsideReturns = returns.filter(r => r < riskFreeRate);
  if (downsideReturns.length < 2) return 0;
  
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const downsideVariance = downsideReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  const downsideDeviation = Math.sqrt(downsideVariance);
  
  if (downsideDeviation === 0) return 0;
  return (portfolioReturn - riskFreeRate) / downsideDeviation;
}

/**
 * Calculates Alpha and Beta of a portfolio relative to a benchmark index.
 */
export function calculateAlphaBeta(
  portfolioReturns: number[],
  benchmarkReturns: number[],
  riskFreeRate = 0.06
): { alpha: number; beta: number } {
  if (portfolioReturns.length < 2 || portfolioReturns.length !== benchmarkReturns.length) {
    return { alpha: 0, beta: 1 };
  }

  const pMean = portfolioReturns.reduce((sum, r) => sum + r, 0) / portfolioReturns.length;
  const bMean = benchmarkReturns.reduce((sum, r) => sum + r, 0) / benchmarkReturns.length;

  // Calculate Covariance of portfolio and benchmark
  let covariance = 0;
  let bVariance = 0;
  for (let i = 0; i < portfolioReturns.length; i++) {
    const pDiff = portfolioReturns[i] - pMean;
    const bDiff = benchmarkReturns[i] - bMean;
    covariance += pDiff * bDiff;
    bVariance += bDiff * bDiff;
  }
  covariance /= portfolioReturns.length - 1;
  bVariance /= benchmarkReturns.length - 1;

  if (bVariance === 0) {
    return { alpha: 0, beta: 1 };
  }

  const beta = covariance / bVariance;
  // Alpha = Portfolio Return - [RiskFreeRate + Beta * (Benchmark Return - RiskFreeRate)]
  const alpha = pMean - (riskFreeRate + beta * (bMean - riskFreeRate));

  return { alpha, beta };
}

/**
 * Calculates the Max Drawdown of historical net worth coordinates.
 */
export function calculateMaxDrawdown(history: number[]): number {
  if (history.length === 0) return 0;
  let maxDrawdown = 0;
  let peak = history[0];

  for (const value of history) {
    if (value > peak) {
      peak = value;
    }
    const drawdown = peak > 0 ? (peak - value) / peak : 0;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

/**
 * Formats numbers into native currency formats (INR / USD).
 */
export function formatVal(amount: number, currency: 'INR' | 'USD', decimals = 0): string {
  if (isNaN(amount) || amount === null) return currency === 'INR' ? '₹0' : '$0';
  
  // Dynamically adjust decimals for tiny prices (like cheap altcoins/micro penny stocks)
  let activeDecimals = decimals;
  if (amount > 0 && amount < 0.1) {
    activeDecimals = Math.max(decimals, 5); // Use 5 decimal places for sub-10c assets
  } else if (amount > 0 && amount < 1.0) {
    activeDecimals = Math.max(decimals, 4); // Use 4 decimal places for sub-1$ assets
  }

  // Format with standard localization
  if (currency === 'INR') {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: activeDecimals,
      minimumFractionDigits: activeDecimals
    }).format(amount);
  } else {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: activeDecimals,
      minimumFractionDigits: activeDecimals
    }).format(amount);
  }
}

const googleFinanceMfMap: Record<string, string> = {
  '147946': 'BAND_SMAL_CAP_11G09BP',      // Bandhan Small Cap
  '122639': 'PPFAS_FLEX_CAP_11F0N0G',     // Parag Parikh Flexi Cap
  '118989': 'SBI_BLUE_FUND_11G021V',      // SBI Bluechip
  '120847': 'MIRA_ASSE_LARG_CAP_120847',  // Mirae Asset Large Cap
  '148918': 'MOTI_OSWA_NASD_100_FOF_DIR_G', // Motilal Oswal Nasdaq 100 FOF
  '120828': 'QUAN_SMAL_CAP_120828',       // Quant Small Cap
  '120823': 'QUAN_ACTI_120823',           // Quant Active
  '118778': 'NIPP_INDI_SMAL_CAP_118778',  // Nippon India Small Cap
  '119598': 'AXIS_BLUE_FUND_11G012L',     // Axis Bluechip
  '119364': 'ICIC_PRUD_BLUE_FUND_11G031U', // ICICI Prudential Bluechip
  '118632': 'NIPP_INDI_LARG_CAP_118632',  // Nippon India Large Cap
  '119732': 'SBI_PSU_FUND_11G022E',       // SBI PSU
  '127042': 'MOTI_OSWA_MIDC_127042',      // Motilal Oswal Midcap
  '146746': 'PARA_PARI_TAX_SAVE_DIR_G',   // Parag Parikh Tax Saver
  '120621': 'ICIC_PRUD_INFR_120621',      // ICICI Prudential Infrastructure
  '118557': 'FRAN_BUIL_INDI_118557',      // Franklin Build India
  '148419': 'MOTI_OSWA_SP_500_DIR_G',     // Motilal Oswal S&P 500 Index
  '119063': 'HDFC_INDE_NIFT_50_DIR_G',    // HDFC Index Nifty 50 Plan
};

/**
 * Generates a direct TradingView symbol details page URL
 */
export function getTradingViewUrl(ticker: string, category: string, exchange?: string): string {
  const cat = category.toLowerCase();
  
  if (cat === 'mutual_fund' || cat === 'mutualfund') {
    const cleanTicker = ticker.toUpperCase().replace(/\.(NS|BOM)$/, '');
    const mappedSymbol = googleFinanceMfMap[cleanTicker] || cleanTicker;
    return `https://www.google.com/finance/quote/${mappedSymbol}:MUTF_IN`;
  }

  const cleanTicker = ticker.toUpperCase().replace(/\.(NS|BOM)$/, '');
  
  if (cat === 'crypto') {
    return `https://www.tradingview.com/symbols/${cleanTicker}USD/`;
  }
  
  // Resolve standard Indian vs US stock formats
  const isUS = cat === 'stock_us' || (cat === 'etf' && !ticker.endsWith('.NS'));
  const ex = exchange?.toUpperCase() || (isUS ? 'NASDAQ' : 'NSE');
  return `https://www.tradingview.com/symbols/${ex}-${cleanTicker}/`;
}
