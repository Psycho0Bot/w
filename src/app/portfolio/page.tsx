'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePortfolio, AssetCategory, Asset, Transaction } from '@/context/portfolioStore';
import { formatVal, calculateXIRR, getTradingViewUrl } from '@/services/financeUtils';
import GlassCard from '@/components/GlassCard';
import MetricCard from '@/components/MetricCard';
import {
  Search,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Info,
  DollarSign,
  Tag,
  BookOpen,
  Calendar,
  X,
  CreditCard,
  Building,
  Coins,
  History,
  Layers,
  AlertTriangle
} from 'lucide-react';

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  stock_in: 'Indian Stocks',
  stock_us: 'US Stocks',
  etf: 'ETFs',
  mutual_fund: 'Mutual Funds',
  crypto: 'Crypto',
  gold: 'Gold & Metals',
  fixed_income: 'Fixed Income & Debt',
  real_estate: 'Real Estate',
  cash: 'Cash & Savings',
};

export default function PortfolioPage() {
  const {
    assets,
    usdInrRate,
    currencyPref,
    addAsset,
    updateAsset,
    deleteAsset,
    addTransaction,
    deleteTransaction
  } = usePortfolio();

  const [activeTab, setActiveTab] = useState<AssetCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'value_desc' | 'value_asc' | 'pnl_desc' | 'pnl_asc' | 'day_desc' | 'day_asc' | 'name_asc' | 'name_desc'>('value_desc');
  const [filterPnl, setFilterPnl] = useState<'all' | 'gain' | 'loss'>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  
  // Dialog controls
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [selectedAssetForTx, setSelectedAssetForTx] = useState<Asset | null>(null);
  const [selectedAssetForHistory, setSelectedAssetForHistory] = useState<Asset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);

  // Form states - Add Asset
  const [newAssetCategory, setNewAssetCategory] = useState<AssetCategory>('stock_in');
  const [newAssetName, setNewAssetName] = useState('');
  const [newAssetTicker, setNewAssetTicker] = useState('');
  const [newAssetQty, setNewAssetQty] = useState('');
  const [newAssetBuyPrice, setNewAssetBuyPrice] = useState('');
  const [newAssetCurrency, setNewAssetCurrency] = useState<'INR' | 'USD'>('INR');
  const [newAssetExchange, setNewAssetExchange] = useState('');
  const [newAssetTags, setNewAssetTags] = useState('');
  const [newAssetNotes, setNewAssetNotes] = useState('');
  
  // Form states - Add Asset Extras
  const [extraInterest, setExtraInterest] = useState('');
  const [extraMaturity, setExtraMaturity] = useState('');
  const [extraRental, setExtraRental] = useState('');
  const [extraLoan, setExtraLoan] = useState('');
  const [extraSector, setExtraSector] = useState('');

  // Form states - Add Transaction
  const [txType, setTxType] = useState<'BUY' | 'SELL' | 'DIVIDEND'>('BUY');
  const [txQty, setTxQty] = useState('');
  const [txPrice, setTxPrice] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);

  // Adjust currency options based on category selection
  const handleCategoryChangeInForm = (category: AssetCategory) => {
    setNewAssetCategory(category);
    if (category === 'stock_us' || category === 'crypto') {
      setNewAssetCurrency('USD');
    } else {
      setNewAssetCurrency('INR');
    }
  };

  const handleAddAssetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssetName || !newAssetTicker || !newAssetQty || !newAssetBuyPrice) {
      alert('Please fill all required fields');
      return;
    }

    const tagsArray = newAssetTags
      ? newAssetTags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const extraObj: Record<string, any> = {};
    if (newAssetCategory === 'fixed_income') {
      if (extraInterest) extraObj.interestRate = parseFloat(extraInterest);
      if (extraMaturity) extraObj.maturityDate = extraMaturity;
    }
    if (newAssetCategory === 'real_estate') {
      extraObj.purchasePrice = parseFloat(newAssetBuyPrice);
      if (extraRental) extraObj.rentalIncome = parseFloat(extraRental);
      if (extraLoan) extraObj.loanRemaining = parseFloat(extraLoan);
    }
    if (extraSector) {
      extraObj.sector = extraSector;
    }

    addAsset({
      category: newAssetCategory,
      name: newAssetName,
      ticker: newAssetTicker.toUpperCase(),
      quantity: parseFloat(newAssetQty),
      avgBuyPrice: parseFloat(newAssetBuyPrice),
      currency: newAssetCurrency,
      exchange: newAssetExchange || undefined,
      tags: tagsArray,
      notes: newAssetNotes,
      extra: Object.keys(extraObj).length > 0 ? extraObj : undefined,
    });

    // Reset forms
    setIsAddAssetOpen(false);
    setNewAssetName('');
    setNewAssetTicker('');
    setNewAssetQty('');
    setNewAssetBuyPrice('');
    setNewAssetExchange('');
    setNewAssetTags('');
    setNewAssetNotes('');
    setExtraInterest('');
    setExtraMaturity('');
    setExtraRental('');
    setExtraLoan('');
    setExtraSector('');
  };

  const handleAddTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetForTx || !txQty || !txPrice || !txDate) {
      alert('Please enter valid details');
      return;
    }

    addTransaction(selectedAssetForTx.id, {
      type: txType,
      quantity: parseFloat(txQty),
      price: parseFloat(txPrice),
      date: txDate,
    });

    setSelectedAssetForTx(null);
    setTxQty('');
    setTxPrice('');
  };

  // Get unique price sources dynamically
  const uniqueSources = useMemo(() => {
    const sources = new Set<string>();
    assets.forEach((a) => {
      if (a.priceSource) {
        sources.add(a.priceSource);
      }
    });
    return Array.from(sources);
  }, [assets]);

  // Filter, Search, and Sort Assets
  const filteredAssets = useMemo(() => {
    let result = assets.filter((asset) => {
      const matchTab = activeTab === 'all' || asset.category === activeTab;
      
      const matchSearch =
        asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const cost = asset.quantity * asset.avgBuyPrice;
      const valuation = asset.quantity * asset.currentPrice;
      const pnl = valuation - cost;
      
      const matchPnl =
        filterPnl === 'all' ||
        (filterPnl === 'gain' && pnl >= 0) ||
        (filterPnl === 'loss' && pnl < 0);

      const matchSource =
        filterSource === 'all' ||
        asset.priceSource === filterSource;

      return matchTab && matchSearch && matchPnl && matchSource;
    });

    // Sort result
    result.sort((a, b) => {
      const valA = a.quantity * a.currentPrice * (a.currency === 'USD' ? usdInrRate : 1);
      const valB = b.quantity * b.currentPrice * (b.currency === 'USD' ? usdInrRate : 1);

      const costA = a.quantity * a.avgBuyPrice;
      const costB = b.quantity * b.avgBuyPrice;
      const pnlPctA = costA > 0 ? ((a.quantity * a.currentPrice - costA) / costA) * 100 : 0;
      const pnlPctB = costB > 0 ? ((b.quantity * b.currentPrice - costB) / costB) * 100 : 0;

      const dayA = a.dayChangePercent || 0;
      const dayB = b.dayChangePercent || 0;

      if (sortBy === 'value_desc') return valB - valA;
      if (sortBy === 'value_asc') return valA - valB;
      if (sortBy === 'pnl_desc') return pnlPctB - pnlPctA;
      if (sortBy === 'pnl_asc') return pnlPctA - pnlPctB;
      if (sortBy === 'day_desc') return dayB - dayA;
      if (sortBy === 'day_asc') return dayA - dayB;
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
      return 0;
    });

    return result;
  }, [assets, activeTab, searchQuery, filterPnl, filterSource, sortBy, usdInrRate]);

  // Calculate Portfolio / Category Totals for summary cards
  const categorySummary = useMemo(() => {
    let totalValUsd = 0;
    let totalValInr = 0;
    let totalInvestedUsd = 0;
    let totalInvestedInr = 0;
    
    const targetAssets = activeTab === 'all' 
      ? assets 
      : assets.filter(a => a.category === activeTab);

    targetAssets.forEach((asset) => {
      const curValue = asset.quantity * asset.currentPrice;
      const curValueUsd = asset.currency === 'USD' ? curValue : curValue / usdInrRate;
      const curValueInr = asset.currency === 'INR' ? curValue : curValue * usdInrRate;
      
      const invValue = asset.quantity * asset.avgBuyPrice;
      const invValueUsd = asset.currency === 'USD' ? invValue : invValue / usdInrRate;
      const invValueInr = asset.currency === 'INR' ? invValue : invValue * usdInrRate;

      totalValUsd += curValueUsd;
      totalValInr += curValueInr;
      totalInvestedUsd += invValueUsd;
      totalInvestedInr += invValueInr;
    });

    const absoluteProfitUsd = totalValUsd - totalInvestedUsd;
    const absoluteProfitInr = totalValInr - totalInvestedInr;
    const profitPercent = totalInvestedUsd > 0 ? (absoluteProfitUsd / totalInvestedUsd) * 100 : 0;

    const label = activeTab === 'all' ? 'All Holdings' : CATEGORY_LABELS[activeTab];

    // Calculate aggregated XIRR and CAGR for this category
    const aggregatedFlows: { amount: number; date: Date }[] = [];
    let oldestTimestamp = Infinity;

    targetAssets.forEach((asset) => {
      // 1. Convert historical transactions to INR
      asset.transactions.forEach((t) => {
        const cost = t.quantity * t.price;
        const costInr = asset.currency === 'INR' ? cost : cost * usdInrRate;
        aggregatedFlows.push({
          amount: t.type === 'BUY' ? -costInr : costInr,
          date: new Date(t.date),
        });

        const dTime = new Date(t.date).getTime();
        if (dTime < oldestTimestamp) {
          oldestTimestamp = dTime;
        }
      });

      // 2. Add current valuation as final hypothetical cash inflow
      const valuation = asset.quantity * asset.currentPrice;
      const valuationInr = asset.currency === 'INR' ? valuation : valuation * usdInrRate;
      if (valuationInr > 0) {
        aggregatedFlows.push({
          amount: valuationInr,
          date: new Date(),
        });
      }
    });

    const categoryXirr = calculateXIRR(aggregatedFlows) * 100;

    let categoryCagr = 0;
    if (oldestTimestamp !== Infinity && totalInvestedInr > 0 && totalValInr > 0) {
      const years = (new Date().getTime() - oldestTimestamp) / (1000 * 60 * 60 * 24 * 365.25);
      if (years > 0.05) { // Only calculate CAGR for holding periods over ~18 days
        categoryCagr = (Math.pow(totalValInr / totalInvestedInr, 1 / years) - 1) * 100;
      }
    }

    // Calculate actual today's P&L change based on yesterday's close price difference
    // CRITICAL: Only count change for assets whose market is OPEN
    let todayChangeUsd = 0;
    let todayChangeInr = 0;
    let isTodayDataComplete = targetAssets.length > 0;

    targetAssets.forEach((asset) => {
      if (asset.previousClose === undefined) {
        isTodayDataComplete = false;
        return;
      }
      // Skip assets whose market is closed — no change today
      if (asset.marketStatus === 'CLOSED') {
        return;
      }
      const changePerUnit = asset.currentPrice - asset.previousClose;
      const totalAssetChange = changePerUnit * asset.quantity;

      const changeUsd = asset.currency === 'USD' ? totalAssetChange : totalAssetChange / usdInrRate;
      const changeInr = asset.currency === 'INR' ? totalAssetChange : totalAssetChange * usdInrRate;

      todayChangeUsd += changeUsd;
      todayChangeInr += changeInr;
    });

    const yesterdayValUsd = totalValUsd - todayChangeUsd;
    const todayChangePercent = yesterdayValUsd > 0 && isTodayDataComplete
      ? (todayChangeUsd / yesterdayValUsd) * 100
      : 0;

    return {
      label,
      totalValUsd,
      totalValInr,
      totalInvestedUsd,
      totalInvestedInr,
      absoluteProfitUsd,
      absoluteProfitInr,
      profitPercent,
      categoryXirr,
      categoryCagr,
      todayChangePercent,
      todayChangeUsd,
      todayChangeInr,
      isTodayDataComplete,
    };
  }, [assets, activeTab, usdInrRate]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight font-heading">Asset Portfolio</h2>
          <p className="text-xs text-gray-400">Add transactions, manage metadata, and view return profiles.</p>
        </div>

        <button
          onClick={() => setIsAddAssetOpen(true)}
          className="glass-btn-primary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center self-start md:self-auto"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Add Asset
        </button>
      </div>

      {/* Category Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title={`${categorySummary.label} Value`}
          inrValue={categorySummary.totalValInr}
          usdValue={categorySummary.totalValUsd}
          extraLabel="Assets Count"
          extraValue={`${activeTab === 'all' ? assets.length : assets.filter(a => a.category === activeTab).length} items`}
        />

        <MetricCard
          title={`${categorySummary.label} Invested`}
          inrValue={categorySummary.totalInvestedInr}
          usdValue={categorySummary.totalInvestedUsd}
          extraLabel="Cost Basis"
          extraValue={
            currencyPref === 'USD'
              ? formatVal(categorySummary.totalInvestedUsd, 'USD', 0)
              : formatVal(categorySummary.totalInvestedInr, 'INR', 0)
          }
        />

        <MetricCard
          title="Today's Gain / Loss"
          inrValue={categorySummary.todayChangeInr}
          usdValue={categorySummary.todayChangeUsd}
          changePercent={categorySummary.todayChangePercent}
          extraLabel="Daily Trend"
          extraValue={categorySummary.todayChangePercent >= 0 ? 'Bullish' : 'Bearish'}
          isLoading={assets.length > 0 && !categorySummary.isTodayDataComplete}
        />

        <MetricCard
          title={`${categorySummary.label} P&L`}
          inrValue={categorySummary.absoluteProfitInr}
          usdValue={categorySummary.absoluteProfitUsd}
          changePercent={categorySummary.profitPercent}
          extraLabel="Returns"
          extraValue={`ROI: ${categorySummary.profitPercent >= 0 ? '+' : ''}${categorySummary.profitPercent.toFixed(1)}%${categorySummary.categoryCagr ? ` • CAGR: ${categorySummary.categoryCagr >= 0 ? '+' : ''}${categorySummary.categoryCagr.toFixed(1)}%` : ''}`}
        />
      </div>

      {/* Tabs list & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-white/5 pb-4">
        {/* Category filtering Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'all'
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/20 shadow-lg shadow-indigo-500/5'
                : 'text-gray-400 hover:text-white border border-transparent'
            }`}
          >
            All Holdings
          </button>
          {(Object.keys(CATEGORY_LABELS) as AssetCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeTab === cat
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/20 shadow-lg shadow-indigo-500/5'
                  : 'text-gray-400 hover:text-white border border-transparent'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Local Search input */}
        <div className="relative w-full lg:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search holdings, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs glass-input pl-9 pr-4 py-2 rounded-xl text-white placeholder-gray-500"
          />
        </div>
      </div>

      {/* Filters & Sorting Controls Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white/5 border border-white/10 p-3 rounded-2xl">
        {/* Sort By Dropdown */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-gray-400">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="bg-black/30 border border-white/10 rounded-xl px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="value_desc">Value: High to Low</option>
            <option value="value_asc">Value: Low to High</option>
            <option value="pnl_desc">P&L: High to Low</option>
            <option value="pnl_asc">P&L: Low to High</option>
            <option value="day_desc">24h Change: High to Low</option>
            <option value="day_asc">24h Change: Low to High</option>
            <option value="name_asc">Name: A to Z</option>
            <option value="name_desc">Name: Z to A</option>
          </select>
        </div>

        {/* P&L Performance Filter */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-gray-400">Performance:</span>
          <select
            value={filterPnl}
            onChange={(e: any) => setFilterPnl(e.target.value)}
            className="bg-black/30 border border-white/10 rounded-xl px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="gain">Profitable (Gain)</option>
            <option value="loss">In Loss (Loss)</option>
          </select>
        </div>

        {/* Price Source Filter */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-gray-400">Price Source:</span>
          <select
            value={filterSource}
            onChange={(e: any) => setFilterSource(e.target.value)}
            className="bg-black/30 border border-white/10 rounded-xl px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">All Sources</option>
            {uniqueSources.map(src => (
              <option key={src} value={src}>{src}</option>
            ))}
          </select>
        </div>

        {/* Reset Filters button */}
        {(searchQuery || filterPnl !== 'all' || filterSource !== 'all') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setFilterPnl('all');
              setFilterSource('all');
            }}
            className="lg:ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl transition-all font-semibold"
          >
            <X className="w-3.5 h-3.5" /> Clear Filters
          </button>
        )}
      </div>

      {/* Assets Grid / Tables */}
      <div className="space-y-4">
        {filteredAssets.length === 0 ? (
          <GlassCard className="text-center py-16 text-gray-500 text-sm">
            No assets found matching the filter criteria. Click "Add Asset" to insert one.
          </GlassCard>
        ) : (
          filteredAssets.map((asset) => {
            const valuation = asset.quantity * asset.currentPrice;
            const valuationUsd = asset.currency === 'USD' ? valuation : valuation / usdInrRate;
            const valuationInr = asset.currency === 'INR' ? valuation : valuation * usdInrRate;

            const cost = asset.quantity * asset.avgBuyPrice;
            const pnl = valuation - cost;
            const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
            const isGain = pnl >= 0;


            return (
              <GlassCard key={asset.id} className="relative overflow-hidden group" hoverEffect={false}>
                {/* Visual Category Stripe Indicator */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                    asset.category === 'stock_us'
                      ? 'bg-blue-500'
                      : asset.category === 'stock_in'
                      ? 'bg-cyan-500'
                      : asset.category === 'etf'
                      ? 'bg-fuchsia-500'
                      : asset.category === 'crypto'
                      ? 'bg-violet-500'
                      : asset.category === 'gold'
                      ? 'bg-amber-500'
                      : asset.category === 'mutual_fund'
                      ? 'bg-indigo-500'
                      : 'bg-slate-500'
                  }`}
                />

                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pl-2">
                  {/* Left: Asset details & tags */}
                  <div className="space-y-2 max-w-md">
                    <div className="flex items-center space-x-3">
                      <a 
                        href={getTradingViewUrl(asset.ticker, asset.category, asset.exchange)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-extrabold text-lg text-white leading-tight hover:text-indigo-400 hover:underline transition-all cursor-pointer flex items-center gap-1"
                      >
                        {asset.name}
                      </a>
                      <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full font-bold text-gray-400">
                        {asset.ticker}
                      </span>
                      {asset.exchange && (
                        <span className="text-[10px] text-gray-500 font-semibold">{asset.exchange}</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 font-semibold text-gray-400 border border-white/5">
                        {CATEGORY_LABELS[asset.category]}
                      </span>
                      {asset.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 font-semibold border border-indigo-500/10 flex items-center"
                        >
                          <Tag className="w-2.5 h-2.5 mr-1" /> {tag}
                        </span>
                      ))}
                    </div>

                    {asset.notes && (
                      <p className="text-[11px] text-gray-500 italic max-w-sm flex items-center">
                        <BookOpen className="w-3 h-3 mr-1 shrink-0" /> {asset.notes}
                      </p>
                    )}
                  </div>

                  {/* Middle: Metrics details */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 xl:gap-8 flex-1">
                    {/* Qty & Buy Price */}
                    <div>
                      <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Holding</p>
                      <p className="text-sm font-bold text-white mt-0.5">
                        {asset.quantity.toFixed(asset.category === 'crypto' ? 4 : 2)}{' '}
                        <span className="text-xs text-gray-400 font-medium">
                          {asset.category === 'gold' ? 'grams' : 'units'}
                        </span>
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        Avg: {formatVal(asset.avgBuyPrice, asset.currency, 2)}{asset.category === 'gold' ? ' /g' : ''}
                      </p>
                    </div>

                    {/* Current Quote */}
                    <div>
                      <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Live Price</p>
                      <p className="text-sm font-bold text-white mt-0.5">
                        {formatVal(asset.currentPrice, asset.currency, 2)}{asset.category === 'gold' ? ' /g' : ''}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">Live streaming</p>
                    </div>

                    {/* 24h Change */}
                    <div>
                      <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">24h Change</p>
                      {asset.previousClose === undefined ? (
                        <div className="text-sm font-semibold text-gray-400 mt-1">—</div>
                      ) : (
                        <div className="flex items-center space-x-1.5 mt-0.5">
                          {(asset.dayChangePercent || 0) >= 0 ? (
                            <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-rose-400 shrink-0" />
                          )}
                          <span className={`text-sm font-bold ${(asset.dayChangePercent || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {(asset.dayChangePercent || 0) >= 0 ? '+' : ''}
                            {(asset.dayChangePercent || 0).toFixed(2)}%
                          </span>
                        </div>
                      )}
                      <p className="text-[10px] text-gray-500 mt-0.5">24h price change</p>
                    </div>

                    {/* Valuation (INR & USD) */}
                    <div>
                      <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Total Value</p>
                      <div className="space-y-0.5 mt-0.5">
                        {currencyPref === 'INR' && (
                          <p className="text-sm font-bold text-white">{formatVal(valuationInr, 'INR', 0)}</p>
                        )}
                        {currencyPref === 'USD' && (
                          <p className="text-sm font-bold text-white">{formatVal(valuationUsd, 'USD', 0)}</p>
                        )}
                        {currencyPref === 'BOTH' && (
                          <>
                            <p className="text-sm font-bold text-white">{formatVal(valuationInr, 'INR', 0)}</p>
                            <p className="text-xs text-gray-400">{formatVal(valuationUsd, 'USD', 0)}</p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* P&L & ROI */}
                    <div>
                      <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">P&L (ROI)</p>
                      <div className="flex items-center space-x-1.5 mt-0.5">
                        {isGain ? (
                          <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span className={`text-sm font-bold ${isGain ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isGain ? '+' : ''}
                          {pnlPercent.toFixed(1)}%
                        </span>
                      </div>
                      {asset.holdingPeriodDays !== undefined && (
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          <span>Holding Period: {asset.holdingPeriodDays}d</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center space-x-2.5 self-end xl:self-center border-t border-white/5 pt-4 xl:border-0 xl:pt-0">
                    <Link
                      href={`/portfolio/${asset.id}`}
                      className="glass-btn px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center hover:bg-white/10 text-indigo-300 border border-indigo-500/20"
                      title="Open Asset Workspace"
                    >
                      <Layers className="w-3.5 h-3.5 mr-1" /> Workspace
                    </Link>

                    <button
                      onClick={() => setSelectedAssetForTx(asset)}
                      className="glass-btn px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center hover:bg-white/10"
                      title="Log Transaction"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Trade
                    </button>
                    
                    <button
                      onClick={() => setSelectedAssetForHistory(asset)}
                      className="glass-btn p-2 rounded-xl text-gray-400 hover:text-white"
                      title="Transaction History"
                    >
                      <History className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setAssetToDelete(asset)}
                      className="p-2 rounded-xl text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors border border-transparent"
                      title="Delete Asset"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Extra category details like FD Maturity or Real Estate Debt */}
                {asset.extra && (
                  <div className="mt-4 pt-3 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-4 text-[11px] text-gray-400">
                    {asset.extra.interestRate !== undefined && (
                      <div>
                        <span className="text-gray-500">Interest rate:</span>{' '}
                        <span className="font-semibold text-white">{asset.extra.interestRate}%</span>
                      </div>
                    )}
                    {asset.extra.maturityDate && (
                      <div>
                        <span className="text-gray-500">Maturity date:</span>{' '}
                        <span className="font-semibold text-white">{asset.extra.maturityDate}</span>
                      </div>
                    )}
                    {asset.extra.rentalIncome !== undefined && (
                      <div>
                        <span className="text-gray-500">Monthly Rent:</span>{' '}
                        <span className="font-semibold text-emerald-400">
                          {formatVal(asset.extra.rentalIncome, asset.currency, 0)}
                        </span>
                      </div>
                    )}
                    {asset.extra.loanRemaining !== undefined && (
                      <div>
                        <span className="text-gray-500">Loan Remaining:</span>{' '}
                        <span className="font-semibold text-rose-400">
                          {formatVal(asset.extra.loanRemaining, asset.currency, 0)}
                        </span>
                      </div>
                    )}
                    {asset.extra.sector && (
                      <div>
                        <span className="text-gray-500">Sector:</span>{' '}
                        <span className="font-semibold text-white">{asset.extra.sector}</span>
                      </div>
                    )}
                    {asset.extra.country && (
                      <div>
                        <span className="text-gray-500">Country:</span>{' '}
                        <span className="font-semibold text-white">{asset.extra.country}</span>
                      </div>
                    )}
                  </div>
                )}
              </GlassCard>
            );
          })
        )}
      </div>

      {/* Dialog: Add Asset Modal */}
      {isAddAssetOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-xl max-h-[90vh] overflow-y-auto no-scrollbar border border-white/10 shadow-2xl space-y-6" hoverEffect={false}>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-lg font-bold text-white">Create Asset Entry</h3>
              <button
                onClick={() => setIsAddAssetOpen(false)}
                className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAssetSubmit} className="space-y-4 text-xs">
              {/* Category Select */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold uppercase">Category</label>
                  <select
                    value={newAssetCategory}
                    onChange={(e) => handleCategoryChangeInForm(e.target.value as AssetCategory)}
                    className="w-full glass-input rounded-xl px-3 py-2 text-white bg-slate-900 border border-white/10"
                  >
                    {(Object.keys(CATEGORY_LABELS) as AssetCategory[]).map((cat) => (
                      <option key={cat} value={cat} className="bg-slate-950">
                        {CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold uppercase">Currency</label>
                  <select
                    value={newAssetCurrency}
                    onChange={(e) => setNewAssetCurrency(e.target.value as 'INR' | 'USD')}
                    className="w-full glass-input rounded-xl px-3 py-2 text-white bg-slate-900 border border-white/10"
                  >
                    <option value="INR" className="bg-slate-950">INR (₹)</option>
                    <option value="USD" className="bg-slate-950">USD ($)</option>
                  </select>
                </div>
              </div>

              {/* Name & Ticker */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold uppercase">Asset Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apple Inc. / Reliance"
                    value={newAssetName}
                    onChange={(e) => setNewAssetName(e.target.value)}
                    className="w-full glass-input rounded-xl px-3 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold uppercase">Ticker / Scheme Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AAPL / 119063 / BTC"
                    value={newAssetTicker}
                    onChange={(e) => setNewAssetTicker(e.target.value)}
                    className="w-full glass-input rounded-xl px-3 py-2"
                  />
                </div>
              </div>

               {/* Qty & Price */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold uppercase">
                    {newAssetCategory === 'gold' ? 'Holding Quantity (Grams) *' : 'Holding Quantity *'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder={newAssetCategory === 'gold' ? 'e.g. 15.5' : 'e.g. 10'}
                    value={newAssetQty}
                    onChange={(e) => setNewAssetQty(e.target.value)}
                    className="w-full glass-input rounded-xl px-3 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold uppercase">
                    {newAssetCategory === 'gold' ? 'Average Buy Price (per gram) *' : 'Average Buy Price *'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder={newAssetCategory === 'gold' ? 'e.g. 14449' : 'e.g. 150'}
                    value={newAssetBuyPrice}
                    onChange={(e) => setNewAssetBuyPrice(e.target.value)}
                    className="w-full glass-input rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              {/* Tags & Exchange */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold uppercase">Exchange / Platform</label>
                  <input
                    type="text"
                    placeholder="e.g. NSE / NASDAQ / Binance"
                    value={newAssetExchange}
                    onChange={(e) => setNewAssetExchange(e.target.value)}
                    className="w-full glass-input rounded-xl px-3 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold uppercase">Tags (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Growth, Tech, Index"
                    value={newAssetTags}
                    onChange={(e) => setNewAssetTags(e.target.value)}
                    className="w-full glass-input rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              {/* Extra Category Fields */}
              {newAssetCategory === 'fixed_income' && (
                <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-3">
                  <div className="space-y-1">
                    <label className="text-gray-400 font-semibold uppercase">Interest Rate (%)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 7.1"
                      value={extraInterest}
                      onChange={(e) => setExtraInterest(e.target.value)}
                      className="w-full glass-input rounded-xl px-3 py-2"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-gray-400 font-semibold uppercase">Maturity Date</label>
                    <input
                      type="date"
                      value={extraMaturity}
                      onChange={(e) => setExtraMaturity(e.target.value)}
                      className="w-full glass-input rounded-xl px-3 py-2 text-gray-400 focus:text-white"
                    />
                  </div>
                </div>
              )}

              {newAssetCategory === 'real_estate' && (
                <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-3">
                  <div className="space-y-1">
                    <label className="text-gray-400 font-semibold uppercase">Monthly Rental Income</label>
                    <input
                      type="number"
                      placeholder="e.g. 25000"
                      value={extraRental}
                      onChange={(e) => setExtraRental(e.target.value)}
                      className="w-full glass-input rounded-xl px-3 py-2"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-gray-400 font-semibold uppercase">Loan Outstanding</label>
                    <input
                      type="number"
                      placeholder="e.g. 3000000"
                      value={extraLoan}
                      onChange={(e) => setExtraLoan(e.target.value)}
                      className="w-full glass-input rounded-xl px-3 py-2"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 border-t border-white/5 pt-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-gray-400 font-semibold uppercase">Sector / Type</label>
                    <input
                      type="text"
                      placeholder="e.g. Technology / Large Cap"
                      value={extraSector}
                      onChange={(e) => setExtraSector(e.target.value)}
                      className="w-full glass-input rounded-xl px-3 py-2"
                    />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold uppercase">Description / Notes</label>
                  <textarea
                    placeholder="Short summary notes about this asset..."
                    value={newAssetNotes}
                    onChange={(e) => setNewAssetNotes(e.target.value)}
                    className="w-full glass-input rounded-xl px-3 py-2 h-16 resize-none"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsAddAssetOpen(false)}
                  className="glass-btn px-4 py-2 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="glass-btn-primary px-5 py-2 rounded-xl font-bold"
                >
                  Create Asset
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Dialog: Log Trade (Transaction) Modal */}
      {selectedAssetForTx && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-md border border-white/10 shadow-2xl space-y-5" hoverEffect={false}>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">Log Transaction</h3>
                <p className="text-[10px] text-gray-500 font-semibold">{selectedAssetForTx.name} ({selectedAssetForTx.ticker})</p>
              </div>
              <button
                onClick={() => setSelectedAssetForTx(null)}
                className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTxSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-gray-400 font-semibold uppercase">Action Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['BUY', 'SELL', 'DIVIDEND'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTxType(type)}
                      className={`py-2 rounded-xl font-bold border transition-all text-center ${
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
                  <label className="text-gray-400 font-semibold uppercase">
                    {txType === 'DIVIDEND' ? 'Total Amount' : 'Quantity'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder={txType === 'DIVIDEND' ? 'Total Div Paid' : 'e.g. 5'}
                    value={txQty}
                    onChange={(e) => setTxQty(e.target.value)}
                    className="w-full glass-input rounded-xl px-3 py-2"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-gray-400 font-semibold uppercase">
                    {txType === 'DIVIDEND' ? 'Value per share' : `Price (in ${selectedAssetForTx.currency})`}
                  </label>
                  <input
                    type="number"
                    step="any"
                    required={txType !== 'DIVIDEND'}
                    placeholder="e.g. 155.2"
                    value={txPrice}
                    onChange={(e) => setTxPrice(e.target.value)}
                    className="w-full glass-input rounded-xl px-3 py-2"
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
                  className="w-full glass-input rounded-xl px-3 py-2 text-gray-400 focus:text-white"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setSelectedAssetForTx(null)}
                  className="glass-btn px-4 py-2 rounded-xl font-bold"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="glass-btn-primary px-5 py-2 rounded-xl font-bold"
                >
                  Log Action
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Dialog: Transaction History Modal */}
      {selectedAssetForHistory && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-xl max-h-[80vh] overflow-y-auto border border-white/10 shadow-2xl space-y-4" hoverEffect={false}>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">Transaction Logs</h3>
                <p className="text-[10px] text-gray-500 font-semibold">{selectedAssetForHistory.name} ({selectedAssetForHistory.ticker})</p>
              </div>
              <button
                onClick={() => setSelectedAssetForHistory(null)}
                className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-x-auto no-scrollbar text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-gray-500 uppercase tracking-wider font-semibold border-b border-white/5">
                    <th className="py-2.5">Date</th>
                    <th className="py-2.5">Action</th>
                    <th className="py-2.5 text-right">Quantity</th>
                    <th className="py-2.5 text-right">Price ({selectedAssetForHistory.currency})</th>
                    <th className="py-2.5 text-right">Total</th>
                    <th className="py-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {selectedAssetForHistory.transactions.map((tx) => {
                    const total = tx.quantity * tx.price;
                    return (
                      <tr key={tx.id} className="text-gray-300 hover:text-white">
                        <td className="py-2.5 font-medium">{tx.date}</td>
                        <td className="py-2.5 font-semibold">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] ${
                              tx.type === 'BUY'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                                : tx.type === 'SELL'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/10'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/10'
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">{tx.quantity.toFixed(selectedAssetForHistory.category === 'crypto' ? 4 : 2)}</td>
                        <td className="py-2.5 text-right">{formatVal(tx.price, selectedAssetForHistory.currency, 2)}</td>
                        <td className="py-2.5 text-right font-bold">{formatVal(total, selectedAssetForHistory.currency, 2)}</td>
                        <td className="py-2.5 text-center">
                          {selectedAssetForHistory.transactions.length > 1 ? (
                            <button
                              onClick={() => deleteTransaction(selectedAssetForHistory.id, tx.id)}
                              className="text-gray-500 hover:text-rose-400 p-1"
                              title="Delete Transaction"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-[9px] text-gray-500 italic">Initial</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Dialog: Delete Confirmation Modal */}
      {assetToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-sm border border-white/10 shadow-2xl space-y-5 text-center p-6" hoverEffect={false}>
            <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Delete Asset?</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Are you sure you want to permanently delete <strong className="text-white">{assetToDelete.name}</strong> ({assetToDelete.ticker})? This will erase all its transaction logs and history.
              </p>
            </div>

            <div className="flex items-center justify-center space-x-3 pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => setAssetToDelete(null)}
                className="w-1/2 glass-btn py-2.5 rounded-xl font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteAsset(assetToDelete.id);
                  setAssetToDelete(null);
                }}
                className="w-1/2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 hover:border-rose-500/40 text-rose-300 hover:text-white py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                Delete permanently
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
