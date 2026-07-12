'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { getUsdInrRate, getStockQuote, getCryptoPrices, getMutualFundNAV, getSimulatedPrice, getGoogleSheetPrices, isMarketOpen } from '@/services/marketService';
import { calculateXIRR, CashFlow } from '@/services/financeUtils';
import { useSession } from '@/context/authContext';

export type AssetCategory =
  | 'stock_in'
  | 'stock_us'
  | 'etf'
  | 'mutual_fund'
  | 'crypto'
  | 'gold'
  | 'fixed_income'
  | 'real_estate'
  | 'cash';

export interface Transaction {
  id: string;
  type: 'BUY' | 'SELL' | 'DIVEST' | 'BONUS' | 'SPLIT' | 'DIVIDEND' | 'INTEREST' | 'STAKING' | 'TRANSFER';
  quantity: number;
  price: number; // in asset's original currency
  date: string; // YYYY-MM-DD
}

export interface Asset {
  id: string;
  category: AssetCategory;
  name: string;
  ticker: string; // Symbol, Coin ID, or Scheme Code
  quantity: number;
  avgBuyPrice: number; // In asset's currency
  currentPrice: number; // In asset's currency
  currency: 'INR' | 'USD';
  exchange?: string;
  tags: string[];
  notes: string;
  transactions: Transaction[];
  holdingPeriodDays?: number;
  dividendsEarned?: number; // In asset's currency
  dayChangePercent?: number;
  previousClose?: number;
  priceSource?: string;
  marketStatus?: 'OPEN' | 'CLOSED';
  extra?: {
    sipAmount?: number;
    sipDate?: number; // 1-31
    goalMapped?: string;
    interestRate?: number;
    maturityDate?: string;
    purchasePrice?: number;
    rentalIncome?: number;
    loanRemaining?: number;
    sector?: string;
    country?: string;
  };
  investmentJournal?: {
    reasonBought?: string;
    expectedReturn?: string;
    targetPrice?: number;
    stopLoss?: number;
    exitPlan?: string;
    lessonsLearned?: string;
    mistakes?: string;
    futureNotes?: string;
  };
}

export interface TargetAllocation {
  stocks: number; // %
  etfs: number; // %
  mutual_funds: number; // %
  crypto: number; // %
  gold: number; // %
  fixed_income: number; // %
  cash: number; // %
  real_estate: number; // %
}

export interface WatchlistItem {
  id: string;
  name: string;
  ticker: string;
  category: AssetCategory;
  currency: 'INR' | 'USD';
  alertPriceUpper?: number;
  alertPriceLower?: number;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number; // in USD
  currentAmount: number; // in USD
  targetDate: string;
  category: string;
}

export interface SmartAlert {
  id: string;
  title: string;
  message: string;
  type: 'warning' | 'success' | 'info' | 'critical';
  timestamp: string;
  read: boolean;
  link?: string;
}

export interface PriceSheetItem {
  ticker: string;
  name: string;
  price: number;
  currency: 'INR' | 'USD';
  category: AssetCategory;
  lastUpdated: string;
  isManual: boolean;
}

interface PortfolioState {
  assets: Asset[];
  targetAllocation: TargetAllocation;
  watchlists: WatchlistItem[];
  goals: Goal[];
  alerts: SmartAlert[];
  currencyPref: 'INR' | 'USD' | 'BOTH';
  usdInrRate: number;
  isUpdatingPrices: boolean;
  googleSheetUrl: string;
  setGoogleSheetUrl: (url: string) => void;
  lastSyncTime: string;
  sheetSyncCount: number;
  priceSheet: PriceSheetItem[];
  updateSheetPrice: (ticker: string, price: number) => void;
  resetSheetPrice: (ticker: string) => void;
  addSheetTicker: (item: Omit<PriceSheetItem, 'lastUpdated' | 'isManual'>) => void;
  addAsset: (asset: Omit<Asset, 'id' | 'currentPrice' | 'transactions'> & { id?: string }) => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  deleteAsset: (id: string) => void;
  addTransaction: (assetId: string, tx: Omit<Transaction, 'id'>) => void;
  deleteTransaction: (assetId: string, txId: string) => void;
  setTargetAllocation: (allocation: TargetAllocation) => void;
  addWatchlist: (item: Omit<WatchlistItem, 'id'>) => void;
  deleteWatchlist: (id: string) => void;
  addGoal: (goal: Omit<Goal, 'id'>) => void;
  deleteGoal: (id: string) => void;
  setCurrencyPref: (pref: 'INR' | 'USD' | 'BOTH') => void;
  refreshPrices: () => Promise<void>;
  clearAlerts: () => void;
  markAlertRead: (id: string) => void;
}

const defaultTargetAllocation: TargetAllocation = {
  stocks: 30,
  etfs: 10,
  mutual_funds: 20,
  crypto: 15,
  gold: 10,
  fixed_income: 10,
  cash: 5,
  real_estate: 0,
};

const PortfolioContext = createContext<PortfolioState | undefined>(undefined);

// Initial Mock Assets to seed database on first launch
const mockAssets: Asset[] = [
  {
    id: 'a1',
    category: 'stock_us',
    name: 'Apple Inc.',
    ticker: 'AAPL',
    quantity: 25,
    avgBuyPrice: 165.5,
    currentPrice: 191.24,
    currency: 'USD',
    exchange: 'NASDAQ',
    tags: ['Tech', 'US Growth'],
    notes: 'Long term core hold.',
    dividendsEarned: 85,
    transactions: [
      { id: 't1_1', type: 'BUY', quantity: 25, price: 165.5, date: '2025-01-10' }
    ],
    extra: { sector: 'Technology', country: 'United States', goalMapped: 'g1' }
  },
  {
    id: 'a2',
    category: 'stock_us',
    name: 'Tesla Inc.',
    ticker: 'TSLA',
    quantity: 15,
    avgBuyPrice: 210.0,
    currentPrice: 182.4,
    currency: 'USD',
    exchange: 'NASDAQ',
    tags: ['EV', 'US Growth'],
    notes: 'Volatile growth play.',
    dividendsEarned: 0,
    transactions: [
      { id: 't2_1', type: 'BUY', quantity: 15, price: 210.0, date: '2025-03-15' }
    ],
    extra: { sector: 'Automotive', country: 'United States' }
  },
  {
    id: 'a3',
    category: 'stock_in',
    name: 'Reliance Industries Ltd.',
    ticker: 'RELIANCE',
    quantity: 50,
    avgBuyPrice: 2450.0,
    currentPrice: 2940.5,
    currency: 'INR',
    exchange: 'NSE',
    tags: ['Conglomerate', 'Heavyweight'],
    notes: 'India retail and telecom proxy.',
    dividendsEarned: 450,
    transactions: [
      { id: 't3_1', type: 'BUY', quantity: 50, price: 2450.0, date: '2024-06-20' }
    ],
    extra: { sector: 'Energy & Consumer', country: 'India' }
  },
  {
    id: 'a4',
    category: 'mutual_fund',
    name: 'HDFC Index Nifty 50 Plan',
    ticker: '119063',
    quantity: 1200,
    avgBuyPrice: 110.0,
    currentPrice: 135.2,
    currency: 'INR',
    tags: ['Index', 'Nifty50'],
    notes: 'Monthly SIP route.',
    transactions: [
      { id: 't4_1', type: 'BUY', quantity: 1200, price: 110.0, date: '2024-02-05' }
    ],
    extra: { sipAmount: 10000, sipDate: 5, sector: 'Large Cap', country: 'India', goalMapped: 'g1' }
  },
  {
    id: 'a10',
    category: 'etf',
    name: 'Nippon India ETF Nifty Bees',
    ticker: 'NIFTYBEES',
    quantity: 150,
    avgBuyPrice: 245.50,
    currentPrice: 277.05,
    currency: 'INR',
    exchange: 'NSE',
    tags: ['Index', 'Passive', 'ETF'],
    notes: 'Core tracking holding.',
    transactions: [
      { id: 't10_1', type: 'BUY', quantity: 150, price: 245.50, date: '2025-02-15' }
    ]
  },
  {
    id: 'a5',
    category: 'crypto',
    name: 'Bitcoin',
    ticker: 'BTC',
    quantity: 0.35,
    avgBuyPrice: 48500.0,
    currentPrice: 60500.0,
    currency: 'USD',
    exchange: 'Binance',
    tags: ['Digital Gold', 'Layer 1'],
    notes: 'Cold storage hold.',
    transactions: [
      { id: 't5_1', type: 'BUY', quantity: 0.35, price: 48500.0, date: '2024-09-01' }
    ],
    extra: { sector: 'Cryptocurrency', country: 'Global' }
  },
  {
    id: 'a6',
    category: 'crypto',
    name: 'Ethereum',
    ticker: 'ETH',
    quantity: 2.5,
    avgBuyPrice: 2200.0,
    currentPrice: 3350.0,
    currency: 'USD',
    exchange: 'CoinDCX',
    tags: ['Smart Contract', 'Layer 1'],
    notes: 'Staked on network.',
    transactions: [
      { id: 't6_1', type: 'BUY', quantity: 2.5, price: 2200.0, date: '2024-10-15' }
    ],
    extra: { sector: 'Cryptocurrency', country: 'Global' }
  },
  {
    id: 'a7',
    category: 'gold',
    name: 'Sovereign Gold Bond Series V',
    ticker: 'SGB',
    quantity: 15, // grams
    avgBuyPrice: 6200.0,
    currentPrice: 6600.0,
    currency: 'INR',
    tags: ['Sovereign', 'Tax Free'],
    notes: 'Earns 2.5% simple interest.',
    transactions: [
      { id: 't7_1', type: 'BUY', quantity: 15, price: 6200.0, date: '2024-11-20' }
    ],
    extra: { sector: 'Precious Metals', country: 'India' }
  },
  {
    id: 'a8',
    category: 'fixed_income',
    name: 'SBI 5-Year Fixed Deposit',
    ticker: 'FD',
    quantity: 1,
    avgBuyPrice: 500000.0,
    currentPrice: 500000.0,
    currency: 'INR',
    tags: ['Fixed Deposit', 'Debt'],
    notes: 'Maturity proceeds will roll over.',
    transactions: [
      { id: 't8_1', type: 'BUY', quantity: 1, price: 500000.0, date: '2025-01-01' }
    ],
    extra: { interestRate: 7.1, maturityDate: '2030-01-01', sector: 'Banking Debt', country: 'India' }
  },
  {
    id: 'a9',
    category: 'real_estate',
    name: '2BHK Apartment (Bangalore)',
    ticker: 'REALESTATE_BLR',
    quantity: 1,
    avgBuyPrice: 8500000.0,
    currentPrice: 9800000.0,
    currency: 'INR',
    tags: ['Property', 'Rental'],
    notes: 'Rented out at ₹32,000 per month.',
    transactions: [
      { id: 't9_1', type: 'BUY', quantity: 1, price: 8500000.0, date: '2023-05-10' }
    ],
    extra: {
      purchasePrice: 8500000.0,
      rentalIncome: 32000,
      loanRemaining: 3800000.0,
      sector: 'Real Estate',
      country: 'India'
    }
  },
  {
    id: 'a10',
    category: 'cash',
    name: 'HDFC Savings Account',
    ticker: 'HDFCSAVINGS',
    quantity: 220000,
    avgBuyPrice: 1.0,
    currentPrice: 1.0,
    currency: 'INR',
    tags: ['Cash Reserve', 'Liquidity'],
    notes: 'Emergency funds.',
    transactions: [
      { id: 't10_1', type: 'BUY', quantity: 220000, price: 1.0, date: '2026-01-01' }
    ],
    extra: { sector: 'Cash Equivalents', country: 'India' }
  }
];

const mockGoals: Goal[] = [
  { id: 'g1', name: 'Retirement Fund (Core)', targetAmount: 250000, currentAmount: 48000, targetDate: '2045-12-31', category: 'Retirement' },
  { id: 'g2', name: 'Emergency Fund 12M', targetAmount: 20000, currentAmount: 2600, targetDate: '2027-06-30', category: 'Emergency' }
];

const mockWatchlists: WatchlistItem[] = [
  { id: 'w1', name: 'Nvidia Corp', ticker: 'NVDA', category: 'stock_us', currency: 'USD', alertPriceUpper: 135, alertPriceLower: 110 },
  { id: 'w2', name: 'Solana', ticker: 'SOL', category: 'crypto', currency: 'USD', alertPriceUpper: 160, alertPriceLower: 120 }
];

const mockAlerts: SmartAlert[] = [
  {
    id: 'al_1',
    title: 'Rebalancing Suggestion',
    message: 'Your crypto allocation has grown to 18.2%, exceeding the target of 15.0%. Consider rebalancing.',
    type: 'warning',
    timestamp: '2026-07-04T12:00:00Z',
    read: false,
  },
  {
    id: 'al_2',
    title: 'Dividend Received',
    message: 'Dividend of $85.00 credited for Apple Inc.',
    type: 'success',
    timestamp: '2026-07-01T09:30:00Z',
    read: false,
  }
];

const defaultPriceSheetItems: PriceSheetItem[] = [
  // ===== Indian Stocks (Nifty 50 components) =====
  { ticker: 'RELIANCE', name: 'Reliance Industries', price: 2940.50, currency: 'INR', category: 'stock_in', lastUpdated: 'Initial', isManual: false },
  { ticker: 'TCS', name: 'Tata Consultancy Services', price: 3820.00, currency: 'INR', category: 'stock_in', lastUpdated: 'Initial', isManual: false },
  { ticker: 'HDFCBANK', name: 'HDFC Bank Ltd.', price: 1610.15, currency: 'INR', category: 'stock_in', lastUpdated: 'Initial', isManual: false },
  { ticker: 'INFY', name: 'Infosys Ltd.', price: 1540.30, currency: 'INR', category: 'stock_in', lastUpdated: 'Initial', isManual: false },
  { ticker: 'ICICIBANK', name: 'ICICI Bank Ltd.', price: 1140.00, currency: 'INR', category: 'stock_in', lastUpdated: 'Initial', isManual: false },
  { ticker: 'HINDUNILVR', name: 'Hindustan Unilever', price: 2480.00, currency: 'INR', category: 'stock_in', lastUpdated: 'Initial', isManual: false },
  { ticker: 'ITC', name: 'ITC Ltd.', price: 435.00, currency: 'INR', category: 'stock_in', lastUpdated: 'Initial', isManual: false },
  { ticker: 'SBIN', name: 'State Bank of India', price: 780.00, currency: 'INR', category: 'stock_in', lastUpdated: 'Initial', isManual: false },
  { ticker: 'BHARTIARTL', name: 'Bharti Airtel', price: 1520.00, currency: 'INR', category: 'stock_in', lastUpdated: 'Initial', isManual: false },
  { ticker: 'KOTAKBANK', name: 'Kotak Mahindra Bank', price: 1780.00, currency: 'INR', category: 'stock_in', lastUpdated: 'Initial', isManual: false },
  { ticker: 'LT', name: 'Larsen & Toubro', price: 3420.00, currency: 'INR', category: 'stock_in', lastUpdated: 'Initial', isManual: false },
  { ticker: 'AXISBANK', name: 'Axis Bank Ltd.', price: 1120.00, currency: 'INR', category: 'stock_in', lastUpdated: 'Initial', isManual: false },
  { ticker: 'WIPRO', name: 'Wipro Ltd.', price: 480.00, currency: 'INR', category: 'stock_in', lastUpdated: 'Initial', isManual: false },
  { ticker: 'BAJFINANCE', name: 'Bajaj Finance', price: 6850.00, currency: 'INR', category: 'stock_in', lastUpdated: 'Initial', isManual: false },
  { ticker: 'MARUTI', name: 'Maruti Suzuki India', price: 12200.00, currency: 'INR', category: 'stock_in', lastUpdated: 'Initial', isManual: false },
  { ticker: 'TATAMOTORS', name: 'Tata Motors Ltd.', price: 940.00, currency: 'INR', category: 'stock_in', lastUpdated: 'Initial', isManual: false },
  { ticker: 'SUNPHARMA', name: 'Sun Pharmaceutical', price: 1650.00, currency: 'INR', category: 'stock_in', lastUpdated: 'Initial', isManual: false },
  { ticker: 'TITAN', name: 'Titan Company', price: 3280.00, currency: 'INR', category: 'stock_in', lastUpdated: 'Initial', isManual: false },
  { ticker: 'ADANIENT', name: 'Adani Enterprises', price: 2840.00, currency: 'INR', category: 'stock_in', lastUpdated: 'Initial', isManual: false },
  { ticker: 'HCLTECH', name: 'HCL Technologies', price: 1450.00, currency: 'INR', category: 'stock_in', lastUpdated: 'Initial', isManual: false },
  { ticker: 'POWERGRID', name: 'Power Grid Corporation', price: 290.00, currency: 'INR', category: 'stock_in', lastUpdated: 'Initial', isManual: false },
  { ticker: 'NTPC', name: 'NTPC Ltd.', price: 350.00, currency: 'INR', category: 'stock_in', lastUpdated: 'Initial', isManual: false },
  { ticker: 'TATASTEEL', name: 'Tata Steel Ltd.', price: 155.00, currency: 'INR', category: 'stock_in', lastUpdated: 'Initial', isManual: false },
  { ticker: 'ONGC', name: 'Oil & Natural Gas Corp.', price: 260.00, currency: 'INR', category: 'stock_in', lastUpdated: 'Initial', isManual: false },
  { ticker: 'COALINDIA', name: 'Coal India Ltd.', price: 430.00, currency: 'INR', category: 'stock_in', lastUpdated: 'Initial', isManual: false },

  // ===== US Stocks =====
  { ticker: 'AAPL', name: 'Apple Inc.', price: 310.00, currency: 'USD', category: 'stock_us', lastUpdated: 'Initial', isManual: false },
  { ticker: 'MSFT', name: 'Microsoft Corp.', price: 440.00, currency: 'USD', category: 'stock_us', lastUpdated: 'Initial', isManual: false },
  { ticker: 'GOOGL', name: 'Alphabet Inc. (Google)', price: 178.00, currency: 'USD', category: 'stock_us', lastUpdated: 'Initial', isManual: false },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', price: 190.00, currency: 'USD', category: 'stock_us', lastUpdated: 'Initial', isManual: false },
  { ticker: 'NVDA', name: 'NVIDIA Corp.', price: 130.00, currency: 'USD', category: 'stock_us', lastUpdated: 'Initial', isManual: false },
  { ticker: 'META', name: 'Meta Platforms Inc.', price: 500.00, currency: 'USD', category: 'stock_us', lastUpdated: 'Initial', isManual: false },
  { ticker: 'TSLA', name: 'Tesla Inc.', price: 250.00, currency: 'USD', category: 'stock_us', lastUpdated: 'Initial', isManual: false },
  { ticker: 'NFLX', name: 'Netflix Inc.', price: 680.00, currency: 'USD', category: 'stock_us', lastUpdated: 'Initial', isManual: false },
  { ticker: 'JPM', name: 'JPMorgan Chase & Co.', price: 200.00, currency: 'USD', category: 'stock_us', lastUpdated: 'Initial', isManual: false },
  { ticker: 'V', name: 'Visa Inc.', price: 280.00, currency: 'USD', category: 'stock_us', lastUpdated: 'Initial', isManual: false },

  // ===== Crypto =====
  { ticker: 'BTC', name: 'Bitcoin', price: 60500.00, currency: 'USD', category: 'crypto', lastUpdated: 'Initial', isManual: false },
  { ticker: 'ETH', name: 'Ethereum', price: 3350.00, currency: 'USD', category: 'crypto', lastUpdated: 'Initial', isManual: false },
  { ticker: 'SOL', name: 'Solana', price: 135.50, currency: 'USD', category: 'crypto', lastUpdated: 'Initial', isManual: false },
  { ticker: 'BNB', name: 'BNB (Binance)', price: 560.00, currency: 'USD', category: 'crypto', lastUpdated: 'Initial', isManual: false },
  { ticker: 'XRP', name: 'Ripple (XRP)', price: 0.52, currency: 'USD', category: 'crypto', lastUpdated: 'Initial', isManual: false },
  { ticker: 'ADA', name: 'Cardano', price: 0.45, currency: 'USD', category: 'crypto', lastUpdated: 'Initial', isManual: false },
  { ticker: 'DOGE', name: 'Dogecoin', price: 0.12, currency: 'USD', category: 'crypto', lastUpdated: 'Initial', isManual: false },
  { ticker: 'AVAX', name: 'Avalanche', price: 35.50, currency: 'USD', category: 'crypto', lastUpdated: 'Initial', isManual: false },
  { ticker: 'DOT', name: 'Polkadot', price: 7.20, currency: 'USD', category: 'crypto', lastUpdated: 'Initial', isManual: false },
  { ticker: 'LINK', name: 'Chainlink', price: 14.80, currency: 'USD', category: 'crypto', lastUpdated: 'Initial', isManual: false },
  { ticker: 'MATIC', name: 'Polygon (POL)', price: 0.073, currency: 'USD', category: 'crypto', lastUpdated: 'Initial', isManual: false },
  { ticker: 'GRAM', name: 'Gram (prev. Toncoin)', price: 1.67, currency: 'USD', category: 'crypto', lastUpdated: 'Initial', isManual: false },
  { ticker: 'KCS', name: 'KuCoin Token', price: 13.22, currency: 'USD', category: 'crypto', lastUpdated: 'Initial', isManual: false },

  // ===== US ETFs =====
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', price: 545.50, currency: 'USD', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'QQQ', name: 'Invesco QQQ Trust (Nasdaq 100)', price: 478.20, currency: 'USD', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'VOO', name: 'Vanguard S&P 500 ETF', price: 502.40, currency: 'USD', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'IVV', name: 'iShares Core S&P 500', price: 547.00, currency: 'USD', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'VTI', name: 'Vanguard Total Stock Market ETF', price: 268.00, currency: 'USD', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'DIA', name: 'SPDR Dow Jones ETF', price: 400.00, currency: 'USD', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'IWM', name: 'iShares Russell 2000 ETF', price: 210.00, currency: 'USD', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'ARKK', name: 'ARK Innovation ETF', price: 48.00, currency: 'USD', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'SCHD', name: 'Schwab US Dividend Equity ETF', price: 78.00, currency: 'USD', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'GLD', name: 'SPDR Gold Trust', price: 210.00, currency: 'USD', category: 'etf', lastUpdated: 'Initial', isManual: false },

  // ===== Indian ETFs =====
  { ticker: 'NIFTYBEES', name: 'Nippon India ETF Nifty BeES', price: 277.05, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'BANKBEES', name: 'Nippon India ETF Bank BeES', price: 52.75, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'GOLDBEES', name: 'Nippon India ETF Gold BeES', price: 118.50, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'SILVERBEES', name: 'Nippon India ETF Silver BeES', price: 78.20, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'JUNIORBEES', name: 'Nippon India ETF Junior BeES', price: 70.40, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'HNGSNGBEES', name: 'Nippon India ETF Hang Seng BeES', price: 482.60, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'NIFTYAXIS', name: 'Axis Nifty 50 ETF', price: 269.09, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'BNKETFAXIS', name: 'Axis Banking ETF', price: 599.68, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'SETFNIF50', name: 'SBI ETF Nifty 50', price: 261.98, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'SETFNN50', name: 'SBI ETF Nifty Next 50', price: 73.80, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'SETFGOLD', name: 'SBI Gold ETF', price: 63.50, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'MON100', name: 'Motilal Oswal Nasdaq 100 ETF', price: 327.28, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'MONQ50', name: 'Motilal Oswal Nifty Midcap 150 ETF', price: 145.29, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'MOM50', name: 'Motilal Oswal Nifty 50 ETF', price: 277.05, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'MAFANG', name: 'Mirae Asset NYSE FANG+ ETF', price: 191.78, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'MASPTOP50', name: 'Mirae Asset S&P 500 Top 50 ETF', price: 77.97, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'MAHKTECH', name: 'Mirae Asset Hang Seng TECH ETF', price: 22.02, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'ICICIB22', name: 'ICICI Prudential Bharat 22 ETF', price: 118.11, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'AXISBPSETF', name: 'Axis BSE PSU Index ETF', price: 13.33, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'HDFCNIFETF', name: 'HDFC Nifty 50 ETF', price: 260.00, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'KOTAKNIFTY', name: 'Kotak Nifty 50 ETF', price: 258.00, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'ITBEES', name: 'Nippon India ETF Nifty IT', price: 38.50, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'PSUBNKBEES', name: 'Nippon India ETF PSU Bank BeES', price: 85.00, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'PHARMABEES', name: 'Nippon India ETF Pharma BeES', price: 18.50, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'INFRABEEES', name: 'Nippon India ETF Infra BeES', price: 68.00, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'CPSEETF', name: 'Nippon India ETF CPSE', price: 76.00, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },
  { ticker: 'MIDCAPETF', name: 'Motilal Oswal Midcap 100 ETF', price: 29.50, currency: 'INR', category: 'etf', lastUpdated: 'Initial', isManual: false },

  // ===== Mutual Funds (AMFI Scheme Codes) =====
  { ticker: '119063', name: 'HDFC Index Nifty 50 Plan Direct', price: 135.20, currency: 'INR', category: 'mutual_fund', lastUpdated: 'Initial', isManual: false },
  { ticker: '122639', name: 'Parag Parikh Flexi Cap Fund Direct', price: 78.40, currency: 'INR', category: 'mutual_fund', lastUpdated: 'Initial', isManual: false },
  { ticker: '118989', name: 'SBI Bluechip Fund Direct Growth', price: 84.10, currency: 'INR', category: 'mutual_fund', lastUpdated: 'Initial', isManual: false },
  { ticker: '120847', name: 'Mirae Asset Large Cap Fund Direct', price: 115.30, currency: 'INR', category: 'mutual_fund', lastUpdated: 'Initial', isManual: false },
  { ticker: '148918', name: 'Motilal Oswal Nasdaq 100 FOF Direct', price: 32.50, currency: 'INR', category: 'mutual_fund', lastUpdated: 'Initial', isManual: false },
  { ticker: '120828', name: 'Quant Small Cap Fund Direct Growth', price: 220.00, currency: 'INR', category: 'mutual_fund', lastUpdated: 'Initial', isManual: false },
  { ticker: '120823', name: 'Quant Active Fund Direct Growth', price: 560.00, currency: 'INR', category: 'mutual_fund', lastUpdated: 'Initial', isManual: false },
  { ticker: '118778', name: 'Nippon India Small Cap Fund Direct', price: 155.00, currency: 'INR', category: 'mutual_fund', lastUpdated: 'Initial', isManual: false },
  { ticker: '119598', name: 'Axis Bluechip Fund Direct Growth', price: 55.00, currency: 'INR', category: 'mutual_fund', lastUpdated: 'Initial', isManual: false },
  { ticker: '119364', name: 'ICICI Prudential Bluechip Fund Direct', price: 95.00, currency: 'INR', category: 'mutual_fund', lastUpdated: 'Initial', isManual: false },
  { ticker: '118632', name: 'Nippon India Large Cap Fund Direct', price: 82.00, currency: 'INR', category: 'mutual_fund', lastUpdated: 'Initial', isManual: false },
  { ticker: '119732', name: 'SBI PSU Fund Direct Growth', price: 26.00, currency: 'INR', category: 'mutual_fund', lastUpdated: 'Initial', isManual: false },
  { ticker: '127042', name: 'Motilal Oswal Midcap Fund Direct', price: 78.00, currency: 'INR', category: 'mutual_fund', lastUpdated: 'Initial', isManual: false },
  { ticker: '146746', name: 'Parag Parikh Tax Saver Fund Direct', price: 28.00, currency: 'INR', category: 'mutual_fund', lastUpdated: 'Initial', isManual: false },
  { ticker: '120621', name: 'ICICI Pru Infrastructure Fund Direct', price: 162.00, currency: 'INR', category: 'mutual_fund', lastUpdated: 'Initial', isManual: false },
  { ticker: '118557', name: 'Franklin Build India Fund Direct', price: 120.00, currency: 'INR', category: 'mutual_fund', lastUpdated: 'Initial', isManual: false },

  // ===== Commodities (Gold, Silver, Oil, etc.) =====
  { ticker: 'GOLD', name: 'Gold 24K (per gram)', price: 14449.00, currency: 'INR', category: 'gold', lastUpdated: 'Initial', isManual: false },
  { ticker: 'SILVER', name: 'Silver (per gram)', price: 93.00, currency: 'INR', category: 'gold', lastUpdated: 'Initial', isManual: false },
  { ticker: 'GOLD_24K', name: 'Physical Gold 24K (1g)', price: 14449.00, currency: 'INR', category: 'gold', lastUpdated: 'Initial', isManual: false },
  { ticker: 'GOLD_22K', name: 'Physical Gold 22K (1g)', price: 13235.00, currency: 'INR', category: 'gold', lastUpdated: 'Initial', isManual: false },
  { ticker: 'DIGI_GOLD', name: 'Digital Gold (1g)', price: 14449.00, currency: 'INR', category: 'gold', lastUpdated: 'Initial', isManual: false },
  { ticker: 'SGB', name: 'Sovereign Gold Bond (1g)', price: 14160.00, currency: 'INR', category: 'gold', lastUpdated: 'Initial', isManual: false },
  { ticker: 'CRUDEOIL', name: 'Crude Oil WTI (per barrel)', price: 73.50, currency: 'USD', category: 'gold', lastUpdated: 'Initial', isManual: false },
  { ticker: 'BRENT', name: 'Brent Crude Oil (per barrel)', price: 78.00, currency: 'USD', category: 'gold', lastUpdated: 'Initial', isManual: false },
  { ticker: 'NATURALGAS', name: 'Natural Gas (per MMBtu)', price: 2.80, currency: 'USD', category: 'gold', lastUpdated: 'Initial', isManual: false },
  { ticker: 'COPPER', name: 'Copper (per lb)', price: 4.50, currency: 'USD', category: 'gold', lastUpdated: 'Initial', isManual: false },
  { ticker: 'PLATINUM', name: 'Platinum (per oz)', price: 980.00, currency: 'USD', category: 'gold', lastUpdated: 'Initial', isManual: false },
];

export const commonMutualFundsMap: Record<string, string> = {
  'PARAG PARIKH FLEXI CAP': '122639',
  'HDFC INDEX NIFTY 50': '119063',
  'SBI BLUECHIP': '118989',
  'MIRAE ASSET LARGE CAP': '120847',
  'MOTILAL OSWAL NASDAQ 100': '148918',
  'QUANT SMALL CAP': '120828',
  'QUANT ACTIVE': '120823',
  'QUANT INFRASTRUCTURE': '120833',
  'SBI HEALTHCARE OPPORTUNITIES': '119783',
  'NIPPON INDIA SMALL CAP': '118778',
  'NIPPON INDIA LARGE CAP': '118632',
  'SBI PSU': '119732',
  'PARAG PARIKH TAX SAVER': '146746',
  'MOTILAL OSWAL MIDCAP': '127042',
  'BANDHAN SMALL CAP': '147946',
  'ICICI PRUDENTIAL INFRASTRUCTURE': '120621',
  'EDELWEISS US TECHNOLOGY': '148063',
  'INVESCO INDIA SMALLCAP': '145137',
  'ADITYA BIRLA SUN LIFE PSU': '147844',
  'NIPPON INDIA MULTI CAP': '118650',
  'INVESCO INDIA PSU': '120395',
  'MOTILAL OSWAL BSE ENHANCED': '150518',
  'FRANKLIN BUILD INDIA': '118557',
};

export const resolveMutualFundTicker = (schemeName: string): string => {
  const cleanName = schemeName.toUpperCase();
  for (const [key, code] of Object.entries(commonMutualFundsMap)) {
    if (cleanName.includes(key)) {
      return code;
    }
  }
  return schemeName;
};

export const isinTickerMap: Record<string, { ticker: string; category: AssetCategory; name?: string }> = {
  // Indian ETFs — tickers verified against Angel One NSE symbols
  'INF846K01W90': { ticker: 'NIFTYAXIS', category: 'etf', name: 'Axis Nifty 50 ETF' },
  'INF846K01W98': { ticker: 'NIFTYAXIS', category: 'etf', name: 'Axis Nifty 50 ETF' },
  'INF846K01X63': { ticker: 'BNKETFAXIS', category: 'etf', name: 'Axis Nifty Bank ETF' },
  'INF846K01DP1': { ticker: 'AXISBPSETF', category: 'etf', name: 'Axis Bond Plus SDL Apr 2026 ETF' },
  'INF200KA1151': { ticker: 'SETFNIF50', category: 'etf', name: 'SBI ETF Nifty 50' },
  'INF200KA1FS1': { ticker: 'SETFNIF50', category: 'etf', name: 'SBI ETF Nifty 50' },
  'INF200K01015': { ticker: 'SETFNIF50', category: 'etf', name: 'SBI ETF Nifty 50' },
  'INF846K01115': { ticker: 'MON100', category: 'etf', name: 'Motilal Oswal Nasdaq 100 ETF' },
  'INF247L01AP3': { ticker: 'MON100', category: 'etf', name: 'Motilal Oswal Nasdaq 100 ETF' },
  'INF247L01AU3': { ticker: 'MONQ50', category: 'etf', name: 'Motilal Oswal Nasdaq Q 50 ETF' },
  'INF247L01536': { ticker: 'MOM50', category: 'etf', name: 'Motilal Oswal Nifty 50 ETF' },
  'INF247L01BU1': { ticker: 'MONIFTY500', category: 'etf', name: 'Motilal Oswal Nifty 500 ETF' },
  'INF247L01023': { ticker: 'MOM100', category: 'etf', name: 'Motilal Oswal Nifty Midcap 100 ETF' },
  'INF204KB1412': { ticker: 'NIFTYBEES', category: 'etf', name: 'Nippon India Nifty 50 BeES ETF' },
  'INF204KB14I2': { ticker: 'NIFTYBEES', category: 'etf', name: 'Nippon India Nifty 50 BeES ETF' },
  'INF204KB1M12': { ticker: 'NIFTYBEES', category: 'etf', name: 'Nippon India Nifty BeES ETF' },
  'INF769K01HD4': { ticker: 'MAFANG', category: 'etf', name: 'Mirae Asset NYSE FANG+ ETF' },
  'INF769K01HF4': { ticker: 'MAFANG', category: 'etf', name: 'Mirae Asset NYSE FANG+ ETF' },
  'INF769K01HF9': { ticker: 'MAFANG', category: 'etf', name: 'Mirae Asset NYSE FANG+ ETF' },
  'INF769K01HP8': { ticker: 'MASPTOP50', category: 'etf', name: 'Mirae Asset S&P 500 Top 50 ETF' },
  'INF769K01HP3': { ticker: 'MASPTOP50', category: 'etf', name: 'Mirae Asset S&P 500 Top 50 ETF' },
  'INF204K01011': { ticker: 'GOLDBEES', category: 'etf', name: 'Nippon India Gold BeES ETF' },
  'INF204K01AP1': { ticker: 'GOLDBEES', category: 'etf', name: 'Nippon India Gold BeES ETF' },
  'INF204K01691': { ticker: 'HNGSNGBEES', category: 'etf', name: 'Nippon India Hang Seng BeES ETF' },
  'INF204KB19I1': { ticker: 'HNGSNGBEES', category: 'etf', name: 'Nippon India Hang Seng BeES ETF' },
  'INF204K03989': { ticker: 'HNGSNGBEES', category: 'etf', name: 'Nippon India Hang Seng BeES ETF' },
  'INF109KB15Y7': { ticker: 'ICICIB22', category: 'etf', name: 'ICICI Prudential Bharat 22 ETF' },
  'INF109KC1972': { ticker: 'ICICIB22', category: 'etf', name: 'ICICI Prudential Bharat 22 ETF' },
  'INF109KC1LR0': { ticker: 'JUNIORBEES', category: 'etf', name: 'Nippon India Nifty Next 50 Junior BeES ETF' },
  'INF204KB1NP5': { ticker: 'BANKBEES', category: 'etf', name: 'Nippon India Bank BeES ETF' },
  'INF200KA1FS4': { ticker: 'SETFNN50', category: 'etf', name: 'SBI ETF Nifty Next 50' },
  'INF200KA1HQ4': { ticker: 'SETFGOLD', category: 'etf', name: 'SBI ETF Gold' },
  'INF204K01EY3': { ticker: 'SILVERBEES', category: 'etf', name: 'Nippon India Silver BeES ETF' },
  'INF769K01HE2': { ticker: 'MAHKTECH', category: 'etf', name: 'Mirae Asset Hang Seng TECH ETF' },
  'INF769K01HS7': { ticker: 'MAHKTECH', category: 'etf', name: 'Mirae Asset Hang Seng TECH ETF' },

  // Mutual Funds
  'INF247L01131': { ticker: '148419', category: 'mutual_fund', name: 'Motilal Oswal S&P 500 Index Fund Direct Growth' },
};

export const resolveAssetByISIN = (isin: string): { ticker: string; category: AssetCategory; name?: string } | null => {
  const cleanIsin = isin.toUpperCase().trim();
  return isinTickerMap[cleanIsin] || null;
};

export const PortfolioProvider = ({ children }: { children: ReactNode }) => {
  const { data: session, status } = useSession();
  const userId = session?.user?.id || 'guest';

  const [assets, setAssets] = useState<Asset[]>([]);
  const [targetAllocation, setTargetAllocationState] = useState<TargetAllocation>(defaultTargetAllocation);
  const [watchlists, setWatchlists] = useState<WatchlistItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [currencyPref, setCurrencyPrefState] = useState<'INR' | 'USD' | 'BOTH'>('BOTH');
  const [usdInrRate, setUsdInrRate] = useState<number>(83.54);
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [googleSheetUrl, setGoogleSheetUrlState] = useState<string>('');
  const [lastSyncTime, setLastSyncTime] = useState<string>('Never');
  const [sheetSyncCount, setSheetSyncCount] = useState<number>(0);
  const [priceSheet, setPriceSheet] = useState<PriceSheetItem[]>([]);

  // Lock storage updates during session transition
  useEffect(() => {
    setInitialized(false);
  }, [userId, status]);

  const setGoogleSheetUrl = (url: string) => {
    setGoogleSheetUrlState(url);
    // No localStorage — saving happens via debounced API call
  };

  const assetsRef = useRef<Asset[]>([]);
  const watchlistsRef = useRef<WatchlistItem[]>([]);
  const priceSheetRef = useRef<PriceSheetItem[]>([]);

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  useEffect(() => {
    watchlistsRef.current = watchlists;
  }, [watchlists]);

  useEffect(() => {
    priceSheetRef.current = priceSheet;
  }, [priceSheet]);

  // 1. Initial Load from Server (DB-backed via /api/portfolio)
  useEffect(() => {
    if (status === 'loading') return;
    if (typeof window === 'undefined') return;

    // If not authenticated, just set defaults and mark initialized
    if (status === 'unauthenticated' || !session?.user?.id) {
      setAssets([]);
      setTargetAllocationState(defaultTargetAllocation);
      setWatchlists([]);
      setGoals([]);
      setAlerts([]);
      setCurrencyPrefState('BOTH');
      setGoogleSheetUrlState('');
      setPriceSheet(defaultPriceSheetItems);
      setInitialized(true);
      return;
    }

    let cancelled = false;

    (async () => {
      // Retry up to 3 times with 500ms delay in case the auth cookie
      // isn't set yet (race between authContext and sync-session completing)
      let loadedData: any = null;
      let loadSuccess = false;

      for (let attempt = 0; attempt < 3 && !loadSuccess; attempt++) {
        if (cancelled) return;
        try {
          const res = await fetch('/api/portfolio', { method: 'GET' });
          if (res.ok) {
            const { data } = await res.json();
            loadedData = data;
            loadSuccess = true;
          } else if (res.status === 401 && attempt < 2) {
            // Cookie not ready yet — wait and retry
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            // Non-401 error or out of retries — give up
            break;
          }
        } catch {
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }

      if (cancelled) return;
      const data = loadedData;

      try {
        if (data) {
          if (data.assets) {
            let loaded: Asset[] = data.assets;
            loaded = loaded.map(asset => {
              // 1. Mutual fund ticker resolution
              if (asset.category === 'mutual_fund') {
                const correct = resolveMutualFundTicker(asset.name || asset.ticker);
                if (correct !== asset.ticker) {
                  asset = { ...asset, ticker: correct };
                }
              }
              // 2. Fix known wrong ISIN→ticker mappings from previous versions
              if (asset.ticker === '149635' && asset.name?.toLowerCase().includes('motilal')) {
                asset = { ...asset, ticker: 'MONQ50', category: 'etf', name: 'Motilal Oswal Nasdaq Q 50 ETF' };
              }
              if (asset.ticker.toUpperCase() === 'AXISNIFTY') {
                asset = { ...asset, ticker: 'NIFTYAXIS', category: 'etf', name: 'Axis Nifty 50 ETF' };
              }
              if (asset.ticker.toUpperCase() === 'AXISBPETF') {
                asset = { ...asset, ticker: 'BNKETFAXIS', category: 'etf', name: 'Axis Nifty Bank ETF' };
              }
              if (asset.ticker.toUpperCase() === 'SETFNIFTY') {
                asset = { ...asset, ticker: 'SETFNIF50', category: 'etf', name: 'SBI ETF Nifty 50' };
              }
              if (asset.ticker.toUpperCase() === 'MASP500') {
                asset = { ...asset, ticker: 'MASPTOP50', category: 'etf', name: 'Mirae Asset S&P 500 Top 50 ETF' };
              }
              if (asset.ticker.toUpperCase() === 'BHARAT22') {
                asset = { ...asset, ticker: 'ICICIB22', category: 'etf', name: 'ICICI Prudential Bharat 22 ETF' };
              }
              // 3. Re-resolve tickers that are stored as raw ISIN codes
              const isISINTicker = /^INF[A-Z0-9]{9}$/.test(asset.ticker.toUpperCase());
              if (isISINTicker) {
                const resolved = resolveAssetByISIN(asset.ticker);
                if (resolved) {
                  asset = { ...asset, ticker: resolved.ticker, category: resolved.category, name: resolved.name || asset.name };
                }
              }
              // 4. ETF category migration
              const isCommonETF = ['SPY', 'QQQ', 'VOO', 'NIFTYBEES', 'GOLDBEES', 'JUNIORBEES', 'AXISNIFTY', 'AXISBPETF', 'AXISBPSETF', 'SETFNIFTY', 'MON100', 'MONQ50', 'MOM50', 'MOM100', 'MONIFTY500', 'MAFANG', 'MASP500', 'MAHKTECH', 'BHARAT22', 'HNGSNGBEES', 'BANKBEES', 'SETFNN50', 'SETFGOLD', 'SILVERBEES'].includes(asset.ticker.toUpperCase());
              const hasETFKeywords = asset.name?.toUpperCase().includes('ETF') || asset.name?.toUpperCase().includes('BEES');
              if ((isCommonETF || hasETFKeywords) && asset.category !== 'etf') {
                asset = { ...asset, category: 'etf' };
              }
              // 5. Stablecoin cost basis fix
              if ((asset.ticker.toUpperCase() === 'USDT' || asset.ticker.toUpperCase() === 'USDC') && asset.avgBuyPrice > 2.0) {
                asset = { ...asset, avgBuyPrice: 1.0 };
                if (asset.transactions) {
                  asset.transactions = asset.transactions.map(t => {
                    if (t.type === 'BUY' && t.price > 2.0) {
                      return { ...t, price: 1.0 };
                    }
                    return t;
                  });
                }
              }
              return asset;
            });

            // Deduplicate and combine duplicate assets
            const deduplicated: Asset[] = [];
            loaded.forEach(asset => {
              const normTicker = normalizeTicker(asset.ticker);
              const existingIndex = deduplicated.findIndex(
                a => normalizeTicker(a.ticker) === normTicker && a.category === asset.category
              );

              if (existingIndex !== -1) {
                const existing = deduplicated[existingIndex];
                const totalQuantity = existing.quantity + asset.quantity;
                let newAvgPrice = existing.avgBuyPrice;
                if (totalQuantity > 0) {
                  newAvgPrice = ((existing.quantity * existing.avgBuyPrice) + (asset.quantity * asset.avgBuyPrice)) / totalQuantity;
                }
                const mergedExchanges = [existing.exchange, asset.exchange]
                  .filter(Boolean)
                  .filter((v, i, self) => self.indexOf(v) === i)
                  .join(' / ');
                const existingTags = Array.isArray(existing.tags) ? existing.tags : [];
                const assetTags = Array.isArray(asset.tags) ? asset.tags : [];
                const mergedTags = Array.from(new Set([...existingTags, ...assetTags]));
                const mergedNotes = [existing.notes, asset.notes]
                  .filter(Boolean)
                  .filter((v, i, self) => self.indexOf(v) === i)
                  .join('\n');
                const mergedTxs = [...(existing.transactions || []), ...(asset.transactions || [])];
                const uniqueTxs = mergedTxs.filter((v, i, self) => self.findIndex(t => t.id === v.id) === i);

                deduplicated[existingIndex] = {
                  ...existing,
                  quantity: totalQuantity,
                  avgBuyPrice: Number(newAvgPrice.toFixed(6)),
                  exchange: mergedExchanges || undefined,
                  tags: mergedTags,
                  notes: mergedNotes,
                  transactions: uniqueTxs
                };
              } else {
                deduplicated.push(asset);
              }
            });

            setAssets(deduplicated);
          } else {
            setAssets([]);
          }

          if (data.targetAllocation) setTargetAllocationState(data.targetAllocation);
          else setTargetAllocationState(defaultTargetAllocation);

          if (data.watchlists) setWatchlists(data.watchlists);
          else setWatchlists([]);

          if (data.goals) setGoals(data.goals);
          else setGoals([]);

          if (data.alerts) setAlerts(data.alerts);
          else setAlerts([]);

          if (data.currencyPref) setCurrencyPrefState(data.currencyPref);
          else setCurrencyPrefState('BOTH');

          if (data.googleSheetUrl) setGoogleSheetUrlState(data.googleSheetUrl);
          else setGoogleSheetUrlState('');

          // Merge stored price sheet with defaults
          let parsedSheet: PriceSheetItem[] = data.priceSheet || [];
          parsedSheet = parsedSheet.map(item => {
            if (item.ticker.toUpperCase() === 'GRAM' && item.price < 0.01) {
              return { ...item, price: 1.67, name: 'Gram (prev. Toncoin)', isManual: false };
            }
            return item;
          });
          const mergedSheet = [...parsedSheet];
          defaultPriceSheetItems.forEach(defItem => {
            if (!mergedSheet.some(x => x.ticker.toUpperCase() === defItem.ticker.toUpperCase())) {
              mergedSheet.push(defItem);
            }
          });
          setPriceSheet(mergedSheet);
        } else {
          // No saved data on server — check localStorage for old data to migrate
          const oldUserId = session?.user?.id || 'guest';
          const oldAssets = localStorage.getItem(`wealthos_assets_${oldUserId}`);
          const oldGuestAssets = localStorage.getItem('wealthos_assets_guest');

          if (oldAssets || oldGuestAssets) {
            // Migrate old localStorage data to server
            const migratedData: any = {};
            migratedData.assets = oldAssets ? JSON.parse(oldAssets) : (oldGuestAssets ? JSON.parse(oldGuestAssets) : []);

            const oldAlloc = localStorage.getItem(`wealthos_allocation_${oldUserId}`) || localStorage.getItem('wealthos_allocation_guest');
            migratedData.targetAllocation = oldAlloc ? JSON.parse(oldAlloc) : defaultTargetAllocation;

            const oldWatch = localStorage.getItem(`wealthos_watchlist_${oldUserId}`) || localStorage.getItem('wealthos_watchlist_guest');
            migratedData.watchlists = oldWatch ? JSON.parse(oldWatch) : [];

            const oldGoals = localStorage.getItem(`wealthos_goals_${oldUserId}`) || localStorage.getItem('wealthos_goals_guest');
            migratedData.goals = oldGoals ? JSON.parse(oldGoals) : [];

            const oldAlerts = localStorage.getItem(`wealthos_alerts_${oldUserId}`) || localStorage.getItem('wealthos_alerts_guest');
            migratedData.alerts = oldAlerts ? JSON.parse(oldAlerts) : [];

            const oldPref = localStorage.getItem(`wealthos_currency_pref_${oldUserId}`) || localStorage.getItem('wealthos_currency_pref_guest');
            migratedData.currencyPref = oldPref || 'BOTH';

            const oldSheetUrl = localStorage.getItem(`wealthos_google_sheet_url_${oldUserId}`) || localStorage.getItem('wealthos_google_sheet_url_guest');
            migratedData.googleSheetUrl = oldSheetUrl || '';

            const oldSheet = localStorage.getItem(`wealthos_price_sheet_${oldUserId}`) || localStorage.getItem('wealthos_price_sheet_guest');
            migratedData.priceSheet = oldSheet ? JSON.parse(oldSheet) : [];

            // Set state from migrated data
            if (migratedData.assets && migratedData.assets.length > 0) {
              setAssets(migratedData.assets);
            } else {
              setAssets([]);
            }
            setTargetAllocationState(migratedData.targetAllocation || defaultTargetAllocation);
            setWatchlists(migratedData.watchlists || []);
            setGoals(migratedData.goals || []);
            setAlerts(migratedData.alerts || []);
            setCurrencyPrefState(migratedData.currencyPref || 'BOTH');
            setGoogleSheetUrlState(migratedData.googleSheetUrl || '');

            // Merge price sheet with defaults
            let parsedSheet: PriceSheetItem[] = migratedData.priceSheet || [];
            const mergedSheet = [...parsedSheet];
            defaultPriceSheetItems.forEach(defItem => {
              if (!mergedSheet.some(x => x.ticker.toUpperCase() === defItem.ticker.toUpperCase())) {
                mergedSheet.push(defItem);
              }
            });
            setPriceSheet(mergedSheet);

            // The debounced save effect will automatically upload this to the server.
            // Also clean up old localStorage keys to prevent re-migration
            try {
              localStorage.removeItem(`wealthos_assets_${oldUserId}`);
              localStorage.removeItem(`wealthos_allocation_${oldUserId}`);
              localStorage.removeItem(`wealthos_watchlist_${oldUserId}`);
              localStorage.removeItem(`wealthos_goals_${oldUserId}`);
              localStorage.removeItem(`wealthos_alerts_${oldUserId}`);
              localStorage.removeItem(`wealthos_currency_pref_${oldUserId}`);
              localStorage.removeItem(`wealthos_google_sheet_url_${oldUserId}`);
              localStorage.removeItem(`wealthos_price_sheet_${oldUserId}`);
              // Also clean guest keys
              ['wealthos_assets_guest', 'wealthos_allocation_guest', 'wealthos_watchlist_guest',
               'wealthos_goals_guest', 'wealthos_alerts_guest', 'wealthos_currency_pref_guest',
               'wealthos_google_sheet_url_guest', 'wealthos_price_sheet_guest'].forEach(k => {
                localStorage.removeItem(k);
              });
            } catch (e) {
              console.error('Failed to clean up old localStorage', e);
            }
          } else {
            // Truly no data anywhere — start fresh
            setAssets([]);
            setTargetAllocationState(defaultTargetAllocation);
            setWatchlists([]);
            setGoals([]);
            setAlerts([]);
            setCurrencyPrefState('BOTH');
            setGoogleSheetUrlState('');
            setPriceSheet(defaultPriceSheetItems);
          }
        }
      } catch (err) {
        console.error('Failed to load portfolio state from server', err);
        // Fallback to empty defaults
        setAssets([]);
        setPriceSheet(defaultPriceSheetItems);
      } finally {
        if (!cancelled) setInitialized(true);
      }
    })();

    return () => { cancelled = true; };
  }, [userId, status]);

  // 2. Save state changes to server (DB-backed, debounced)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!initialized || status !== 'authenticated') return;

    // Debounce: wait 2s after last change before sending to server
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      try {
        // Read CSRF token from cookie
        const csrfCookie = document.cookie
          .split('; ')
          .find(c => c.startsWith('csrf-token='));
        const csrfToken = csrfCookie ? csrfCookie.split('=')[1] : '';

        await fetch('/api/portfolio', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken,
          },
          body: JSON.stringify({
            assets,
            targetAllocation,
            watchlists,
            goals,
            alerts,
            currencyPref,
            googleSheetUrl,
            priceSheet,
          }),
        });
      } catch (e) {
        console.error('Failed to save portfolio state to server', e);
      }
    }, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [assets, targetAllocation, watchlists, goals, alerts, currencyPref, googleSheetUrl, priceSheet, initialized, status]);

  // 3. Helper to update holding calculations (like holding period)
  const computeHoldingDays = (txs: Transaction[]): number => {
    if (txs.length === 0) return 0;
    const earliest = txs
      .map(t => new Date(t.date).getTime())
      .reduce((min, d) => (d < min ? d : min), Date.now());
    return Math.floor((Date.now() - earliest) / (1000 * 60 * 60 * 24));
  };

  // Helper to normalize tickers for comparison
  const normalizeTicker = (t: string) => {
    return t.toUpperCase()
      .replace(/^(NSE:|BOM:|NASDAQ:|NYSE:|AMFI:)/, '') // remove exchange prefixes
      .replace(/\.(NS|BOM)$/, '') // remove suffix
      .trim();
  };

  // 4. Update prices from APIs
  const refreshPrices = async () => {
    setIsUpdatingPrices(true);
    try {
      const currentAssets = assetsRef.current;
      const currentWatchlists = watchlistsRef.current;
      const currentPriceSheet = priceSheetRef.current;

      const rate = await getUsdInrRate();
      setUsdInrRate(rate);

      // Fetch Google Sheet CSV data if configured
      let sheetPrices: Record<string, number> = {};
      let sheetPreviousCloses: Record<string, number> = {};
      if (googleSheetUrl) {
        try {
          const rawSheetData = await getGoogleSheetPrices(googleSheetUrl);
          Object.entries(rawSheetData.prices).forEach(([key, val]) => {
            sheetPrices[normalizeTicker(key)] = val;
          });
          Object.entries(rawSheetData.previousCloses).forEach(([key, val]) => {
            sheetPreviousCloses[normalizeTicker(key)] = val;
          });
          const syncCount = Object.keys(sheetPrices).length;
          setSheetSyncCount(syncCount);
          setLastSyncTime(new Date().toLocaleTimeString());
        } catch (e) {
          console.error('Failed to sync Google Sheet:', e);
        }
      }

      // Check manual overrides in Virtual Sheet
      const manualPrices: Record<string, number> = {};
      currentPriceSheet.forEach(item => {
        if (item.isManual) {
          manualPrices[normalizeTicker(item.ticker)] = item.price;
        }
      });

      // Collect cryptos in portfolio and watchlist that are NOT matched in Google Sheet or manual overrides
      const cryptoSymbols = Array.from(
        new Set([
          ...currentAssets.filter(a => a.category === 'crypto').map(a => a.ticker),
          ...currentWatchlists.filter(w => w.category === 'crypto').map(w => w.ticker)
        ])
      ).filter(sym => sheetPrices[normalizeTicker(sym)] === undefined && manualPrices[normalizeTicker(sym)] === undefined);
      
      let cryptoPrices: Record<string, { usdPrice: number; inrPrice: number; usdChange24h: number; inrChange24h: number }> = {};
      if (cryptoSymbols.length > 0) {
        cryptoPrices = await getCryptoPrices(cryptoSymbols);
      }

      // Map through assets to update price
      const updatedAssets = await Promise.all(
        currentAssets.map(async (asset) => {
          let currentPrice = asset.currentPrice;
          let dayChangePercent = asset.dayChangePercent || 0;
          let previousClose = asset.previousClose !== undefined ? asset.previousClose : currentPrice;
          let priceSource = asset.priceSource || 'Manual Entry';
          let marketStatus: 'OPEN' | 'CLOSED' = asset.marketStatus || 'CLOSED';
          const normTicker = normalizeTicker(asset.ticker);
          const normName = normalizeTicker(asset.name);

          // 1. Check if there is a local manual override price
          if (manualPrices[normTicker] !== undefined) {
            currentPrice = manualPrices[normTicker];
            previousClose = currentPrice;
            dayChangePercent = 0;
            priceSource = 'Manual Override';
            marketStatus = isMarketOpen(asset.ticker, asset.category);
          }
          // 2. Check if Google Sheet contains this price
          else if (sheetPrices[normTicker] !== undefined) {
            currentPrice = sheetPrices[normTicker];
            previousClose = sheetPreviousCloses[normTicker] !== undefined ? sheetPreviousCloses[normTicker] : currentPrice;
            dayChangePercent = previousClose > 0 ? ((currentPrice - previousClose) / previousClose) * 100 : 0;
            priceSource = 'Google Sheet';
            marketStatus = isMarketOpen(asset.ticker, asset.category);
          } else if (sheetPrices[normName] !== undefined) {
            currentPrice = sheetPrices[normName];
            previousClose = sheetPreviousCloses[normName] !== undefined ? sheetPreviousCloses[normName] : currentPrice;
            dayChangePercent = previousClose > 0 ? ((currentPrice - previousClose) / previousClose) * 100 : 0;
            priceSource = 'Google Sheet';
            marketStatus = isMarketOpen(asset.ticker, asset.category);
          } else {
            // 3. Fallback to live APIs
            try {
              if (asset.category === 'stock_us') {
                const res = await getStockQuote(asset.ticker, true);
                currentPrice = res.price;
                dayChangePercent = res.changePercent;
                previousClose = res.previousClose;
                marketStatus = res.marketStatus;
                priceSource = 'Google Finance';
              } else if (asset.category === 'stock_in') {
                const res = await getStockQuote(asset.ticker, false);
                currentPrice = res.price;
                dayChangePercent = res.changePercent;
                previousClose = res.previousClose;
                marketStatus = res.marketStatus;
                priceSource = 'Google Finance';
              } else if (asset.category === 'etf') {
                const t = asset.ticker.toUpperCase();
                const US_ETFS = ['SPY','QQQ','VOO','IVV','DIA','IWM','VTI','VEA','VWO','IEMG','EEM','GLD','SLV','AGG','BND','XLF','XLE','XLK','XLV','XLRE','XLI','XLU','XLB','XLP','XLY','TQQQ','SQQQ','ARKK','ARKG','ARKF','SCHD','JEPI','JEPQ','VIG','VYM','DVY','HDV','NOBL','VGT','SMH','SOXX','HACK','BOTZ','LIT','TAN','ICLN','KWEB'];
                const isUS = US_ETFS.includes(t);
                const res = await getStockQuote(asset.ticker, isUS);
                currentPrice = res.price;
                dayChangePercent = res.changePercent;
                previousClose = res.previousClose;
                marketStatus = res.marketStatus;
                priceSource = 'Google Finance';
              } else if (asset.category === 'crypto') {
                const sym = asset.ticker.toUpperCase();
                if (cryptoPrices[sym]) {
                  const data = cryptoPrices[sym];
                  currentPrice = asset.currency === 'USD' ? data.usdPrice : data.inrPrice;
                  dayChangePercent = asset.currency === 'USD' ? data.usdChange24h : data.inrChange24h;
                  previousClose = currentPrice / (1 + dayChangePercent / 100);
                  marketStatus = isMarketOpen(asset.ticker, asset.category);
                  priceSource = 'CoinGecko';
                }
              } else if (asset.category === 'mutual_fund') {
                const res = await getMutualFundNAV(asset.ticker);
                currentPrice = res.nav;
                previousClose = res.previousNav || res.nav;
                dayChangePercent = previousClose > 0 ? ((currentPrice - previousClose) / previousClose) * 100 : 0;
                marketStatus = isMarketOpen(asset.ticker, asset.category);
                priceSource = 'AMFI';
              } else if (asset.category === 'gold') {
                const tick = asset.ticker.toUpperCase();
                const otherCommodities = ['CRUDEOIL', 'BRENT', 'NATURALGAS', 'COPPER', 'PLATINUM', 'PALLADIUM', 'CRUDE', 'WTI', 'NATGAS'];
                if (otherCommodities.includes(tick)) {
                  const res = await getStockQuote(tick, true);
                  currentPrice = res.price;
                  dayChangePercent = res.changePercent;
                  previousClose = res.previousClose;
                  marketStatus = res.marketStatus;
                  priceSource = 'Google Finance';
                } else {
                  // Fetch global spot gold price (USD per troy ounce) from COMEX
                  const goldQuote = await getStockQuote('GOLD', true);
                  const spotPerGramUsd = goldQuote.price / 31.1034768; // Convert oz → gram
                  const spotPerGramInr = spotPerGramUsd * rate; // Convert USD → INR
                  // Indian retail markup: import duty + GST + premiums ≈ 13.5%
                  const gold24kPerGram = spotPerGramInr * 1.135;
                  
                  const spotPrevPerGramUsd = goldQuote.previousClose / 31.1034768;
                  const spotPrevPerGramInr = spotPrevPerGramUsd * rate;
                  const gold24kPrevPerGram = spotPrevPerGramInr * 1.135;

                  dayChangePercent = goldQuote.changePercent;
                  marketStatus = goldQuote.marketStatus;
                  priceSource = 'Google Finance';

                  if (tick === 'GOLD' || tick === 'GOLD_24K' || tick === 'DIGI_GOLD') {
                    currentPrice = gold24kPerGram;
                    previousClose = gold24kPrevPerGram;
                  } else if (tick === 'GOLD_22K') {
                    currentPrice = gold24kPerGram * 0.916; // 22K = 91.6% purity
                    previousClose = gold24kPrevPerGram * 0.916;
                  } else if (tick === 'SGB') {
                    currentPrice = gold24kPerGram * 0.98; // SGB ~2% secondary market discount
                    previousClose = gold24kPrevPerGram * 0.98;
                  } else if (tick === 'SILVER') {
                    const silverQuote = await getStockQuote('SILVER', true);
                    const silverPerGramInr = (silverQuote.price / 31.1034768) * rate * 1.135;
                    const silverPrevPerGramInr = (silverQuote.previousClose / 31.1034768) * rate * 1.135;
                    currentPrice = silverPerGramInr;
                    previousClose = silverPrevPerGramInr;
                    dayChangePercent = silverQuote.changePercent;
                    marketStatus = silverQuote.marketStatus;
                  } else {
                    currentPrice = gold24kPerGram; // Default to 24K for any unknown gold ticker
                    previousClose = gold24kPrevPerGram;
                  }
                }
              } else {
                const res = getSimulatedPrice(asset.ticker, asset.currency, asset.category);
                currentPrice = res.price;
                dayChangePercent = res.changePercent;
                previousClose = res.previousClose;
                marketStatus = res.marketStatus;
                priceSource = 'Simulation';
              }
            } catch (e) {
              console.error(`Failed to refresh price for ${asset.name}`, e);
            }
          }

          // Recalculate holding period
          const holdingDays = computeHoldingDays(asset.transactions);

          return {
            ...asset,
            currentPrice,
            holdingPeriodDays: holdingDays,
            dayChangePercent,
            previousClose,
            priceSource,
            marketStatus,
            lastUpdated: new Date().toISOString(),
          };
        })
      );

      // Now build the updated price sheet
      setPriceSheet(prev => {
        const tickerPriceMap: Record<string, number> = {};
        updatedAssets.forEach(a => {
          tickerPriceMap[normalizeTicker(a.ticker)] = a.currentPrice;
        });

        return prev.map(item => {
          const norm = normalizeTicker(item.ticker);
          if (item.isManual) return item; // Keep manual overrides
          if (tickerPriceMap[norm] !== undefined) {
            return {
              ...item,
              price: tickerPriceMap[norm],
              lastUpdated: new Date().toLocaleTimeString()
            };
          }
          return item;
        });
      });

      // Trigger automatic checks for watchlists & price alerts
      checkPriceAlerts(updatedAssets, rate);

      // Build a complete map of all enriched fields keyed by asset ID
      const enrichedMap: Record<string, {
        currentPrice: number;
        dayChangePercent: number;
        previousClose: number | undefined;
        priceSource: string;
        marketStatus: 'OPEN' | 'CLOSED';
        lastUpdated: string;
      }> = {};
      updatedAssets.forEach(a => {
        enrichedMap[a.id] = {
          currentPrice: a.currentPrice,
          dayChangePercent: a.dayChangePercent ?? 0,
          previousClose: a.previousClose,
          priceSource: a.priceSource || 'Manual Entry',
          marketStatus: a.marketStatus || 'CLOSED',
          lastUpdated: a.lastUpdated || new Date().toISOString(),
        };
      });

      // Update assets synchronously using latest state references — include ALL enriched fields
      setAssets(prev =>
        prev.map(asset => {
          const enriched = enrichedMap[asset.id];
          if (enriched) {
            return {
              ...asset,
              currentPrice: enriched.currentPrice,
              dayChangePercent: enriched.dayChangePercent,
              previousClose: enriched.previousClose,
              priceSource: enriched.priceSource,
              marketStatus: enriched.marketStatus,
              lastUpdated: enriched.lastUpdated,
              holdingPeriodDays: computeHoldingDays(asset.transactions),
            };
          }
          return asset;
        })
      );
    } catch (err) {
      console.error('Error refreshing price stream', err);
    } finally {
      setIsUpdatingPrices(false);
    }
  };

  // Check alert limits
  const checkPriceAlerts = (currentAssets: Asset[], currentRate: number) => {
    watchlists.forEach(watch => {
      // Find asset or simulation price
      let livePrice = 0;
      const matchingAsset = currentAssets.find(a => normalizeTicker(a.ticker) === normalizeTicker(watch.ticker));
      if (matchingAsset) {
        livePrice = matchingAsset.currentPrice;
      } else {
        const sim = getSimulatedPrice(watch.ticker, watch.currency);
        livePrice = sim.price;
      }

      if (watch.alertPriceUpper && livePrice >= watch.alertPriceUpper) {
        triggerAlert(
          'alert_upper_' + watch.ticker,
          'Watchlist Target Triggered',
          `${watch.name} (${watch.ticker}) hit upper target limit: ${watch.currency === 'USD' ? '$' : '₹'}${watch.alertPriceUpper}. Current: ${watch.currency === 'USD' ? '$' : '₹'}${livePrice.toFixed(2)}`,
          'success'
        );
      }
      if (watch.alertPriceLower && livePrice <= watch.alertPriceLower) {
        triggerAlert(
          'alert_lower_' + watch.ticker,
          'Watchlist Price Alert',
          `${watch.name} (${watch.ticker}) fell below lower limit: ${watch.currency === 'USD' ? '$' : '₹'}${watch.alertPriceLower}. Current: ${watch.currency === 'USD' ? '$' : '₹'}${livePrice.toFixed(2)}`,
          'critical'
        );
      }
    });
  };

  const triggerAlert = (id: string, title: string, message: string, type: SmartAlert['type']) => {
    setAlerts(prev => {
      // Don't add duplicate active alerts
      if (prev.some(a => a.id === id && !a.read)) return prev;
      return [
        {
          id,
          title,
          message,
          type,
          timestamp: new Date().toISOString(),
          read: false,
        },
        ...prev,
      ];
    });
  };

  // 5a. Fetch real news for portfolio assets and generate Smart Alerts
  const lastNewsFetchRef = useRef<number>(0);
  const NEWS_FETCH_INTERVAL = 15 * 60 * 1000; // 15 minutes

  const fetchNewsAlerts = async () => {
    if (status !== 'authenticated') return;
    const currentAssets = assetsRef.current;
    if (currentAssets.length === 0) return;

    // Throttle: only fetch every 5 minutes
    const now = Date.now();
    if (now - lastNewsFetchRef.current < NEWS_FETCH_INTERVAL) return;
    lastNewsFetchRef.current = now;

    try {
      // Build query params from ALL portfolio assets
      const allAssets = [...currentAssets]
        .sort((a, b) => (b.quantity * b.currentPrice) - (a.quantity * a.currentPrice));

      const tickers = allAssets.map(a => a.ticker).join(',');
      const names = allAssets.map(a => a.name).join(',');
      const categories = allAssets.map(a => a.category).join(',');

      const res = await fetch(`/api/news?tickers=${encodeURIComponent(tickers)}&names=${encodeURIComponent(names)}&categories=${encodeURIComponent(categories)}`);
      if (!res.ok) return;

      const { news } = await res.json();
      if (!news || !Array.isArray(news)) return;

      // News is already filtered to high-impact articles by the API
      // Filter to news from the last 24 hours
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recentNews = news.filter((item: any) => {
        const pubTime = new Date(item.pubDate).getTime();
        return !isNaN(pubTime) && pubTime > oneDayAgo;
      });

      // Generate alerts for the top 5 highest-impact news items
      // Remove old news alerts first, then add new ones
      setAlerts(prev => {
        // Keep non-news alerts (price alerts, rebalancing, etc.)
        const nonNewsAlerts = prev.filter(a => !a.id.startsWith('news_'));
        // Add new news alerts with impact-based type
        const newsAlerts: SmartAlert[] = recentNews.slice(0, 5).map((item: any) => {
          const impactType = item.impactType || 'neutral';
          const alertType: SmartAlert['type'] =
            impactType === 'negative' ? 'critical' :
            impactType === 'positive' ? 'success' : 'info';
          const icon = impactType === 'negative' ? '⚠️' : impactType === 'positive' ? '🚀' : '📰';
          return {
            id: item.id,
            title: `${icon} ${item.assetName}`,
            message: item.title,
            type: alertType,
            timestamp: item.pubDate || new Date().toISOString(),
            read: false,
            link: item.link || undefined,
          };
        });
        // News alerts go first, then existing non-news alerts
        return [...newsAlerts, ...nonNewsAlerts].slice(0, 30); // cap at 30 total
      });
    } catch (err) {
      console.error('Failed to fetch news alerts', err);
    }
  };

  // 5. Periodic Background Refresh
  useEffect(() => {
    if (!initialized) return;
    refreshPrices(); // Run on mount
    fetchNewsAlerts(); // Fetch news on mount

    const interval = setInterval(() => {
      refreshPrices();
    }, 60000); // 1 minute auto refresh

    // News fetch every 15 minutes (fetchNewsAlerts has its own throttle)
    const newsInterval = setInterval(() => {
      fetchNewsAlerts();
    }, 15 * 60 * 1000);

    return () => {
      clearInterval(interval);
      clearInterval(newsInterval);
    };
  }, [initialized]);

  // Asset CRUD operations
  const addAsset = (newAsset: Omit<Asset, 'id' | 'currentPrice' | 'transactions'> & { id?: string }) => {
    const tx: Transaction = {
      id: 'tx_' + Math.random().toString(36).substr(2, 9),
      type: 'BUY',
      quantity: newAsset.quantity,
      price: newAsset.avgBuyPrice,
      date: new Date().toISOString().split('T')[0]
    };

    setAssets(prev => {
      const normNewTicker = normalizeTicker(newAsset.ticker);
      const existingIndex = prev.findIndex(
        a => normalizeTicker(a.ticker) === normNewTicker && a.category === newAsset.category
      );

      if (existingIndex !== -1) {
        const next = [...prev];
        const existing = next[existingIndex];
        const totalQuantity = existing.quantity + newAsset.quantity;

        let newAvgPrice = existing.avgBuyPrice;
        if (totalQuantity > 0) {
          newAvgPrice = ((existing.quantity * existing.avgBuyPrice) + (newAsset.quantity * newAsset.avgBuyPrice)) / totalQuantity;
        }

        // Merge platforms (exchanges), tags, and notes
        const mergedExchanges = [existing.exchange, newAsset.exchange]
          .filter(Boolean)
          .filter((v, i, self) => self.indexOf(v) === i)
          .join(' / ');

        const mergedTags = Array.from(new Set([...existing.tags, ...newAsset.tags]));
        
        const mergedNotes = [existing.notes, newAsset.notes]
          .filter(Boolean)
          .filter((v, i, self) => self.indexOf(v) === i)
          .join('\n');

        next[existingIndex] = {
          ...existing,
          quantity: totalQuantity,
          avgBuyPrice: Number(newAvgPrice.toFixed(6)),
          exchange: mergedExchanges || undefined,
          tags: mergedTags,
          notes: mergedNotes,
          transactions: [...(existing.transactions || []), tx]
        };
        return next;
      } else {
        const id = newAsset.id || 'as_' + Math.random().toString(36).substr(2, 9);
        const initialPrice = newAsset.avgBuyPrice;

        const asset: Asset = {
          ...newAsset,
          id,
          currentPrice: initialPrice,
          transactions: [tx],
          holdingPeriodDays: 0
        };
        return [...prev, asset];
      }
    });

    // Add to virtual Price Sheet
    setPriceSheet(prev => {
      const normNewTicker = normalizeTicker(newAsset.ticker);
      if (prev.some(x => normalizeTicker(x.ticker) === normNewTicker)) return prev;
      return [
        ...prev,
        {
          ticker: newAsset.ticker.toUpperCase(),
          name: newAsset.name,
          price: newAsset.avgBuyPrice,
          currency: newAsset.currency,
          category: newAsset.category,
          lastUpdated: new Date().toLocaleTimeString(),
          isManual: false
        }
      ];
    });
  };

  const updateAsset = (id: string, updates: Partial<Asset>) => {
    setAssets(prev =>
      prev.map(asset => {
        if (asset.id === id) {
          const merged = { ...asset, ...updates };
          return merged;
        }
        return asset;
      })
    );

    // Sync updates back to Price Sheet if ticker/name changes
    if (updates.ticker || updates.name) {
      setAssets(prev => {
        const target = prev.find(x => x.id === id);
        if (target) {
          setPriceSheet(sheet =>
            sheet.map(item => {
              // Note: this is a simple sync, usually we only change non-tickers
              if (normalizeTicker(item.ticker) === normalizeTicker(target.ticker)) {
                return {
                  ...item,
                  name: target.name,
                  ticker: target.ticker
                };
              }
              return item;
            })
          );
        }
        return prev;
      });
    }
  };

  const deleteAsset = (id: string) => {
    setAssets(prev => prev.filter(asset => asset.id !== id));
  };

  const addTransaction = (assetId: string, txData: Omit<Transaction, 'id'>) => {
    const newTx: Transaction = {
      ...txData,
      id: 'tx_' + Math.random().toString(36).substr(2, 9),
    };

    setAssets(prev =>
      prev.map(asset => {
        if (asset.id === assetId) {
          const transactions = [...asset.transactions, newTx].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          );

          // Recalculate average buy price & net quantities
          let totalQty = 0;
          let totalCost = 0;
          let totalDiv = asset.dividendsEarned || 0;

          for (const t of transactions) {
            if (t.type === 'BUY') {
              totalQty += t.quantity;
              totalCost += t.quantity * t.price;
            } else if (t.type === 'SELL') {
              totalQty -= t.quantity;
              // Realized gains are not averaged back, quantity simply drops
            } else if (t.type === 'DIVIDEND') {
              totalDiv += t.price; // Dividend value stored in tx price field
            }
          }

          const avgBuyPrice = totalQty > 0 ? totalCost / totalQty : asset.avgBuyPrice;

          return {
            ...asset,
            quantity: Math.max(0, totalQty),
            avgBuyPrice,
            dividendsEarned: totalDiv,
            transactions,
          };
        }
        return asset;
      })
    );
  };

  const deleteTransaction = (assetId: string, txId: string) => {
    setAssets(prev =>
      prev.map(asset => {
        if (asset.id === assetId) {
          const transactions = asset.transactions.filter(t => t.id !== txId);
          // Recalculate totals
          let totalQty = 0;
          let totalCost = 0;
          for (const t of transactions) {
            if (t.type === 'BUY') {
              totalQty += t.quantity;
              totalCost += t.quantity * t.price;
            } else if (t.type === 'SELL') {
              totalQty -= t.quantity;
            }
          }
          const avgBuyPrice = totalQty > 0 ? totalCost / totalQty : asset.avgBuyPrice;
          return {
            ...asset,
            quantity: Math.max(0, totalQty),
            avgBuyPrice,
            transactions,
          };
        }
        return asset;
      })
    );
  };

  const addWatchlist = (item: Omit<WatchlistItem, 'id'>) => {
    const id = 'wl_' + Math.random().toString(36).substr(2, 9);
    setWatchlists(prev => [...prev, { ...item, id }]);
  };

  const deleteWatchlist = (id: string) => {
    setWatchlists(prev => prev.filter(w => w.id !== id));
  };

  const addGoal = (goal: Omit<Goal, 'id'>) => {
    const id = 'gl_' + Math.random().toString(36).substr(2, 9);
    setGoals(prev => [...prev, { ...goal, id }]);
  };

  const deleteGoal = (id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
  };

  const setCurrencyPref = (pref: 'INR' | 'USD' | 'BOTH') => {
    setCurrencyPrefState(pref);
  };

  const clearAlerts = () => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
  };

  const markAlertRead = (id: string) => {
    setAlerts(prev => prev.map(a => (a.id === id ? { ...a, read: true } : a)));
  };

  return (
    <PortfolioContext.Provider
      value={{
        assets,
        targetAllocation,
        watchlists,
        goals,
        alerts,
        currencyPref,
        usdInrRate,
        isUpdatingPrices,
        addAsset,
        updateAsset,
        deleteAsset,
        addTransaction,
        deleteTransaction,
        setTargetAllocation: setTargetAllocationState,
        addWatchlist,
        deleteWatchlist,
        addGoal,
        deleteGoal,
        setCurrencyPref,
        refreshPrices,
        clearAlerts,
        markAlertRead,
        googleSheetUrl,
        setGoogleSheetUrl: setGoogleSheetUrl,
        lastSyncTime,
        sheetSyncCount,
        priceSheet,
        updateSheetPrice: (ticker: string, price: number) => {
          const norm = normalizeTicker(ticker);
          setPriceSheet(prev =>
            prev.map(item => {
              if (normalizeTicker(item.ticker) === norm) {
                return {
                  ...item,
                  price,
                  isManual: true,
                  lastUpdated: new Date().toLocaleTimeString()
                };
              }
              return item;
            })
          );
          // Sync assets
          setAssets(prev =>
            prev.map(a => {
              if (normalizeTicker(a.ticker) === norm) {
                return { ...a, currentPrice: price };
              }
              return a;
            })
          );
        },
        resetSheetPrice: (ticker: string) => {
          const norm = normalizeTicker(ticker);
          setPriceSheet(prev =>
            prev.map(item => {
              if (normalizeTicker(item.ticker) === norm) {
                return {
                  ...item,
                  isManual: false,
                  lastUpdated: new Date().toLocaleTimeString()
                };
              }
              return item;
            })
          );
          // Trigger reload
          setTimeout(() => {
            refreshPrices();
          }, 50);
        },
        addSheetTicker: (item: Omit<PriceSheetItem, 'lastUpdated' | 'isManual'>) => {
          setPriceSheet(prev => {
            if (prev.some(x => normalizeTicker(x.ticker) === normalizeTicker(item.ticker))) return prev;
            return [
              ...prev,
              {
                ...item,
                lastUpdated: new Date().toLocaleTimeString(),
                isManual: true
              }
            ];
          });
        }
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
};

export const usePortfolio = () => {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
};
