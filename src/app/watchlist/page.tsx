'use client';

import React, { useState, useMemo } from 'react';
import { usePortfolio, WatchlistItem, AssetCategory } from '@/context/portfolioStore';
import { formatVal } from '@/services/financeUtils';
import { getSimulatedPrice } from '@/services/marketService';
import GlassCard from '@/components/GlassCard';
import {
  Eye,
  Plus,
  Trash2,
  Bell,
  TrendingUp,
  Activity,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

const CATEGORIES: Record<AssetCategory, string> = {
  stock_in: 'Indian Stock',
  stock_us: 'US Stock',
  etf: 'ETF',
  mutual_fund: 'Mutual Fund',
  crypto: 'Crypto',
  gold: 'Precious Metals',
  fixed_income: 'Debt & Bond',
  real_estate: 'Real Estate',
  cash: 'Cash Account',
};

export default function WatchlistPage() {
  const { watchlists, addWatchlist, deleteWatchlist, usdInrRate } = usePortfolio();

  const [newItemName, setNewItemName] = useState('');
  const [newItemTicker, setNewItemTicker] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<AssetCategory>('stock_us');
  const [newItemCurrency, setNewItemCurrency] = useState<'INR' | 'USD'>('USD');
  const [newUpperLimit, setNewUpperLimit] = useState('');
  const [newLowerLimit, setNewLowerLimit] = useState('');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !newItemTicker) {
      alert('Please fill out required fields.');
      return;
    }

    addWatchlist({
      name: newItemName,
      ticker: newItemTicker.toUpperCase(),
      category: newItemCategory,
      currency: newItemCurrency,
      alertPriceUpper: newUpperLimit ? parseFloat(newUpperLimit) : undefined,
      alertPriceLower: newLowerLimit ? parseFloat(newLowerLimit) : undefined,
    });

    setNewItemName('');
    setNewItemTicker('');
    setNewUpperLimit('');
    setNewLowerLimit('');
  };

  // Compile detailed financial statistics for watched items
  const watchlistDetails = useMemo(() => {
    return watchlists.map((item) => {
      // Fetch simulated live pricing & indicators
      const sim = getSimulatedPrice(item.ticker, item.currency);
      const seconds = new Date().getSeconds();
      
      // Seed pseudo-random technical indicators based on ticker character values
      const charSum = item.ticker.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      
      const pe = item.category === 'crypto' || item.category === 'gold' ? '-' : ((charSum % 25) + 12).toFixed(1);
      const pb = item.category === 'crypto' || item.category === 'gold' ? '-' : ((charSum % 5) + 1.2).toFixed(1);
      const divYield = item.category === 'crypto' ? '-' : `${((charSum % 4) * 0.8 + 0.5).toFixed(2)}%`;
      
      const rsi = Math.round(45 + Math.sin(charSum + seconds) * 22);
      const sma50 = sim.price * (1 + (charSum % 4 === 0 ? 0.04 : -0.03));
      
      const high52 = sim.price * 1.25;
      const low52 = sim.price * 0.78;

      return {
        ...item,
        price: sim.price,
        change: sim.changePercent,
        pe,
        pb,
        divYield,
        rsi,
        sma50,
        high52,
        low52,
      };
    });
  }, [watchlists]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight font-heading">Asset Watchlists</h2>
        <p className="text-xs text-gray-400">Track indices, setups, triggers, and fundamental indicator matrices.</p>
      </div>

      {/* Main Grid split: Watchlist Table & Add Ticker Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Watchlist table view */}
        <GlassCard hoverEffect={false} className="lg:col-span-2 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Monitored Assets</h3>
          </div>

          <div className="overflow-x-auto no-scrollbar text-xs">
            {watchlistDetails.length === 0 ? (
              <p className="text-center py-10 text-gray-500">No items in your watchlist. Configure some on the right.</p>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-gray-500 uppercase font-semibold text-[10px] border-b border-white/5">
                    <th className="py-2.5">Ticker / Asset</th>
                    <th className="py-2.5 text-right">Price</th>
                    <th className="py-2.5 text-right">PE / PB</th>
                    <th className="py-2.5 text-right">Div Yield</th>
                    <th className="py-2.5 text-right">RSI (14)</th>
                    <th className="py-2.5 text-right">52W Range</th>
                    <th className="py-2.5 text-center">Alert Triggers</th>
                    <th className="py-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                  {watchlistDetails.map((w) => {
                    const priceFormatted = formatVal(w.price, w.currency, w.currency === 'USD' ? 2 : 1);
                    const isUp = w.change >= 0;
                    
                    return (
                      <tr key={w.id} className="hover:bg-white/5">
                        <td className="py-3">
                          <div className="font-semibold text-white">{w.name}</div>
                          <div className="text-[10px] text-gray-500 font-semibold uppercase">
                            {w.ticker} • {CATEGORIES[w.category]}
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <div className="font-bold text-white">{priceFormatted}</div>
                          <div className={`text-[10px] flex items-center justify-end font-semibold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isUp ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                            {Math.abs(w.change).toFixed(2)}%
                          </div>
                        </td>
                        <td className="py-3 text-right font-medium">
                          {w.pe !== '-' ? `${w.pe}x / ${w.pb}x` : '-'}
                        </td>
                        <td className="py-3 text-right font-medium">{w.divYield}</td>
                        <td className="py-3 text-right font-bold">
                          <span
                            className={
                              w.rsi > 70
                                ? 'text-rose-400'
                                : w.rsi < 30
                                ? 'text-emerald-400'
                                : 'text-indigo-300'
                            }
                          >
                            {w.rsi}
                          </span>
                        </td>
                        <td className="py-3 text-right font-semibold text-gray-400">
                          <div className="text-[10px]">H: {formatVal(w.high52, w.currency, 0)}</div>
                          <div className="text-[10px]">L: {formatVal(w.low52, w.currency, 0)}</div>
                        </td>
                        <td className="py-3 text-center">
                          {w.alertPriceLower || w.alertPriceUpper ? (
                            <div className="flex items-center justify-center space-x-1.5 text-amber-400" title="Alert Configured">
                              <Bell className="w-3.5 h-3.5" />
                              <span className="text-[9px] font-bold">
                                {w.alertPriceLower ? `L<${w.alertPriceLower}` : ''}
                                {w.alertPriceLower && w.alertPriceUpper ? ' | ' : ''}
                                {w.alertPriceUpper ? `H>${w.alertPriceUpper}` : ''}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                        <td className="py-3 text-center">
                          <button
                            onClick={() => deleteWatchlist(w.id)}
                            className="text-gray-500 hover:text-rose-400 transition-colors p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </GlassCard>

        {/* Watchlist Setup Form */}
        <GlassCard hoverEffect={false} className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Monitor New Ticker</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">Stream pricing and setup smart alert targets</p>
          </div>

          <form onSubmit={handleAddSubmit} className="space-y-3.5 text-xs">
            <div className="space-y-1">
              <label className="text-gray-500 font-semibold uppercase">Category</label>
              <select
                value={newItemCategory}
                onChange={(e) => {
                  const cat = e.target.value as AssetCategory;
                  setNewItemCategory(cat);
                  if (cat === 'stock_us' || cat === 'crypto') {
                    setNewItemCurrency('USD');
                  } else {
                    setNewItemCurrency('INR');
                  }
                }}
                className="w-full glass-input rounded-xl px-3 py-2 text-white bg-slate-900 border border-white/10"
              >
                <option value="stock_us" className="bg-slate-950">US Stock (NYSE/NASDAQ)</option>
                <option value="stock_in" className="bg-slate-950">Indian Stock (NSE/BSE)</option>
                <option value="crypto" className="bg-slate-950">Cryptocurrency</option>
                <option value="mutual_fund" className="bg-slate-950">Mutual Fund</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-gray-500 font-semibold uppercase">Asset Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nvidia / SBI"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full glass-input rounded-xl px-3 py-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-500 font-semibold uppercase">Ticker Symbol *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NVDA / INFY / SOL"
                  value={newItemTicker}
                  onChange={(e) => setNewItemTicker(e.target.value)}
                  className="w-full glass-input rounded-xl px-3 py-2"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-gray-500 font-semibold uppercase">Pricing Currency</label>
              <select
                value={newItemCurrency}
                onChange={(e) => setNewItemCurrency(e.target.value as 'INR' | 'USD')}
                className="w-full glass-input rounded-xl px-3 py-2 text-white bg-slate-900 border border-white/10"
              >
                <option value="INR" className="bg-slate-950">INR (₹)</option>
                <option value="USD" className="bg-slate-950">USD ($)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-3.5">
              <div className="space-y-1">
                <label className="text-gray-500 font-semibold uppercase flex items-center">
                  Upper Target Alert <ArrowUpRight className="w-3 h-3 text-emerald-400 ml-1" />
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 130"
                  value={newUpperLimit}
                  onChange={(e) => setNewUpperLimit(e.target.value)}
                  className="w-full glass-input rounded-xl px-3 py-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-500 font-semibold uppercase flex items-center">
                  Lower Limit Alert <ArrowDownRight className="w-3 h-3 text-rose-400 ml-1" />
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 95"
                  value={newLowerLimit}
                  onChange={(e) => setNewLowerLimit(e.target.value)}
                  className="w-full glass-input rounded-xl px-3 py-2"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full glass-btn-primary px-4 py-2 rounded-xl font-bold mt-2"
            >
              Add to Watchlist
            </button>
          </form>
        </GlassCard>
      </div>
    </div>
  );
}
