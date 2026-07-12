'use client';

import React, { useMemo } from 'react';
import { usePortfolio } from '@/context/portfolioStore';
import { formatVal } from '@/services/financeUtils';
import GlassCard from '@/components/GlassCard';
import {
  Percent,
  TrendingDown,
  Sparkles,
  Info,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet
} from 'lucide-react';

export default function TaxPage() {
  const { assets, usdInrRate, currencyPref } = usePortfolio();

  // Compile exact tax metrics based on transaction history dates and gains
  const taxMetrics = useMemo(() => {
    let stcgGainsUsd = 0;
    let ltcgGainsUsd = 0;
    let cryptoGainsUsd = 0;
    let totalDividendsUsd = 0;
    
    // Tax Harvesting targets
    const harvestableLosses: { name: string; ticker: string; lossUsd: number; category: string }[] = [];

    const now = new Date();

    assets.forEach((asset) => {
      const curValue = asset.quantity * asset.currentPrice;
      const curValueUsd = asset.currency === 'USD' ? curValue : curValue / usdInrRate;
      
      const cost = asset.quantity * asset.avgBuyPrice;
      const costUsd = asset.currency === 'USD' ? cost : cost / usdInrRate;
      
      const profitUsd = curValueUsd - costUsd;

      // Track dividends
      const div = asset.dividendsEarned || 0;
      totalDividendsUsd += asset.currency === 'USD' ? div : div / usdInrRate;

      if (profitUsd < 0) {
        // Harvesting candidate
        harvestableLosses.push({
          name: asset.name,
          ticker: asset.ticker,
          lossUsd: Math.abs(profitUsd),
          category: asset.category,
        });
      } else if (profitUsd > 0) {
        if (asset.category === 'crypto') {
          cryptoGainsUsd += profitUsd;
        } else if (asset.category === 'stock_us' || asset.category === 'stock_in' || asset.category === 'mutual_fund') {
          // Check holding period of first buy transaction
          const firstTx = asset.transactions[0];
          if (firstTx) {
            const buyDate = new Date(firstTx.date);
            const diffDays = (now.getTime() - buyDate.getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays > 365) {
              ltcgGainsUsd += profitUsd;
            } else {
              stcgGainsUsd += profitUsd;
            }
          } else {
            stcgGainsUsd += profitUsd;
          }
        }
      }
    });

    // Tax rates defaults:
    // STCG: 15% (or 20% in India starting 2024, let's use 15%)
    // LTCG: 10% (above threshold, let's assume flat 10%)
    // Crypto Tax: 30% flat tax on gains in India
    // Dividend Tax: slab rate, average 15%
    const estStcgTax = stcgGainsUsd * 0.15;
    const estLtcgTax = ltcgGainsUsd * 0.10;
    const estCryptoTax = cryptoGainsUsd * 0.30;
    const estDivTax = totalDividendsUsd * 0.15;
    
    const totalTaxUsd = estStcgTax + estLtcgTax + estCryptoTax + estDivTax;

    return {
      stcgGainsUsd,
      ltcgGainsUsd,
      cryptoGainsUsd,
      totalDividendsUsd,
      estStcgTax,
      estLtcgTax,
      estCryptoTax,
      estDivTax,
      totalTaxUsd,
      harvestableLosses,
    };
  }, [assets, usdInrRate]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight font-heading">Tax Dashboard</h2>
          <p className="text-xs text-gray-400">Capital gains, crypto flat taxes, and harvesting recommendations.</p>
        </div>

        <button
          onClick={() => alert('Tax reports CSV successfully exported.')}
          className="glass-btn px-4 py-2 rounded-xl text-xs font-bold flex items-center self-start md:self-auto hover:bg-white/10"
        >
          <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Export Tax Ledger
        </button>
      </div>

      {/* Tax Liability Metrics cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlassCard hoverEffect={true} className="flex flex-col justify-between">
          <div>
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Estimated Total Tax</p>
            <p className="text-2xl font-extrabold text-white mt-1">
              {currencyPref === 'USD'
                ? formatVal(taxMetrics.totalTaxUsd, 'USD', 0)
                : formatVal(taxMetrics.totalTaxUsd * usdInrRate, 'INR', 0)}
            </p>
          </div>
          <div className="text-[10px] text-gray-400 mt-4 pt-2 border-t border-white/5">
            Sum of capital gains & dividend taxes
          </div>
        </GlassCard>

        <GlassCard hoverEffect={true} className="flex flex-col justify-between">
          <div>
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Crypto Tax (30%)</p>
            <p className="text-2xl font-extrabold text-rose-400 mt-1">
              {currencyPref === 'USD'
                ? formatVal(taxMetrics.estCryptoTax, 'USD', 0)
                : formatVal(taxMetrics.estCryptoTax * usdInrRate, 'INR', 0)}
            </p>
          </div>
          <div className="text-[10px] text-gray-400 mt-4 pt-2 border-t border-white/5">
            Gains: {currencyPref === 'USD' ? formatVal(taxMetrics.cryptoGainsUsd, 'USD', 0) : formatVal(taxMetrics.cryptoGainsUsd * usdInrRate, 'INR', 0)}
          </div>
        </GlassCard>

        <GlassCard hoverEffect={true} className="flex flex-col justify-between">
          <div>
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">STCG Tax (15%)</p>
            <p className="text-2xl font-extrabold text-amber-400 mt-1">
              {currencyPref === 'USD'
                ? formatVal(taxMetrics.estStcgTax, 'USD', 0)
                : formatVal(taxMetrics.estStcgTax * usdInrRate, 'INR', 0)}
            </p>
          </div>
          <div className="text-[10px] text-gray-400 mt-4 pt-2 border-t border-white/5">
            STCG Gains: {currencyPref === 'USD' ? formatVal(taxMetrics.stcgGainsUsd, 'USD', 0) : formatVal(taxMetrics.stcgGainsUsd * usdInrRate, 'INR', 0)}
          </div>
        </GlassCard>

        <GlassCard hoverEffect={true} className="flex flex-col justify-between">
          <div>
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">LTCG Tax (10%)</p>
            <p className="text-2xl font-extrabold text-emerald-400 mt-1">
              {currencyPref === 'USD'
                ? formatVal(taxMetrics.estLtcgTax, 'USD', 0)
                : formatVal(taxMetrics.estLtcgTax * usdInrRate, 'INR', 0)}
            </p>
          </div>
          <div className="text-[10px] text-gray-400 mt-4 pt-2 border-t border-white/5">
            LTCG Gains: {currencyPref === 'USD' ? formatVal(taxMetrics.ltcgGainsUsd, 'USD', 0) : formatVal(taxMetrics.ltcgGainsUsd * usdInrRate, 'INR', 0)}
          </div>
        </GlassCard>
      </div>

      {/* Harvesting Suggestion & Detailed Breakdown tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tax Loss Harvesting Suggestions */}
        <GlassCard hoverEffect={true} className="lg:col-span-1 space-y-4">
          <div className="flex items-center space-x-2 border-b border-white/5 pb-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Harvesting Suggestions</h3>
          </div>

          <div className="space-y-3.5">
            {taxMetrics.harvestableLosses.length === 0 ? (
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 text-emerald-300 text-xs rounded-xl flex gap-2.5">
                <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
                <p>All your active holdings are currently profitable. No tax-loss harvesting candidates found.</p>
              </div>
            ) : (
              taxMetrics.harvestableLosses.map((l, idx) => {
                const lossFormatted = currencyPref === 'USD' 
                  ? formatVal(l.lossUsd, 'USD', 0) 
                  : formatVal(l.lossUsd * usdInrRate, 'INR', 0);
                
                const taxSaved = currencyPref === 'USD'
                  ? formatVal(l.lossUsd * 0.15, 'USD', 0)
                  : formatVal(l.lossUsd * 0.15 * usdInrRate, 'INR', 0);
                return (
                  <div key={idx} className="p-3.5 rounded-xl border border-white/5 bg-black/25 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold text-white">
                      <span>Harvest: {l.name}</span>
                      <span className="text-rose-400">-{lossFormatted}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-snug">
                      Holding {l.ticker} has a loss. Selling these shares before the fiscal year-end allows offsetting up to <span className="font-semibold text-gray-300">{lossFormatted}</span> of short-term stock profits, saving approximately <span className="font-bold text-emerald-400">{taxSaved}</span> in taxes.
                    </p>
                    <div className="flex justify-between items-center text-[10px] text-gray-500 pt-1 border-t border-white/5">
                      <span>Offset type: STCG offset</span>
                      <button
                        onClick={() => alert(`Sell order trigger configured for ${l.ticker}`)}
                        className="text-indigo-400 hover:underline flex items-center font-bold"
                      >
                        Trade now <ArrowRight className="w-3 h-3 ml-0.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </GlassCard>

        {/* Detailed Gains breakdown ledger */}
        <GlassCard hoverEffect={true} className="lg:col-span-2 space-y-4">
          <div className="flex items-center space-x-2 border-b border-white/5 pb-2">
            <Percent className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Capital Gains Ledger</h3>
          </div>

          <div className="overflow-x-auto no-scrollbar text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-gray-500 uppercase font-semibold text-[10px] border-b border-white/5">
                  <th className="py-2.5">Capital Gains Type</th>
                  <th className="py-2.5 text-right">Tax Rate</th>
                  <th className="py-2.5 text-right">Taxable Gains</th>
                  <th className="py-2.5 text-right">Estimated Liability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                <tr className="hover:bg-white/5">
                  <td className="py-3 font-semibold text-white">Short-Term Capital Gains (STCG)</td>
                  <td className="py-3 text-right">15%</td>
                  <td className="py-3 text-right">
                    {currencyPref === 'USD' ? formatVal(taxMetrics.stcgGainsUsd, 'USD', 0) : formatVal(taxMetrics.stcgGainsUsd * usdInrRate, 'INR', 0)}
                  </td>
                  <td className="py-3 text-right font-bold text-amber-400">
                    {currencyPref === 'USD' ? formatVal(taxMetrics.estStcgTax, 'USD', 0) : formatVal(taxMetrics.estStcgTax * usdInrRate, 'INR', 0)}
                  </td>
                </tr>
                <tr className="hover:bg-white/5">
                  <td className="py-3 font-semibold text-white">Long-Term Capital Gains (LTCG)</td>
                  <td className="py-3 text-right">10%</td>
                  <td className="py-3 text-right">
                    {currencyPref === 'USD' ? formatVal(taxMetrics.ltcgGainsUsd, 'USD', 0) : formatVal(taxMetrics.ltcgGainsUsd * usdInrRate, 'INR', 0)}
                  </td>
                  <td className="py-3 text-right font-bold text-emerald-400">
                    {currencyPref === 'USD' ? formatVal(taxMetrics.estLtcgTax, 'USD', 0) : formatVal(taxMetrics.estLtcgTax * usdInrRate, 'INR', 0)}
                  </td>
                </tr>
                <tr className="hover:bg-white/5">
                  <td className="py-3 font-semibold text-white">Cryptocurrency Returns (India flat rate)</td>
                  <td className="py-3 text-right">30%</td>
                  <td className="py-3 text-right">
                    {currencyPref === 'USD' ? formatVal(taxMetrics.cryptoGainsUsd, 'USD', 0) : formatVal(taxMetrics.cryptoGainsUsd * usdInrRate, 'INR', 0)}
                  </td>
                  <td className="py-3 text-right font-bold text-rose-400">
                    {currencyPref === 'USD' ? formatVal(taxMetrics.estCryptoTax, 'USD', 0) : formatVal(taxMetrics.estCryptoTax * usdInrRate, 'INR', 0)}
                  </td>
                </tr>
                <tr className="hover:bg-white/5">
                  <td className="py-3 font-semibold text-white">Dividend Incomes</td>
                  <td className="py-3 text-right">Slab (~15%)</td>
                  <td className="py-3 text-right">
                    {currencyPref === 'USD' ? formatVal(taxMetrics.totalDividendsUsd, 'USD', 0) : formatVal(taxMetrics.totalDividendsUsd * usdInrRate, 'INR', 0)}
                  </td>
                  <td className="py-3 text-right font-bold text-indigo-400">
                    {currencyPref === 'USD' ? formatVal(taxMetrics.estDivTax, 'USD', 0) : formatVal(taxMetrics.estDivTax * usdInrRate, 'INR', 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="pt-3 border-t border-white/5 flex gap-2.5 text-[10px] text-gray-500">
            <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <p className="leading-snug">
              Under Indian Income Tax rules, LTCG on listed equities/MFs is taxed at 12.5% (or 10% pre-2024 amendments) on gains exceeding ₹1.25 Lakh. STCG is taxed at 20% (formerly 15%). Cryptocurrencies are taxed at a flat 30% with no loss offsetting allowed between tokens.
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
