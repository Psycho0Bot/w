'use client';

import React, { useState, useEffect, use, useMemo } from 'react';
import Link from 'next/link';
import { usePortfolio } from '@/context/portfolioStore';
import GlassCard from '@/components/GlassCard';
import NewsCard, { type NewsArticleData } from '@/components/NewsCard';
import { BADGE_STYLES, getBadgeColor, isVerifiedSource, getSourceInfo, formatPrice } from '@/lib/assetLogos';
import {
  ArrowLeft, ExternalLink, Bookmark, BookmarkCheck, TrendingUp, TrendingDown,
  Minus, Clock, Newspaper, Info, Briefcase, AlertCircle, CheckCircle2,
  Layers, Zap, Target, BarChart3, Link2, ChevronRight, FileText, ListChecks,
  Globe, Activity, ShieldCheck, ShieldAlert,
} from 'lucide-react';

/**
 * Normalized Impact Score (0-100).
 * Uses logarithmic scaling so only exceptional articles exceed 90.
 * Raw impact scores of 3→~38, 5→~61, 8→~84, 12+→90+.
 */
function getImportanceNumber(score: number): number {
  if (score <= 0) return 0;
  // Logarithmic normalization: maps raw scores to a 0-100 scale
  // where typical articles (score 3-5) get 30-60, high-impact (8+) get 70-90+
  const normalized = Math.round(Math.min(100, 20 * Math.log2(1 + score * 2)));
  return normalized;
}

/**
 * Impact level from normalized score.
 */
function getImpactLevel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'Critical', color: 'text-rose-400' };
  if (score >= 70) return { label: 'High', color: 'text-amber-400' };
  if (score >= 40) return { label: 'Medium', color: 'text-blue-400' };
  return { label: 'Low', color: 'text-gray-400' };
}

/**
 * Confidence level — objective factors, not arbitrary percentage.
 */
function getConfidenceLevel(sourceCount: number, verified: boolean): {
  label: string; signals: number; maxSignals: number; color: string;
} {
  let signals = 0;
  const maxSignals = 4;
  if (verified) signals++;
  if (sourceCount > 1) signals++;
  if (sourceCount > 3) signals++;
  // Entity match is always true if we have a ticker
  signals++;

  const label = signals >= 3 ? 'High' : signals >= 2 ? 'Medium' : 'Low';
  const color = signals >= 3 ? 'text-emerald-400' : signals >= 2 ? 'text-amber-400' : 'text-rose-400';
  return { label, signals, maxSignals, color };
}

/** Estimate reading time from word count */
function estimateReadingTime(text?: string): string {
  if (!text) return '1 min read';
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  return `${Math.max(1, Math.ceil(words / 200))} min read`;
}

/** Extract key points from article summary (split by sentences, take top 3-5) */
function extractKeyPoints(summary?: string): string[] {
  if (!summary) return [];
  const sentences = summary
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 200);
  return sentences.slice(0, 5);
}

/** Related assets — tickers commonly associated with the article's ticker */
const RELATED_ASSETS_MAP: Record<string, string[]> = {
  BTC: ['ETH', 'COIN', 'MSTR', 'IBIT'],
  ETH: ['BTC', 'COIN', 'UNI', 'LDO'],
  SOL: ['BTC', 'ETH', 'JUP', 'PYTH'],
  AAPL: ['MSFT', 'GOOGL', 'AMZN', 'NVDA'],
  TSLA: ['NVDA', 'AAPL', 'RIVN', 'LCID'],
  NVDA: ['AMD', 'INTC', 'TSM', 'MSFT'],
  MSFT: ['AAPL', 'GOOGL', 'AMZN', 'NVDA'],
  GOOGL: ['MSFT', 'AMZN', 'META', 'AAPL'],
  RELIANCE: ['TCS', 'INFY', 'HDFCBANK', 'SBIN'],
  TCS: ['INFY', 'WIPRO', 'HCLTECH', 'RELIANCE'],
};

function getRelatedAssets(ticker?: string): string[] {
  if (!ticker) return [];
  return RELATED_ASSETS_MAP[ticker.toUpperCase()] || [];
}

/** Colored badge with ticker initials — no external images */
function MiniLogo({ ticker, category, name, size = 'sm' }: { ticker: string; category?: string; name?: string; size?: 'sm' | 'md' | 'lg' }) {
  const color = getBadgeColor(category);
  const style = BADGE_STYLES[color];
  const sizes = { sm: 'w-5 h-5 text-[8px]', md: 'w-8 h-8 text-[10px]', lg: 'w-12 h-12 text-xs' };

  return (
    <div className={`${sizes[size]} rounded-full ${style.bg} ${style.ring} border flex items-center justify-center shrink-0`}>
      <span className={`font-black ${style.text}`}>{ticker.slice(0, 3)}</span>
    </div>
  );
}

export default function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { assets } = usePortfolio();
  const [article, setArticle] = useState<NewsArticleData | null>(null);
  const [related, setRelated] = useState<NewsArticleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [macroData, setMacroData] = useState<any>(null);

  const portfolioTickers = useMemo(() => assets.map(a => a.ticker), [assets]);
  const portfolioAssets = useMemo(() => {
    const totalValue = assets.reduce((sum, a) => sum + a.quantity * a.currentPrice, 0);
    return assets.map(a => ({
      ticker: a.ticker, name: a.name, category: a.category,
      weight: totalValue > 0 ? (a.quantity * a.currentPrice / totalValue) * 100 : 0,
      currentPrice: a.currentPrice, dayChangePercent: a.dayChangePercent || 0,
      avgBuyPrice: a.avgBuyPrice, quantity: a.quantity, currency: a.currency,
    }));
  }, [assets]);

  // Find affected portfolio holdings
  const affectedHoldings = useMemo(() => {
    if (!article) return [];
    const text = `${article.title} ${article.summary || ''} ${article.ticker || ''} ${article.assetName || ''}`.toLowerCase();
    return portfolioAssets.filter(a =>
      text.includes(a.ticker.toLowerCase()) || text.includes(a.name.toLowerCase())
    );
  }, [article, portfolioAssets]);

  // Portfolio impact calculation
  const portfolioImpact = useMemo(() => {
    if (!article || affectedHoldings.length === 0) return null;
    const totalValue = assets.reduce((sum, a) => sum + a.quantity * a.currentPrice, 0);
    const affectedValue = affectedHoldings.reduce((sum, a) => sum + (a.weight / 100) * totalValue, 0);
    const exposurePct = totalValue > 0 ? (affectedValue / totalValue) * 100 : 0;
    const score = article.impactScore || 0;
    let impactLevel = 'Low';
    if (score >= 8 && exposurePct > 15) impactLevel = 'Critical';
    else if (score >= 5 && exposurePct > 10) impactLevel = 'High';
    else if (score >= 3 && exposurePct > 5) impactLevel = 'Medium';
    return { exposurePct, impactLevel, affectedCount: affectedHoldings.length };
  }, [article, affectedHoldings, assets]);

  // Related assets (from mapping + portfolio overlap)
  const relatedAssets = useMemo(() => {
    if (!article) return [];
    const fromMap = getRelatedAssets(article.ticker);
    // Add the article's own ticker if not in the list
    if (article.ticker && !fromMap.includes(article.ticker)) {
      return [article.ticker, ...fromMap].slice(0, 5);
    }
    return fromMap.slice(0, 5);
  }, [article]);

  // Key points from summary
  const keyPoints = useMemo(() => extractKeyPoints(article?.summary), [article]);

  // Load article + macro context
  useEffect(() => {
    async function loadArticle() {
      setLoading(true);

      // Fetch macro data in parallel
      fetch('/api/news/macro').then(res => res.ok ? res.json() : null).then(data => setMacroData(data)).catch(() => {});

      try {
        // Try bookmark DB first
        const bookmarkRes = await fetch('/api/news/bookmark');
        if (bookmarkRes.ok) {
          const bookmarkData = await bookmarkRes.json();
          const found = bookmarkData.bookmarks.find((b: any) => b.article.id === id || b.article.url === decodeURIComponent(id));
          if (found) {
            const a = found.article;
            setArticle({
              id: a.id, title: a.title, link: a.url, summary: a.summary || undefined,
              source: a.source, imageUrl: a.imageUrl || undefined, pubDate: a.publishedAt,
              ticker: a.ticker || undefined, assetName: a.assetName || undefined,
              category: a.category || undefined, provider: a.provider || undefined,
              impactScore: a.impactScore || 0, impactType: a.impactType || 'neutral',
              bookmarked: true, sourceCount: 1, relatedArticles: [],
            });
            setIsBookmarked(true);
            setLoading(false);
            return;
          }
        }
        // Search endpoint
        const searchParams = new URLSearchParams({ time: 'week', sort: 'latest', limit: '50' });
        if (assets.length > 0) {
          searchParams.set('tickers', assets.map(a => a.ticker).join(','));
          searchParams.set('names', assets.map(a => a.name).join(','));
          searchParams.set('categories', assets.map(a => a.category).join(','));
        }
        const res = await fetch(`/api/news/search?${searchParams.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const allNews = data.news || [];
          const found = allNews.find((n: any) => n.id === id || n.link === decodeURIComponent(id));
          if (found) {
            setArticle(found);
            const relatedArticles = allNews
              .filter((n: any) => n.id !== found.id && (n.ticker === found.ticker || n.assetName === found.assetName))
              .slice(0, 4);
            setRelated(relatedArticles);
          }
        }
      } catch (err) {
        console.error('Failed to load article', err);
      } finally {
        setLoading(false);
      }
    }
    loadArticle();
  }, [id, assets]);

  const handleBookmark = async () => {
    if (!article) return;
    try {
      const csrfToken = document.cookie.match(/csrf-token=([^;]+)/)?.[1] || '';
      if (isBookmarked) {
        await fetch('/api/news/bookmark', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ action: 'remove', articleId: article.id }) });
        setIsBookmarked(false);
      } else {
        await fetch('/api/news/bookmark', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ action: 'save', article: { title: article.title, url: article.link, summary: article.summary, source: article.source, imageUrl: article.imageUrl, ticker: article.ticker, assetName: article.assetName, category: article.category, provider: article.provider, impactScore: article.impactScore, impactType: article.impactType, pubDate: article.pubDate } }) });
        setIsBookmarked(true);
      }
    } catch (err) { console.error('Bookmark failed', err); }
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const sentiment = article?.impactType || 'neutral';
  const sentimentIcon = sentiment === 'positive' ? <TrendingUp className="w-4 h-4" /> : sentiment === 'negative' ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />;
  const sentimentLabel = sentiment === 'positive' ? 'BULLISH' : sentiment === 'negative' ? 'BEARISH' : 'NEUTRAL';
  const sentimentColor = sentiment === 'positive' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : sentiment === 'negative' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' : 'text-gray-400 bg-white/5 border-white/5';

  const verified = article ? isVerifiedSource(article.source) : false;
  const importanceNum = getImportanceNumber(article?.impactScore || 0);
  const impactLevel = getImpactLevel(importanceNum);
  const sourceInfo = article ? getSourceInfo(article.source) : { type: 'Unverified', verified: false };
  const confidenceInfo = getConfidenceLevel(article?.sourceCount || 1, verified);
  const sourceCount = article?.sourceCount || 1;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <div className="text-xs text-indigo-300 font-bold animate-pulse">Loading article...</div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-gray-600 mx-auto" />
        <p className="text-sm text-gray-500">Article not found. It may have expired from the cache.</p>
        <Link href="/news" className="inline-flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300">
          <ArrowLeft className="w-4 h-4" /> Back to News
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back link */}
      <Link href="/news" className="inline-flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to News
      </Link>

      {/* Article header */}
      <div className="space-y-4">
        {/* Tags — sentiment + importance score + verified (NO provider badge) */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[9px] font-black px-2 py-1 rounded-lg border ${sentimentColor} flex items-center gap-1`}>
            {sentimentIcon} {sentimentLabel}
          </span>
          <span className="text-[9px] font-black px-2 py-1 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400 flex items-center gap-1">
            <Zap className="w-2.5 h-2.5" /> Impact Score {importanceNum}/100
          </span>
          {verified && (
            <span className="text-[9px] font-bold px-2 py-1 rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-400 flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" /> Verified Source
            </span>
          )}
          {sourceCount > 1 && (
            <span className="text-[9px] font-bold px-2 py-1 rounded-lg border border-white/10 bg-white/10 text-gray-300 flex items-center gap-1">
              <Layers className="w-2.5 h-2.5" /> {sourceCount} sources
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">{article.title}</h1>

        {/* Meta — publisher + verified + date + reading time */}
        <div className="flex items-center gap-3 text-[11px] text-gray-500 font-bold flex-wrap">
          <span className="text-indigo-400 flex items-center gap-1">{article.source}{verified && <CheckCircle2 className="w-2.5 h-2.5 text-blue-400" />}</span>
          <span>•</span><span>{formatDate(article.pubDate)}</span>
          <span>•</span><Clock className="w-3 h-3" /><span>{estimateReadingTime(article.summary)}</span>
        </div>
      </div>

      {/* Content starts immediately — no hero image */}

      {/* Summary */}
      {article.summary && (
        <GlassCard className="p-6" hoverEffect={false}>
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" /> Summary
          </h3>
          <p className="text-sm text-gray-300 leading-relaxed">{article.summary}</p>
        </GlassCard>
      )}

      {/* Key Points */}
      {keyPoints.length > 0 && (
        <GlassCard className="p-6" hoverEffect={false}>
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-indigo-400" /> Key Takeaways
          </h3>
          <div className="space-y-3">
            {keyPoints.map((point, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-lg bg-indigo-500/20 text-indigo-300 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-xs text-gray-300 leading-relaxed">{point}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Impact Score & Confidence — transparent calculations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Impact Score */}
        <GlassCard className="p-5" hoverEffect={false}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-gray-500 uppercase">Impact Score</span>
            <span className={`text-[10px] font-black ${impactLevel.color}`}>{impactLevel.label}</span>
          </div>
          <p className="text-2xl font-black text-white">{importanceNum}<span className="text-sm text-gray-500">/100</span></p>
          <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full" style={{ width: `${importanceNum}%` }} />
          </div>
          <div className="mt-3 space-y-1">
            <p className="text-[9px] text-gray-600 font-bold uppercase">Calculated from</p>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> Keyword signals ({article.impactScore || 0} matched)
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> Sentiment ({sentimentLabel.toLowerCase()})
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> Source type ({sourceInfo.type})
            </div>
            {portfolioImpact && (
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> Portfolio exposure ({portfolioImpact.exposurePct.toFixed(1)}%)
              </div>
            )}
          </div>
        </GlassCard>

        {/* Confidence */}
        <GlassCard className="p-5" hoverEffect={false}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-gray-500 uppercase">Confidence</span>
            <span className={`text-[10px] font-black ${confidenceInfo.color}`}>{confidenceInfo.label}</span>
          </div>
          <p className="text-2xl font-black text-white">{confidenceInfo.signals}<span className="text-sm text-gray-500">/{confidenceInfo.maxSignals} signals</span></p>
          <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full" style={{ width: `${(confidenceInfo.signals / confidenceInfo.maxSignals) * 100}%` }} />
          </div>
          <div className="mt-3 space-y-1">
            <p className="text-[9px] text-gray-600 font-bold uppercase">Based on</p>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
              {sourceInfo.verified ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> : <AlertCircle className="w-2.5 h-2.5 text-amber-400" />}
              {sourceInfo.verified ? 'Verified publisher' : 'Unverified publisher'}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
              {sourceCount > 1 ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> : <AlertCircle className="w-2.5 h-2.5 text-amber-400" />}
              {sourceCount > 1 ? `${sourceCount} independent sources` : 'Single source'}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> Entity match ({article.ticker || article.assetName || 'general'})
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Source classification — factual labels, no stars */}
      <GlassCard className="p-5" hoverEffect={false}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="w-4 h-4 text-indigo-400" />
            <div>
              <p className="text-xs font-bold text-white">{article.source}</p>
              <p className="text-[10px] text-gray-500">{sourceInfo.type}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {sourceInfo.verified ? (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" /> Verified
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400">
                <ShieldAlert className="w-3.5 h-3.5" /> Unverified
              </span>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Related Assets — with portfolio data for owned assets */}
      {relatedAssets.length > 0 && (
        <GlassCard className="p-6" hoverEffect={false}>
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-indigo-400" /> Related Assets
          </h3>
          <div className="space-y-2">
            {relatedAssets.map(ticker => {
              const owned = portfolioAssets.find(a => a.ticker === ticker);
              const isOwned = !!owned;
              const roi = owned ? ((owned.currentPrice - owned.avgBuyPrice) / owned.avgBuyPrice) * 100 : 0;
              return (
                <div key={ticker} className={`flex items-center justify-between p-3 rounded-xl border ${isOwned ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-white/5 border-white/5'}`}>
                  <div className="flex items-center gap-2">
                    <MiniLogo ticker={ticker} />
                    <div>
                      <span className="text-xs font-bold text-white">{ticker}</span>
                      {isOwned && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-indigo-500/20 text-indigo-300 ml-1.5">OWNED</span>}
                    </div>
                  </div>
                  {isOwned ? (
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-[9px] text-gray-500">Weight</p>
                        <p className="text-xs font-bold text-indigo-300">{owned.weight.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-gray-500">Return</p>
                        <p className={`text-xs font-bold ${roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{roi >= 0 ? '+' : ''}{roi.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-gray-500">Value</p>
                        <p className="text-xs font-bold text-white">{formatPrice(owned.currentPrice * owned.quantity, owned.currency as 'INR' | 'USD')}</p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-[10px] text-gray-600">Not in portfolio</span>
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* Portfolio Impact — Why this matters */}
      {portfolioImpact && (
        <GlassCard className="p-6 border-indigo-500/20" hoverEffect={false}>
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-400" /> Why this matters to you
          </h3>
          <div className="space-y-3">
            {affectedHoldings.map((holding, i) => {
              const roi = ((holding.currentPrice - holding.avgBuyPrice) / holding.avgBuyPrice) * 100;
              const value = holding.currentPrice * holding.quantity;
              return (
                <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MiniLogo ticker={holding.ticker} category={holding.category} name={holding.name} />
                      <div>
                        <span className="text-xs font-bold text-white">{holding.name}</span>
                        <span className="text-[10px] text-gray-500 ml-1">({holding.ticker})</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-indigo-300">{holding.weight.toFixed(1)}%</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                    <div>
                      <p className="text-[9px] text-gray-500 uppercase">Allocation</p>
                      <p className="text-xs font-bold text-white">{holding.weight.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-500 uppercase">Current P/L</p>
                      <p className={`text-xs font-bold ${roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{roi >= 0 ? '+' : ''}{roi.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-500 uppercase">Value</p>
                      <p className="text-xs font-bold text-white">{formatPrice(value, holding.currency as 'INR' | 'USD')}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="pt-3 border-t border-white/5 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs text-gray-400">Affects <span className="font-bold text-white">{portfolioImpact.affectedCount}</span> of your holdings</p>
                <p className="text-[10px] text-gray-500">Total exposure: {portfolioImpact.exposurePct.toFixed(1)}% of portfolio</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-500 uppercase font-bold">Est. Impact</p>
                <p className={`text-sm font-black ${portfolioImpact.impactLevel === 'Critical' ? 'text-rose-400' : portfolioImpact.impactLevel === 'High' ? 'text-amber-400' : portfolioImpact.impactLevel === 'Medium' ? 'text-blue-400' : 'text-gray-400'}`}>
                  {portfolioImpact.impactLevel === 'Critical' ? 'High Impact' : portfolioImpact.impactLevel}
                </p>
              </div>
            </div>
            {/* Exposure level */}
            <div className="pt-3 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500 uppercase font-bold">Exposure</span>
                <span className={`text-xs font-bold ${
                  portfolioImpact.exposurePct > 20 ? 'text-rose-400' :
                  portfolioImpact.exposurePct > 10 ? 'text-amber-400' :
                  portfolioImpact.exposurePct > 5 ? 'text-blue-400' : 'text-gray-400'
                }`}>
                  {portfolioImpact.exposurePct > 20 ? 'High' : portfolioImpact.exposurePct > 10 ? 'Medium' : portfolioImpact.exposurePct > 5 ? 'Low' : 'Minimal'}
                </span>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Market Reaction — show day change of affected holdings */}
      {affectedHoldings.length > 0 && (
        <GlassCard className="p-6" hoverEffect={false}>
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" /> Market Reaction
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {affectedHoldings.map((holding, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-2">
                  <MiniLogo ticker={holding.ticker} category={holding.category} name={holding.name} />
                  <span className="text-xs font-bold text-white">{holding.ticker}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{formatPrice(holding.currentPrice, holding.category === 'crypto' ? 'USD' : 'INR')}</span>
                  <span className={`text-xs font-bold flex items-center gap-0.5 ${holding.dayChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {holding.dayChangePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {holding.dayChangePercent >= 0 ? '+' : ''}{holding.dayChangePercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Macro Environment — relevant market data */}
      <GlassCard className="p-6" hoverEffect={false}>
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-400" /> Macro Environment
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {affectedHoldings.slice(0, 2).map((holding, i) => (
            <div key={i} className="flex flex-col gap-0.5 p-3 rounded-xl bg-white/5 border border-white/5">
              <span className="text-[9px] font-bold text-gray-500 uppercase">{holding.ticker}</span>
              <span className="text-sm font-black text-white">{formatPrice(holding.currentPrice, holding.currency as 'INR' | 'USD')}</span>
              <span className={`text-[10px] font-bold flex items-center gap-0.5 ${holding.dayChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {holding.dayChangePercent >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {holding.dayChangePercent >= 0 ? '+' : ''}{holding.dayChangePercent.toFixed(2)}%
              </span>
            </div>
          ))}
          {macroData?.fearGreed && (
            <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-white/5 border border-white/5">
              <span className="text-[9px] font-bold text-gray-500 uppercase">Fear & Greed</span>
              <span className="text-sm font-black text-white">{macroData.fearGreed.value}</span>
              <span className={`text-[10px] font-bold ${macroData.fearGreed.color}`}>{macroData.fearGreed.label}</span>
            </div>
          )}
          {macroData?.vix && (
            <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-white/5 border border-white/5">
              <span className="text-[9px] font-bold text-gray-500 uppercase">VIX</span>
              <span className="text-sm font-black text-white">{macroData.vix.value.toFixed(1)}</span>
              <span className={`text-[10px] font-bold ${macroData.vix.color}`}>{macroData.vix.label}</span>
            </div>
          )}
          {macroData?.dollarIndex && (
            <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-white/5 border border-white/5">
              <span className="text-[9px] font-bold text-gray-500 uppercase">Dollar Index</span>
              <span className="text-sm font-black text-white">{macroData.dollarIndex.value.toFixed(1)}</span>
              <span className={`text-[10px] font-bold ${macroData.dollarIndex.color}`}>{macroData.dollarIndex.label}</span>
            </div>
          )}
          {macroData?.treasury10Y && (
            <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-white/5 border border-white/5">
              <span className="text-[9px] font-bold text-gray-500 uppercase">10Y Yield</span>
              <span className="text-sm font-black text-white">{macroData.treasury10Y.value.toFixed(2)}%</span>
              <span className={`text-[10px] font-bold ${macroData.treasury10Y.color}`}>{macroData.treasury10Y.label}</span>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Timeline — news event chronology */}
      <GlassCard className="p-6" hoverEffect={false}>
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" /> Timeline
        </h3>
        <div className="space-y-3">
          {/* Article published */}
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className="w-2 h-2 rounded-full bg-indigo-400" />
              <div className="w-px h-full bg-white/10" />
            </div>
            <div className="pb-3">
              <p className="text-[10px] text-gray-500 font-bold">{new Date(article.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              <p className="text-xs text-white">Article published — {article.source}</p>
            </div>
          </div>
          {/* Market reactions */}
          {affectedHoldings.map((holding, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-2 h-2 rounded-full ${holding.dayChangePercent >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                {i < affectedHoldings.length - 1 && <div className="w-px h-full bg-white/10" />}
              </div>
              <div className="pb-3">
                <p className="text-[10px] text-gray-500 font-bold">Market reaction</p>
                <p className="text-xs text-white">{holding.ticker} {holding.dayChangePercent >= 0 ? '+' : ''}{holding.dayChangePercent.toFixed(2)}%</p>
                <p className="text-[10px] text-gray-500">{formatPrice(holding.currentPrice, holding.currency as 'INR' | 'USD')}</p>
              </div>
            </div>
          ))}
          {/* Confidence note */}
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className="w-2 h-2 rounded-full bg-gray-500" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold">Assessment</p>
              <p className="text-xs text-gray-400">{confidenceInfo.label} confidence • {sourceCount} source{sourceCount > 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Story sources — if multiple sources cover same event */}
      {article.relatedArticles && article.relatedArticles.length > 0 && (
        <GlassCard className="p-6" hoverEffect={false}>
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" /> Other Sources Covering This
          </h3>
          <div className="space-y-2">
            {article.relatedArticles.map((src, i) => (
              <a key={i} href={src.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-indigo-500/20 transition-colors group">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-indigo-400">{src.source}</span>
                  <span className="text-[11px] text-gray-400 truncate">{src.title}</span>
                </div>
                <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-indigo-400 shrink-0" />
              </a>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Related News */}
      {related.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-indigo-400" /> Related News
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {related.map((relArticle, idx) => (
              <NewsCard key={`related-${relArticle.id}-${idx}`} article={relArticle} portfolioTickers={portfolioTickers} portfolioAssets={portfolioAssets} />
            ))}
          </div>
        </div>
      )}

      {/* Action bar — Open Original is LAST, not first */}
      <div className="flex items-center gap-3 pt-4 border-t border-white/5">
        <button onClick={handleBookmark} className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-bold text-xs transition-colors ${isBookmarked ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>
          {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          {isBookmarked ? 'Saved' : 'Save for Later'}
        </button>
        <a href={article.link} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-bold text-xs hover:bg-indigo-500/30 transition-colors">
          <ExternalLink className="w-4 h-4" /> Open Original Source
        </a>
      </div>
    </div>
  );
}
