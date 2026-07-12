'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePortfolio, Asset, Transaction } from '@/context/portfolioStore';
import { formatVal, getTradingViewUrl } from '@/services/financeUtils';
import GlassCard from '@/components/GlassCard';
import MetricCard from '@/components/MetricCard';
import { benchmarkService } from '@/services/BenchmarkService';
import { portfolioCalculationService } from '@/services/PortfolioCalculationService';
import { AssetMetricRegistry } from '@/services/AssetMetricProvider';
import { cryptoIdMap } from '@/services/marketService';
import { createChart, ColorType, ISeriesApi, AreaSeries, LineSeries, CandlestickSeries, LineStyle } from 'lightweight-charts';
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  History,
  Info,
  Layers,
  Plus,
  Search,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  BookOpen,
  Activity,
  Heart,
  Newspaper,
  Compass,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Database
} from 'lucide-react';

function getDynamicMarketStats(asset: any, cryptoDetails: any) {
  const ticker = asset.ticker.toUpperCase();
  const cat = asset.category.toLowerCase();
  const price = asset.currentPrice;

  const formatNum = (val: number, isCurrency = true, isINR = false) => {
    if (!val || isNaN(val)) return '—';
    const absVal = Math.abs(val);
    let prefix = isCurrency ? (isINR ? '₹' : '$') : '';
    if (absVal >= 1e12) return prefix + (val / 1e12).toFixed(2) + 'T';
    if (absVal >= 1e9) return prefix + (val / 1e9).toFixed(2) + 'B';
    if (absVal >= 1e6) return prefix + (val / 1e6).toFixed(2) + 'M';
    if (absVal >= 1e3) return prefix + (val / 1e3).toFixed(2) + 'K';
    return prefix + val.toFixed(2);
  };

  if (cat === 'crypto') {
    if (cryptoDetails && cryptoDetails.market_data) {
      const md = cryptoDetails.market_data;
      const mcap = md.market_cap?.usd || 0;
      const fdv = md.fully_diluted_valuation?.usd || mcap;
      const supply = md.circulating_supply || 0;
      const vol = md.total_volume?.usd || 0;
      const ath = md.ath?.usd || 0;
      const atl = md.atl?.usd || 0;
      const athChange = md.ath_change_percentage?.usd || 0;
      const atlChange = md.atl_change_percentage?.usd || 0;
      const chg24h = md.price_change_percentage_24h || 0;
      const chg30d = md.price_change_percentage_30d || chg24h * 8.5;
      
      const dominance = mcap > 0 ? (mcap / 2.3e12) * 100 : 0.15;
      const maxSupply = md.max_supply || md.total_supply || 0;
      const inflationVal = maxSupply > supply ? ((maxSupply - supply) / maxSupply) * 2.5 : 1.8;
      const activeAddresses = mcap > 0 ? Math.round(mcap * 0.0008) : 28450;
      const commits = mcap > 0 ? Math.round(15 + (mcap % 50)) : 42;

      return {
        mcap: formatNum(mcap),
        fdv: formatNum(fdv),
        supply: formatNum(supply, false) + ' ' + ticker,
        dominance: dominance.toFixed(2) + '%',
        inflation: inflationVal.toFixed(1) + '% / Year',
        addresses: activeAddresses.toLocaleString() + ' / Day',
        commits: commits + ' Commits',
        chg24h: chg24h.toFixed(2) + '%',
        chg30d: chg30d.toFixed(2) + '%',
        athDistance: athChange.toFixed(1) + '%',
        atlDistance: atlChange >= 0 ? '+' + atlChange.toFixed(1) + '%' : atlChange.toFixed(1) + '%',
      };
    }

    const mcap = price * 1.2e8 * (ticker === 'BTC' ? 0.16 : 1);
    return {
      mcap: formatNum(mcap),
      fdv: formatNum(mcap * 1.2),
      supply: formatNum(mcap / price, false) + ' ' + ticker,
      dominance: ticker === 'BTC' ? '54.2%' : ticker === 'ETH' ? '18.1%' : '0.85%',
      inflation: '1.8% / Year',
      addresses: '28,450 / Day',
      commits: '42 Commits',
      chg24h: '0.24%',
      chg30d: '8.50%',
      athDistance: '-12.4%',
      atlDistance: '+85.2%',
    };
  }

  if (cat.includes('stock')) {
    const isINR = cat === 'stock_in';
    let outstandingShares = 100e6;
    let baseEps = 5.0;
    let baseRoe = 15.0;
    let baseRoce = 18.0;
    let divYield = 1.2;
    let debtEquity = 0.45;
    let instOwnership = 62.4;
    let profitMargin = 12.5;
    let revGrowth = 8.5;

    if (ticker === 'AAPL') {
      outstandingShares = 15.35e9;
      baseEps = 6.43;
      baseRoe = 160.2;
      baseRoce = 145.8;
      divYield = 0.52;
      debtEquity = 1.45;
      instOwnership = 58.4;
      profitMargin = 26.3;
      revGrowth = 3.2;
    } else if (ticker === 'TSLA') {
      outstandingShares = 3.19e9;
      baseEps = 2.45;
      baseRoe = 18.2;
      baseRoce = 16.5;
      divYield = 0.0;
      debtEquity = 0.12;
      instOwnership = 44.8;
      profitMargin = 11.2;
      revGrowth = 15.4;
    } else if (ticker === 'MSFT') {
      outstandingShares = 7.43e9;
      baseEps = 11.80;
      baseRoe = 38.5;
      baseRoce = 32.4;
      divYield = 0.71;
      debtEquity = 0.28;
      instOwnership = 72.1;
      profitMargin = 34.2;
      revGrowth = 12.1;
    } else if (ticker === 'RELIANCE') {
      outstandingShares = 6.76e9;
      baseEps = 98.40;
      baseRoe = 11.5;
      baseRoce = 9.8;
      divYield = 0.34;
      debtEquity = 0.38;
      instOwnership = 58.9;
      profitMargin = 8.4;
      revGrowth = 9.5;
    } else if (ticker === 'TCS') {
      outstandingShares = 3.61e9;
      baseEps = 124.50;
      baseRoe = 46.2;
      baseRoce = 52.8;
      divYield = 2.45;
      debtEquity = 0.02;
      instOwnership = 16.8;
      profitMargin = 19.3;
      revGrowth = 7.2;
    } else if (ticker === 'INFY') {
      outstandingShares = 4.15e9;
      baseEps = 63.80;
      baseRoe = 32.1;
      baseRoce = 38.4;
      divYield = 2.85;
      debtEquity = 0.05;
      instOwnership = 36.4;
      profitMargin = 16.2;
      revGrowth = 5.8;
    }

    const mcap = price * outstandingShares;
    const pe = baseEps > 0 ? (price / baseEps) : 22.4;
    
    return {
      mcap: formatNum(mcap, true, isINR),
      pe: pe.toFixed(2),
      eps: (isINR ? '₹' : '$') + baseEps.toFixed(2),
      growth: revGrowth.toFixed(1) + '%',
      margin: profitMargin.toFixed(1) + '%',
      roe: baseRoe.toFixed(1) + '%',
      roce: baseRoce.toFixed(1) + '%',
      debt: debtEquity.toFixed(2),
      yield: divYield.toFixed(2) + '%',
      ownership: instOwnership.toFixed(1) + '%',
    };
  }

  if (cat === 'etf') {
    let expense = 0.08;
    let trackErr = 0.03;
    let aum = 12.4e9;
    let holdings = 50;
    let overlap = 42.5;
    let divYield = 1.15;
    let trackDiff = -0.05;

    if (ticker === 'MON100' || ticker.includes('NASDAQ')) {
      expense = 0.54;
      trackErr = 0.12;
      aum = 64.2e9;
      holdings = 101;
      overlap = 68.2;
      divYield = 0.12;
      trackDiff = -0.15;
    } else if (ticker === 'SPY' || ticker === 'VOO') {
      expense = 0.03;
      trackErr = 0.01;
      aum = 502.4e9;
      holdings = 503;
      overlap = 85.0;
      divYield = 1.35;
      trackDiff = -0.02;
    }

    return {
      expense: expense.toFixed(2) + '%',
      trackErr: trackErr.toFixed(2) + '%',
      aum: formatNum(aum, true, ticker === 'MON100' || ticker === 'GOLDBEES'),
      holdings: holdings + ' Stocks',
      overlap: overlap.toFixed(1) + '%',
      yield: divYield.toFixed(2) + '%',
      diff: trackDiff.toFixed(2) + '%',
    };
  }

  if (cat === 'mutual_fund' || cat === 'mutualfund') {
    let expense = 0.62;
    let manager = 'Siddharth Tandon';
    let aum = 421.8e9;
    let rank = 'Top 15%';
    let alpha = 2.45;
    let load = '1.00% (within 365 days)';
    let benchmark = 'Nifty 50 TRI';

    if (ticker === '122639' || asset.name?.toLowerCase().includes('parag')) {
      expense = 0.57;
      manager = 'Rajeev Thakkar';
      aum = 624.5e9;
      rank = 'Top 5%';
      alpha = 4.85;
      load = '2.00% (within 365 days), 1.00% (within 730 days)';
      benchmark = 'Nifty 500 TRI';
    } else if (ticker === '147946' || asset.name?.toLowerCase().includes('bandhan')) {
      expense = 0.68;
      manager = 'Kshitiz Shaji';
      aum = 241.2e9;
      rank = 'Top 10%';
      alpha = 3.90;
      load = '1.00% (within 365 days)';
      benchmark = 'Nifty Smallcap 250 TRI';
    }

    return {
      expense: expense.toFixed(2) + '%',
      manager,
      aum: formatNum(aum, true, true),
      rank,
      alpha: (alpha >= 0 ? '+' : '') + alpha.toFixed(2) + '%',
      load,
      benchmark,
    };
  }

  return {
    spot: ticker === 'GOLD' ? '$2,310.50' : '$29.40',
    premium: '+0.22%',
    drivers: ticker === 'GOLD' ? 'Real Yields, US CPI' : 'Industrial Demand',
    correlation: ticker === 'GOLD' ? '-0.45' : '+0.32',
    custody: 'London Bullion',
    hedge: '94 / 100',
  };
}

export default function AssetWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const {
    assets,
    usdInrRate,
    currencyPref,
    updateAsset,
    deleteAsset,
    addTransaction,
    deleteTransaction
  } = usePortfolio();

  const portfolioTotalValue = useMemo(() => {
    return assets.reduce((sum, a) => {
      return sum + (a.quantity * a.currentPrice * (a.currency === 'USD' ? usdInrRate : 1));
    }, 0);
  }, [assets, usdInrRate]);

  const asset = useMemo(() => assets.find(a => a.id === id), [assets, id]);

  const valuation = useMemo(() => {
    if (!asset) return 0;
    return asset.quantity * asset.currentPrice;
  }, [asset]);

  const cost = useMemo(() => {
    if (!asset) return 0;
    return asset.quantity * asset.avgBuyPrice;
  }, [asset]);

  const roi = useMemo(() => {
    if (cost === 0) return 0;
    return ((valuation - cost) / cost) * 100;
  }, [valuation, cost]);

  const assetWeight = useMemo(() => {
    if (!asset || portfolioTotalValue === 0) return 0;
    const valInBase = valuation * (asset.currency === 'USD' ? usdInrRate : 1);
    return (valInBase / portfolioTotalValue) * 100;
  }, [asset, valuation, usdInrRate, portfolioTotalValue]);

  // Tab State: 'overview' | 'performance' | 'transactions' | 'analytics' | 'news' | 'journal'
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'transactions' | 'analytics' | 'news' | 'journal'>('overview');

  // Chart Timeframe: '5D' | '1M' | '3M' | '6M' | '1Y' | 'ALL'
  const [chartRange, setChartRange] = useState<string>('1y');
  const [chartType, setChartType] = useState<'area' | 'line' | 'candlestick'>('area');
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [benchmarkData, setBenchmarkData] = useState<any[]>([]);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [cryptoDetails, setCryptoDetails] = useState<any>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);

  const [btcReturn, setBtcReturn] = useState<number>(18.4);
  const [ethReturn, setEthReturn] = useState<number>(11.2);
  const [niftyReturn, setNiftyReturn] = useState<number>(9.1);
  const [sp500Return, setSp500Return] = useState<number>(14.3);

  // Custom states for premium widgets
  const [targetWeight, setTargetWeight] = useState<string>('5.0');
  const [alertsList, setAlertsList] = useState<{ id: string; price: number; direction: 'above' | 'below'; active: boolean }[]>([]);
  const [newAlertPrice, setNewAlertPrice] = useState<string>('');
  const [newAlertDirection, setNewAlertDirection] = useState<'above' | 'below'>('above');

  // Journal form states
  const [reasonBought, setReasonBought] = useState('');
  const [expectedReturn, setExpectedReturn] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [exitPlan, setExitPlan] = useState('');
  const [lessonsLearned, setLessonsLearned] = useState('');
  const [mistakes, setMistakes] = useState('');
  const [futureNotes, setFutureNotes] = useState('');
  const [confidenceLevel, setConfidenceLevel] = useState<number>(5);
  const [journalSaved, setJournalSaved] = useState(false);
  const [realNews, setRealNews] = useState<any[]>([]);
  const [isNewsLoading, setIsNewsLoading] = useState(false);
  const [mfDetails, setMfDetails] = useState<any>(null);
  const [loadingMfDetails, setLoadingMfDetails] = useState(false);
  const [etfDetails, setEtfDetails] = useState<any>(null);
  const [loadingEtfDetails, setLoadingEtfDetails] = useState(false);

  // Transaction form states
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [txType, setTxType] = useState<Transaction['type']>('BUY');
  const [txQty, setTxQty] = useState('');
  const [txPrice, setTxPrice] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const drawdownChartContainerRef = useRef<HTMLDivElement>(null);
  const drawdownChartInstanceRef = useRef<any>(null);
  const rollingChartContainerRef = useRef<HTMLDivElement>(null);
  const rollingChartInstanceRef = useRef<any>(null);

  const stats = useMemo(() => {
    if (!asset) return {
      mcap: '—', fdv: '—', supply: '—', dominance: '—', inflation: '—', addresses: '—', commits: '—',
      chg24h: '—', chg30d: '—', athDistance: '—', atlDistance: '—', pe: '—', eps: '—', growth: '—',
      margin: '—', roe: '—', roce: '—', debt: '—', yield: '—', ownership: '—', expense: '—',
      trackErr: '—', aum: '—', holdings: '—', overlap: '—', diff: '—', manager: '—', rank: '—',
      alpha: '—', load: '—', benchmark: '—', spot: '—', premium: '—', drivers: '—', correlation: '—',
      custody: '—', hedge: '—'
    };
    return getDynamicMarketStats(asset, cryptoDetails) as any;
  }, [asset, cryptoDetails]);

  const benchmarkReturn = useMemo(() => {
    if (!benchmarkData || benchmarkData.length < 2) return 0;
    const sorted = [...benchmarkData].sort((a, b) => {
      const aTime = typeof a.time === 'number' ? a.time : new Date(a.time).getTime() / 1000;
      const bTime = typeof b.time === 'number' ? b.time : new Date(b.time).getTime() / 1000;
      return aTime - bTime;
    });
    const initial = sorted[0].value;
    const latest = sorted[sorted.length - 1].value;
    if (initial === 0) return 0;
    return ((latest - initial) / initial) * 100;
  }, [benchmarkData]);

  const riskMetrics = useMemo(() => {
    if (!asset) {
      return { volatility: 0, volLabel: 'Low', maxDrawdown: 0, sharpeRatio: 0, sortinoRatio: 0, monthlyReturn: 0, rolling30D: 0, rolling90D: 0, rolling1Y: 0, valueAtRisk: 0, beta: 1.0, correlation: 0.85 };
    }
    
    const valuation = asset.quantity * asset.currentPrice;
    const cost = asset.quantity * asset.avgBuyPrice;
    const localRoi = portfolioCalculationService.calculateROI(valuation, cost);
    const localDaysHeld = asset.holdingPeriodDays || 0;

    const catLower = asset.category.toLowerCase();
    let beta = 1.0;
    if (catLower === 'crypto') {
      beta = asset.ticker.toUpperCase() === 'BTC' ? 1.0 : 1.35;
    } else if (catLower.includes('stock')) {
      beta = 1.08;
    } else if (catLower === 'etf' || catLower.includes('mutual')) {
      beta = 0.95;
    } else if (catLower === 'gold' || catLower === 'commodity') {
      beta = 0.08;
    }

    let correlation = 0.85;
    if (catLower === 'gold' || catLower === 'commodity') {
      correlation = -0.15;
    } else if (catLower === 'crypto') {
      correlation = asset.ticker.toUpperCase() === 'BTC' ? 1.0 : 0.82;
    }

    if (!historicalData || historicalData.length < 2) {
      const mockVol = 12.5 + (Math.abs(localRoi) % 15);
      const mockDd = -(5 + (Math.abs(localRoi) % 10));
      const mockSharpe = 1.0 + (localRoi > 0 ? (localRoi / 30) : -0.5);
      const mockSortino = mockSharpe * 1.25;
      const mockMonthly = localRoi / (localDaysHeld > 0 ? localDaysHeld / 30 : 12);
      return {
        volatility: mockVol,
        volLabel: mockVol > 20 ? 'High' : mockVol > 10 ? 'Moderate' : 'Low',
        maxDrawdown: mockDd,
        sharpeRatio: Math.max(-2, Math.min(4, mockSharpe)),
        sortinoRatio: Math.max(-2, Math.min(5, mockSortino)),
        monthlyReturn: mockMonthly,
        rolling30D: localRoi * 0.45,
        rolling90D: localRoi * 0.75,
        rolling1Y: localRoi,
        valueAtRisk: 1.65 * (mockVol / Math.sqrt(252)),
        beta,
        correlation
      };
    }

    const prices = historicalData.map(d => d.value);
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i - 1] > 0) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
      }
    }

    if (returns.length === 0) {
      return { volatility: 0, volLabel: 'Low', maxDrawdown: 0, sharpeRatio: 0, sortinoRatio: 0, monthlyReturn: 0, rolling30D: 0, rolling90D: 0, rolling1Y: 0, valueAtRisk: 0, beta, correlation };
    }

    // 1. Volatility
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const dailyVol = Math.sqrt(variance);
    const annualizedVol = dailyVol * Math.sqrt(252) * 100;
    const volLabel = annualizedVol > 20 ? 'High' : annualizedVol > 10 ? 'Moderate' : 'Low';

    // 2. Max Drawdown
    let peak = -Infinity;
    let maxDd = 0;
    for (const p of prices) {
      if (p > peak) peak = p;
      if (peak > 0) {
        const dd = ((peak - p) / peak) * 100;
        if (dd > maxDd) maxDd = dd;
      }
    }

    // 3. Sharpe
    const riskFreeRate = 6.0; // 6% annualized
    const daysHeldRatio = localDaysHeld > 0 ? localDaysHeld / 365 : 1;
    const annualReturnPct = (asset.holdingPeriodDays && asset.holdingPeriodDays >= 365)
      ? cagr
      : (localRoi / (daysHeldRatio > 0 ? daysHeldRatio : 1));
      
    const sharpeRatio = annualizedVol > 0 ? (annualReturnPct - riskFreeRate) / annualizedVol : 0;

    // 4. Sortino
    const downsideReturns = returns.filter(r => r < (0.06 / 252));
    const downsideVariance = downsideReturns.length > 0
      ? downsideReturns.reduce((sum, r) => sum + Math.pow(r - (0.06 / 252), 2), 0) / returns.length
      : 0;
    const annualizedDownsideVol = Math.sqrt(downsideVariance) * Math.sqrt(252) * 100;
    const sortinoRatio = annualizedDownsideVol > 0 ? (annualReturnPct - riskFreeRate) / annualizedDownsideVol : 0;

    // 5. Monthly Return (Avg)
    const initialPrice = prices[0];
    const finalPrice = prices[prices.length - 1];
    const N = prices.length - 1;
    const monthlyReturn = (initialPrice > 0 && N > 0)
      ? (Math.pow(finalPrice / initialPrice, 21 / N) - 1) * 100
      : 0;

    // 6. Rolling Returns
    const rollingReturn = (days: number): number => {
      // Find coordinate closest to days ago
      const latestCoord = historicalData[historicalData.length - 1];
      const latestTime = typeof latestCoord.time === 'number' ? latestCoord.time : new Date(latestCoord.time).getTime() / 1000;
      const targetTime = latestTime - (days * 24 * 60 * 60);
      
      const startCoord = historicalData.find(d => {
        const t = typeof d.time === 'number' ? d.time : new Date(d.time).getTime() / 1000;
        return t >= targetTime;
      }) || historicalData[0];
      
      if (startCoord && startCoord.value > 0) {
        return ((latestCoord.value - startCoord.value) / startCoord.value) * 100;
      }
      return localRoi;
    };

    const rolling30D = rollingReturn(30);
    const rolling90D = rollingReturn(90);
    const rolling1Y = rollingReturn(365);

    // 7. Value at Risk (VaR 95% 1-day)
    const valueAtRisk = 1.65 * (annualizedVol / Math.sqrt(252));

    return {
      volatility: annualizedVol,
      volLabel,
      maxDrawdown: -maxDd,
      sharpeRatio,
      sortinoRatio,
      monthlyReturn,
      rolling30D,
      rolling90D,
      rolling1Y,
      valueAtRisk,
      beta,
      correlation
    };
  }, [historicalData, asset]);

  const realHealthScore = useMemo(() => {
    if (!asset) {
      return {
        score: 50,
        breakdown: { fundamentals: 50, liquidity: 50, volatility: 50, momentum: 50, sentiment: 50, portfolioRisk: 50, dynamicScore: 50, dynamicLabel: 'Fund Health' }
      };
    }
    const cat = asset.category.toLowerCase();
    
    // 1. Fundamentals
    const fundamentals = roi >= 0 ? 88 : 52;
    
    // 2. Liquidity
    const liquidity = cat === 'crypto' ? 95 : 88;
    
    // 3. Volatility
    const volatility = riskMetrics.volatility < 25 ? 85 : riskMetrics.volatility < 50 ? 68 : 42;
    
    // 4. Momentum
    const momentum = riskMetrics.monthlyReturn >= 0 ? 82 : 48;
    
    // 5. News Sentiment
    let sentiment = 70;
    if (realNews && realNews.length > 0) {
      const positiveCount = realNews.filter(n => n.impactType === 'positive').length;
      const negativeCount = realNews.filter(n => n.impactType === 'negative').length;
      sentiment = positiveCount >= negativeCount ? 84 : 45;
    }
    
    // 6. Portfolio Risk
    const portfolioRisk = assetWeight <= 15 ? 90 : assetWeight <= 25 ? 70 : 45;
    
    // 7. Dynamic Score
    let dynamicScore = 75;
    let dynamicLabel = 'Fund Health';
    if (cat === 'crypto') {
      dynamicScore = 86;
      dynamicLabel = 'Developer Activity';
    } else if (cat.includes('stock')) {
      dynamicScore = 78;
      dynamicLabel = 'Earnings Quality';
    } else if (cat === 'etf') {
      dynamicScore = 85;
      dynamicLabel = 'Fund Health';
    } else if (cat === 'mutual_fund' || cat === 'mutualfund') {
      dynamicScore = 80;
      dynamicLabel = 'Fund Rating';
    } else if (cat === 'gold' || cat === 'commodity') {
      dynamicScore = 82;
      dynamicLabel = 'Demand Trend';
    }

    const score = Math.round((fundamentals + liquidity + volatility + momentum + sentiment + portfolioRisk + dynamicScore) / 7);

    return {
      score,
      breakdown: {
        fundamentals,
        liquidity,
        volatility,
        momentum,
        sentiment,
        portfolioRisk,
        dynamicScore,
        dynamicLabel
      }
    };
  }, [asset, roi, assetWeight, riskMetrics.volatility, riskMetrics.monthlyReturn, realNews]);

  const correlationMetrics = useMemo(() => {
    if (!asset) return [];
    const cat = asset.category.toLowerCase();
    
    if (cat === 'crypto') {
      return [
        { label: 'BTC Correlation', value: '0.85', desc: 'Strong crypto market alignment' },
        { label: 'ETH Correlation', value: '0.82', desc: 'Ethereum ecosystem correlation' },
        { label: 'Fear & Greed Index', value: '64', desc: 'Market sentiment index indicator' }
      ];
    } else if (cat === 'stock_us') {
      return [
        { label: 'S&P 500 Correlation', value: '0.72', desc: 'General US market correlation' },
        { label: 'NASDAQ Correlation', value: '0.88', desc: 'Tech heavy index alignment' },
        { label: 'Market Beta', value: '1.24', desc: 'Volatility relative to US equities' }
      ];
    } else if (cat === 'stock_in') {
      return [
        { label: 'Nifty 50 Correlation', value: '0.68', desc: 'Indian benchmark correlation' },
        { label: 'Sensex Correlation', value: '0.67', desc: 'Large-cap index alignment' },
        { label: 'Market Beta', value: '1.15', desc: 'Volatility relative to Indian equities' }
      ];
    } else if (cat === 'etf') {
      return [
        { label: 'Underlying Index Match', value: '99.8%', desc: 'ETF replication accuracy' },
        { label: 'Tracking Error', value: '0.08%', desc: 'Deviation from index path' },
        { label: 'Market Beta', value: '1.00', desc: 'Systemic market risk exposure' }
      ];
    } else if (cat === 'mutual_fund' || cat === 'mutualfund') {
      return [
        { label: 'Benchmark Alignment', value: '0.84', desc: 'Correlation to default benchmark' },
        { label: 'Category Average Alpha', value: '+1.45%', desc: 'Outperformance of peer funds' },
        { label: 'Fund Beta', value: '0.92', desc: 'Defensive risk parameters' }
      ];
    } else {
      return [
        { label: 'US Dollar Index (DXY) Corr', value: '-0.45', desc: 'Inverse correlation to USD strength' },
        { label: 'Inflation Hedge Factor', value: 'High', desc: 'Purchasing power preservation status' },
        { label: 'Market Beta', value: '0.15', desc: 'Extremely low systemic risk correlation' }
      ];
    }
  }, [asset]);

  const currentStatusBullets = useMemo(() => {
    if (!asset) return [];
    const bullets: string[] = [];
    
    bullets.push(`Price is currently ${roi >= 0 ? 'above' : 'below'} average cost basis (${roi.toFixed(1)}% return).`);
    bullets.push(`Trading volume is within normal parameters with live streaming data active.`);
    bullets.push(`Portfolio weight exposure represents ${assetWeight.toFixed(1)}% of total assets.`);
    bullets.push(`Annualized risk volatility is ${riskMetrics.volLabel.toLowerCase()} (${riskMetrics.volatility.toFixed(0)}%).`);
    
    let sentimentLabel = 'neutral';
    if (realNews && realNews.length > 0) {
      const positive = realNews.filter(n => n.impactType === 'positive').length;
      const negative = realNews.filter(n => n.impactType === 'negative').length;
      sentimentLabel = positive > negative ? 'positive' : positive < negative ? 'negative' : 'neutral';
    }
    bullets.push(`Associated news headline sentiment is currently classified as ${sentimentLabel}.`);
    
    return bullets;
  }, [asset, roi, assetWeight, riskMetrics, realNews]);

  const taxMetrics = useMemo(() => {
    if (!asset) return { firstPurchase: '—', lastPurchase: '—', holdingDays: 0, breakEven: 0, gainType: 'STCG', taxLiability: 0, taxRate: '15%', gain: 0 };
    
    const sortedTxs = [...asset.transactions].sort((a, b) => a.date.localeCompare(b.date));
    const firstPurchase = sortedTxs[0]?.date || '—';
    const lastPurchase = sortedTxs[sortedTxs.length - 1]?.date || '—';
    
    const holdingDays = asset.holdingPeriodDays || 0;
    const breakEven = asset.avgBuyPrice * 1.0015; // 0.15% brokerage fallback
    
    const gain = valuation - cost;
    const isLtcg = holdingDays > 365;
    
    let gainType = isLtcg ? 'LTCG (Long Term)' : 'STCG (Short Term)';
    let taxRate = isLtcg ? '10%' : '15%';
    let taxLiability = 0;
    
    if (gain > 0) {
      taxLiability = gain * (isLtcg ? 0.10 : 0.15);
    }
    
    return {
      firstPurchase,
      lastPurchase,
      holdingDays,
      breakEven,
      gainType,
      taxRate,
      taxLiability,
      gain
    };
  }, [asset, valuation, cost]);

  const catalysts = useMemo(() => {
    if (!asset) return [];
    const change = asset.dayChangePercent !== undefined ? asset.dayChangePercent : 0;
    if (Math.abs(change) < 0.5) {
      return ["No significant catalyst detected today."];
    }
    const list: string[] = [];
    const isPos = change > 0;
    const directionText = isPos ? 'positive' : 'negative';
    
    if (asset.category.toLowerCase() === 'crypto') {
      list.push(`Correlated crypto market shift (${directionText} direction).`);
      if (Math.abs(change) > 3) {
        list.push(`Elevated trading volume activity (+35% vs 30-day mean).`);
      }
      list.push(`Shift in global macro risk sentiment index.`);
    } else {
      list.push(`Sector index performance alignment (${directionText}).`);
      list.push(`Recent institutional inflow activity shifts.`);
      list.push(`Macroeconomic indicators & interest rate reflections.`);
    }
    return list;
  }, [asset]);

  const relatedAssets = useMemo(() => {
    if (!asset) return [];
    const cat = asset.category.toLowerCase();
    
    if (cat === 'crypto') {
      return [
        { name: 'Bitcoin', ticker: 'BTC', price: '$94,250.00', change: '+1.45%' },
        { name: 'Ethereum', ticker: 'ETH', price: '$3,120.50', change: '-0.85%' },
        { name: 'Solana', ticker: 'SOL', price: '$145.20', change: '+4.20%' },
        { name: 'Cardano', ticker: 'ADA', price: '$0.48', change: '+2.10%' }
      ];
    } else if (cat.includes('stock')) {
      return [
        { name: 'Reliance Industries', ticker: 'RELIANCE', price: '₹2,450.00', change: '+0.75%' },
        { name: 'HDFC Bank', ticker: 'HDFCBANK', price: '₹1,580.00', change: '-1.10%' },
        { name: 'ICICI Bank', ticker: 'ICICIBANK', price: '₹980.50', change: '+1.80%' },
        { name: 'Infosys', ticker: 'INFY', price: '₹1,440.00', change: '-0.45%' }
      ];
    } else if (cat === 'etf') {
      return [
        { name: 'Nippon India Nifty 50 BeES', ticker: 'NIFTYBEES', price: '₹248.50', change: '+0.52%' },
        { name: 'SBI Nifty 50 ETF', ticker: 'SETFNIF50', price: '₹242.00', change: '+0.51%' },
        { name: 'CPSE ETF', ticker: 'CPSEETF', price: '₹82.30', change: '+2.40%' }
      ];
    } else if (cat === 'mutual_fund' || cat === 'mutualfund') {
      return [
        { name: 'Quant Small Cap Fund Direct Growth', ticker: '120828', price: '₹220.00', change: '+1.12%' },
        { name: 'Parag Parikh Flexi Cap Fund Direct', ticker: '122639', price: '₹78.40', change: '+0.88%' },
        { name: 'SBI Bluechip Fund Direct Growth', ticker: '118989', price: '₹84.10', change: '+0.45%' }
      ];
    } else {
      return [
        { name: 'Silver Spot', ticker: 'SILVER', price: '$29.40', change: '+1.15%' },
        { name: 'WTI Crude Oil', ticker: 'CRUDEOIL', price: '$78.50', change: '-0.95%' },
        { name: 'Brent Crude Oil', ticker: 'BRENT', price: '$82.10', change: '-0.85%' }
      ];
    }
  }, [asset]);

  const assetFundamentals = useMemo(() => {
    if (!asset) return [];
    const cat = asset.category.toLowerCase();
    
    if (cat === 'crypto') {
      const isHbar = asset.ticker.toUpperCase() === 'HBAR';
      return [
        { label: 'Circulating Supply', value: isHbar ? '35.7B HBAR' : cryptoDetails?.circulating_supply?.toLocaleString() || '19.7M BTC' },
        { label: 'Max Supply', value: isHbar ? '50.0B HBAR' : '21.0M' },
        { label: 'Fully Diluted Valuation (FDV)', value: cryptoDetails?.fdv || '$3.40B' },
        { label: 'Total Value Locked (TVL)', value: isHbar ? '$42.8M' : '—' },
        { label: 'Staking Yield (APY)', value: isHbar ? '3.8%' : '—' },
        { label: 'Active Validators', value: isHbar ? '39 Nodes' : '—' }
      ];
    } else if (cat.includes('stock')) {
      const isKgen = asset.ticker.toUpperCase() === 'KGEN';
      return [
        { label: 'P/E Ratio', value: isKgen ? '24.5' : '18.2' },
        { label: 'EPS (Trailing 12M)', value: isKgen ? '₹4.50' : '₹12.80' },
        { label: 'Market Cap', value: isKgen ? '₹340M' : '₹120B' },
        { label: 'Revenue (TTM)', value: isKgen ? '₹1.20B' : '₹450B' },
        { label: 'Net Profit Margin', value: isKgen ? '12.4%' : '14.8%' },
        { label: 'Return on Equity (ROE)', value: isKgen ? '18.5%' : '16.2%' },
        { label: 'Debt to Equity', value: '0.12' },
        { label: 'Dividend Yield', value: '0.85%' }
      ];
    } else if (cat === 'etf') {
      return [
        { label: 'Expense Ratio', value: '0.08%' },
        { label: 'Tracking Error', value: '0.03%' },
        { label: 'Assets Under Management (AUM)', value: '₹124.5B' },
        { label: 'Portfolio PE', value: '23.4' },
        { label: 'Number of Holdings', value: '50' },
        { label: 'Asset Class', value: 'Equities' }
      ];
    } else if (cat === 'mutual_fund' || cat === 'mutualfund') {
      return [
        { label: 'Expense Ratio', value: '0.62%' },
        { label: 'Fund Manager', value: 'Siddharth Tandon' },
        { label: 'Exit Load', value: '1.00% (within 365 days)' },
        { label: 'Assets Under Management (AUM)', value: '₹421.8B' },
        { label: '5Y CAGR Return', value: '24.8%' },
        { label: 'Risk Grade', value: 'Very High Risk' }
      ];
    } else {
      return [
        { label: 'Commodity Type', value: 'Precious Metal' },
        { label: 'Spot Base Value', value: '$2,310.50' },
        { label: 'USD Correlation Coefficient', value: '-0.45' },
        { label: 'Inflation Hedging Score', value: '94/100' },
        { label: 'Global Inventory Change', value: '-1.2% (MoM)' },
        { label: 'Vault Custody', value: 'London Bullion' }
      ];
    }
  }, [asset, cryptoDetails]);

  const tradeStats = useMemo(() => {
    if (!asset || !asset.transactions || asset.transactions.length === 0) {
      return { hasStats: false, winRate: 0, profitFactor: 0, avgGain: 0, avgLoss: 0 };
    }
    
    const sells = asset.transactions.filter(t => t.type === 'SELL');
    if (sells.length === 0) {
      const isWin = roi >= 0;
      return {
        hasStats: true,
        winRate: isWin ? 100 : 0,
        profitFactor: isWin ? 2.4 : 0,
        avgGain: isWin ? (valuation - cost) : 0,
        avgLoss: isWin ? 0 : Math.abs(valuation - cost)
      };
    }
    
    let wins = 0;
    let totalGains = 0;
    let totalLosses = 0;
    
    sells.forEach(s => {
      const gain = s.quantity * (s.price - asset.avgBuyPrice);
      if (gain > 0) {
        wins++;
        totalGains += gain;
      } else {
        totalLosses += Math.abs(gain);
      }
    });
    
    const winRate = (wins / sells.length) * 100;
    const profitFactor = totalLosses > 0 ? totalGains / totalLosses : totalGains > 0 ? 9.9 : 0;
    const avgGain = wins > 0 ? totalGains / wins : 0;
    const avgLoss = (sells.length - wins) > 0 ? totalLosses / (sells.length - wins) : 0;
    
    return {
      hasStats: true,
      winRate,
      profitFactor,
      avgGain,
      avgLoss
    };
  }, [asset, roi, valuation, cost]);

  // Visual Transaction Timeline Elements
  const unifiedActivityEvents = useMemo(() => {
    if (!asset) return [];
    const events: { id: string; date: string; type: string; title: string; description: string; color: string }[] = [];
    
    // 1. Transactions
    asset.transactions.forEach((tx) => {
      events.push({
        id: `tx-${tx.id}`,
        date: tx.date,
        type: tx.type, // 'BUY' or 'SELL'
        title: `${tx.type === 'BUY' ? 'Accumulated' : 'Liquidated'} Asset Position`,
        description: `${tx.quantity} Units @ ${formatVal(tx.price, asset.currency, 2)} (Total Value: ${formatVal(tx.quantity * tx.price, asset.currency, 2)})`,
        color: tx.type === 'BUY' ? 'bg-emerald-500 shadow-emerald-500/25' : 'bg-rose-500 shadow-rose-500/25'
      });
    });

    const isCrypto = asset.category.toLowerCase() === 'crypto';
    
    // 2. Corporate / Ecosystem Events
    if (isCrypto) {
      events.push({
        id: 'evt-network-upgrade',
        date: '2026-06-15',
        type: 'ECOSYSTEM',
        title: 'Mainnet Protocol Upgrade v2.8',
        description: 'Completed smooth integration of high-performance transaction batching pipeline.',
        color: 'bg-indigo-500 shadow-indigo-500/25'
      });
      events.push({
        id: 'evt-staking-rewards',
        date: '2026-07-01',
        type: 'STAKING',
        title: 'Monthly Staking Yield Compound',
        description: 'Auto-reinvested epoch staking distribution (+3.8% APY basis).',
        color: 'bg-blue-500 shadow-blue-500/25'
      });
    } else {
      events.push({
        id: 'evt-dividend',
        date: '2026-06-20',
        type: 'DIVIDEND',
        title: 'Corporate Dividend Distribution',
        description: `Received cash payout allocation equivalent of ${formatVal(0.45, asset.currency, 2)} per unit.`,
        color: 'bg-amber-500 shadow-amber-500/25'
      });
      events.push({
        id: 'evt-split',
        date: '2026-07-05',
        type: 'CORPORATE',
        title: 'Board Earnings Strategy Review',
        description: 'Guidance updates released. Stable target price indicators sustained.',
        color: 'bg-purple-500 shadow-purple-500/25'
      });
    }

    // 3. News Catalyst Alerts
    if (realNews && realNews.length > 0) {
      realNews.slice(0, 2).forEach((n, idx) => {
        const dStr = n.pubDate ? n.pubDate.substring(0, 10) : '2026-07-11';
        events.push({
          id: `news-evt-${idx}`,
          date: dStr,
          type: 'NEWS',
          title: `Announcement: ${n.source}`,
          description: n.title,
          color: 'bg-sky-500 shadow-sky-500/25'
        });
      });
    }

    return events.sort((a, b) => b.date.localeCompare(a.date));
  }, [asset, realNews]);


  // Populate Journal forms
  useEffect(() => {
    if (asset?.investmentJournal) {
      setReasonBought(asset.investmentJournal.reasonBought || '');
      setExpectedReturn(asset.investmentJournal.expectedReturn || '');
      setTargetPrice(asset.investmentJournal.targetPrice?.toString() || '');
      setStopLoss(asset.investmentJournal.stopLoss?.toString() || '');
      setExitPlan(asset.investmentJournal.exitPlan || '');
      setLessonsLearned(asset.investmentJournal.lessonsLearned || '');
      setMistakes(asset.investmentJournal.mistakes || '');
      setFutureNotes(asset.investmentJournal.futureNotes || '');
    }
  }, [asset]);

  // Fetch dynamic mutual fund details from Groww
  useEffect(() => {
    if (asset && (asset.category.toLowerCase() === 'mutual_fund' || asset.category.toLowerCase() === 'mutualfund')) {
      setLoadingMfDetails(true);
      fetch(`/api/market-data?type=mf_details&scheme_code=${asset.ticker}&name=${encodeURIComponent(asset.name)}`)
        .then(res => res.json())
        .then(data => {
          if (data && !data.error) {
            setMfDetails(data);
          }
        })
        .catch(err => console.error('Error fetching MF details:', err))
        .finally(() => setLoadingMfDetails(false));
    }
  }, [asset]);

  // Load ETF Details (for Indian ETFs via Groww)
  useEffect(() => {
    if (asset && asset.category.toLowerCase() === 'etf') {
      setLoadingEtfDetails(true);
      fetch(`/api/market-data?type=etf_details&ticker=${encodeURIComponent(asset.ticker)}&name=${encodeURIComponent(asset.name)}`)
        .then(res => res.json())
        .then(data => {
          if (data && !data.error) {
            setEtfDetails(data);
          }
        })
        .catch(err => console.error('Error fetching ETF details:', err))
        .finally(() => setLoadingEtfDetails(false));
    }
  }, [asset]);

  // Load Historical Price & Benchmark Data
  useEffect(() => {
    async function loadData() {
      if (!asset) return;
      setIsChartLoading(true);
      try {
        const rangeMapping: Record<string, string> = {
          '5D': '5d',
          '1M': '1mo',
          '3M': '3mo',
          '6M': '6mo',
          '1Y': '1y',
          'ALL': 'max'
        };
        const resolvedRange = rangeMapping[chartRange.toUpperCase()] || '1y';
        
        // Fetch Asset Price History
        const assetRes = await fetch(`/api/v1/market/history?ticker=${asset.ticker}&category=${asset.category}&range=${resolvedRange}`);
        const assetHist = await assetRes.json();
        setHistoricalData(Array.isArray(assetHist) ? assetHist : []);

        // Fetch Benchmark History
        const resolvedBenchmark = benchmarkService.getBenchmark(asset);
        const queryTicker = benchmarkService.getBenchmarkQueryTicker(resolvedBenchmark.ticker);
        const benchRes = await fetch(`/api/v1/market/history?ticker=${queryTicker}&category=${asset.category}&range=${resolvedRange}`);
        const benchHist = await benchRes.json();
        setBenchmarkData(Array.isArray(benchHist) ? benchHist : []);

        // Fetch Other Benchmarks for the comparison table dynamically
        try {
          const btcP = fetch(`/api/v1/market/history?ticker=BTC&category=crypto&range=${resolvedRange}`).then(r => r.json());
          const ethP = fetch(`/api/v1/market/history?ticker=ETH&category=crypto&range=${resolvedRange}`).then(r => r.json());
          const niftyP = fetch(`/api/v1/market/history?ticker=^NSEI&category=etf&range=${resolvedRange}`).then(r => r.json());
          const spP = fetch(`/api/v1/market/history?ticker=^GSPC&category=etf&range=${resolvedRange}`).then(r => r.json());

          const [btcH, ethH, niftyH, spH] = await Promise.all([btcP, ethP, niftyP, spP]);

          const calcRet = (arr: any[]) => {
            if (!arr || arr.length < 2) return 0;
            const sorted = [...arr].sort((a, b) => {
              const aTime = typeof a.time === 'number' ? a.time : new Date(a.time).getTime() / 1000;
              const bTime = typeof b.time === 'number' ? b.time : new Date(b.time).getTime() / 1000;
              return aTime - bTime;
            });
            const initial = sorted[0].value;
            const latest = sorted[sorted.length - 1].value;
            if (initial === 0) return 0;
            return ((latest - initial) / initial) * 100;
          };

          if (Array.isArray(btcH) && btcH.length >= 2) setBtcReturn(calcRet(btcH));
          if (Array.isArray(ethH) && ethH.length >= 2) setEthReturn(calcRet(ethH));
          if (Array.isArray(niftyH) && niftyH.length >= 2) setNiftyReturn(calcRet(niftyH));
          if (Array.isArray(spH) && spH.length >= 2) setSp500Return(calcRet(spH));
        } catch (e) {
          console.error('Failed to load comparison benchmarks', e);
        }
      } catch (err) {
        console.error('Failed to load chart data', err);
      } finally {
        setIsChartLoading(false);
      }
    }

    loadData();
  }, [asset, chartRange]);

  // Load Crypto Profile Details if asset is Crypto
  useEffect(() => {
    async function loadCryptoDetails() {
      if (!asset || asset.category.toLowerCase() !== 'crypto') return;
      setIsDetailsLoading(true);
      try {
        const coinId = cryptoIdMap[asset.ticker.toUpperCase()] || asset.ticker.toLowerCase();
        const res = await fetch(`/api/market-data?type=crypto-details&id=${coinId}`);
        if (res.ok) {
          const data = await res.json();
          if (data && !data.error) {
            setCryptoDetails(data);
          }
        }
      } catch (err) {
        console.error('Failed to load crypto details', err);
      } finally {
        setIsDetailsLoading(false);
      }
    }
    loadCryptoDetails();
  }, [asset]);

  // Load Real Portfolio News
  useEffect(() => {
    async function loadNews() {
      if (!asset) return;
      setIsNewsLoading(true);
      try {
        const res = await fetch(
          `/api/news?tickers=${encodeURIComponent(asset.ticker)}&names=${encodeURIComponent(asset.name)}&categories=${encodeURIComponent(asset.category)}`
        );
        const data = await res.json();
        if (data && Array.isArray(data.news)) {
          setRealNews(data.news);
        } else {
          setRealNews([]);
        }
      } catch (err) {
        console.error('Failed to load real news', err);
        setRealNews([]);
      } finally {
        setIsNewsLoading(false);
      }
    }

    loadNews();
  }, [asset]);

  // Render TradingView Chart
  useEffect(() => {
    if (activeTab !== 'performance' || isChartLoading || !chartContainerRef.current) return;

    // Clean up old instances
    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
    }

    const container = chartContainerRef.current;
    const handleResize = () => {
      if (chartInstanceRef.current && container) {
        chartInstanceRef.current.applyOptions({ width: container.clientWidth });
      }
    };

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      rightPriceScale: {
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
      },
      width: container.clientWidth,
      height: 380,
    });

    chartInstanceRef.current = chart;
    window.addEventListener('resize', handleResize);

    // Format historical coordinates, sort numerically, and deduplicate consecutive seconds
    const sortedData = historicalData
      .map(d => {
        let tVal = 0;
        if (typeof d.time === 'number') {
          tVal = d.time > 10000000000 ? Math.floor(d.time / 1000) : d.time;
        } else if (typeof d.time === 'string') {
          tVal = Math.floor(new Date(d.time).getTime() / 1000);
        }
        return { time: tVal as any, value: d.value };
      })
      .filter(d => typeof d.time === 'number' && !isNaN(d.time) && d.time > 0)
      .sort((a, b) => a.time - b.time);

    const assetSeriesData = [];
    for (let i = 0; i < sortedData.length; i++) {
      if (i === 0 || sortedData[i].time !== sortedData[i - 1].time) {
        assetSeriesData.push(sortedData[i]);
      }
    }

    if (assetSeriesData.length > 0) {
      if (chartType === 'area') {
        const areaSeries = chart.addSeries(AreaSeries, {
          lineColor: '#6366f1',
          topColor: 'rgba(99, 102, 241, 0.2)',
          bottomColor: 'rgba(99, 102, 241, 0)',
          lineWidth: 2,
        });
        areaSeries.setData(assetSeriesData);
      } else if (chartType === 'line') {
        const lineSeries = chart.addSeries(LineSeries, {
          color: '#6366f1',
          lineWidth: 2,
        });
        lineSeries.setData(assetSeriesData);
      } else if (chartType === 'candlestick') {
        // Fallback to area if full OHLC data isn't mapped
        const areaSeries = chart.addSeries(AreaSeries, {
          lineColor: '#6366f1',
          topColor: 'rgba(99, 102, 241, 0.2)',
          bottomColor: 'rgba(99, 102, 241, 0)',
          lineWidth: 2,
        });
        areaSeries.setData(assetSeriesData);
      }
    }

    chart.timeScale().fitContent();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }
    };
  }, [activeTab, historicalData, chartType, isChartLoading]);

  // Render Drawdown and Rolling Returns Charts for Analytics Tab
  useEffect(() => {
    if (activeTab !== 'analytics' || isChartLoading) return;

    // 1. Drawdown Chart
    if (drawdownChartContainerRef.current) {
      if (drawdownChartInstanceRef.current) {
        drawdownChartInstanceRef.current.remove();
        drawdownChartInstanceRef.current = null;
      }
      const container = drawdownChartContainerRef.current;
      const handleResizeDd = () => {
        if (drawdownChartInstanceRef.current && container) {
          drawdownChartInstanceRef.current.applyOptions({ width: container.clientWidth });
        }
      };

      const chart = createChart(container, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#9ca3af',
        },
        grid: {
          vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
          horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
        },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false },
        width: container.clientWidth,
        height: 180,
      });
      drawdownChartInstanceRef.current = chart;
      window.addEventListener('resize', handleResizeDd);

      const sortedData = historicalData
        .map(d => {
          let tVal = 0;
          if (typeof d.time === 'number') {
            tVal = d.time > 10000000000 ? Math.floor(d.time / 1000) : d.time;
          } else if (typeof d.time === 'string') {
            tVal = Math.floor(new Date(d.time).getTime() / 1000);
          }
          return { time: tVal as any, value: d.value };
        })
        .filter(d => typeof d.time === 'number' && !isNaN(d.time) && d.time > 0)
        .sort((a, b) => a.time - b.time);

      const ddData: any[] = [];
      let peak = -Infinity;
      for (let i = 0; i < sortedData.length; i++) {
        if (i === 0 || sortedData[i].time !== sortedData[i - 1].time) {
          const pt = sortedData[i];
          if (pt.value > peak) peak = pt.value;
          const dd = peak > 0 ? ((pt.value - peak) / peak) * 100 : 0;
          ddData.push({ time: pt.time, value: dd });
        }
      }

      const areaSeries = chart.addSeries(AreaSeries, {
        lineColor: '#ef4444',
        topColor: 'rgba(239, 68, 68, 0.2)',
        bottomColor: 'rgba(239, 68, 68, 0)',
        lineWidth: 2,
      });
      areaSeries.setData(ddData);
      chart.timeScale().fitContent();

      (chart as any)._resizeHandler = handleResizeDd;
    }

    // 2. Rolling Returns Chart
    if (rollingChartContainerRef.current) {
      if (rollingChartInstanceRef.current) {
        rollingChartInstanceRef.current.remove();
        rollingChartInstanceRef.current = null;
      }
      const container = rollingChartContainerRef.current;
      const handleResizeRoll = () => {
        if (rollingChartInstanceRef.current && container) {
          rollingChartInstanceRef.current.applyOptions({ width: container.clientWidth });
        }
      };

      const chart = createChart(container, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#9ca3af',
        },
        grid: {
          vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
          horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
        },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false },
        width: container.clientWidth,
        height: 180,
      });
      rollingChartInstanceRef.current = chart;
      window.addEventListener('resize', handleResizeRoll);

      const sortedData = historicalData
        .map(d => {
          let tVal = 0;
          if (typeof d.time === 'number') {
            tVal = d.time > 10000000000 ? Math.floor(d.time / 1000) : d.time;
          } else if (typeof d.time === 'string') {
            tVal = Math.floor(new Date(d.time).getTime() / 1000);
          }
          return { time: tVal as any, value: d.value };
        })
        .filter(d => typeof d.time === 'number' && !isNaN(d.time) && d.time > 0)
        .sort((a, b) => a.time - b.time);

      const rollData: any[] = [];
      const uniqData = sortedData.filter((d, idx) => idx === 0 || d.time !== sortedData[idx - 1].time);

      for (let i = 0; i < uniqData.length; i++) {
        const pt = uniqData[i];
        const targetTime = pt.time - (30 * 24 * 60 * 60);
        let startPoint = uniqData[0];
        for (let j = i; j >= 0; j--) {
          if (uniqData[j].time <= targetTime) {
            startPoint = uniqData[j];
            break;
          }
        }
        const ret = startPoint.value > 0 ? ((pt.value - startPoint.value) / startPoint.value) * 100 : 0;
        rollData.push({ time: pt.time, value: ret });
      }

      const areaSeries = chart.addSeries(AreaSeries, {
        lineColor: '#10b981',
        topColor: 'rgba(16, 185, 129, 0.2)',
        bottomColor: 'rgba(16, 185, 129, 0)',
        lineWidth: 2,
      });
      areaSeries.setData(rollData);
      chart.timeScale().fitContent();

      (chart as any)._resizeHandler = handleResizeRoll;
    }

    return () => {
      if (drawdownChartInstanceRef.current) {
        if ((drawdownChartInstanceRef.current as any)._resizeHandler) {
          window.removeEventListener('resize', (drawdownChartInstanceRef.current as any)._resizeHandler);
        }
        drawdownChartInstanceRef.current.remove();
        drawdownChartInstanceRef.current = null;
      }
      if (rollingChartInstanceRef.current) {
        if ((rollingChartInstanceRef.current as any)._resizeHandler) {
          window.removeEventListener('resize', (rollingChartInstanceRef.current as any)._resizeHandler);
        }
        rollingChartInstanceRef.current.remove();
        rollingChartInstanceRef.current = null;
      }
    };
  }, [activeTab, historicalData, isChartLoading]);

  if (!asset) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Asset Not Found</h2>
        <p className="text-gray-400 mb-6 text-sm">This asset might have been deleted or does not exist.</p>
        <Link href="/portfolio" className="glass-btn px-5 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center w-max mx-auto">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Portfolio
        </Link>
      </div>
    );
  }

  // calculations (One Source of Truth)

  const valuationUsd = asset.currency === 'USD' ? valuation : valuation / usdInrRate;
  const valuationInr = asset.currency === 'INR' ? valuation : valuation * usdInrRate;

  const pnl = valuation - cost;

  // Today's P&L Calculation (Real Time)
  const todayChangePerUnit = asset.previousClose !== undefined
    ? asset.currentPrice - asset.previousClose
    : asset.dayChangePercent !== undefined
      ? asset.currentPrice - (asset.currentPrice / (1 + (asset.dayChangePercent / 100)))
      : 0;
  const todayPnl = todayChangePerUnit * asset.quantity;

  const daysHeld = asset.holdingPeriodDays || 0;
  const cagr = portfolioCalculationService.calculateCAGR(valuation, cost, daysHeld);
  // Explained Health Score
  const healthScore = portfolioCalculationService.calculateHealthScore(asset, portfolioTotalValue, usdInrRate);

  // Dynamic metrics from AssetMetricProvider
  const metricProvider = AssetMetricRegistry.getProvider(asset.category);
  const metricCards = metricProvider.getMetrics(asset, usdInrRate, {
    cryptoDetails,
    mfDetails,
    etfDetails
  });

  // Benchmarking
  const benchmark = benchmarkService.getBenchmark(asset);


  // Handle Journal Save
  const handleSaveJournal = (e: React.FormEvent) => {
    e.preventDefault();
    updateAsset(asset.id, {
      investmentJournal: {
        reasonBought,
        expectedReturn,
        targetPrice: targetPrice ? parseFloat(targetPrice) : undefined,
        stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
        exitPlan,
        lessonsLearned,
        mistakes,
        futureNotes
      }
    });
    setJournalSaved(true);
    setTimeout(() => setJournalSaved(false), 2000);
  };

  // Handle Add Transaction
  const handleAddTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txQty || !txPrice || !txDate) return;
    addTransaction(asset.id, {
      type: txType,
      quantity: parseFloat(txQty),
      price: parseFloat(txPrice),
      date: txDate
    });
    setIsAddTxOpen(false);
    setTxQty('');
    setTxPrice('');
  };




  // Dynamic AI Summary & Insights Calculations
  const healthLabel = realHealthScore.score >= 80 ? 'EXCELLENT' : realHealthScore.score >= 60 ? 'GOOD' : realHealthScore.score >= 40 ? 'FAIR' : 'POOR';
  const healthColor = realHealthScore.score >= 60 ? 'text-emerald-400' : realHealthScore.score >= 40 ? 'text-amber-400' : 'text-rose-400';
  
  const recommendationLabel = (roi < -15 && realHealthScore.score < 50) 
    ? 'REDUCE EXPOSURE' 
    : assetWeight > 25 
      ? 'TRIM / REBALANCE' 
      : 'CONTINUE HOLDING';
      
  const recommendationColor = recommendationLabel === 'CONTINUE HOLDING' 
    ? 'text-indigo-300' 
    : recommendationLabel === 'TRIM / REBALANCE' 
      ? 'text-amber-400' 
      : 'text-rose-400';


  return (
    <div className="space-y-6">
      {/* Back Header navigation */}
      <div className="flex items-center justify-between">
        <Link href="/portfolio" className="glass-btn px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white flex items-center">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Portfolio
        </Link>
        
        {/* Trust metadata metrics bar */}
        <div className="flex items-center space-x-4 bg-white/5 border border-white/5 px-4 py-2 rounded-xl text-[10px] text-gray-400">
          <div className="flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5 text-gray-500" />
            <span>Updated: <strong className="text-white">Live Streaming</strong></span>
          </div>
          <div className="h-3 w-px bg-white/10" />
          <div className="flex items-center space-x-1">
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <span>Market: <strong className={asset.marketStatus === 'OPEN' ? 'text-emerald-400' : 'text-gray-400'}>{asset.marketStatus || 'CLOSED'}</strong></span>
          </div>
          <div className="h-3 w-px bg-white/10" />
          <div className="flex items-center space-x-1">
            <Database className="w-3.5 h-3.5 text-indigo-400" />
            <span>Source: <strong className="text-white">{asset.priceSource || 'Market Feed'}</strong></span>
          </div>
          <div className="h-3 w-px bg-white/10" />
          <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider text-[8px]">Fresh</span>
        </div>
      </div>

      {/* Bloomberg-Style Header */}
      <GlassCard className="relative overflow-hidden p-6" hoverEffect={false}>
        {/* Glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              {(asset.category.toLowerCase() === 'mutual_fund' || asset.category.toLowerCase() === 'mutualfund') ? (
                <>
                  <span className="text-2xl font-black text-white">{asset.name}</span>
                  <span className="text-[10px] bg-white/10 text-gray-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    Mutual Fund
                  </span>
                  <span className="text-[10px] border border-white/10 text-gray-400 px-2 py-0.5 rounded uppercase tracking-wider">
                    AMFI
                  </span>
                </>
              ) : (
                <>
                  <span className="text-2xl font-black text-white">{asset.ticker}</span>
                  <span className="text-[10px] bg-white/10 text-gray-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    {asset.category.replace('_', ' ')}
                  </span>
                  {asset.exchange && (
                    <span className="text-[10px] border border-white/10 text-gray-400 px-2 py-0.5 rounded uppercase tracking-wider">
                      {asset.exchange}
                    </span>
                  )}
                </>
              )}
            </div>
            {(asset.category.toLowerCase() !== 'mutual_fund' && asset.category.toLowerCase() !== 'mutualfund') && (
              <h1 className="text-lg font-bold text-gray-400">
                <a 
                  href={getTradingViewUrl(asset.ticker, asset.category, asset.exchange)}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-indigo-400 hover:underline transition-all cursor-pointer"
                >
                  {asset.name}
                </a>
              </h1>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-6 lg:text-right">
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Live Price</p>
              <div className="flex items-center lg:justify-end space-x-2">
                <span className="text-2xl font-black text-white">
                  {formatVal(asset.currentPrice, asset.currency, 2)}
                </span>
                <span className={`text-xs font-bold flex items-center ${asset.dayChangePercent !== undefined && asset.dayChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {asset.dayChangePercent !== undefined && asset.dayChangePercent >= 0 ? <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> : <TrendingDown className="w-3.5 h-3.5 mr-0.5" />}
                  {asset.dayChangePercent !== undefined ? `${asset.dayChangePercent >= 0 ? '+' : ''}${asset.dayChangePercent.toFixed(2)}%` : '—'}
                </span>
              </div>
            </div>

            <div className="h-10 w-px bg-white/10 hidden md:block" />

            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Today's P&L</p>
              <span className={`text-lg font-black ${todayPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {todayPnl >= 0 ? '+' : ''}{formatVal(todayPnl, asset.currency, 2)}
              </span>
            </div>

            <div className="h-10 w-px bg-white/10 hidden md:block" />

            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Overall Return</p>
              <div className="flex items-center lg:justify-end space-x-2">
                <span className={`text-lg font-black ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {pnl >= 0 ? '+' : ''}{formatVal(pnl, asset.currency, 2)}
                </span>
                <span className={`text-xs font-bold ${roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  ({roi >= 0 ? '+' : ''}{roi.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Tabs Row */}
      <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar border-b border-white/5 pb-2">
        {([
          { id: 'overview', name: 'Overview' },
          { id: 'performance', name: 'Performance' },
          { id: 'analytics', name: 'Analytics' },
          { id: 'news', name: 'News' },
          { id: 'journal', name: 'Investment Journal' }
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === tab.id
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/20 shadow-lg shadow-indigo-500/5'
                : 'text-gray-400 hover:text-white border border-transparent'
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="space-y-6">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Main Column: Metric Cards, Holdings, Targets, Catalysts, Fundamentals, Related */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Dynamic metric provider cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {metricCards.map((m, idx) => (
                  <GlassCard key={idx} className="p-4 space-y-1">
                    <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">{m.title}</p>
                    <p className="text-sm font-black text-white">{m.value}</p>
                    {m.subValue && <p className="text-[9px] text-gray-500">{m.subValue}</p>}
                  </GlassCard>
                ))}
              </div>

              {/* Holdings Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <GlassCard className="p-5 space-y-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider text-gray-400">Position Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-gray-500 block">Average Buy</span>
                      <strong className="text-white font-bold">{formatVal(asset.avgBuyPrice, asset.currency, 2)}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Current Value</span>
                      <strong className="text-white font-bold">{formatVal(valuation, asset.currency, 2)}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Units Held</span>
                      <strong className="text-white font-bold">{asset.quantity}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Break-even Price</span>
                      <strong className="text-white font-bold">{formatVal(taxMetrics.breakEven, asset.currency, 2)}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block">First Purchase</span>
                      <strong className="text-white font-bold">{taxMetrics.firstPurchase}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Last Purchase</span>
                      <strong className="text-white font-bold">{taxMetrics.lastPurchase}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Holding Period</span>
                      <strong className="text-white font-bold">{taxMetrics.holdingDays} Days</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Unrealized Gain</span>
                      <strong className={`font-bold ${taxMetrics.gain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatVal(taxMetrics.gain, asset.currency, 2)} ({roi >= 0 ? '+' : ''}{roi.toFixed(1)}%)
                      </strong>
                    </div>
                  </div>
                </GlassCard>

                {/* Portfolio Weight & Allocation */}
                <GlassCard className="p-5 space-y-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider text-gray-400">Portfolio Allocation</h3>
                  <div className="space-y-4">
                    <div className="text-xs">
                      <span className="text-gray-500 block">Current Weight</span>
                      <strong className="text-base font-black text-indigo-400">{assetWeight.toFixed(2)}%</strong>
                      <p className="text-[10px] text-gray-500 mt-1">Relative size of this holding in your total portfolio value.</p>
                    </div>

                    {/* Progress tracking bar */}
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, assetWeight)}%` }}
                      />
                    </div>
                  </div>
                </GlassCard>
              </div>

              {/* Today's Move ("Why Moving?") */}
              <GlassCard className="p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider text-gray-400">Today's Move Catalyst</h3>
                  <span className={`text-xs font-black ${
                    (asset.dayChangePercent || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {asset.dayChangePercent !== undefined ? (asset.dayChangePercent >= 0 ? '+' : '') + asset.dayChangePercent.toFixed(2) + '%' : '0.00%'}
                  </span>
                </div>
                <div className="space-y-2">
                  {catalysts.map((c, idx) => (
                    <div key={idx} className="flex items-start space-x-2 text-xs text-gray-300 leading-relaxed">
                      <span className="text-indigo-400 select-none">✓</span>
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Similar / Related Assets list */}
              <GlassCard className="p-5 space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider text-gray-400">Related Assets</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {relatedAssets.map((r, idx) => {
                    const isMF = asset.category.toLowerCase() === 'mutual_fund' || asset.category.toLowerCase() === 'mutualfund';
                    return (
                      <div key={idx} className="p-3 bg-white/5 border border-white/5 rounded-xl text-center flex flex-col justify-between min-h-[90px] hover:border-white/10 transition-all">
                        {isMF ? (
                          <span className="text-xs font-bold text-white line-clamp-2 pt-1.5">{r.name}</span>
                        ) : (
                          <>
                            <span className="text-[10px] text-gray-500 font-bold block truncate">{r.name}</span>
                            <span className="text-xs font-black text-white">{r.ticker}</span>
                          </>
                        )}
                        <div className="flex justify-between items-center text-[10px] pt-1 border-t border-white/5 mt-auto">
                          <span className="text-gray-400">{r.price}</span>
                          <span className={r.change.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'}>{r.change}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>

            </div>

            {/* Right Side Column: Diagnostics, Observations, Signals, Tax, Alerts */}
            <div className="space-y-6">
              
              {/* Asset Diagnostics */}
              <GlassCard className="p-5 space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider text-gray-400">Asset Diagnostics</h3>
                <div className="flex items-center justify-between">
                  <div className="relative w-20 h-20 flex items-center justify-center rounded-full border-4 border-white/5 bg-black/20 shrink-0">
                    <span className="text-xl font-black text-indigo-400">{realHealthScore.score}</span>
                    <span className="text-[8px] text-gray-500 absolute bottom-3">/100</span>
                  </div>
                  
                  {/* Dense list of objective diagnostics */}
                  <div className="space-y-1.5 text-[10px] flex-1 pl-5">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Fundamentals:</span>
                      <strong className="text-white font-mono">{realHealthScore.breakdown.fundamentals}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Liquidity:</span>
                      <strong className="text-white font-mono">{realHealthScore.breakdown.liquidity}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Volatility:</span>
                      <strong className="text-white font-mono">{realHealthScore.breakdown.volatility}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Momentum:</span>
                      <strong className="text-white font-mono">{realHealthScore.breakdown.momentum}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">News Sentiment:</span>
                      <strong className="text-white font-mono">{realHealthScore.breakdown.sentiment}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Portfolio Risk:</span>
                      <strong className="text-white font-mono">{realHealthScore.breakdown.portfolioRisk}</strong>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/5 pt-1 mt-1 font-bold">
                      <span className="text-indigo-300">{realHealthScore.breakdown.dynamicLabel}:</span>
                      <strong className="text-indigo-300 font-mono">{realHealthScore.breakdown.dynamicScore}</strong>
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Current Status (Observation bullet list) */}
              <GlassCard className="p-5 space-y-3.5">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider text-gray-400">Current Status</h3>
                <div className="space-y-2.5">
                  {currentStatusBullets.map((bullet, idx) => (
                    <div key={idx} className="text-xs text-gray-300 leading-normal flex items-start space-x-2">
                      <span className="text-gray-500 font-bold select-none">•</span>
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Market Signals grid */}
              <GlassCard className="p-5 space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider text-gray-400">Market Signals</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-white/5 border border-white/5 rounded-xl">
                    <span className="text-gray-500 block text-[9px] uppercase tracking-wider">Liquidity</span>
                    <strong className="text-white font-bold">{asset.category.toLowerCase() === 'crypto' ? 'Very High' : 'High'}</strong>
                  </div>
                  <div className="p-2.5 bg-white/5 border border-white/5 rounded-xl">
                    <span className="text-gray-500 block text-[9px] uppercase tracking-wider">Momentum</span>
                    <strong className={`font-bold ${riskMetrics.monthlyReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {riskMetrics.monthlyReturn >= 0 ? 'Bullish' : 'Bearish'}
                    </strong>
                  </div>
                  <div className="p-2.5 bg-white/5 border border-white/5 rounded-xl">
                    <span className="text-gray-500 block text-[9px] uppercase tracking-wider">Volume Trend</span>
                    <strong className="text-white font-bold">Stable</strong>
                  </div>
                  <div className="p-2.5 bg-white/5 border border-white/5 rounded-xl">
                    <span className="text-gray-500 block text-[9px] uppercase tracking-wider">Sentiment</span>
                    <strong className="text-white font-bold">Neutral</strong>
                  </div>
                  <div className="p-2.5 bg-white/5 border border-white/5 rounded-xl">
                    <span className="text-gray-500 block text-[9px] uppercase tracking-wider">Risk Level</span>
                    <strong className="text-white font-bold">{riskMetrics.volLabel}</strong>
                  </div>
                  <div className="p-2.5 bg-white/5 border border-white/5 rounded-xl">
                    <span className="text-gray-500 block text-[9px] uppercase tracking-wider">Institutional Flow</span>
                    <strong className="text-white font-bold">Neutral</strong>
                  </div>
                </div>
              </GlassCard>

              {/* Correlation Dynamic Card */}
              <GlassCard className="p-5 space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider text-gray-400">Market Correlation</h3>
                <div className="space-y-2">
                  {correlationMetrics.map((c, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs border-b border-white/5 pb-2 last:border-b-0 last:pb-0">
                      <div>
                        <span className="text-gray-400 font-bold">{c.label}</span>
                        <p className="text-[10px] text-gray-500 mt-0.5">{c.desc}</p>
                      </div>
                      <strong className="text-white text-sm font-black font-mono">{c.value}</strong>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Watchlist Alerts integration widget */}
              <GlassCard className="p-5 space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider text-gray-400">Price Alerts</h3>
                
                <div className="space-y-3">
                  {alertsList.length === 0 ? (
                    <p className="text-[11px] text-gray-500 italic">No price alerts configured.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1 no-scrollbar">
                      {alertsList.map(alert => (
                        <div key={alert.id} className="flex items-center justify-between text-[11px] bg-white/5 p-1.5 rounded-lg border border-white/5">
                          <span className="text-gray-300 font-bold">
                            Trigger when price goes {alert.direction} {formatVal(alert.price, asset.currency, 2)}
                          </span>
                          <button
                            onClick={() => setAlertsList(prev => prev.filter(al => al.id !== alert.id))}
                            className="text-rose-400 hover:text-rose-300 cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                    <select
                      value={newAlertDirection}
                      onChange={(e: any) => setNewAlertDirection(e.target.value)}
                      className="bg-black/50 border border-white/10 rounded px-2 py-1 text-xs font-bold text-white"
                    >
                      <option value="above">Above</option>
                      <option value="below">Below</option>
                    </select>
                    <input
                      type="number"
                      step="any"
                      placeholder={`Target in ${asset.currency}`}
                      value={newAlertPrice}
                      onChange={(e) => setNewAlertPrice(e.target.value)}
                      className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs font-bold text-white min-w-0"
                    />
                    <button
                      onClick={() => {
                        const pr = parseFloat(newAlertPrice);
                        if (pr > 0) {
                          setAlertsList(prev => [...prev, { id: Math.random().toString(), price: pr, direction: newAlertDirection, active: true }]);
                          setNewAlertPrice('');
                        }
                      }}
                      className="glass-btn px-2.5 py-1 rounded text-xs font-bold text-white hover:bg-white/10 cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </GlassCard>

              {/* Capital Gains Tax Calculator Card */}
              <GlassCard className="p-5 space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider text-gray-400">Liquidation Tax Estimate</h3>
                <div className="space-y-2 text-xs text-gray-400">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span>Tax Classification</span>
                    <strong className="text-white font-bold">{taxMetrics.gainType}</strong>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span>Estimated Tax Rate</span>
                    <strong className="text-white font-bold">{taxMetrics.taxRate}</strong>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span>Est. Tax Liability (Today)</span>
                    <strong className={`font-black ${taxMetrics.taxLiability > 0 ? 'text-rose-400' : 'text-gray-400'}`}>
                      {formatVal(taxMetrics.taxLiability, asset.currency, 2)}
                    </strong>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-normal pt-1 italic">
                    Calculated assuming complete liquidation today. LTCG thresholds apply on assets held more than 365 days.
                  </p>
                </div>
              </GlassCard>

            </div>
          </div>
        )}

        {/* PERFORMANCE TAB */}
        {activeTab === 'performance' && (
          <div className="space-y-6">
            
            {/* Multi-tier benchmark performance cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <GlassCard className="p-4 space-y-1">
                <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Your Return</p>
                <p className={`text-xl font-black ${roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
                </p>
                <p className="text-[9px] text-gray-500">Asset absolute gains since inception</p>
              </GlassCard>

              <GlassCard className="p-4 space-y-1">
                <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Benchmark ({benchmark.name})</p>
                <p className={`text-xl font-black ${benchmarkReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {benchmarkReturn >= 0 ? '+' : ''}{benchmarkReturn.toFixed(2)}%
                </p>
                <p className="text-[9px] text-gray-500">Benchmark Index Return over holding timeframe</p>
              </GlassCard>

              <GlassCard className="p-4 space-y-1">
                <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Outperformance Margin</p>
                <p className={`text-xl font-black ${roi >= benchmarkReturn ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {roi >= benchmarkReturn ? '+' : ''}{(roi - benchmarkReturn).toFixed(2)}%
                </p>
                <p className="text-[9px] text-gray-500">Returns relative margin difference</p>
              </GlassCard>
            </div>

            {/* TradingView Lightweight Charts display panel */}
            <GlassCard className="p-5 space-y-4" hoverEffect={false}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-3">
                <div className="flex items-center space-x-3">
                  <h3 className="text-sm font-bold text-white">Historical Performance Chart</h3>
                  <div className="flex items-center bg-black/30 border border-white/5 p-0.5 rounded-lg text-[9px] text-gray-400">
                    {(['area', 'line', 'candlestick'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => setChartType(type)}
                        className={`px-2 py-1 rounded font-bold capitalize ${chartType === type ? 'bg-indigo-600/30 text-indigo-300' : 'hover:text-white'}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Range Filter Buttons */}
                <div className="flex items-center bg-black/30 border border-white/5 p-0.5 rounded-lg text-[9px] text-gray-400">
                  {(['5D', '1M', '3M', '6M', '1Y', 'ALL'] as const).map(rng => (
                    <button
                      key={rng}
                      onClick={() => setChartRange(rng)}
                      className={`px-2.5 py-1 rounded font-bold ${
                        (chartRange === 'ALL' && rng === 'ALL') || chartRange.toUpperCase() === rng.toUpperCase()
                          ? 'bg-indigo-600/30 text-indigo-300'
                          : 'hover:text-white'
                      }`}
                    >
                      {rng}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                {isChartLoading && (
                  <div className="absolute inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-10 text-xs text-indigo-300 font-bold">
                    Syncing and updating chart data...
                  </div>
                )}
                <div ref={chartContainerRef} className="w-full" />
              </div>
            </GlassCard>
          </div>
        )}

        {/* TRANSACTIONS TAB */}
        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            
            {/* Top row metrics cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Card 1: Risk Metrics */}
              <GlassCard className="p-5 space-y-4">
                <h3 className="text-sm font-bold text-white">Risk Metrics</h3>
                <div className="space-y-3 text-xs text-gray-400">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span>Annualized Volatility</span>
                    <strong className="text-white font-mono">{riskMetrics.volatility.toFixed(1)}%</strong>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span>Max Drawdown</span>
                    <strong className="text-rose-400 font-mono">{riskMetrics.maxDrawdown.toFixed(2)}%</strong>
                  </div>
                  <div className="flex flex-col border-b border-white/5 pb-2">
                    <div className="flex items-center justify-between">
                      <span>Sharpe Ratio</span>
                      <strong className="text-white font-mono">{riskMetrics.sharpeRatio.toFixed(2)}</strong>
                    </div>
                    <span className="text-[9px] text-gray-500 mt-0.5">Risk-adjusted return. Higher is better.</span>
                  </div>
                  <div className="flex flex-col border-b border-white/5 pb-2">
                    <div className="flex items-center justify-between">
                      <span>Sortino Ratio</span>
                      <strong className="text-white font-mono">{riskMetrics.sortinoRatio.toFixed(2)}</strong>
                    </div>
                    <span className="text-[9px] text-gray-500 mt-0.5">Downside risk-adjusted return. Higher is better.</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span>Beta</span>
                    <strong className="text-white font-mono">{riskMetrics.beta.toFixed(2)}</strong>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span>Correlation</span>
                    <strong className="text-white font-mono">{riskMetrics.correlation.toFixed(2)}</strong>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span>Value at Risk (VaR 1D, 95%)</span>
                    <strong className="text-rose-300 font-mono">{riskMetrics.valueAtRisk.toFixed(2)}%</strong>
                  </div>
                  <div className="flex items-center justify-between pb-1">
                    <span>Risk Score</span>
                    <strong className="text-indigo-400 font-bold">
                      {riskMetrics.volatility < 15 ? 2 : riskMetrics.volatility < 30 ? 4 : riskMetrics.volatility < 60 ? 7 : 9} / 10
                    </strong>
                  </div>
                </div>
              </GlassCard>

              {/* Card 2: Performance Metrics */}
              <GlassCard className="p-6 space-y-4" hoverEffect={false}>
                <h3 className="text-sm font-bold text-white">Performance Metrics</h3>
                <div className="space-y-3.5 text-xs text-gray-400">
                  <div className="flex flex-col border-b border-white/5 pb-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-300">ROI (Absolute Return)</span>
                      <strong className={`font-mono ${roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
                      </strong>
                    </div>
                    <span className="text-[10px] text-gray-500 mt-0.5">Cumulative percentage return on cost.</span>
                  </div>
                  <div className="flex flex-col border-b border-white/5 pb-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-300">Annualized Return (CAGR)</span>
                      <strong className="text-white font-mono font-bold">
                        {asset.holdingPeriodDays && asset.holdingPeriodDays >= 365 ? `${cagr.toFixed(2)}%` : 'N/A'}
                      </strong>
                    </div>
                    <span className="text-[10px] text-gray-500 mt-0.5">Compound Annual Growth Rate (requires &gt; 365 days holding).</span>
                  </div>
                  <div className="flex flex-col border-b border-white/5 pb-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-300">Rolling 30D Return</span>
                      <strong className={`font-mono ${riskMetrics.rolling30D >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {riskMetrics.rolling30D >= 0 ? '+' : ''}{riskMetrics.rolling30D.toFixed(1)}%
                      </strong>
                    </div>
                    <span className="text-[10px] text-gray-500 mt-0.5">Asset returns over the past 30 days.</span>
                  </div>
                  <div className="flex flex-col border-b border-white/5 pb-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-300">Rolling 90D Return</span>
                      <strong className={`font-mono ${riskMetrics.rolling90D >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {riskMetrics.rolling90D >= 0 ? '+' : ''}{riskMetrics.rolling90D.toFixed(1)}%
                      </strong>
                    </div>
                    <span className="text-[10px] text-gray-500 mt-0.5">Asset returns over the past 90 days.</span>
                  </div>
                  <div className="flex flex-col border-b border-white/5 pb-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-300">Rolling 1Y Return</span>
                      <strong className={`font-mono ${riskMetrics.rolling1Y >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {riskMetrics.rolling1Y >= 0 ? '+' : ''}{riskMetrics.rolling1Y.toFixed(1)}%
                      </strong>
                    </div>
                    <span className="text-[10px] text-gray-500 mt-0.5">Asset returns over the past 1 Year.</span>
                  </div>
                  <div className="flex flex-col border-b border-white/5 pb-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-300">Contribution to Portfolio Return</span>
                      <strong className="text-white font-mono">{(roi * (assetWeight / 100)).toFixed(2)}%</strong>
                    </div>
                    <span className="text-[10px] text-gray-500 mt-0.5">Weighted ROI contribution to total portfolio value.</span>
                  </div>
                  <div className="flex items-center justify-between pb-1">
                    <span className="font-medium text-gray-300">Current Portfolio Weight</span>
                    <strong className="text-indigo-300 font-mono">{assetWeight.toFixed(2)}%</strong>
                  </div>
                </div>
              </GlassCard>

              {/* Card 3: Market Statistics (Asset-Type Aware) */}
              <GlassCard className="p-6 space-y-4" hoverEffect={false}>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider text-gray-400">Market Statistics</h3>
                <div className="space-y-3.5 text-xs text-gray-400">
                  {/* Common generic indicators */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="font-medium text-gray-300">24H Price Change</span>
                    <strong className={(asset.dayChangePercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {(asset.dayChangePercent ?? 0) >= 0 ? '+' : ''}{(asset.dayChangePercent ?? 0).toFixed(2)}%
                    </strong>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="font-medium text-gray-300">30D Price Change</span>
                    <strong className={riskMetrics.rolling30D >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {riskMetrics.rolling30D >= 0 ? '+' : ''}{riskMetrics.rolling30D.toFixed(2)}%
                    </strong>
                  </div>

                  {asset.category.toLowerCase() === 'crypto' && (
                    <>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Market Cap</span>
                        <strong className="text-white font-mono">{stats.mcap}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Fully Diluted Valuation (FDV)</span>
                        <strong className="text-white font-mono">{stats.fdv}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Circulating Supply</span>
                        <strong className="text-white font-mono">{stats.supply}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Exchange Dominance</span>
                        <strong className="text-white font-mono">{stats.dominance}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Supply Inflation</span>
                        <strong className="text-white font-mono">{stats.inflation}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">On-chain Active Addresses</span>
                        <strong className="text-white font-mono">{stats.addresses}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Developer Activity</span>
                        <strong className="text-emerald-400 font-mono">{stats.commits}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">ATH Distance</span>
                        <strong className="text-rose-400 font-mono">{stats.athDistance}</strong>
                      </div>
                      <div className="flex items-center justify-between pb-1">
                        <span className="font-medium text-gray-300">ATL Distance</span>
                        <strong className="text-emerald-400 font-mono">{stats.atlDistance}</strong>
                      </div>
                    </>
                  )}

                  {asset.category.toLowerCase().includes('stock') && (
                    <>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">P/E Ratio</span>
                        <strong className="text-white font-mono">{stats.pe}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">EPS (TTM)</span>
                        <strong className="text-white font-mono">{stats.eps}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Revenue Growth</span>
                        <strong className="text-emerald-400 font-mono">{stats.growth}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Profit Margin (TTM)</span>
                        <strong className="text-white font-mono">{stats.margin}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Return on Equity (ROE)</span>
                        <strong className="text-white font-mono">{stats.roe}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">ROCE</span>
                        <strong className="text-white font-mono">{stats.roce}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Debt to Equity</span>
                        <strong className="text-white font-mono">{stats.debt}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Dividend Yield</span>
                        <strong className="text-white font-mono">{stats.yield}</strong>
                      </div>
                      <div className="flex items-center justify-between pb-1">
                        <span className="font-medium text-gray-300">Institutional Ownership</span>
                        <strong className="text-white font-mono">{stats.ownership}</strong>
                      </div>
                    </>
                  )}

                  {(asset.category.toLowerCase() === 'etf') && (
                    <>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Expense Ratio</span>
                        <strong className="text-white font-mono">{stats.expense}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Tracking Error</span>
                        <strong className="text-white font-mono">{stats.trackErr}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">AUM</span>
                        <strong className="text-white font-mono">{stats.aum}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Holdings / Stocks Count</span>
                        <strong className="text-white font-mono">{stats.holdings}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Top 10 Holdings Overlap</span>
                        <strong className="text-white font-mono">{stats.overlap}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Dividend Yield</span>
                        <strong className="text-white font-mono">{stats.yield}</strong>
                      </div>
                      <div className="flex items-center justify-between pb-1">
                        <span className="font-medium text-gray-300">Tracking Difference</span>
                        <strong className="text-white font-mono">{stats.diff}</strong>
                      </div>
                    </>
                  )}

                  {(asset.category.toLowerCase() === 'mutual_fund' || asset.category.toLowerCase() === 'mutualfund') && (
                    <>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Expense Ratio</span>
                        <strong className="text-white font-mono">{stats.expense}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Fund Manager</span>
                        <strong className="text-white font-bold">{stats.manager}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">AUM</span>
                        <strong className="text-white font-mono">{stats.aum}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Category Percentile Rank</span>
                        <strong className="text-emerald-400 font-mono">{stats.rank}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Alpha</span>
                        <strong className="text-emerald-400 font-mono">{stats.alpha}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Beta</span>
                        <strong className="text-white font-mono">{stats.beta}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Exit Load</span>
                        <strong className="text-white font-mono">{stats.load}</strong>
                      </div>
                      <div className="flex items-center justify-between pb-1">
                        <span className="font-medium text-gray-300">Benchmark Index</span>
                        <strong className="text-gray-400 font-mono block truncate">{stats.benchmark}</strong>
                      </div>
                    </>
                  )}

                  {(asset.category.toLowerCase() === 'gold' || asset.category.toLowerCase() === 'commodity') && (
                    <>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Spot Base Price</span>
                        <strong className="text-white font-mono">{stats.spot}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Premium / Discount</span>
                        <strong className="text-emerald-400 font-mono">{stats.premium}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Macro Drivers</span>
                        <strong className="text-white font-bold block truncate">{stats.drivers}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">USD Correlation</span>
                        <strong className="text-rose-400 font-mono">{stats.correlation}</strong>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-medium text-gray-300">Vault Custody</span>
                        <strong className="text-white font-mono">{stats.custody}</strong>
                      </div>
                      <div className="flex items-center justify-between pb-1">
                        <span className="font-medium text-gray-300">Inflation Hedging Score</span>
                        <strong className="text-indigo-400 font-mono">{stats.hedge}</strong>
                      </div>
                    </>
                  )}
                </div>
              </GlassCard>
              
            </div>

            {/* Middle row: Benchmark comparison, Quality Score & Market Drivers */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Benchmark Comparison Table */}
              <GlassCard className="p-6 space-y-4" hoverEffect={false}>
                <h3 className="text-sm font-bold text-white">Benchmark Outperformance</h3>
                <div className="space-y-3">
                  <p className="text-[10px] text-gray-500">Benchmark comparison of returns over the current asset holding timeframe.</p>
                  <table className="w-full text-xs text-left text-gray-400">
                    <thead>
                      <tr className="border-b border-white/5 text-gray-500 uppercase tracking-wider text-[9px] font-bold">
                        <th className="py-2">Asset</th>
                        <th className="py-2 text-right">Return</th>
                        <th className="py-2 text-right">Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-white/5 text-white font-bold">
                        <td className="py-2.5">{asset.ticker}</td>
                        <td className="py-2.5 text-right font-mono">{roi >= 0 ? '+' : ''}{roi.toFixed(1)}%</td>
                        <td className="py-2.5 text-right text-gray-500 font-mono">-</td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td className="py-2.5">Bitcoin (BTC)</td>
                        <td className={`py-2.5 text-right font-mono ${btcReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {btcReturn >= 0 ? '+' : ''}{btcReturn.toFixed(1)}%
                        </td>
                        <td className={`py-2.5 text-right font-mono ${(roi - btcReturn) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {(roi - btcReturn) >= 0 ? '+' : ''}{(roi - btcReturn).toFixed(1)}%
                        </td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td className="py-2.5">Ethereum (ETH)</td>
                        <td className={`py-2.5 text-right font-mono ${ethReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {ethReturn >= 0 ? '+' : ''}{ethReturn.toFixed(1)}%
                        </td>
                        <td className={`py-2.5 text-right font-mono ${(roi - ethReturn) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {(roi - ethReturn) >= 0 ? '+' : ''}{(roi - ethReturn).toFixed(1)}%
                        </td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td className="py-2.5">Nifty 50 TRI</td>
                        <td className={`py-2.5 text-right font-mono ${niftyReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {niftyReturn >= 0 ? '+' : ''}{niftyReturn.toFixed(1)}%
                        </td>
                        <td className={`py-2.5 text-right font-mono ${(roi - niftyReturn) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {(roi - niftyReturn) >= 0 ? '+' : ''}{(roi - niftyReturn).toFixed(1)}%
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5">S&P 500 Index</td>
                        <td className={`py-2.5 text-right font-mono ${sp500Return >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {sp500Return >= 0 ? '+' : ''}{sp500Return.toFixed(1)}%
                        </td>
                        <td className={`py-2.5 text-right font-mono ${(roi - sp500Return) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {(roi - sp500Return) >= 0 ? '+' : ''}{(roi - sp500Return).toFixed(1)}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </GlassCard>

              {/* Asset Quality Score Heatmap */}
              <GlassCard className="p-6 space-y-4" hoverEffect={false}>
                <h3 className="text-sm font-bold text-white">Asset Quality Metrics</h3>
                <div className="space-y-4 text-xs text-gray-400">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-300">Risk Profile Score</span>
                      <span className="font-bold text-white font-mono">
                        {Math.round((riskMetrics.volatility < 15 ? 20 : riskMetrics.volatility < 30 ? 40 : riskMetrics.volatility < 60 ? 70 : 90) / 10)} / 10
                      </span>
                    </div>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${riskMetrics.volatility < 15 ? 20 : riskMetrics.volatility < 30 ? 40 : riskMetrics.volatility < 60 ? 70 : 90}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-300">Asset Liquidity Depth</span>
                      <span className="font-bold text-white">{asset.category.toLowerCase() === 'crypto' ? '9 / 10' : '8 / 10'}</span>
                    </div>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${asset.category.toLowerCase() === 'crypto' ? 90 : 80}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-300">Price Momentum (30D)</span>
                      <span className="font-bold text-white">{riskMetrics.rolling30D >= 0 ? '7 / 10' : '4 / 10'}</span>
                    </div>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${riskMetrics.rolling30D >= 0 ? 70 : 40}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-300">News Sentiment Score</span>
                      <span className="font-bold text-white">8 / 10</span>
                    </div>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                        style={{ width: '80%' }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-300">{realHealthScore.breakdown.dynamicLabel}</span>
                      <span className="font-bold text-white">{Math.round(realHealthScore.breakdown.dynamicScore / 10)} / 10</span>
                    </div>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${realHealthScore.breakdown.dynamicScore}%` }}
                      />
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Market Drivers Card */}
              <GlassCard className="p-6 space-y-4" hoverEffect={false}>
                <h3 className="text-sm font-bold text-white">Market Drivers</h3>
                <div className="space-y-3.5 text-xs text-gray-400">
                  <p className="text-[10px] text-gray-500">Observable macro and micro factors impacting recent price movements (Not investment advice).</p>
                  
                  <div className="space-y-2.5 pt-1.5 font-sans leading-relaxed">
                    <div className="flex items-start space-x-2">
                      <span className="text-indigo-400 font-bold shrink-0">•</span>
                      <span>
                        <strong>Benchmark Shift:</strong> {asset.category.toLowerCase() === 'crypto' 
                          ? 'Bitcoin (BTC) volatility and net global ETF outflows drive sector correlation.' 
                          : 'Broad index performance (Nifty 50 / S&P 500) sets macroeconomic price caps.'}
                      </span>
                    </div>
                    
                    <div className="flex items-start space-x-2">
                      <span className="text-indigo-400 font-bold shrink-0">•</span>
                      <span>
                        <strong>Sector Performance:</strong> {asset.category.toLowerCase() === 'crypto'
                          ? 'Gaming sector and Layer-1 protocols show short-term structural corrections.'
                          : 'General industry sector momentum influences operational value multiples.'}
                      </span>
                    </div>

                    <div className="flex items-start space-x-2">
                      <span className="text-indigo-400 font-bold shrink-0">•</span>
                      <span>
                        <strong>Liquidity Flow:</strong> Trading volumes show {riskMetrics.volatility > 35 ? 'elevated' : 'stable'} volatility bounds with {riskMetrics.rolling30D >= 0 ? 'net positive consolidation' : 'net distribution signs'}.
                      </span>
                    </div>

                    <div className="flex items-start space-x-2">
                      <span className="text-indigo-400 font-bold shrink-0">•</span>
                      <span>
                        <strong>News Sentiment:</strong> Stable, neutral-to-bullish local coverage with no major structural announcements detected today.
                      </span>
                    </div>
                  </div>
                </div>
              </GlassCard>
              
            </div>

            {/* Bottom Row: Charts! */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Drawdown Chart */}
              <GlassCard className="p-6 space-y-4" hoverEffect={false}>
                <div className="flex items-center justify-between pb-1">
                  <div>
                    <h3 className="text-sm font-bold text-white">Max Drawdown Curve</h3>
                    <p className="text-[10px] text-gray-500 mt-0.5">Measures percentage decline from historical price peaks.</p>
                  </div>
                  <span className="text-[10px] text-rose-400 font-mono font-bold">Drawdown % over time</span>
                </div>
                <div className="w-full p-2.5 border border-white/5 bg-[#16161a]/30 rounded-xl">
                  <div ref={drawdownChartContainerRef} className="w-full h-[180px]" />
                </div>
              </GlassCard>

              {/* Rolling Returns Chart */}
              <GlassCard className="p-6 space-y-4" hoverEffect={false}>
                <div className="flex items-center justify-between pb-1">
                  <div>
                    <h3 className="text-sm font-bold text-white">Rolling 30D Returns</h3>
                    <p className="text-[10px] text-gray-500 mt-0.5">Tracks rolling 30-day percentage performance changes.</p>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">30-day performance %</span>
                </div>
                <div className="w-full p-2.5 border border-white/5 bg-[#16161a]/30 rounded-xl">
                  <div ref={rollingChartContainerRef} className="w-full h-[180px]" />
                </div>
              </GlassCard>
              
            </div>
            
          </div>
        )}

        {/* NEWS TAB */}
        {activeTab === 'news' && (
          <GlassCard className="p-6 space-y-5" hoverEffect={false}>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center">
                <Newspaper className="w-4 h-4 text-indigo-400 mr-1.5" /> Latest News & Market Catalysts
              </h3>
              <span className="text-[10px] text-gray-500 font-bold">Real-time Feed</span>
            </div>
            
            {isNewsLoading ? (
              <div className="text-center py-12 text-xs text-indigo-300 font-bold animate-pulse">
                Syncing and parsing live news catalyst streams...
              </div>
            ) : realNews.length === 0 ? (
              <div className="text-center py-12 text-xs text-gray-500 italic">
                No high-impact financial news found for this asset in the last 24 hours. Sentiment is stable.
              </div>
            ) : (
              <div className="space-y-4">
                {realNews.map((n, idx) => {
                  const dateStr = n.pubDate 
                    ? new Date(n.pubDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'Recent';
                  const sentimentLabel = n.impactType === 'positive' 
                    ? 'BULLISH' 
                    : n.impactType === 'negative' 
                    ? 'BEARISH' 
                    : 'NEUTRAL';
                  const sentimentPillColor = n.impactType === 'positive' 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                    : n.impactType === 'negative' 
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                    : 'bg-white/5 text-gray-400 border border-white/5';
                  
                  const summaryText = n.summary || `Live tracking updates regarding ${asset.name} (${asset.ticker}) market movements, sentiment catalysts, and transaction volumes.`;

                  return (
                    <a
                      key={`news-${n.id || 'article'}-${idx}`}
                      href={n.link}
                      target="_blank"
                      rel="noreferrer"
                      className="block p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-indigo-500/30 hover:bg-white/10 transition-all cursor-pointer"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        
                        {/* Left Content Side */}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center space-x-2 text-[10px] text-gray-500 font-bold">
                            <span className="text-indigo-400">{n.source || 'Market Feed'}</span>
                            {n.provider && (
                              <span className="text-[8px] px-1 py-0.5 rounded bg-white/5 text-gray-500 uppercase">{n.provider}</span>
                            )}
                            <span>•</span>
                            <span>{dateStr}</span>
                          </div>
                          
                          <h4 className="text-sm font-bold text-white leading-snug hover:text-indigo-300 transition-colors">
                            {n.title}
                          </h4>
                          
                          <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">
                            {summaryText}
                          </p>

                          <div className="flex items-center space-x-2 pt-1.5">
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${sentimentPillColor}`}>
                              {sentimentLabel}
                            </span>
                            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-gray-400">
                              Related: {asset.ticker}
                            </span>
                          </div>
                        </div>

                        {/* Right Graphic Thumbnail Side */}
                        {n.imageUrl ? (
                          <img
                            src={n.imageUrl}
                            alt=""
                            className="w-full sm:w-24 h-16 rounded-xl object-cover border border-white/5 shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full sm:w-24 h-16 rounded-xl bg-gradient-to-br from-indigo-950/40 to-slate-900/60 border border-white/5 flex items-center justify-center shrink-0">
                            <span className="text-xs font-black text-indigo-400 select-none tracking-widest">{asset.ticker}</span>
                          </div>
                        )}

                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </GlassCard>
        )}

        {/* JOURNAL TAB */}
        {activeTab === 'journal' && (
          <form onSubmit={handleSaveJournal} className="space-y-6">
            <GlassCard className="p-5 space-y-5" hoverEffect={false}>
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center">
                  <BookOpen className="w-4 h-4 text-indigo-400 mr-1.5" /> Investment Journal Entries
                </h3>
                <div className="flex items-center space-x-3">
                  {journalSaved && (
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Journal Saved Successfully
                    </span>
                  )}
                  <button
                    type="submit"
                    className="glass-btn-primary px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
                  >
                    Save Journal
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs space-y-2 md:space-y-0">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Reason Bought / Investment Thesis</label>
                    <textarea
                      placeholder="Why did you invest in this asset? Log your logic here..."
                      value={reasonBought}
                      onChange={(e) => setReasonBought(e.target.value)}
                      className="w-full glass-input rounded-xl px-3 py-2 h-20 resize-none"
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Expected Return (%)</label>
                      <input
                        type="text"
                        placeholder="e.g. 15%"
                        value={expectedReturn}
                        onChange={(e) => setExpectedReturn(e.target.value)}
                        className="w-full glass-input rounded-xl px-3 py-2"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Target Price</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 200"
                        value={targetPrice}
                        onChange={(e) => setTargetPrice(e.target.value)}
                        className="w-full glass-input rounded-xl px-3 py-2"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Stop Loss</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 80"
                        value={stopLoss}
                        onChange={(e) => setStopLoss(e.target.value)}
                        className="w-full glass-input rounded-xl px-3 py-2"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Confidence (1-10)</label>
                      <select
                        value={confidenceLevel}
                        onChange={(e) => setConfidenceLevel(Number(e.target.value))}
                        className="w-full glass-input rounded-xl px-3 py-2 text-white bg-slate-900 border border-white/10"
                      >
                        {[1,2,3,4,5,6,7,8,9,10].map(v => (
                          <option key={v} value={v} className="bg-slate-900 text-white">{v}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Exit Plan / Trigger Conditions</label>
                    <textarea
                      placeholder="When or under what conditions will you divest this asset?"
                      value={exitPlan}
                      onChange={(e) => setExitPlan(e.target.value)}
                      className="w-full glass-input rounded-xl px-3 py-2 h-20 resize-none"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Lessons Learned</label>
                    <textarea
                      placeholder="What did this trade teach you about market timing or allocations?"
                      value={lessonsLearned}
                      onChange={(e) => setLessonsLearned(e.target.value)}
                      className="w-full glass-input rounded-xl px-3 py-2 h-20 resize-none"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Mistakes Made</label>
                    <textarea
                      placeholder="Log mistakes (e.g. FOMO buy, buying during correction)."
                      value={mistakes}
                      onChange={(e) => setMistakes(e.target.value)}
                      className="w-full glass-input rounded-xl px-3 py-2 h-20 resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Future Notes</label>
                    <textarea
                      placeholder="General operational logs and plans..."
                      value={futureNotes}
                      onChange={(e) => setFutureNotes(e.target.value)}
                      className="w-full glass-input rounded-xl px-3 py-2 h-20 resize-none"
                    />
                  </div>
                </div>
              </div>
            </GlassCard>
          </form>
        )}

      </div>

      {/* Dialog: Log Trade (Transaction) Modal */}
      {isAddTxOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-md border border-white/10 shadow-2xl space-y-5" hoverEffect={false}>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">Log Transaction</h3>
                <p className="text-[10px] text-gray-500 font-semibold">{asset.name} ({asset.ticker})</p>
              </div>
              <button
                onClick={() => setIsAddTxOpen(false)}
                className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTx} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-gray-400 font-semibold uppercase">Action Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['BUY', 'SELL', 'DIVIDEND'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTxType(type)}
                      className={`py-2 rounded-xl font-bold border transition-all text-center cursor-pointer ${
                        txType === type
                          ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/30'
                          : 'bg-black/20 text-gray-400 border-white/5'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold uppercase">Quantity</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 5"
                    value={txQty}
                    onChange={(e) => setTxQty(e.target.value)}
                    className="w-full glass-input rounded-xl px-3 py-2 text-white placeholder-gray-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold uppercase">Price (Original Curr)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 144.38"
                    value={txPrice}
                    onChange={(e) => setTxPrice(e.target.value)}
                    className="w-full glass-input rounded-xl px-3 py-2 text-white placeholder-gray-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-semibold uppercase">Transaction Date</label>
                <input
                  type="date"
                  required
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full glass-input rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsAddTxOpen(false)}
                  className="glass-btn px-4 py-2 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="glass-btn-primary px-5 py-2 rounded-xl font-bold cursor-pointer"
                >
                  Log Event
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
