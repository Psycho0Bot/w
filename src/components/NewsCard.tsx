'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Bookmark, BookmarkCheck, Clock, TrendingUp, TrendingDown, Minus, CheckCircle2, Layers } from 'lucide-react';
import { isVerifiedSource } from '@/lib/assetLogos';

export interface NewsArticleData {
  id: string;
  title: string;
  link: string;
  summary?: string;
  source: string;
  imageUrl?: string;
  pubDate: string;
  ticker?: string;
  assetName?: string;
  category?: string;
  provider?: string;
  impactScore?: number;
  impactType?: 'positive' | 'negative' | 'neutral';
  bookmarked?: boolean;
  readStatus?: string;
  sourceCount?: number;
  relatedArticles?: { title: string; source: string; url: string }[];
}

interface NewsCardProps {
  article: NewsArticleData;
  variant?: 'default' | 'top' | 'compact';
  portfolioTickers?: string[];
  portfolioAssets?: { ticker: string; name: string; weight: number; category?: string }[];
  onBookmark?: (article: NewsArticleData) => void;
}

function getImportance(score: number): { label: string; color: string } {
  if (score >= 8) return { label: 'High Impact', color: 'text-rose-400' };
  if (score >= 5) return { label: 'High', color: 'text-amber-400' };
  if (score >= 3) return { label: 'Medium', color: 'text-blue-400' };
  return { label: 'Low', color: 'text-gray-400' };
}

function getReadingTime(summary?: string): string {
  if (!summary) return '1 min';
  const words = summary.split(/\s+/).filter(w => w.length > 0).length;
  return `${Math.max(1, Math.ceil(words / 200))} min`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Why-this-matters mini panel */
function WhyThisMatters({ article, portfolioAssets }: { article: NewsArticleData; portfolioAssets: { ticker: string; name: string; weight: number; category?: string }[] }) {
  const affected = portfolioAssets.filter(a => {
    const text = `${article.title} ${article.summary || ''} ${article.ticker || ''} ${article.assetName || ''}`.toLowerCase();
    return text.includes(a.ticker.toLowerCase()) || text.includes(a.name.toLowerCase());
  });
  if (affected.length === 0) return null;

  const totalExposure = affected.reduce((sum, a) => sum + a.weight, 0);
  const score = article.impactScore || 0;
  let impactLevel = 'Low';
  let impactColor = 'text-gray-400';
  if (score >= 8 && totalExposure > 15) { impactLevel = 'High Impact'; impactColor = 'text-rose-400'; }
  else if (score >= 5 && totalExposure > 10) { impactLevel = 'High'; impactColor = 'text-amber-400'; }
  else if (score >= 3 && totalExposure > 5) { impactLevel = 'Medium'; impactColor = 'text-blue-400'; }

  return (
    <div className="flex items-center gap-2 pt-1.5 mt-1.5 border-t border-white/5">
      <span className="text-[9px] text-gray-500">
        Affects: {affected.slice(0, 3).map(a => a.ticker).join(' • ')}
        {affected.length > 3 && ` +${affected.length - 3}`}
      </span>
      <span className="text-[9px] text-gray-600">({totalExposure.toFixed(1)}%)</span>
      <span className={`text-[9px] font-bold ${impactColor} ml-auto`}>{impactLevel}</span>
    </div>
  );
}

export default function NewsCard({ article, variant = 'default', portfolioTickers = [], portfolioAssets = [], onBookmark }: NewsCardProps) {
  const [isBookmarked, setIsBookmarked] = useState(article.bookmarked || false);

  const sentiment = article.impactType || 'neutral';
  const sentimentIcon = sentiment === 'positive' ? <TrendingUp className="w-3 h-3" /> : sentiment === 'negative' ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />;
  const sentimentLabel = sentiment === 'positive' ? 'BULLISH' : sentiment === 'negative' ? 'BEARISH' : 'NEUTRAL';
  const sentimentColor = sentiment === 'positive' ? 'text-emerald-400' : sentiment === 'negative' ? 'text-rose-400' : 'text-gray-400';

  const importance = getImportance(article.impactScore || 0);
  const isPortfolioRelated = article.ticker && portfolioTickers.includes(article.ticker);
  const verified = isVerifiedSource(article.source);
  const sourceCount = article.sourceCount || 1;

  const handleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsBookmarked(!isBookmarked);
    onBookmark?.(article);
  };

  // ─── TOP variant — text-first hero, Bloomberg-style ───
  if (variant === 'top') {
    return (
      <Link href={`/news/${encodeURIComponent(article.id)}`} className="block group">
        <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-black/60 p-5 sm:p-6 hover:border-indigo-500/40 hover:-translate-y-0.5 transition-all duration-200">
          {/* Badges row */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${sentimentColor} border-current/20 flex items-center gap-1`}>
              {sentimentIcon} {sentimentLabel}
            </span>
            <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${importance.color} border-current/20`}>
              {importance.label}
            </span>
            {isPortfolioRelated && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                PORTFOLIO
              </span>
            )}
            {sourceCount > 1 && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-white/10 text-gray-300 border border-white/10 flex items-center gap-0.5">
                <Layers className="w-2.5 h-2.5" /> {sourceCount} sources
              </span>
            )}
          </div>

          {/* Headline */}
          <h2 className="text-base sm:text-lg font-bold text-white leading-tight group-hover:text-indigo-300 transition-colors mb-2">
            {article.title}
          </h2>

          {/* AI Summary — rule-based, 2 lines */}
          {article.summary && (
            <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2 mb-3">
              {article.summary}
            </p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold flex-wrap">
            <span className="text-indigo-400">{article.source}</span>
            {verified && <CheckCircle2 className="w-2.5 h-2.5 text-blue-400" />}
            <span>•</span>
            <span>{timeAgo(article.pubDate)}</span>
            <span>•</span>
            <Clock className="w-2.5 h-2.5" />
            <span>{getReadingTime(article.summary)} read</span>
          </div>

          {/* Affected tickers */}
          {article.ticker && (
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
              <span className="text-[9px] text-gray-600 uppercase font-bold">Affects:</span>
              <span className="text-[10px] font-bold text-white">{article.ticker}</span>
              {article.assetName && <span className="text-[10px] text-gray-500">{article.assetName}</span>}
              {portfolioAssets.length > 0 && <WhyThisMatters article={article} portfolioAssets={portfolioAssets} />}
            </div>
          )}

          <button onClick={handleBookmark} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100">
            {isBookmarked ? <BookmarkCheck className="w-4 h-4 text-indigo-400" /> : <Bookmark className="w-4 h-4 text-gray-500" />}
          </button>
        </div>
      </Link>
    );
  }

  // ─── COMPACT variant ───
  if (variant === 'compact') {
    return (
      <Link href={`/news/${encodeURIComponent(article.id)}`} className="block group">
        <div className="flex gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors">
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className="text-[11px] font-bold text-white leading-tight line-clamp-2 group-hover:text-indigo-300 transition-colors">{article.title}</p>
            <div className="flex items-center gap-1.5 text-[9px] text-gray-500">
              <span className="text-indigo-400">{article.source}</span>
              {verified && <CheckCircle2 className="w-2 h-2 text-blue-400" />}
              <span>•</span>
              <span>{timeAgo(article.pubDate)}</span>
              {article.ticker && <><span>•</span><span className="text-gray-400">{article.ticker}</span></>}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // ─── DEFAULT variant — text-first card, no images ───
  return (
    <Link href={`/news/${encodeURIComponent(article.id)}`} className="block group">
      <div className="p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-indigo-500/30 hover:-translate-y-0.5 hover:bg-white/[0.07] transition-all duration-200 cursor-pointer">
        {/* Source + verified + time */}
        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold flex-wrap mb-2">
          <span className="text-indigo-400">{article.source}</span>
          {verified && <CheckCircle2 className="w-2.5 h-2.5 text-blue-400" />}
          <span>•</span>
          <span>{timeAgo(article.pubDate)}</span>
          <span>•</span>
          <Clock className="w-2.5 h-2.5" />
          <span>{getReadingTime(article.summary)} read</span>
          {sourceCount > 1 && <><span>•</span><span className="flex items-center gap-0.5"><Layers className="w-2.5 h-2.5" />{sourceCount}</span></>}
        </div>

        {/* Ticker + asset name */}
        {article.ticker && (
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-black text-white tracking-wide">{article.ticker}</span>
            {article.assetName && <span className="text-[10px] text-gray-500">{article.assetName}</span>}
          </div>
        )}

        {/* Headline */}
        <h3 className="text-sm font-bold text-white leading-snug group-hover:text-indigo-300 transition-colors line-clamp-2 mb-1">{article.title}</h3>

        {/* 1-line summary */}
        {article.summary && <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-1 mb-2">{article.summary}</p>}

        {/* Tags */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${sentimentColor} border-current/20 flex items-center gap-1`}>{sentimentIcon} {sentimentLabel}</span>
          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${importance.color} border-current/20`}>{importance.label}</span>
          {isPortfolioRelated && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">PORTFOLIO</span>}
        </div>

        {/* Why this matters */}
        {portfolioAssets.length > 0 && <WhyThisMatters article={article} portfolioAssets={portfolioAssets} />}

        {/* Bookmark — fades in on hover */}
        <div className="flex justify-end mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={handleBookmark} className="p-1 rounded hover:bg-white/5 transition-colors">
            {isBookmarked ? <BookmarkCheck className="w-3.5 h-3.5 text-indigo-400" /> : <Bookmark className="w-3.5 h-3.5 text-gray-600" />}
          </button>
        </div>
      </div>
    </Link>
  );
}
