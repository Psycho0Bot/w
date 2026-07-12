'use client';

import React, { useMemo } from 'react';
import { usePortfolio } from '@/context/portfolioStore';
import { formatVal } from '@/services/financeUtils';
import GlassCard from './GlassCard';
import { TrendingUp, TrendingDown, Wallet, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function PerformanceChart() {
  const { assets, usdInrRate, currencyPref } = usePortfolio();

  const data = useMemo(() => {
    let totalUsd = 0;
    let totalCostUsd = 0;
    let todayChangeUsd = 0;
    let yesterdayValueUsd = 0;

    assets.forEach(asset => {
      const value = asset.quantity * asset.currentPrice;
      const cost = asset.quantity * asset.avgBuyPrice;
      const valueUsd = asset.currency === 'USD' ? value : value / usdInrRate;
      const costUsd = asset.currency === 'USD' ? cost : cost / usdInrRate;
      totalUsd += valueUsd;
      totalCostUsd += costUsd;

      const prevClose = asset.previousClose || asset.currentPrice;
      const prevValue = asset.quantity * prevClose;
      const prevValueUsd = asset.currency === 'USD' ? prevValue : prevValue / usdInrRate;
      // Only count change if market is OPEN
      if (asset.marketStatus === 'OPEN') {
        yesterdayValueUsd += prevValueUsd;
        todayChangeUsd += valueUsd - prevValueUsd;
      } else {
        yesterdayValueUsd += valueUsd; // no change when market closed
      }
    });

    const totalGain = totalUsd - totalCostUsd;
    const totalGainPct = totalCostUsd > 0 ? (totalGain / totalCostUsd) * 100 : 0;
    const todayChangePct = yesterdayValueUsd > 0 ? (todayChangeUsd / yesterdayValueUsd) * 100 : 0;

    // Top gainers and losers today
    const movers = assets
      .map(a => {
        const change = a.dayChangePercent || 0;
        const value = a.quantity * a.currentPrice;
        const valueUsd = a.currency === 'USD' ? value : value / usdInrRate;
        return { ticker: a.ticker, name: a.name, change, valueUsd };
      })
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    return {
      totalUsd, totalCostUsd, totalGain, totalGainPct,
      todayChangeUsd, todayChangePct,
      topGainer: movers.find(m => m.change > 0),
      topLoser: movers.find(m => m.change < 0),
    };
  }, [assets, usdInrRate]);

  const formatValue = (usd: number) => {
    return currencyPref === 'USD' ? formatVal(usd, 'USD', 0) : formatVal(usd * usdInrRate, 'INR', 0);
  };

  return (
    <GlassCard className="h-full flex flex-col justify-between">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-400 tracking-wide uppercase">Net Worth Performance</h3>
          <p className="text-xs text-gray-500 mt-0.5">Total portfolio value & P&L</p>
        </div>
      </div>

      {/* Total Value */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-indigo-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-indigo-400" />
            <span className="text-[10px] font-bold text-gray-400 uppercase">Total Value</span>
          </div>
          <p className="text-xl font-black text-white">{formatValue(data.totalUsd)}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">{formatVal(data.totalUsd, 'USD', 0)}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-gray-400" />
            <span className="text-[10px] font-bold text-gray-400 uppercase">Total P&L</span>
          </div>
          <p className={`text-xl font-black ${data.totalGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {data.totalGain >= 0 ? '+' : ''}{formatValue(Math.abs(data.totalGain))}
          </p>
          <p className={`text-[10px] font-bold mt-0.5 ${data.totalGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {data.totalGain >= 0 ? '+' : ''}{data.totalGainPct.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Today's Change */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/5 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Today's Change</span>
            <p className={`text-lg font-black ${data.todayChangeUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {data.todayChangeUsd >= 0 ? '+' : ''}{formatValue(Math.abs(data.todayChangeUsd))}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Change %</span>
            <p className={`text-lg font-black flex items-center justify-end gap-1 ${data.todayChangeUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {data.todayChangeUsd >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {data.todayChangePct >= 0 ? '+' : ''}{data.todayChangePct.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* Top Movers */}
      <div className="grid grid-cols-2 gap-4">
        {data.topGainer && (
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
            <span className="text-[9px] font-bold text-gray-500 uppercase">Top Gainer</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs font-bold text-white">{data.topGainer.ticker}</span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />+{data.topGainer.change.toFixed(2)}%
              </span>
            </div>
          </div>
        )}
        {data.topLoser && (
          <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/10">
            <span className="text-[9px] font-bold text-gray-500 uppercase">Top Loser</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs font-bold text-white">{data.topLoser.ticker}</span>
              <span className="text-xs font-bold text-rose-400 flex items-center gap-0.5">
                <TrendingDown className="w-3 h-3" />{data.topLoser.change.toFixed(2)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
