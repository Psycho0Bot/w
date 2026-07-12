'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { usePortfolio, Asset } from '@/context/portfolioStore';
import { formatVal, calculateXIRR, calculateCAGR } from '@/services/financeUtils';
import MetricCard from '@/components/MetricCard';
import AssetPieChart from '@/components/AssetPieChart';
import PerformanceChart from '@/components/PerformanceChart';
import GlassCard from '@/components/GlassCard';
import TradingViewWidget from '@/components/TradingViewWidget';
import Link from 'next/link';
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Award,
  AlertCircle,
  Plus,
  ArrowLeftRight,
  ChevronUp,
  ChevronDown,
  ArrowRight,
  Eye,
  Settings,
  X,
  Trash2,
  Newspaper
} from 'lucide-react';

type WidgetKey = 'performance' | 'allocation' | 'goals' | 'watchlist' | 'alerts';

export default function DashboardPage() {
  const {
    assets,
    usdInrRate,
    currencyPref,
    goals,
    alerts,
    watchlists,
    isUpdatingPrices,
    addGoal,
    deleteGoal
  } = usePortfolio();

  // Add Goal states
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalCategory, setGoalCategory] = useState('other');
  const [goalTargetAmount, setGoalTargetAmount] = useState('');
  const [goalTargetCurrency, setGoalTargetCurrency] = useState<'USD' | 'INR'>('INR');
  const [goalCurrentAmount, setGoalCurrentAmount] = useState('');
  const [goalCurrentCurrency, setGoalCurrentCurrency] = useState<'USD' | 'INR'>('INR');
  const [goalTargetDate, setGoalTargetDate] = useState('');

  const handleAddGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalName || !goalTargetAmount || !goalCurrentAmount || !goalTargetDate) {
      alert('Please fill in all fields');
      return;
    }

    const rawTarget = parseFloat(goalTargetAmount);
    const rawCurrent = parseFloat(goalCurrentAmount);
    if (isNaN(rawTarget) || isNaN(rawCurrent)) {
      alert('Please enter valid numeric amounts');
      return;
    }

    // Convert values to USD for store compatibility
    const targetInUsd = goalTargetCurrency === 'USD' ? rawTarget : rawTarget / usdInrRate;
    const currentInUsd = goalCurrentCurrency === 'USD' ? rawCurrent : rawCurrent / usdInrRate;

    addGoal({
      name: goalName,
      category: goalCategory,
      targetAmount: targetInUsd,
      currentAmount: currentInUsd,
      targetDate: goalTargetDate
    });

    // Reset state & close
    setGoalName('');
    setGoalCategory('other');
    setGoalTargetAmount('');
    setGoalCurrentAmount('');
    setGoalTargetDate('');
    setIsAddGoalOpen(false);
  };

  // Widget ordering state for rearranging widgets
  const [widgetOrder, setWidgetOrder] = useState<WidgetKey[]>([
    'performance',
    'allocation',
    'goals',
    'watchlist',
    'alerts',
  ]);

  // Move widget helper
  const moveWidget = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= widgetOrder.length) return;
    
    const newOrder = [...widgetOrder];
    const temp = newOrder[index];
    newOrder[index] = newOrder[nextIndex];
    newOrder[nextIndex] = temp;
    setWidgetOrder(newOrder);
  };

  // 1. Calculate Portfolio Totals
  const portfolioCalculations = useMemo(() => {
    let totalValueUsd = 0;
    let totalValueInr = 0;
    let totalInvestedUsd = 0;
    let totalInvestedInr = 0;
    let totalDividendsUsd = 0;
    let totalDividendsInr = 0;
    
    let combinedCashFlows: { amount: number; date: Date }[] = [];
    let earliestDate = new Date();
    let hasTransactions = false;

    // Loop through assets to accumulate totals
    assets.forEach((asset) => {
      const curValue = asset.quantity * asset.currentPrice;
      const curValueUsd = asset.currency === 'USD' ? curValue : curValue / usdInrRate;
      const curValueInr = asset.currency === 'INR' ? curValue : curValue * usdInrRate;
      
      const invValue = asset.quantity * asset.avgBuyPrice;
      const invValueUsd = asset.currency === 'USD' ? invValue : invValue / usdInrRate;
      const invValueInr = asset.currency === 'INR' ? invValue : invValue * usdInrRate;

      const divValue = asset.dividendsEarned || 0;
      const divValueUsd = asset.currency === 'USD' ? divValue : divValue / usdInrRate;
      const divValueInr = asset.currency === 'INR' ? divValue : divValue * usdInrRate;

      totalValueUsd += curValueUsd;
      totalValueInr += curValueInr;
      totalInvestedUsd += invValueUsd;
      totalInvestedInr += invValueInr;
      totalDividendsUsd += divValueUsd;
      totalDividendsInr += divValueInr;

      // Consolidate cash flows for portfolio-wide XIRR
      asset.transactions.forEach((tx) => {
        hasTransactions = true;
        const txAmt = tx.quantity * tx.price;
        const txAmtUsd = asset.currency === 'USD' ? txAmt : txAmt / usdInrRate;
        
        // Buy is cash outflow (-), Sell is cash inflow (+)
        combinedCashFlows.push({
          amount: tx.type === 'BUY' ? -txAmtUsd : txAmtUsd,
          date: new Date(tx.date),
        });

        const txDate = new Date(tx.date);
        if (txDate < earliestDate) {
          earliestDate = txDate;
        }
      });

      // Add current asset value as hypothetical final sale today
      if (curValueUsd > 0) {
        combinedCashFlows.push({
          amount: curValueUsd,
          date: new Date(),
        });
      }
    });

    // Calculate actual today's P&L change based on yesterday's close price difference
    // CRITICAL: Only count change for assets whose market is OPEN
    // When market is CLOSED (weekends/holidays), day change must be 0
    let todayChangeUsd = 0;
    let todayChangeInr = 0;
    let isTodayDataComplete = assets.length > 0;

    assets.forEach((asset) => {
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

    const yesterdayValUsd = totalValueUsd - todayChangeUsd;
    const todayChangePercent = yesterdayValUsd > 0 && isTodayDataComplete
      ? (todayChangeUsd / yesterdayValUsd) * 100
      : 0;

    // Absolute return
    const absoluteProfitUsd = totalValueUsd - totalInvestedUsd;
    const absoluteProfitInr = totalValueInr - totalInvestedInr;
    const profitPercent = totalInvestedUsd > 0 ? (absoluteProfitUsd / totalInvestedUsd) * 100 : 0;

    // CAGR & XIRR calculation
    const years = hasTransactions
      ? (new Date().getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
      : 1;

    const portfolioXirr = calculateXIRR(combinedCashFlows);
    const portfolioCagr = calculateCAGR(totalInvestedUsd, totalValueUsd, Math.max(0.1, years));

    return {
      totalValueUsd,
      totalValueInr,
      todayChangeUsd,
      todayChangeInr,
      todayChangePercent,
      absoluteProfitUsd,
      absoluteProfitInr,
      profitPercent,
      portfolioXirr: portfolioXirr * 100,
      portfolioCagr: portfolioCagr * 100,
      totalInvestedInr,
      totalInvestedUsd,
      isTodayDataComplete,
    };
  }, [assets, usdInrRate]);

  // Dynamic prefill effect for Current Saved amount defaulting to total portfolio value
  useEffect(() => {
    if (isAddGoalOpen) {
      const defaultVal = goalCurrentCurrency === 'USD' 
        ? portfolioCalculations.totalValueUsd 
        : portfolioCalculations.totalValueInr;
      setGoalCurrentAmount(Math.round(defaultVal).toString());
    }
  }, [isAddGoalOpen, goalCurrentCurrency, portfolioCalculations.totalValueUsd, portfolioCalculations.totalValueInr]);

  // Widget rendering mapper
  const renderWidget = (key: WidgetKey, index: number) => {
    const controls = (
      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => moveWidget(index, 'up')}
          disabled={index === 0}
          className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-30"
          title="Move Widget Up"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => moveWidget(index, 'down')}
          disabled={index === widgetOrder.length - 1}
          className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-30"
          title="Move Widget Down"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    );

    switch (key) {
      case 'performance':
        return (
          <div key={key} className="group relative col-span-1 lg:col-span-2">
            <div className="absolute right-4 top-4 z-20 flex items-center space-x-2">
              {controls}
            </div>
            <PerformanceChart />
          </div>
        );

      case 'allocation':
        return (
          <div key={key} className="group relative col-span-1">
            <div className="absolute right-4 top-4 z-20 flex items-center space-x-2">
              {controls}
            </div>
            <AssetPieChart />
          </div>
        );

      case 'goals':
        return (
          <GlassCard key={key} className="group relative h-full flex flex-col justify-between" hoverEffect={true}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-400 tracking-wide uppercase">Goal Mapping</h3>
              <div className="flex items-center space-x-2">
                {controls}
                <button
                  onClick={() => setIsAddGoalOpen(true)}
                  className="text-xs text-indigo-400 hover:underline flex items-center bg-transparent border-none cursor-pointer"
                >
                  Add Goal <Plus className="w-3 h-3 ml-0.5" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {goals.length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-xs">No active goals configured.</div>
              ) : (
                goals.map((g) => {
                  const percent = Math.min(100, (g.currentAmount / g.targetAmount) * 100);
                  const inrCurrent = g.currentAmount * usdInrRate;
                  const inrTarget = g.targetAmount * usdInrRate;
                  return (
                    <div key={g.id} className="space-y-1.5 border-b border-white/5 pb-3 last:border-0 last:pb-0 group/goal relative">
                      <div className="flex justify-between text-xs items-center">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-gray-300">{g.name}</span>
                          <button
                            onClick={() => deleteGoal(g.id)}
                            className="opacity-0 group-hover/goal:opacity-100 p-0.5 text-gray-500 hover:text-rose-400 transition-all rounded bg-transparent border-none cursor-pointer"
                            title="Delete Goal"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-gray-400">{percent.toFixed(0)}%</span>
                      </div>
                      
                      {/* Bar indicator */}
                      <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden border border-white/5">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[10px] text-gray-500">
                        <span>
                          {currencyPref === 'USD'
                            ? formatVal(g.currentAmount, 'USD', 0)
                            : formatVal(inrCurrent, 'INR', 0)}
                        </span>
                        <span>
                          Target:{' '}
                          {currencyPref === 'USD'
                            ? formatVal(g.targetAmount, 'USD', 0)
                            : formatVal(inrTarget, 'INR', 0)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </GlassCard>
        );

      case 'watchlist':
        return (
          <GlassCard key={key} className="group relative h-full flex flex-col justify-between" hoverEffect={true}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-400 tracking-wide uppercase">Watchlist Widgets</h3>
              <div className="flex items-center space-x-2">
                {controls}
                <Link href="/watchlist" className="text-xs text-indigo-400 hover:underline flex items-center">
                  Configure <Eye className="w-3 h-3 ml-0.5" />
                </Link>
              </div>
            </div>

            <div className="space-y-3 flex-1 flex flex-col justify-center">
              {watchlists.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-xs">Watchlist empty.</div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5 h-full">
                  {/* Render mini tradingview symbol or lists */}
                  <div className="h-32 rounded-xl overflow-hidden">
                    <TradingViewWidget symbol={`NASDAQ:${watchlists[0]?.ticker || 'AAPL'}`} />
                  </div>
                  <div className="flex justify-between items-center text-xs px-2.5 py-1.5 bg-white/5 rounded-xl border border-white/5">
                    <div>
                      <span className="font-semibold text-white">{watchlists[0]?.name}</span>
                      <span className="text-[10px] text-gray-500 ml-1.5">{watchlists[0]?.ticker}</span>
                    </div>
                    <span className="text-emerald-400 font-semibold flex items-center">
                      Live Quote <ArrowUpRight className="w-3 h-3 ml-0.5" />
                    </span>
                  </div>
                </div>
              )}
            </div>
          </GlassCard>
        );

      case 'alerts':
        return (
          <GlassCard key={key} className="group relative h-full flex flex-col justify-between" hoverEffect={true}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-400 tracking-wide uppercase flex items-center">
                Smart Alerts
                {alerts.filter(a => !a.read).length > 0 && (
                  <span className="w-2 h-2 bg-rose-500 rounded-full ml-1.5 animate-pulse" />
                )}
              </h3>
              {controls}
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-48 pr-1 no-scrollbar flex-1">
              {alerts.length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-xs">No notifications.</div>
              ) : (
                alerts.slice(0, 5).map((a, idx) => {
                  const isNews = a.id.startsWith('news_');
                  const Wrapper = isNews && a.link ? 'a' : 'div';
                  return (
                  <Wrapper
                    key={`alert-${a.id}-${idx}`}
                    {...(isNews && a.link ? { href: a.link, target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className={`p-2.5 rounded-xl border border-white/5 bg-black/20 flex gap-2 ${isNews ? 'cursor-pointer hover:border-blue-500/20 hover:bg-blue-500/5 transition-colors' : ''}`}
                  >
                    {isNews ? (
                      <Newspaper className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                    ) : (
                      <AlertCircle className={`w-3.5 h-3.5 shrink-0 ${a.type === 'critical' ? 'text-rose-400' : 'text-amber-400'}`} />
                    )}
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-white leading-tight truncate">{a.title}</p>
                      <p className="text-[10px] text-gray-400 leading-snug line-clamp-2">{a.message}</p>
                      <p className="text-[9px] text-gray-600">
                        {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </Wrapper>
                  );
                })
              )}
            </div>
          </GlassCard>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Dashboard Intro */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white font-heading">Wealth Overview</h2>
          <p className="text-xs text-gray-400">Welcome to WealthOS. Real-time updates active.</p>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            href="/portfolio"
            className="glass-btn-primary px-4 py-2 rounded-xl text-xs font-bold tracking-wide flex items-center"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Add New Asset
          </Link>
        </div>
      </div>

      {/* KPI Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Total Net Worth"
          inrValue={portfolioCalculations.totalValueInr}
          usdValue={portfolioCalculations.totalValueUsd}
          changeInr={portfolioCalculations.todayChangeInr}
          changeUsd={portfolioCalculations.todayChangeUsd}
          changePercent={portfolioCalculations.todayChangePercent}
          extraLabel="Invested"
          extraValue={
            currencyPref === 'USD'
              ? formatVal(portfolioCalculations.totalInvestedUsd, 'USD', 0)
              : formatVal(portfolioCalculations.totalInvestedInr, 'INR', 0)
          }
          isLoading={assets.length > 0 && !portfolioCalculations.isTodayDataComplete}
        />

        <MetricCard
          title="Today's Gain / Loss"
          inrValue={portfolioCalculations.todayChangeInr}
          usdValue={portfolioCalculations.todayChangeUsd}
          changePercent={portfolioCalculations.todayChangePercent}
          extraLabel="Daily Trend"
          extraValue={portfolioCalculations.todayChangePercent >= 0 ? 'Bullish' : 'Bearish'}
          isLoading={assets.length > 0 && !portfolioCalculations.isTodayDataComplete}
        />

        <MetricCard
          title="Total Returns"
          inrValue={portfolioCalculations.absoluteProfitInr}
          usdValue={portfolioCalculations.absoluteProfitUsd}
          changePercent={portfolioCalculations.profitPercent}
          extraLabel="CAGR"
          extraValue={`${portfolioCalculations.portfolioCagr.toFixed(1)}%`}
        />
      </div>

      {/* Widget Ordering Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {widgetOrder.map((key, index) => renderWidget(key, index))}
      </div>

      {/* Add Goal Modal */}
      {isAddGoalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <GlassCard className="w-full max-w-md p-6 border border-white/10 relative" hoverEffect={false}>
            <button
              onClick={() => setIsAddGoalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors bg-transparent border-none cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
              <Plus className="w-5 h-5 mr-2 text-indigo-400" /> Create Financial Goal
            </h3>

            <form onSubmit={handleAddGoalSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-400 uppercase">Goal Name</label>
                <input
                  type="text"
                  placeholder="e.g. Own House, Buy a Car, Start Business"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  className="w-full text-xs glass-input px-3 py-2 rounded-xl text-white placeholder-gray-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-400 uppercase">Category</label>
                <select
                  value={goalCategory}
                  onChange={(e) => setGoalCategory(e.target.value)}
                  className="w-full text-xs glass-input px-3 py-2 rounded-xl text-white bg-slate-900 border-none"
                >
                  <option value="housing">🏡 Housing / Real Estate</option>
                  <option value="vehicle">🚗 Vehicle / Car</option>
                  <option value="business">💼 Starting a Business</option>
                  <option value="retirement">👴 Retirement Fund</option>
                  <option value="education">🎓 Education</option>
                  <option value="other">🎯 Other Goals</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="block text-xs font-bold text-gray-400 uppercase">Target Amount</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="50,00,000"
                    value={goalTargetAmount}
                    onChange={(e) => setGoalTargetAmount(e.target.value)}
                    className="w-full text-xs glass-input px-3 py-2 rounded-xl text-white placeholder-gray-500"
                    required
                  />
                </div>
                <div className="col-span-1 space-y-1">
                  <label className="block text-xs font-bold text-gray-400 uppercase">Currency</label>
                  <select
                    value={goalTargetCurrency}
                    onChange={(e) => {
                      setGoalTargetCurrency(e.target.value as 'USD' | 'INR');
                      setGoalCurrentCurrency(e.target.value as 'USD' | 'INR');
                    }}
                    className="w-full text-xs glass-input px-3 py-2 rounded-xl text-white bg-slate-900 border-none"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="block text-xs font-bold text-gray-400 uppercase">Current Saved</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="10,00,000"
                    value={goalCurrentAmount}
                    onChange={(e) => setGoalCurrentAmount(e.target.value)}
                    className="w-full text-xs glass-input px-3 py-2 rounded-xl text-white placeholder-gray-500"
                    required
                  />
                  <span className="text-[9px] text-gray-500 block leading-tight mt-0.5">
                    Pre-filled with your total portfolio value ({goalCurrentCurrency === 'USD' ? formatVal(portfolioCalculations.totalValueUsd, 'USD', 0) : formatVal(portfolioCalculations.totalValueInr, 'INR', 0)})
                  </span>
                </div>
                <div className="col-span-1 space-y-1">
                  <label className="block text-xs font-bold text-gray-400 uppercase">Currency</label>
                  <div className="w-full text-xs glass-input px-3 py-2 rounded-xl text-gray-400 bg-slate-950 flex items-center justify-center">
                    {goalCurrentCurrency === 'USD' ? 'USD ($)' : 'INR (₹)'}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-400 uppercase">Target Date</label>
                <input
                  type="date"
                  value={goalTargetDate}
                  onChange={(e) => setGoalTargetDate(e.target.value)}
                  className="w-full text-xs glass-input px-3 py-2 rounded-xl text-white placeholder-gray-500"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddGoalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 bg-transparent cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="glass-btn-primary px-4 py-2 rounded-xl text-xs font-bold"
                >
                  Save Goal
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
