'use client';

import React, { useMemo } from 'react';
import { usePortfolio } from '@/context/portfolioStore';
import {
  formatVal,
  calculateVolatility,
  calculateSharpeRatio,
  calculateSortinoRatio,
  calculateAlphaBeta,
  calculateMaxDrawdown
} from '@/services/financeUtils';
import GlassCard from '@/components/GlassCard';
import {
  ShieldAlert,
  BarChart4,
  Globe2,
  Coins,
  TrendingUp,
  Activity,
  ArrowDownRight,
  ArrowUpRight
} from 'lucide-react';

export default function AnalyticsPage() {
  const { assets, usdInrRate, currencyPref } = usePortfolio();

  // 1. Calculate general portfolio stats
  const totals = useMemo(() => {
    let totalUsd = 0;
    const sectorVals: Record<string, number> = {};
    const countryVals: Record<string, number> = {};
    const currencyVals: Record<string, number> = { INR: 0, USD: 0 };

    assets.forEach((asset) => {
      const curValue = asset.quantity * asset.currentPrice;
      const curValueUsd = asset.currency === 'USD' ? curValue : curValue / usdInrRate;

      totalUsd += curValueUsd;

      // Sector accumulation
      const sector = asset.extra?.sector || 'Uncategorized';
      sectorVals[sector] = (sectorVals[sector] || 0) + curValueUsd;

      // Country accumulation
      const country = asset.extra?.country || 'India';
      countryVals[country] = (countryVals[country] || 0) + curValueUsd;

      // Currency accumulation
      currencyVals[asset.currency] += curValueUsd;
    });

    return {
      totalUsd,
      sectorVals,
      countryVals,
      currencyVals,
    };
  }, [assets, usdInrRate]);

  // 2. Compute Advanced Mathematical Ratios (Sharpe, Sortino, Beta, Volatility, Drawdown)
  const stats = useMemo(() => {
    // Generate simulated periodic daily returns based on portfolio composition
    // If portfolio has high crypto, volatility is higher, else stable.
    let cryptoPct = 0;
    if (totals.totalUsd > 0) {
      const cryptoVal = assets
        .filter(a => a.category === 'crypto')
        .reduce((sum, a) => sum + (a.currency === 'USD' ? a.quantity * a.currentPrice : (a.quantity * a.currentPrice) / usdInrRate), 0);
      cryptoPct = cryptoVal / totals.totalUsd;
    }

    const baseVolatility = 0.08 + cryptoPct * 0.18; // base volatility (8%) scaled by crypto allocation (up to 26%)
    const baseReturn = 0.12 + cryptoPct * 0.10; // return potential scaled by crypto

    // Generate simulated list of 30 past monthly returns to compute math functions
    const mockPortfolioReturns: number[] = [];
    const mockBenchmarkReturns: number[] = []; // e.g. Nifty 50 or S&P 500 benchmark
    
    const now = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(now.getTime() - i * 30 * 24 * 60 * 60 * 1000);
      const seconds = date.getSeconds();
      const seed = Math.sin(date.getTime() + seconds);
      const bSeed = Math.cos(date.getTime() - seconds);
      
      const pReturn = (baseReturn / 12) + seed * (baseVolatility / Math.sqrt(12));
      const bReturn = 0.009 + bSeed * 0.035; // benchmark return (~10.8% annual, ~12% monthly vol)
      
      mockPortfolioReturns.push(pReturn);
      mockBenchmarkReturns.push(bReturn);
    }

    const volatility = calculateVolatility(mockPortfolioReturns) * Math.sqrt(12); // Annualized Volatility
    const annualizedReturn = mockPortfolioReturns.reduce((sum, r) => sum + r, 0) / mockPortfolioReturns.length * 12;
    const benchmarkAnnualized = mockBenchmarkReturns.reduce((sum, r) => sum + r, 0) / mockBenchmarkReturns.length * 12;

    const sharpe = calculateSharpeRatio(annualizedReturn, volatility, 0.06);
    const sortino = calculateSortinoRatio(annualizedReturn, mockPortfolioReturns, 0.06);
    const { alpha, beta } = calculateAlphaBeta(mockPortfolioReturns, mockBenchmarkReturns, 0.06);

    // Simulated historical values for Drawdown
    const historyVals = [];
    let net = totals.totalUsd || 100000;
    for (let i = mockPortfolioReturns.length - 1; i >= 0; i--) {
      net = net / (1 + mockPortfolioReturns[i]);
      historyVals.push(net);
    }
    const maxDrawdown = calculateMaxDrawdown(historyVals.reverse()) * 100;

    return {
      annualizedReturn: annualizedReturn * 100,
      volatility: volatility * 100,
      sharpe,
      sortino,
      alpha: alpha * 100,
      beta,
      maxDrawdown,
    };
  }, [totals, assets, usdInrRate]);

  // 3. Calendar Monthly Returns Matrix (Simulated Bloomberg Heatmap)
  const heatmapData = [
    { year: 2026, jan: 2.1, feb: 1.5, mar: -3.2, apr: 4.8, may: 2.9, jun: 6.2, jul: 1.4, aug: 0.0, sep: 0.0, oct: 0.0, nov: 0.0, dec: 0.0 },
    { year: 2025, jan: -1.5, feb: 3.2, mar: 5.1, apr: -2.8, may: 4.0, jun: -1.2, jul: 2.6, aug: -3.5, sep: 4.2, oct: 1.8, nov: 6.9, dec: 3.1 },
    { year: 2024, jan: 4.2, feb: -0.8, mar: 1.9, apr: 3.0, may: -2.1, jun: 5.5, jul: 6.8, aug: 1.1, sep: -4.5, oct: 3.2, nov: 2.5, dec: 5.0 },
  ];

  // Helper to color codes in heat map cell
  const getHeatmapColor = (val: number) => {
    if (val === 0) return 'bg-white/5 text-gray-500';
    if (val > 0) {
      if (val > 5) return 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/30';
      if (val > 3) return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20';
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10';
    } else {
      if (val < -3) return 'bg-rose-500/30 text-rose-400 border border-rose-500/30';
      return 'bg-rose-500/15 text-rose-400 border border-rose-500/15';
    }
  };

  const getYearTotal = (row: typeof heatmapData[0]) => {
    const months = [row.jan, row.feb, row.mar, row.apr, row.may, row.jun, row.jul, row.aug, row.sep, row.oct, row.nov, row.dec];
    const activeMonths = months.filter(m => m !== 0);
    if (activeMonths.length === 0) return 0;
    // Compounded annual returns: product of (1 + r_i) - 1
    const compound = activeMonths.reduce((prod, m) => prod * (1 + m / 100), 1) - 1;
    return compound * 100;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight font-heading">Risk & Performance Analytics</h2>
        <p className="text-xs text-gray-400">Advanced statistical parameters, asset concentrations, and historical return distributions.</p>
      </div>

      {/* Ratios & Indicators Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlassCard hoverEffect={true} className="flex items-center space-x-4">
          <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Sharpe Ratio</p>
            <p className="text-2xl font-bold text-white mt-0.5">{stats.sharpe.toFixed(2)}</p>
            <p className="text-[10px] text-gray-400">Risk-Adjusted Efficiency (6% Hurdle)</p>
          </div>
        </GlassCard>

        <GlassCard hoverEffect={true} className="flex items-center space-x-4">
          <div className="p-3 bg-violet-500/10 rounded-2xl border border-violet-500/20 text-violet-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Sortino Ratio</p>
            <p className="text-2xl font-bold text-white mt-0.5">{stats.sortino.toFixed(2)}</p>
            <p className="text-[10px] text-gray-400">Downside Deviation adjusted</p>
          </div>
        </GlassCard>

        <GlassCard hoverEffect={true} className="flex items-center space-x-4">
          <div className="p-3 bg-cyan-500/10 rounded-2xl border border-cyan-500/20 text-cyan-400">
            <BarChart4 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Portfolio Beta / Alpha</p>
            <p className="text-2xl font-bold text-white mt-0.5">
              {stats.beta.toFixed(2)} / {stats.alpha.toFixed(1)}%
            </p>
            <p className="text-[10px] text-gray-400">Volatility relative to Index</p>
          </div>
        </GlassCard>

        <GlassCard hoverEffect={true} className="flex items-center space-x-4">
          <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20 text-rose-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Max Drawdown / Vol</p>
            <p className="text-2xl font-bold text-white mt-0.5">
              -{stats.maxDrawdown.toFixed(1)}% / {stats.volatility.toFixed(1)}%
            </p>
            <p className="text-[10px] text-gray-400">Historical peak-to-trough drop</p>
          </div>
        </GlassCard>
      </div>

      {/* Allocation Segment bars (Sector, Country, Currency) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sector Allocation */}
        <GlassCard hoverEffect={true} className="space-y-4">
          <div className="flex items-center space-x-2 border-b border-white/5 pb-2">
            <BarChart4 className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Sector Concentration</h3>
          </div>
          
          <div className="space-y-3 max-h-60 overflow-y-auto no-scrollbar pr-1">
            {Object.entries(totals.sectorVals).length === 0 ? (
              <p className="text-gray-500 text-xs text-center py-4">No sector data</p>
            ) : (
              Object.entries(totals.sectorVals)
                .sort((a, b) => b[1] - a[1])
                .map(([sector, valUsd]) => {
                  const pct = totals.totalUsd > 0 ? (valUsd / totals.totalUsd) * 100 : 0;
                  return (
                    <div key={sector} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-gray-300">{sector}</span>
                        <span className="text-gray-400 font-bold">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-black/40 h-2 rounded-full border border-white/5 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-full rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </GlassCard>

        {/* Country Exposure */}
        <GlassCard hoverEffect={true} className="space-y-4">
          <div className="flex items-center space-x-2 border-b border-white/5 pb-2">
            <Globe2 className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Geographic Exposure</h3>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto no-scrollbar pr-1">
            {Object.entries(totals.countryVals).length === 0 ? (
              <p className="text-gray-500 text-xs text-center py-4">No geographic data</p>
            ) : (
              Object.entries(totals.countryVals)
                .sort((a, b) => b[1] - a[1])
                .map(([country, valUsd]) => {
                  const pct = totals.totalUsd > 0 ? (valUsd / totals.totalUsd) * 100 : 0;
                  return (
                    <div key={country} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-gray-300">{country}</span>
                        <span className="text-gray-400 font-bold">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-black/40 h-2 rounded-full border border-white/5 overflow-hidden">
                        <div
                          className="bg-cyan-500 h-full rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </GlassCard>

        {/* Currency Denomination */}
        <GlassCard hoverEffect={true} className="space-y-4">
          <div className="flex items-center space-x-2 border-b border-white/5 pb-2">
            <Coins className="w-4 h-4 text-violet-400" />
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Currency Exposures</h3>
          </div>

          <div className="space-y-3">
            {totals.totalUsd === 0 ? (
              <p className="text-gray-500 text-xs text-center py-4">No currency data</p>
            ) : (
              Object.entries(totals.currencyVals)
                .sort((a, b) => b[1] - a[1])
                .map(([currency, valUsd]) => {
                  const pct = totals.totalUsd > 0 ? (valUsd / totals.totalUsd) * 100 : 0;
                  return (
                    <div key={currency} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-gray-300">{currency} Assets</span>
                        <span className="text-gray-400 font-bold">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-black/40 h-2 rounded-full border border-white/5 overflow-hidden">
                        <div
                          className="bg-violet-500 h-full rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </GlassCard>
      </div>

      {/* Calendar Returns Matrix (Bloomberg heatmap styled card) */}
      <GlassCard hoverEffect={true} className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Calendar Returns Heatmap</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">Compounded returns matrix per month (Apple + Bloomberg style)</p>
        </div>

        <div className="overflow-x-auto no-scrollbar border border-white/5 rounded-2xl">
          <table className="w-full text-center text-xs border-collapse">
            <thead>
              <tr className="bg-black/40 text-gray-500 uppercase font-semibold text-[10px] border-b border-white/5">
                <th className="py-3 px-3 text-left">Year</th>
                <th className="py-3">Jan</th>
                <th className="py-3">Feb</th>
                <th className="py-3">Mar</th>
                <th className="py-3">Apr</th>
                <th className="py-3">May</th>
                <th className="py-3">Jun</th>
                <th className="py-3">Jul</th>
                <th className="py-3">Aug</th>
                <th className="py-3">Sep</th>
                <th className="py-3">Oct</th>
                <th className="py-3">Nov</th>
                <th className="py-3">Dec</th>
                <th className="py-3 px-3 text-right">YTD Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {heatmapData.map((row) => {
                const ytd = getYearTotal(row);
                return (
                  <tr key={row.year} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3 font-bold text-white text-left">{row.year}</td>
                    {[
                      row.jan,
                      row.feb,
                      row.mar,
                      row.apr,
                      row.may,
                      row.jun,
                      row.jul,
                      row.aug,
                      row.sep,
                      row.oct,
                      row.nov,
                      row.dec,
                    ].map((mVal, mIdx) => (
                      <td key={mIdx} className="py-3.5 px-0.5">
                        <div
                          className={`w-11 h-8 rounded-lg flex items-center justify-center font-bold text-[10px] mx-auto transition-all ${getHeatmapColor(
                            mVal
                          )}`}
                        >
                          {mVal !== 0 ? `${mVal > 0 ? '+' : ''}${mVal}%` : '-'}
                        </div>
                      </td>
                    ))}
                    <td className="py-3 px-3 text-right font-extrabold">
                      <span
                        className={`text-xs px-2 py-1 rounded-md ${
                          ytd >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                        }`}
                      >
                        {ytd > 0 ? '+' : ''}
                        {ytd.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
