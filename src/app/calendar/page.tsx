'use client';

import React, { useState, useMemo } from 'react';
import { usePortfolio } from '@/context/portfolioStore';
import { formatVal } from '@/services/financeUtils';
import GlassCard from '@/components/GlassCard';
import {
  Calendar as CalIcon,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Plus,
  ArrowRight,
  Clock
} from 'lucide-react';

interface CalendarEvent {
  day: number;
  title: string;
  category: 'sip' | 'tax' | 'dividend' | 'maturity';
  details: string;
  amountFormatted?: string;
}

export default function CalendarPage() {
  const { assets, usdInrRate, currencyPref } = usePortfolio();

  // Simple state for active month navigation
  const [currentMonthIndex, setCurrentMonthIndex] = useState(6); // July (0-indexed: 6)
  const [currentYear, setCurrentYear] = useState(2026);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    if (currentMonthIndex === 0) {
      setCurrentMonthIndex(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonthIndex(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonthIndex === 11) {
      setCurrentMonthIndex(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonthIndex(prev => prev + 1);
    }
  };

  // Compile calendar events for the active month
  const calendarEvents = useMemo(() => {
    const events: CalendarEvent[] = [];

    // 1. Compile SIP schedules from Mutual Funds
    assets.forEach(asset => {
      if (asset.category === 'mutual_fund' && asset.extra?.sipAmount && asset.extra?.sipDate) {
        const amtVal = asset.extra.sipAmount;
        events.push({
          day: asset.extra.sipDate,
          title: `SIP Debit: ${asset.name}`,
          category: 'sip',
          details: `Monthly SIP auto-debit of units from your bank.`,
          amountFormatted: currencyPref === 'USD' 
            ? formatVal(amtVal / usdInrRate, 'USD', 0) 
            : formatVal(amtVal, 'INR', 0)
        });
      }
    });

    // 2. Compile Tax deadlines (Specific months in India/US)
    if (currentMonthIndex === 6) { // July
      events.push({
        day: 31,
        title: 'Income Tax Return Due Date',
        category: 'tax',
        details: 'Last date to file ITR (AY 2026-27) without late filing penalty fees.'
      });
    }
    
    if (currentMonthIndex === 8) { // September
      events.push({
        day: 15,
        title: 'Advance Tax Payment: Q2 Due',
        category: 'tax',
        details: 'Deadline to submit second instalment of advance tax (30% of total tax liability).'
      });
    }

    if (currentMonthIndex === 11) { // December
      events.push({
        day: 15,
        title: 'Advance Tax Payment: Q3 Due',
        category: 'tax',
        details: 'Deadline to submit third instalment of advance tax (75% of total tax liability).'
      });
    }

    if (currentMonthIndex === 2) { // March
      events.push({
        day: 15,
        title: 'Advance Tax Payment: Q4 Due',
        category: 'tax',
        details: 'Last deadline to submit final instalment of advance tax (100% of tax liability).'
      });
      events.push({
        day: 31,
        title: 'Financial Year Ending Closures',
        category: 'tax',
        details: 'Deadline for completing tax saving deductions (PPF, ELSS, NPS, Health Insurance) under Section 80C.'
      });
    }

    if (currentMonthIndex === 5) { // June
      events.push({
        day: 15,
        title: 'Advance Tax Payment: Q1 Due',
        category: 'tax',
        details: 'Deadline to submit first instalment of advance tax (15% of total tax liability).'
      });
    }

    // 3. Compile FD maturities
    assets.forEach(asset => {
      if (asset.category === 'fixed_income' && asset.extra?.maturityDate) {
        const mat = new Date(asset.extra.maturityDate);
        if (mat.getMonth() === currentMonthIndex && mat.getFullYear() === currentYear) {
          const valAmt = asset.quantity * asset.avgBuyPrice;
          events.push({
            day: mat.getDate(),
            title: `FD Maturity: ${asset.name}`,
            category: 'maturity',
            details: `Maturity proceeds rollover scheduling. Principal: ${formatVal(valAmt, asset.currency, 0)}`,
            amountFormatted: formatVal(valAmt * (1 + (asset.extra.interestRate || 7) / 100 * 5), asset.currency, 0)
          });
        }
      }
    });

    // 4. Compile simulated Bond coupon payouts (e.g. SGB Interest on Jan 15th & July 15th)
    const hasSgb = assets.some(a => a.ticker === 'SGB');
    if (hasSgb && (currentMonthIndex === 0 || currentMonthIndex === 6)) { // Jan & July
      events.push({
        day: 15,
        title: 'SGB Semi-Annual Coupon Payout',
        category: 'dividend',
        details: 'Interest coupon credit of 1.25% (half of 2.5% annual rate) on Sovereign Gold Bonds.',
        amountFormatted: currencyPref === 'USD' ? '$12' : '₹1,000'
      });
    }

    return events;
  }, [currentMonthIndex, currentYear, assets, usdInrRate, currencyPref]);

  // Calendar dates setup (July 2026 has 31 days, starts on a Wednesday)
  // Let's implement a dynamic calendar calculator helper
  const calendarDays = useMemo(() => {
    // Days in current month
    const daysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
    // First day weekday (0-6)
    const firstDayIndex = new Date(currentYear, currentMonthIndex, 1).getDay();

    const grid = [];
    
    // Empty buffer days before start
    for (let i = 0; i < firstDayIndex; i++) {
      grid.push(null);
    }

    // Days numbers
    for (let d = 1; d <= daysInMonth; d++) {
      const dayEvents = calendarEvents.filter(e => e.day === d);
      grid.push({
        dayNumber: d,
        events: dayEvents,
      });
    }

    return grid;
  }, [currentMonthIndex, currentYear, calendarEvents]);

  // Selected Day State for detail viewing
  const [selectedDay, setSelectedDay] = useState<number | null>(15);

  const activeDayEvents = useMemo(() => {
    if (!selectedDay) return [];
    return calendarEvents.filter(e => e.day === selectedDay);
  }, [selectedDay, calendarEvents]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight font-heading">Investment Calendar</h2>
        <p className="text-xs text-gray-400">Track recurring SIP debits, interest coupon credits, bond maturities, and due dates.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: 70% Monthly Grid View */}
        <GlassCard hoverEffect={false} className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center space-x-2">
              <CalIcon className="w-4 h-4 text-indigo-400" />
              <span className="font-bold text-sm text-gray-300 uppercase tracking-wider">
                {months[currentMonthIndex]} {currentYear}
              </span>
            </div>
            
            <div className="flex space-x-1">
              <button onClick={handlePrevMonth} className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={handleNextMonth} className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2.5 text-center text-xs">
            {/* Weekdays */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((wd) => (
              <div key={wd} className="text-gray-500 font-semibold py-1 uppercase text-[10px] tracking-wider">
                {wd}
              </div>
            ))}

            {/* Grid days */}
            {calendarDays.map((cell, idx) => {
              if (cell === null) {
                return <div key={`empty-${idx}`} className="h-16 bg-transparent" />;
              }

              const isSelected = selectedDay === cell.dayNumber;
              const hasEvents = cell.events.length > 0;

              return (
                <div
                  key={`day-${cell.dayNumber}`}
                  onClick={() => setSelectedDay(cell.dayNumber)}
                  className={`h-16 rounded-xl flex flex-col justify-between p-1.5 cursor-pointer border transition-all ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500/40'
                      : hasEvents
                      ? 'bg-white/5 border-white/10 hover:border-white/20'
                      : 'bg-black/20 border-transparent hover:border-white/5'
                  }`}
                >
                  <span className={`text-[10px] font-bold self-start ${isSelected ? 'text-indigo-400' : 'text-gray-400'}`}>
                    {cell.dayNumber}
                  </span>
                  
                  {/* Category dots */}
                  {hasEvents && (
                    <div className="flex space-x-1 self-end">
                      {cell.events.map((e, eIdx) => (
                        <div
                          key={eIdx}
                          className={`w-1.5 h-1.5 rounded-full ${
                            e.category === 'sip'
                              ? 'bg-indigo-400'
                              : e.category === 'tax'
                              ? 'bg-rose-400'
                              : e.category === 'dividend'
                              ? 'bg-emerald-400'
                              : 'bg-amber-400'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>

        {/* Right: 30% Schedule detail panel */}
        <GlassCard hoverEffect={false} className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center">
              <Clock className="w-4 h-4 mr-1.5 text-indigo-400" /> Agenda for Day {selectedDay}
            </h3>
            <p className="text-[10px] text-gray-500 mt-0.5">Details of scheduled investments or calendar filings</p>
          </div>

          <div className="space-y-3">
            {activeDayEvents.length === 0 ? (
              <p className="text-center py-10 text-gray-500 text-xs italic">No actions scheduled for this date.</p>
            ) : (
              activeDayEvents.map((e, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-white/5 bg-black/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        e.category === 'sip'
                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          : e.category === 'tax'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : e.category === 'dividend'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {e.category}
                    </span>
                    {e.amountFormatted && (
                      <span className="font-extrabold text-xs text-white">{e.amountFormatted}</span>
                    )}
                  </div>
                  
                  <h4 className="font-bold text-xs text-white leading-tight">{e.title}</h4>
                  <p className="text-[10px] text-gray-400 leading-snug">{e.details}</p>
                </div>
              ))
            )}
          </div>

          {/* Advance schedule details */}
          <div className="border-t border-white/5 pt-4">
            <h4 className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-2.5">Monthly Totals</h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400 font-medium">SIP Outflows:</span>
                <span className="font-bold text-white">
                  {currencyPref === 'USD' ? '$300' : '₹25,000'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 font-medium">Expected Dividends:</span>
                <span className="font-bold text-emerald-400">
                  {currencyPref === 'USD' ? '+$12' : '+₹1,000'}
                </span>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
