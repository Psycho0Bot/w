'use client';

import React from 'react';
import { usePortfolio } from '@/context/portfolioStore';
import { formatVal } from '@/services/financeUtils';
import GlassCard from './GlassCard';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface MetricCardProps {
  title: string;
  inrValue: number;
  usdValue: number;
  changeInr?: number;
  changeUsd?: number;
  changePercent?: number;
  extraLabel?: string;
  extraValue?: string;
  className?: string;
  isLoading?: boolean;
}

export default function MetricCard({
  title,
  inrValue,
  usdValue,
  changeInr,
  changeUsd,
  changePercent,
  extraLabel,
  extraValue,
  className = '',
  isLoading = false,
}: MetricCardProps) {
  const { currencyPref } = usePortfolio();

  if (isLoading) {
    return (
      <GlassCard className={`flex flex-col justify-between ${className}`} hoverEffect={true}>
        <div className="space-y-4 animate-pulse w-full">
          <div className="flex items-center justify-between">
            <div className="h-4 w-28 bg-white/10 rounded"></div>
            <div className="h-5 w-12 bg-white/10 rounded-full"></div>
          </div>
          <div className="space-y-2">
            <div className="h-8 w-36 bg-white/10 rounded"></div>
            {currencyPref === 'BOTH' && <div className="h-5 w-24 bg-white/10 rounded"></div>}
          </div>
        </div>
        <div className="mt-6 pt-3 border-t border-white/5 flex items-center justify-between">
          <div className="h-3 w-16 bg-white/10 rounded"></div>
          <div className="h-3 w-20 bg-white/10 rounded"></div>
        </div>
      </GlassCard>
    );
  }

  const isPositive = changePercent !== undefined ? changePercent >= 0 : (changeInr !== undefined ? changeInr >= 0 : true);

  const renderValue = (currency: 'INR' | 'USD', size: 'large' | 'small') => {
    const val = currency === 'INR' ? inrValue : usdValue;
    const formatted = formatVal(val, currency, currency === 'INR' ? 0 : 0);

    if (size === 'large') {
      return <span className="font-bold tracking-tight text-white">{formatted}</span>;
    }
    return <span className="text-gray-400 font-medium">{formatted}</span>;
  };

  return (
    <GlassCard className={`flex flex-col justify-between ${className}`} hoverEffect={true}>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-400 tracking-wide uppercase">{title}</span>
          {changePercent !== undefined && (
            <div
              className={`flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                isPositive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              {isPositive ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
              {Math.abs(changePercent).toFixed(2)}%
            </div>
          )}
        </div>

        <div className="space-y-1">
          {currencyPref === 'INR' && (
            <div className="text-3xl">{renderValue('INR', 'large')}</div>
          )}
          {currencyPref === 'USD' && (
            <div className="text-3xl">{renderValue('USD', 'large')}</div>
          )}
          {currencyPref === 'BOTH' && (
            <div className="flex flex-col">
              <div className="text-3xl">{renderValue('INR', 'large')}</div>
              <div className="text-lg mt-0.5">{renderValue('USD', 'small')}</div>
            </div>
          )}
        </div>
      </div>

      {(changeInr !== undefined || extraValue !== undefined) && (
        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
          <div>
            {changeInr !== undefined && (
              <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                {isPositive ? '+' : ''}
                {currencyPref === 'USD'
                  ? formatVal(changeUsd || 0, 'USD', 0)
                  : formatVal(changeInr, 'INR', 0)}
                {currencyPref === 'BOTH' && ` (${formatVal(changeUsd || 0, 'USD', 0)})`}
              </span>
            )}
          </div>
          {extraLabel && extraValue && (
            <div className="text-right">
              <span className="text-gray-500">{extraLabel}: </span>
              <span className="font-semibold text-gray-300">{extraValue}</span>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}
