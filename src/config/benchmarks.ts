export const BENCHMARKS = {
  stock_in: 'NIFTY50',
  stock_us: 'S&P500',
  etf: 'NIFTY50',
  crypto: 'BTC',
  gold: 'XAUUSD',
  mutual_fund: 'NIFTY500',
  fixed_income: 'NIFTY_GSEC', // General Indian government securities index as proxy
  real_estate: 'CPI_IN', // Inflation index as proxy benchmark
  cash: 'INR_SAVINGS' // Savings rate benchmark
};

export const BENCHMARK_NAMES: Record<string, string> = {
  NIFTY50: 'Nifty 50 Index',
  'S&P500': 'S&P 500 Index',
  BTC: 'Bitcoin Spot',
  XAUUSD: 'Spot Gold Price',
  NIFTY500: 'Nifty 500 Index',
  NIFTY_GSEC: 'Nifty G-Sec Index',
  CPI_IN: 'Consumer Price Index (IN)',
  INR_SAVINGS: 'Savings Bank Deposit Rate (Avg)'
};

// Specific ticker-to-benchmark overrides (e.g. MONQ50 matches NASDAQ100)
export const TICKER_BENCHMARK_OVERRIDES: Record<string, string> = {
  MONQ50: 'NASDAQ100',
  MON100: 'NASDAQ100',
  MAFANG: 'NYSE_FANG',
  QQQ: 'NASDAQ100',
  SPY: 'S&P500',
  VOO: 'S&P500',
  BTC: 'BTC',
  ETH: 'BTC', // Cryptos compare to BTC dominance
  SOL: 'BTC',
  GOLD: 'XAUUSD',
  SILVER: 'XAGUSD'
};

export const OVERRIDE_BENCHMARK_NAMES: Record<string, string> = {
  NASDAQ100: 'NASDAQ-100 Index',
  NYSE_FANG: 'NYSE FANG+ Index',
  XAGUSD: 'Spot Silver Price'
};
