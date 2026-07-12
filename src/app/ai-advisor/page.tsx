'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useSession } from '@/context/authContext';
import { usePortfolio, TargetAllocation, AssetCategory } from '@/context/portfolioStore';
import { formatVal } from '@/services/financeUtils';
import { getCsrfToken } from '@/lib/csrfClient';
import GlassCard from '@/components/GlassCard';
import {
  BrainCircuit,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Scale,
  Sparkles,
  Info,
  Send,
  Image as ImageIcon,
  Trash2,
  Loader2,
  User,
  X
} from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  stocks: 'Stocks (US & Indian)',
  etfs: 'ETFs',
  mutual_funds: 'Mutual Funds',
  crypto: 'Cryptocurrency',
  gold: 'Gold & Metals',
  fixed_income: 'Fixed Income & Debt',
  cash: 'Cash & Savings',
  real_estate: 'Real Estate',
};

export default function AIAdvisorPage() {
  const {
    assets,
    usdInrRate,
    currencyPref,
    targetAllocation,
    setTargetAllocation,
    goals
  } = usePortfolio();

  // Temporary local state for target allocations during edit/sliders
  const [localTargets, setLocalTargets] = useState<TargetAllocation>({ ...targetAllocation });

  // Sum of local targets to validate that it sums to 100%
  const totalTargetPct = useMemo(() => {
    return (
      localTargets.stocks +
      localTargets.mutual_funds +
      localTargets.crypto +
      localTargets.gold +
      localTargets.fixed_income +
      localTargets.cash +
      localTargets.real_estate
    );
  }, [localTargets]);

  const handleSliderChange = (cat: keyof TargetAllocation, value: number) => {
    setLocalTargets(prev => ({
      ...prev,
      [cat]: value,
    }));
  };

  const handleSaveTargets = () => {
    if (totalTargetPct !== 100) {
      alert(`Allocation must sum to exactly 100%. Current sum: ${totalTargetPct}%`);
      return;
    }
    setTargetAllocation(localTargets);
    alert('Target allocations saved successfully.');
  };

  // 1. Compute current allocations in USD
  const currentAllocation = useMemo(() => {
    let totalUsd = 0;
    const catVals: Record<keyof TargetAllocation, number> = {
      stocks: 0,
      etfs: 0,
      mutual_funds: 0,
      crypto: 0,
      gold: 0,
      fixed_income: 0,
      cash: 0,
      real_estate: 0,
    };

    assets.forEach((asset) => {
      const curValue = asset.quantity * asset.currentPrice;
      const curValueUsd = asset.currency === 'USD' ? curValue : curValue / usdInrRate;
      totalUsd += curValueUsd;

      if (asset.category === 'stock_us' || asset.category === 'stock_in') {
        catVals.stocks += curValueUsd;
      } else if (asset.category === 'etf') {
        catVals.etfs += curValueUsd;
      } else if (asset.category === 'mutual_fund') {
        catVals.mutual_funds += curValueUsd;
      } else if (asset.category === 'crypto') {
        catVals.crypto += curValueUsd;
      } else if (asset.category === 'gold') {
        catVals.gold += curValueUsd;
      } else if (asset.category === 'fixed_income') {
        catVals.fixed_income += curValueUsd;
      } else if (asset.category === 'cash') {
        catVals.cash += curValueUsd;
      } else if (asset.category === 'real_estate') {
        catVals.real_estate += curValueUsd;
      }
    });

    const percentages = {} as Record<keyof TargetAllocation, number>;
    Object.keys(catVals).forEach((k) => {
      const key = k as keyof TargetAllocation;
      percentages[key] = totalUsd > 0 ? (catVals[key] / totalUsd) * 100 : 0;
    });

    return {
      totalUsd,
      catVals,
      percentages,
    };
  }, [assets, usdInrRate]);

  // 2. Local Heuristics-driven AI Insights Engine
  const aiInsights = useMemo(() => {
    const insights: { message: string; type: 'warning' | 'info' | 'success'; category: string }[] = [];
    const p = currentAllocation.percentages;

    // Check Crypto Overexposure (> 15% by default)
    if (p.crypto > 15) {
      insights.push({
        message: `Crypto allocation is high at ${p.crypto.toFixed(1)}%. Volatile assets should ideally represent less than 15% of your net worth to reduce downside drawdowns.`,
        type: 'warning',
        category: 'Asset Concentration',
      });
    }

    // Check Cash stagnation (> 20%)
    if (p.cash > 20) {
      insights.push({
        message: `You hold ${p.cash.toFixed(1)}% in cash reserves. Consider transferring cash to Equities or Debt for inflation protection.`,
        type: 'warning',
        category: 'Inflation Drag',
      });
    } else if (p.cash < 3 && currentAllocation.totalUsd > 0) {
      insights.push({
        message: `Cash allocation is low at ${p.cash.toFixed(1)}%. Maintain at least 5% as emergency funds.`,
        type: 'info',
        category: 'Emergency Liquidity',
      });
    }

    // Check Debt allocation relative to equity
    const equities = p.stocks + p.mutual_funds;
    if (equities > 75 && p.fixed_income < 10) {
      insights.push({
        message: `Equity weighting (${equities.toFixed(1)}%) is aggressive. Rebalance to debt instruments (FDs, bonds) for protection.`,
        type: 'warning',
        category: 'Risk Balance',
      });
    }

    let deviationsCount = 0;
    Object.keys(targetAllocation).forEach((key) => {
      const k = key as keyof TargetAllocation;
      const dev = Math.abs(p[k] - targetAllocation[k]);
      if (dev > 5) deviationsCount++;
    });

    if (deviationsCount > 2) {
      insights.push({
        message: 'Rebalancing suggested: Your portfolio asset allocations have drifted significantly from target weights.',
        type: 'info',
        category: 'Portfolio Drift',
      });
    } else if (currentAllocation.totalUsd > 0) {
      insights.push({
        message: 'Your asset distributions are well-aligned with your target templates!',
        type: 'success',
        category: 'Asset Health',
      });
    }

    return insights;
  }, [currentAllocation, targetAllocation]);

  // 3. Rebalancing Engine Math & Tax Estimator
  const rebalanceDecisions = useMemo(() => {
    const suggestions: {
      category: keyof TargetAllocation;
      action: 'BUY' | 'SELL' | 'HOLD';
      currentAmountUsd: number;
      targetAmountUsd: number;
      deltaUsd: number;
      taxImpactUsd: number;
    }[] = [];

    let totalTaxImpactUsd = 0;

    Object.keys(targetAllocation).forEach((key) => {
      const k = key as keyof TargetAllocation;
      const currentVal = currentAllocation.catVals[k];
      const targetVal = currentAllocation.totalUsd * (targetAllocation[k] / 100);
      const delta = targetVal - currentVal;
      const absDelta = Math.abs(delta);

      let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
      if (delta > 50) action = 'BUY';
      else if (delta < -50) action = 'SELL';

      let tax = 0;
      if (action === 'SELL') {
        if (k === 'crypto') {
          const estimatedProfits = absDelta * 0.40;
          tax = estimatedProfits * 0.30;
        } else if (k === 'stocks' || k === 'etfs' || k === 'mutual_funds') {
          const estimatedProfits = absDelta * 0.30;
          tax = estimatedProfits * 0.15;
        }
      }

      totalTaxImpactUsd += tax;

      suggestions.push({
        category: k,
        action,
        currentAmountUsd: currentVal,
        targetAmountUsd: targetVal,
        deltaUsd: delta,
        taxImpactUsd: tax,
      });
    });

    return {
      suggestions,
      totalTaxImpactUsd,
    };
  }, [currentAllocation, targetAllocation]);

  // --- AI Chatbot States & Helpers ---
  const { data: session } = useSession();
  const userId = session?.user?.id || 'guest';

  const [chatMessages, setChatMessages] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
    image?: string;
  }>>([]);

  const [chatInitialized, setChatInitialized] = useState(false);

  // Load chat messages from localStorage on initialization
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`wealthos_chat_history_${userId}`);
      if (stored) {
        try {
          setChatMessages(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse chat history:", e);
        }
      } else {
        setChatMessages([
          {
            role: 'assistant',
            content: 'Hello! I am your WealthOS AI Advisor. Ask me anything about your current holdings, rebalancing options, or upload a screenshot of another portfolio to analyze!'
          }
        ]);
      }
      setChatInitialized(true);
    }
  }, [userId]);

  // Save chat messages to localStorage whenever they change
  useEffect(() => {
    if (chatInitialized && typeof window !== 'undefined') {
      localStorage.setItem(`wealthos_chat_history_${userId}`, JSON.stringify(chatMessages));
    }
  }, [chatMessages, userId, chatInitialized]);

  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async (textToSend = inputText) => {
    const activeText = textToSend || inputText;
    if (!activeText.trim() && !attachedImage) return;

    const newUserMessage = {
      role: 'user' as const,
      content: activeText,
      image: attachedImage || undefined
    };

    setChatMessages(prev => [...prev, newUserMessage]);
    setInputText('');
    setAttachedImage(null);
    setIsSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
        },
        body: JSON.stringify({
          messages: [...chatMessages, newUserMessage],
          portfolio: assets,
          usdInrRate,
          currencyPref,
          goals
        })
      });

      const data = await response.json();
      if (data.error) {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${data.error}`
        }]);
      } else {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: data.text
        }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I failed to communicate with the AI advisor. Please verify your server connection.'
      }]);
    } finally {
      setIsSending(false);
    }
  };

  const clearChat = () => {
    const defaultMsg = [
      {
        role: 'assistant' as const,
        content: 'Hello! I am your WealthOS AI Advisor. Ask me anything about your current holdings, rebalancing options, or upload a screenshot of another portfolio to analyze!'
      }
    ];
    setChatMessages(defaultMsg);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`wealthos_chat_history_${userId}`, JSON.stringify(defaultMsg));
    }
  };

  const parseInlineStyles = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-white font-extrabold">{part.slice(2, -2)}</strong>;
      }
      const codeParts = part.split(/(`.*?`)/g);
      return codeParts.map((cPart, j) => {
        if (cPart.startsWith('`') && cPart.endsWith('`')) {
          return <code key={j} className="bg-black/60 px-1 py-0.5 rounded text-indigo-300 font-mono text-[10px]">{cPart.slice(1, -1)}</code>;
        }
        return cPart;
      });
    });
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return <h4 key={idx} className="text-[11px] font-extrabold text-white mt-3 mb-1 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-violet-400" /> {line.substring(4)}</h4>;
      }
      if (line.startsWith('#### ')) {
        return <h5 key={idx} className="text-[10px] font-bold text-gray-200 mt-2 mb-0.5">{line.substring(5)}</h5>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={idx} className="text-xs font-black text-white mt-4 mb-1.5 border-b border-white/5 pb-1 uppercase tracking-wider">{line.substring(3)}</h3>;
      }
      const trimmedLine = line.trimStart();
      if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ') || trimmedLine.startsWith('+ ')) {
        return (
          <li key={idx} className="list-disc list-inside text-[11px] text-gray-300 ml-2 my-0.5 leading-relaxed">
            {parseInlineStyles(trimmedLine.substring(2))}
          </li>
        );
      }
      if (line.startsWith('> ')) {
        return (
          <blockquote key={idx} className="border-l-2 border-indigo-500 bg-indigo-500/10 px-3 py-1.5 my-2 rounded text-[11px] text-gray-300 italic">
            {parseInlineStyles(line.substring(2))}
          </blockquote>
        );
      }
      if (!line.trim()) {
        return <div key={idx} className="h-1.5" />;
      }
      return (
        <p key={idx} className="text-[11px] text-gray-300 leading-relaxed my-0.5">
          {parseInlineStyles(line)}
        </p>
      );
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight font-heading">AI Advisor & Portfolio Rebalancer</h2>
        <p className="text-xs text-gray-400">Target adjustments, delta calculators, live interactive AI advisor, and rebalance execution lists.</p>
      </div>

      {/* Main Grid Layout: Targets (Left) vs Chat / Math (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Target Templates Card */}
          <GlassCard hoverEffect={false} className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center">
                <Scale className="w-4 h-4 mr-2 text-indigo-400" /> Target Templates
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">Define your ideal asset distribution profile (must sum to 100%)</p>
            </div>

            <div className="space-y-4">
              {(Object.keys(localTargets) as (keyof TargetAllocation)[]).map((cat) => {
                const val = localTargets[cat];
                return (
                  <div key={cat} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-300">{CATEGORY_LABELS[cat]}</span>
                      <span className="text-indigo-400 font-bold">{val}%</span>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={val}
                        onChange={(e) => handleSliderChange(cat, parseInt(e.target.value))}
                        className="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs">
              <div>
                <span className="text-gray-500 font-medium">Total allocation: </span>
                <span
                  className={`font-bold ${
                    totalTargetPct === 100 ? 'text-emerald-400' : 'text-rose-400 animate-pulse'
                  }`}
                >
                  {totalTargetPct}%
                </span>
              </div>
              
              <button
                onClick={handleSaveTargets}
                disabled={totalTargetPct !== 100}
                className="glass-btn-primary px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
              >
                Apply Targets
              </button>
            </div>
          </GlassCard>

          {/* AI Diagnostics Card */}
          <GlassCard hoverEffect={true} className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-white/5 pb-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">AI Portfolio Diagnoses</h3>
            </div>

            <div className="space-y-3">
              {aiInsights.map((insight, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border flex gap-3 ${
                    insight.type === 'warning'
                      ? 'bg-rose-500/5 border-rose-500/20 text-rose-300'
                      : insight.type === 'success'
                      ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                      : 'bg-indigo-500/5 border-indigo-500/20 text-indigo-300'
                  }`}
                >
                  <BrainCircuit className="w-5 h-5 shrink-0 mt-0.5 text-violet-400" />
                  <div>
                    <span className="font-extrabold text-xs block text-white">{insight.category}</span>
                    <p className="text-[11px] leading-relaxed mt-0.5 text-gray-400">{insight.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Right Column (8 cols) */}
        <div className="lg:col-span-8 space-y-6">

          {/* Real AI Chatbot Component */}
          <GlassCard hoverEffect={false} className="flex flex-col h-[700px] p-0 overflow-hidden relative border border-white/10 bg-black/20">
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div className="flex items-center space-x-2.5">
                <BrainCircuit className="w-5 h-5 text-indigo-400 animate-pulse" />
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">WealthOS Neural Coach</h3>
                  <p className="text-[9px] text-gray-500">Live Gemini multimodal assistant powered by your current holdings</p>
                </div>
              </div>
              <button 
                onClick={clearChat}
                className="p-1.5 text-gray-400 hover:text-white transition-colors duration-200 hover:bg-white/5 rounded-lg"
                title="Reset Chat"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
              {chatMessages.map((msg, index) => (
                <div 
                  key={index}
                  className={`flex gap-3 items-start ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role !== 'user' && (
                    <div className="w-7 h-7 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                      <BrainCircuit className="w-4 h-4 text-indigo-400" />
                    </div>
                  )}
                  
                  <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`rounded-2xl px-4 py-2.5 text-xs max-w-[90%] md:max-w-[80%] ${
                      msg.role === 'user'
                        ? 'bg-indigo-500/20 border border-indigo-500/30 text-white rounded-tr-none'
                        : 'bg-white/5 border border-white/10 text-gray-300 rounded-tl-none space-y-1 shadow-lg'
                    }`}>
                      {msg.image && (
                        <img 
                          src={msg.image} 
                          alt="attached asset document" 
                          className="rounded-lg max-h-40 object-cover border border-white/10 mb-2"
                        />
                      )}
                      <div>
                        {msg.role === 'user' ? msg.content : renderMarkdown(msg.content)}
                      </div>
                    </div>
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                </div>
              ))}

              {isSending && (
                <div className="flex gap-3 items-start justify-start">
                  <div className="w-7 h-7 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-none px-4 py-2.5 text-[11px] text-gray-400">
                    Neural engine thinking...
                  </div>
                </div>
              )}
            </div>

            {/* Quick Chips */}
            <div className="flex gap-2 overflow-x-auto pb-2 px-4 scrollbar-none shrink-0 border-t border-white/5 pt-2">
              <button 
                onClick={() => handleSendMessage("Check my portfolio against the last 24 hours of market news and give me advice.")}
                disabled={isSending}
                className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] text-gray-300 hover:bg-white/10 hover:border-white/20 transition-all font-medium disabled:opacity-50 shrink-0"
              >
                📰 24h News Analysis
              </button>
              <button 
                onClick={() => handleSendMessage("Conduct an audit of my asset concentration and risk exposure.")}
                disabled={isSending}
                className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] text-gray-300 hover:bg-white/10 hover:border-white/20 transition-all font-medium disabled:opacity-50 shrink-0"
              >
                🔍 Audit Risk Exposure
              </button>
              <button 
                onClick={() => handleSendMessage("Analyze my cryptocurrency holdings (BTC, ETH, SUI, MAJOR, ZK, etc.). What is your recommendation?")}
                disabled={isSending}
                className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] text-gray-300 hover:bg-white/10 hover:border-white/20 transition-all font-medium disabled:opacity-50 shrink-0"
              >
                🪙 Altcoin Recommendations
              </button>
              <button 
                onClick={() => handleSendMessage("Give me rebalancing actions based on my target allocations.")}
                disabled={isSending}
                className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] text-gray-300 hover:bg-white/10 hover:border-white/20 transition-all font-medium disabled:opacity-50 shrink-0"
              >
                ⚖️ Rebalance Strategy
              </button>
            </div>

            {/* Input Row */}
            <div className="p-4 bg-black/40 border-t border-white/5 flex flex-col gap-2.5 shrink-0">
              {attachedImage && (
                <div className="relative w-16 h-16 rounded-xl border border-indigo-500/50 overflow-hidden shrink-0 group">
                  <img src={attachedImage} alt="attachment preview" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => setAttachedImage(null)}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200"
                  >
                    <X className="w-4 h-4 text-rose-400" />
                  </button>
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                  title="Upload portfolio image / screenshot"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask advisor, rebalance queries, or upload screenshot..."
                  className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/60"
                  disabled={isSending}
                />

                <button
                  onClick={() => handleSendMessage()}
                  disabled={isSending || (!inputText.trim() && !attachedImage)}
                  className="glass-btn-primary p-2.5 rounded-xl disabled:opacity-50 shrink-0 flex items-center justify-center"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </GlassCard>

          {/* Rebalancing Delta Matrix */}
          <GlassCard hoverEffect={true} className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center space-x-2">
                <Scale className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Rebalancing Delta Matrix</h3>
              </div>
              <div className="text-[10px] text-gray-500">
                Est. Tax Impact:{' '}
                <span className="text-rose-400 font-bold">
                  {currencyPref === 'USD'
                    ? formatVal(rebalanceDecisions.totalTaxImpactUsd, 'USD', 0)
                    : formatVal(rebalanceDecisions.totalTaxImpactUsd * usdInrRate, 'INR', 0)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto no-scrollbar text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-gray-500 uppercase font-semibold text-[10px] border-b border-white/5">
                    <th className="py-2">Asset Class</th>
                    <th className="py-2 text-right">Current Weight</th>
                    <th className="py-2 text-right">Target Weight</th>
                    <th className="py-2 text-right">Delta Amount</th>
                    <th className="py-2 text-center">Action Suggestion</th>
                    <th className="py-2 text-right">Tax Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                  {rebalanceDecisions.suggestions.map((s) => {
                    const label = CATEGORY_LABELS[s.category] || s.category;
                    const deltaInr = s.deltaUsd * usdInrRate;
                    const taxInr = s.taxImpactUsd * usdInrRate;

                    return (
                      <tr key={s.category} className="hover:bg-white/5">
                        <td className="py-3 font-semibold text-white">{label}</td>
                        <td className="py-3 text-right">{(currentAllocation.percentages[s.category] || 0).toFixed(1)}%</td>
                        <td className="py-3 text-right">{targetAllocation[s.category]}%</td>
                        <td className={`py-3 text-right font-bold ${s.deltaUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {s.deltaUsd >= 0 ? '+' : ''}
                          {currencyPref === 'USD'
                            ? formatVal(s.deltaUsd, 'USD', 0)
                            : formatVal(deltaInr, 'INR', 0)}
                        </td>
                        <td className="py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                              s.action === 'BUY'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : s.action === 'SELL'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-transparent text-gray-500 border border-white/5'
                            }`}
                          >
                            {s.action}
                          </span>
                        </td>
                        <td className="py-3 text-right font-medium text-rose-400">
                          {s.taxImpactUsd > 0
                            ? (currencyPref === 'USD' ? formatVal(s.taxImpactUsd, 'USD', 0) : formatVal(taxInr, 'INR', 0))
                            : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-white/5 text-[10px] text-gray-500 flex gap-2.5">
              <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <p className="leading-snug">
                The estimated tax assumes standard rates: 30% capital gains tax on crypto sells, and 15% STCG tax on equities (Stocks/MFs) sells assuming 30-40% of the asset volume consists of profits. Real tax will vary on holding period details.
              </p>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
