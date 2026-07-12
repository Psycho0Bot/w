'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { usePortfolio, AssetCategory } from '@/context/portfolioStore';
import { formatVal } from '@/services/financeUtils';
import GlassCard from './GlassCard';

const CATEGORY_COLORS: Record<string, string> = {
  stock_in: '#06b6d4',      // Cyan for Indian Stocks
  stock_us: '#3b82f6',      // Blue for US Stocks
  etf: '#d946ef',           // Fuchsia for ETFs
  mutual_fund: '#6366f1',   // Indigo for Mutual Funds
  crypto: '#8b5cf6',        // Violet for Crypto
  gold: '#f59e0b',          // Amber for Gold
  fixed_income: '#ec4899',  // Pink for Fixed Income/Debt
  real_estate: '#10b981',   // Emerald for Real Estate
  cash: '#64748b',          // Slate for Cash
};

const CATEGORY_NAMES: Record<string, string> = {
  stock_in: 'Indian Stocks',
  stock_us: 'US Stocks',
  etf: 'ETFs',
  mutual_fund: 'Mutual Funds',
  crypto: 'Crypto',
  gold: 'Gold & Silver',
  fixed_income: 'Fixed Income & Debt',
  real_estate: 'Real Estate',
  cash: 'Cash & Savings',
};

export default function AssetPieChart() {
  const { assets, usdInrRate, currencyPref } = usePortfolio();

  // 1. Calculate values for each category
  const categoryTotals = assets.reduce((acc, asset) => {
    const value = asset.quantity * asset.currentPrice;
    const valueUsd = asset.currency === 'USD' ? value : value / usdInrRate;
    const valueInr = asset.currency === 'INR' ? value : value * usdInrRate;

    acc[asset.category] = (acc[asset.category] || 0) + valueUsd;
    return acc;
  }, {} as Record<AssetCategory, number>);

  const totalPortfolioValueUsd = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);

  const data = Object.entries(categoryTotals)
    .map(([category, valueUsd]) => {
      const percentage = totalPortfolioValueUsd > 0 ? (valueUsd / totalPortfolioValueUsd) * 100 : 0;
      return {
        name: CATEGORY_NAMES[category] || category,
        value: valueUsd,
        percentage,
        color: CATEGORY_COLORS[category] || '#ffffff',
        category,
      };
    })
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value);

  // Custom tooltips matching the dark glass theme
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const valUsd = data.value;
      const valInr = valUsd * usdInrRate;
      return (
        <div className="glass-panel px-3 py-2 rounded-xl text-xs space-y-1 shadow-2xl border border-white/10">
          <p className="font-semibold text-white">{data.name}</p>
          <div className="flex justify-between space-x-6">
            <span className="text-gray-400">Value:</span>
            <span className="font-medium text-indigo-300">
              {currencyPref === 'USD'
                ? formatVal(valUsd, 'USD', 0)
                : formatVal(valInr, 'INR', 0)}
              {currencyPref === 'BOTH' && ` / ${formatVal(valUsd, 'USD', 0)}`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Allocation:</span>
            <span className="font-medium text-emerald-400">{data.percentage.toFixed(1)}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <GlassCard className="h-96 flex items-center justify-center">
        <span className="text-gray-400 text-sm">No asset data available. Add holdings to see allocation.</span>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="h-full flex flex-col justify-between">
      <div>
        <h3 className="text-sm font-semibold text-gray-400 tracking-wide uppercase mb-4">Asset Allocation</h3>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-6 my-2">
        <div className="w-full md:w-1/2 h-56 relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={85}
                paddingAngle={4}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(3,3,8,0.8)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          
          <div className="absolute text-center flex flex-col justify-center items-center pointer-events-none">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Total Portfolio</span>
            <span className="text-xl font-bold text-white leading-tight">
              {currencyPref === 'USD'
                ? formatVal(totalPortfolioValueUsd, 'USD', 0)
                : formatVal(totalPortfolioValueUsd * usdInrRate, 'INR', 0)}
            </span>
            {currencyPref === 'BOTH' && (
              <span className="text-xs text-gray-400">
                {formatVal(totalPortfolioValueUsd, 'USD', 0)}
              </span>
            )}
          </div>
        </div>

        {/* Custom Legend */}
        <div className="w-full md:w-1/2 space-y-2.5 max-h-56 overflow-y-auto no-scrollbar pr-1">
          {data.map((entry, index) => {
            const valUsd = entry.value;
            const valInr = valUsd * usdInrRate;
            return (
              <div key={index} className="flex items-center justify-between text-xs py-0.5 border-b border-white/5 last:border-b-0">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-gray-300 font-medium">{entry.name}</span>
                </div>
                <div className="text-right space-y-0.5">
                  <span className="font-semibold text-white mr-1.5">{entry.percentage.toFixed(1)}%</span>
                  <span className="text-gray-400">
                    ({currencyPref === 'USD'
                      ? formatVal(valUsd, 'USD', 0)
                      : formatVal(valInr, 'INR', 0)})
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}
