'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { usePortfolio } from '@/context/portfolioStore';
import GlassCard from '@/components/GlassCard';
import NewsCard, { type NewsArticleData } from '@/components/NewsCard';
import { BADGE_STYLES, getBadgeColor, formatPrice } from '@/lib/assetLogos';
import {
  Search, RefreshCw, Flame, TrendingUp, TrendingDown, Newspaper,
  Bookmark as BookmarkIcon, Clock, X, Briefcase, BarChart3, Coins,
  Landmark, Gem, DollarSign, CalendarDays, Rocket, Cpu, CheckCircle2,
  Sun, Eye, ChevronRight, ArrowUpRight, ArrowDownRight, Activity,
} from 'lucide-react';

type TabId = 'foryou' | 'markets' | 'stocks' | 'etf' | 'mutual_funds' | 'crypto' | 'economy' | 'commodities' | 'forex' | 'earnings' | 'ipo' | 'ai_tech' | 'bookmarks';

const TABS: { id: TabId; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'foryou', label: 'For You', icon: Flame },
  { id: 'markets', label: 'Markets', icon: BarChart3 },
  { id: 'stocks', label: 'Stocks', icon: TrendingUp },
  { id: 'etf', label: 'ETFs', icon: Briefcase },
  { id: 'mutual_funds', label: 'Mutual Funds', icon: Briefcase },
  { id: 'crypto', label: 'Crypto', icon: Coins },
  { id: 'economy', label: 'Economy', icon: Landmark },
  { id: 'commodities', label: 'Commodities', icon: Gem },
  { id: 'forex', label: 'Forex', icon: DollarSign },
  { id: 'earnings', label: 'Earnings', icon: CalendarDays },
  { id: 'ipo', label: 'IPO', icon: Rocket },
  { id: 'ai_tech', label: 'AI & Tech', icon: Cpu },
  { id: 'bookmarks', label: 'Saved Articles', icon: BookmarkIcon },
];

const FILTER_CHIPS = [
  { id: 'today', label: 'Today', group: 'time' },
  { id: 'week', label: 'This Week', group: 'time' },
  { id: 'high_impact', label: 'High Impact', group: 'impact' },
  { id: 'portfolio', label: 'Portfolio', group: 'portfolio' },
  { id: 'verified', label: 'Verified', group: 'source' },
];

const TRENDING_ASSETS = ['BTC', 'ETH', 'NVDA', 'TSLA', 'RELIANCE', 'GOLD'];

function MiniAssetLogo({ ticker, category, name, size = 'sm' }: { ticker: string; category?: string; name?: string; size?: 'sm' | 'md' }) {
  const color = getBadgeColor(category);
  const style = BADGE_STYLES[color];
  const sizes = { sm: 'w-4 h-4 text-[7px]', md: 'w-6 h-6 text-[9px]' };

  return (
    <div className={`${sizes[size]} rounded-full ${style.bg} ${style.ring} border flex items-center justify-center shrink-0`}>
      <span className={`font-black ${style.text}`}>{ticker.slice(0, 3)}</span>
    </div>
  );
}

export default function NewsPage() {
  const { assets, usdInrRate, currencyPref } = usePortfolio();
  const [activeTab, setActiveTab] = useState<TabId>('foryou');
  const [timeFilter, setTimeFilter] = useState('today');
  const [sort, setSort] = useState('latest');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [portfolioOnly, setPortfolioOnly] = useState(false);
  const [highImpactOnly, setHighImpactOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [trendingFilter, setTrendingFilter] = useState<string>('');
  const [macroData, setMacroData] = useState<any>(null);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [liveMarkets, setLiveMarkets] = useState<any[]>([]);

  const [articles, setArticles] = useState<NewsArticleData[]>([]);
  const [visibleCount, setVisibleCount] = useState(10);
  const [loading, setLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [bookmarkArticles, setBookmarkArticles] = useState<NewsArticleData[]>([]);
  const [readCount, setReadCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadingRef = useRef(false);
  const portfolioTickers = useMemo(() => assets.map(a => a.ticker), [assets]);

  // Portfolio assets with weights for "Why this matters"
  const portfolioAssets = useMemo(() => {
    const totalValue = assets.reduce((sum, a) => sum + a.quantity * a.currentPrice, 0);
    return assets.map(a => ({
      ticker: a.ticker,
      name: a.name,
      weight: totalValue > 0 ? (a.quantity * a.currentPrice / totalValue) * 100 : 0,
    }));
  }, [assets]);

  // Fetch live market prices
  const fetchLiveMarkets = useCallback(async () => {
    try {
      const res = await fetch('/api/news/markets');
      if (res.ok) {
        const data = await res.json();
        setLiveMarkets(data.markets || []);
      }
    } catch (err) { console.error('Failed to fetch live markets', err); }
  }, []);

  // Fetch macro indicators
  const fetchMacro = useCallback(async () => {
    try {
      const res = await fetch('/api/news/macro');
      if (res.ok) setMacroData(await res.json());
    } catch (err) { console.error('Failed to fetch macro', err); }
  }, []);

  // Fetch calendar events
  const fetchCalendar = useCallback(async () => {
    try {
      const res = await fetch('/api/news/calendar');
      if (res.ok) {
        const data = await res.json();
        setCalendarEvents(data.events || []);
      }
    } catch (err) { console.error('Failed to fetch calendar', err); }
  }, []);

  // Fetch bookmarks
  const fetchBookmarks = useCallback(async () => {
    try {
      const res = await fetch('/api/news/bookmark');
      if (res.ok) {
        const data = await res.json();
        const bookmarkIds = new Set<string>(data.bookmarks.map((b: any) => b.article.url));
        setBookmarks(bookmarkIds);
        setBookmarkArticles(data.bookmarks.map((b: any) => ({
          id: b.article.id, title: b.article.title, link: b.article.url,
          summary: b.article.summary || undefined, source: b.article.source,
          imageUrl: b.article.imageUrl || undefined, pubDate: b.article.publishedAt,
          ticker: b.article.ticker || undefined, assetName: b.article.assetName || undefined,
          category: b.article.category || undefined, provider: b.article.provider || undefined,
          impactScore: b.article.impactScore || 0, impactType: b.article.impactType || 'neutral',
          bookmarked: true, readStatus: b.readStatus,
        })));
        setReadCount(data.bookmarks.filter((b: any) => b.readStatus === 'read').length);
        setUnreadCount(data.bookmarks.filter((b: any) => b.readStatus === 'unread').length);
      }
    } catch (err) {
      console.error('Failed to fetch bookmarks', err);
    }
  }, []);

  // Fetch news
  const fetchNews = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setVisibleCount(10);
    try {
      const params = new URLSearchParams({ time: timeFilter, sort, limit: '50' });

      if (activeTab === 'foryou') {
        params.set('sort', 'relevant');
        if (assets.length > 0) {
          params.set('tickers', assets.map(a => a.ticker).join(','));
          params.set('names', assets.map(a => a.name).join(','));
          params.set('categories', assets.map(a => a.category).join(','));
        }
      } else if (activeTab === 'bookmarks') {
        setLoading(false);
        loadingRef.current = false;
        return;
      } else {
        params.set('category', activeTab);
      }

      if (searchQuery) params.set('q', searchQuery);
      if (portfolioOnly) {
        params.set('portfolioOnly', 'true');
        if (assets.length > 0) {
          params.set('tickers', assets.map(a => a.ticker).join(','));
          params.set('names', assets.map(a => a.name).join(','));
          params.set('categories', assets.map(a => a.category).join(','));
        }
      }
      if (trendingFilter) params.set('q', trendingFilter);

      const res = await fetch(`/api/news/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        let news = data.news || [];
        // Client-side filters
        if (highImpactOnly) news = news.filter((n: any) => (n.impactScore || 0) >= 5);
        if (verifiedOnly) news = news.filter((n: any) => {
          const verifiedSources = ['Reuters', 'Bloomberg', 'CNBC', 'Economic Times', 'Moneycontrol', 'CoinDesk', 'Cointelegraph', 'WSJ', 'Financial Times', 'Barron\'s', 'MarketWatch', 'Forbes', 'Business Insider', 'Associated Press', 'Benzinga'];
          return verifiedSources.some(v => n.source?.toLowerCase().includes(v.toLowerCase()));
        });
        setArticles(news);
      } else {
        setArticles([]);
      }
    } catch (err) {
      console.error('Failed to fetch news', err);
      setArticles([]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [activeTab, timeFilter, sort, searchQuery, portfolioOnly, trendingFilter, highImpactOnly, verifiedOnly, assets]);

  useEffect(() => {
    fetchMacro();
    fetchCalendar();
    fetchLiveMarkets();
    if (activeTab === 'bookmarks') {
      fetchBookmarks();
      setLoading(false);
    } else {
      fetchNews();
    }
  }, [fetchNews, activeTab, fetchBookmarks, fetchMacro, fetchCalendar, fetchLiveMarkets]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const displayArticles = useMemo(() => {
    const base = activeTab === 'bookmarks' ? bookmarkArticles : articles.map(a => ({ ...a, bookmarked: bookmarks.has(a.link) }));
    return base;
  }, [activeTab, bookmarkArticles, articles, bookmarks]);

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop < document.documentElement.offsetHeight - 200) return;
      if (visibleCount < displayArticles.length) {
        setVisibleCount(prev => Math.min(prev + 5, displayArticles.length));
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [visibleCount, displayArticles.length]);

  const handleBookmark = async (article: NewsArticleData) => {
    try {
      const csrfToken = document.cookie.match(/csrf-token=([^;]+)/)?.[1] || '';
      const isBookmarked = bookmarks.has(article.link);
      if (isBookmarked) {
        await fetch('/api/news/bookmark', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ action: 'remove', articleId: article.id }) });
        const newBookmarks = new Set(bookmarks);
        newBookmarks.delete(article.link);
        setBookmarks(newBookmarks);
      } else {
        await fetch('/api/news/bookmark', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ action: 'save', article: { title: article.title, url: article.link, summary: article.summary, source: article.source, imageUrl: article.imageUrl, ticker: article.ticker, assetName: article.assetName, category: article.category, provider: article.provider, impactScore: article.impactScore, impactType: article.impactType, pubDate: article.pubDate } }) });
        const newBookmarks = new Set(bookmarks);
        newBookmarks.add(article.link);
        setBookmarks(newBookmarks);
      }
    } catch (err) { console.error('Bookmark failed', err); }
  };

  const topStory = displayArticles[0];
  const restArticles = displayArticles.slice(1, visibleCount);

  // Market strip — real live data from /api/news/markets
  const marketStrip = useMemo(() => {
    if (liveMarkets.length > 0) {
      return liveMarkets.map(m => ({
        label: m.label,
        ticker: m.ticker,
        price: m.price || undefined,
        currency: m.currency as 'INR' | 'USD',
        change: m.change,
        category: m.category,
      }));
    }
    // Fallback while loading
    return [
      { label: 'BTC', ticker: 'BTC', price: undefined, currency: 'USD' as const, change: 0, category: 'crypto' },
      { label: 'ETH', ticker: 'ETH', price: undefined, currency: 'USD' as const, change: 0, category: 'crypto' },
      { label: 'S&P 500', ticker: 'SPX', price: undefined, currency: 'USD' as const, change: 0, category: 'index' },
      { label: 'NIFTY 50', ticker: 'NIFTY', price: undefined, currency: 'INR' as const, change: 0, category: 'index' },
    ];
  }, [liveMarkets]);

  // Today's Market Brief — uses live market data + portfolio + news
  const marketBrief = useMemo(() => {
    // Group live markets by region with individual items
    const crypto = liveMarkets.filter(m => m.category === 'crypto');
    const india = liveMarkets.filter(m => m.category === 'index' && m.currency === 'INR');
    const us = liveMarkets.filter(m => (m.category === 'index' && m.currency === 'USD') || m.category === 'commodity');

    const avgChange = (items: any[]) => {
      const valid = items.filter(m => m.price !== null);
      if (valid.length === 0) return 0;
      return valid.reduce((sum, m) => sum + m.change, 0) / valid.length;
    };

    const upCount = (items: any[]) => items.filter(m => m.price !== null && m.change > 0).length;
    const totalValid = (items: any[]) => items.filter(m => m.price !== null).length;

    const regions = [
      {
        name: 'India',
        items: india.map(m => ({ label: m.label, change: m.change, price: m.price })),
        up: upCount(india), total: totalValid(india), avg: avgChange(india),
      },
      {
        name: 'Crypto',
        items: crypto.map(m => ({ label: m.label, change: m.change, price: m.price })),
        up: upCount(crypto), total: totalValid(crypto), avg: avgChange(crypto),
      },
      {
        name: 'US',
        items: us.map(m => ({ label: m.label, change: m.change, price: m.price })),
        up: upCount(us), total: totalValid(us), avg: avgChange(us),
      },
    ];

    const portfolioNewsCount = articles.filter(a => a.ticker && portfolioTickers.includes(a.ticker)).length;

    return { regions, portfolioNewsCount };
  }, [liveMarkets, articles, portfolioTickers]);

  // Portfolio Intelligence — actionable metrics
  const portfolioIntel = useMemo(() => {
    const portfolioNews = articles.filter(a => a.ticker && portfolioTickers.includes(a.ticker));
    const positiveCount = portfolioNews.filter(a => a.impactType === 'positive').length;
    const negativeCount = portfolioNews.filter(a => a.impactType === 'negative').length;
    const neutralCount = portfolioNews.filter(a => a.impactType === 'neutral').length;
    const highImpactCount = portfolioNews.filter(a => (a.impactScore || 0) >= 5).length;

    // News health score: positive news increases, negative decreases
    const newsHealth = portfolioNews.length > 0
      ? Math.min(100, Math.max(0, Math.round(50 + (positiveCount - negativeCount) * 5 + (portfolioNews.length > 10 ? 10 : 0))))
      : 50;

    // Overall sentiment label
    const overallSentiment = positiveCount > negativeCount * 1.5 ? 'Positive'
      : negativeCount > positiveCount * 1.5 ? 'Negative'
      : 'Neutral';

    // Affected holdings count with article counts + sentiment breakdown
    const tickerCounts: Record<string, number> = {};
    portfolioNews.forEach(a => {
      if (a.ticker) tickerCounts[a.ticker] = (tickerCounts[a.ticker] || 0) + 1;
    });
    const affectedHoldingsList = Object.entries(tickerCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([ticker, count]) => {
        const asset = portfolioAssets.find(a => a.ticker === ticker);
        const negCount = portfolioNews.filter(a => a.ticker === ticker && a.impactType === 'negative').length;
        const posCount = portfolioNews.filter(a => a.ticker === ticker && a.impactType === 'positive').length;
        return { ticker, count, name: asset?.name || ticker, weight: asset?.weight || 0, isHighRisk: negCount >= 3, negCount, posCount };
      });

    // Needs attention — high risk or most mentioned
    const needsAttention = affectedHoldingsList
      .filter(a => a.isHighRisk || a.count >= 4)
      .slice(0, 3);

    // Most mentioned
    const mostMentioned = affectedHoldingsList[0]?.ticker || null;

    // Highest risk holding
    const atRisk = affectedHoldingsList.find(a => a.isHighRisk)?.ticker || null;

    // Earnings/macro counts
    const earningsCount = calendarEvents.filter(e => e.type === 'earnings').length;
    const macroCount = calendarEvents.filter(e => e.type === 'economic').length;
    const fedCount = calendarEvents.filter(e => e.type === 'fed').length;

    // Market regime determination
    const fearGreed = macroData?.fearGreed?.value || 50;
    const vix = macroData?.vix?.value || 20;
    const dollarChange = macroData?.dollarIndex?.change || 0;
    const isRiskOn = fearGreed > 50 && vix < 20 && dollarChange < 0;
    const isRiskOff = fearGreed < 30 || vix > 30;
    const marketRegime = isRiskOn ? 'Risk-On' : isRiskOff ? 'Risk-Off' : 'Neutral';
    const regimeConfidence = Math.round(Math.abs(fearGreed - 50) + (20 - Math.min(20, vix)) * 2 + Math.abs(dollarChange) * 5);
    const regimeDrivers: string[] = [];
    if (dollarChange < 0) regimeDrivers.push('Falling Dollar');
    if (positiveCount > negativeCount) regimeDrivers.push('Positive Sentiment');
    if (vix < 18) regimeDrivers.push('Low VIX');
    if (fearGreed > 55) regimeDrivers.push('High Greed');
    if (negativeCount > positiveCount) regimeDrivers.push('Negative Sentiment');
    if (vix > 25) regimeDrivers.push('Elevated VIX');

    // Portfolio risk level
    const portfolioRisk = newsHealth < 30 ? 'HIGH' : newsHealth < 50 ? 'ELEVATED' : newsHealth < 70 ? 'MODERATE' : 'LOW';

    // News health label
    const newsHealthLabel = newsHealth >= 70 ? 'Good' : newsHealth >= 50 ? 'Fair' : newsHealth >= 30 ? 'Poor' : 'Critical';

    // AI Daily Summary — rule-based, no LLM
    const summaryParts: string[] = [];
    if (marketRegime === 'Risk-On') summaryParts.push('Markets are in risk-on mode today.');
    else if (marketRegime === 'Risk-Off') summaryParts.push('Markets are mildly risk-off today.');
    else summaryParts.push('Markets are in a neutral regime today.');

    if (overallSentiment === 'Negative') summaryParts.push(`News sentiment is bearish with ${negativeCount} negative articles affecting your portfolio.`);
    else if (overallSentiment === 'Positive') summaryParts.push(`News sentiment is bullish with ${positiveCount} positive articles.`);
    else summaryParts.push('News sentiment is balanced.');

    if (needsAttention.length > 0) {
      summaryParts.push(`${needsAttention.length} holdings require attention: ${needsAttention.map(a => a.ticker).join(', ')}.`);
    }

    const cryptoItems = liveMarkets.filter(m => m.category === 'crypto');
    const btcItem = cryptoItems.find(m => m.ticker === 'BTC');
    if (btcItem) {
      summaryParts.push(btcItem.change < 0 ? 'Crypto remains weak.' : 'Crypto is holding gains.');
    }

    const aiSummary = summaryParts.join(' ');

    return {
      totalNews: portfolioNews.length,
      affectedCount: affectedHoldingsList.length,
      positiveCount, negativeCount, neutralCount, highImpactCount,
      newsHealth, newsHealthLabel, overallSentiment, portfolioRisk,
      needsAttention, mostMentioned, atRisk,
      affectedHoldingsList,
      earningsCount, macroCount, fedCount,
      marketRegime, regimeConfidence: Math.min(99, regimeConfidence), regimeDrivers: regimeDrivers.slice(0, 4),
      aiSummary,
    };
  }, [articles, portfolioTickers, portfolioAssets, calendarEvents, macroData, liveMarkets]);

  // Active filter chips
  const activeChips: string[] = [];
  if (timeFilter === 'today') activeChips.push('today');
  if (highImpactOnly) activeChips.push('high_impact');
  if (portfolioOnly) activeChips.push('portfolio');
  if (verifiedOnly) activeChips.push('verified');

  const toggleChip = (chipId: string) => {
    if (chipId === 'today' || chipId === 'week') setTimeFilter(chipId);
    else if (chipId === 'high_impact') setHighImpactOnly(!highImpactOnly);
    else if (chipId === 'portfolio') setPortfolioOnly(!portfolioOnly);
    else if (chipId === 'verified') setVerifiedOnly(!verifiedOnly);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header — sticky on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-20 bg-black/40 backdrop-blur-lg pb-2 -mt-2 pt-2">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-indigo-400" />
            News
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Portfolio-first financial intelligence</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search news..."
              className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 transition-colors" />
            {searchInput && <button onClick={() => setSearchInput('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
          </div>
          <button onClick={() => fetchNews()} className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ─── Intelligence Hub ─── */}
      {activeTab === 'foryou' && !searchQuery && !trendingFilter && (
        <div className="space-y-4">
          {/* Portfolio Intelligence + Market Regime row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Portfolio Intelligence */}
            <GlassCard className="p-5 border-indigo-500/20" hoverEffect={false}>
              <div className="flex items-center gap-2 mb-4">
                <Briefcase className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Portfolio Intelligence</h3>
                <span className="ml-auto text-[10px] text-gray-500">
                  News Health: <span className={`font-black ${portfolioIntel.newsHealth >= 60 ? 'text-emerald-400' : portfolioIntel.newsHealth >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>{portfolioIntel.newsHealth}/100</span>
                </span>
              </div>
              <div className="space-y-3">
                {/* Affected holdings count */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                  <div>
                    <p className="text-2xl font-black text-white">{portfolioIntel.affectedCount}</p>
                    <p className="text-[10px] text-gray-400 font-bold">Holdings Affected</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500">Overall Sentiment</p>
                    <p className={`text-sm font-black ${portfolioIntel.overallSentiment === 'Positive' ? 'text-emerald-400' : portfolioIntel.overallSentiment === 'Negative' ? 'text-rose-400' : 'text-gray-400'}`}>
                      {portfolioIntel.overallSentiment === 'Positive' ? '🟢' : portfolioIntel.overallSentiment === 'Negative' ? '🔴' : '⚪'} {portfolioIntel.overallSentiment}
                    </p>
                  </div>
                </div>
                {/* Sentiment breakdown */}
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-emerald-400 font-bold">↑ {portfolioIntel.positiveCount} Bullish</span>
                  <span className="text-rose-400 font-bold">↓ {portfolioIntel.negativeCount} Bearish</span>
                  <span className="text-gray-400 font-bold">• {portfolioIntel.neutralCount} Neutral</span>
                </div>
                {/* Needs Attention */}
                {portfolioIntel.needsAttention.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-gray-500 uppercase font-bold">Needs Attention</p>
                    {portfolioIntel.needsAttention.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-white flex items-center gap-1.5">
                          <span className={item.isHighRisk ? 'text-rose-400' : 'text-amber-400'}>{item.isHighRisk ? '🔴' : '🟠'}</span>
                          {item.ticker}
                        </span>
                        <span className="text-[10px] text-gray-500">{item.count} articles{item.isHighRisk ? ' • High Risk' : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </GlassCard>

            {/* Market Regime */}
            <GlassCard className="p-5" hoverEffect={false}>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Market Regime</h3>
                <span className="ml-auto text-[10px] text-gray-500">Confidence: <span className="font-black text-indigo-300">{portfolioIntel.regimeConfidence}%</span></span>
              </div>
              <div className="space-y-3">
                <div className={`p-4 rounded-xl border text-center ${portfolioIntel.marketRegime === 'Risk-On' ? 'bg-emerald-500/10 border-emerald-500/20' : portfolioIntel.marketRegime === 'Risk-Off' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-white/5 border-white/10'}`}>
                  <p className={`text-lg font-black ${portfolioIntel.marketRegime === 'Risk-On' ? 'text-emerald-400' : portfolioIntel.marketRegime === 'Risk-Off' ? 'text-rose-400' : 'text-gray-300'}`}>
                    {portfolioIntel.marketRegime === 'Risk-On' ? '▲' : portfolioIntel.marketRegime === 'Risk-Off' ? '▼' : '◆'} {portfolioIntel.marketRegime}
                  </p>
                </div>
                {portfolioIntel.regimeDrivers.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-gray-500 uppercase font-bold">Drivers</p>
                    {portfolioIntel.regimeDrivers.map((driver, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[10px] text-gray-400">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> {driver}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </GlassCard>
          </div>

          {/* Today's Events */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
              <p className="text-xl font-black text-white">{portfolioIntel.earningsCount}</p>
              <p className="text-[10px] text-gray-400 font-bold">Earnings</p>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
              <p className="text-xl font-black text-white">{portfolioIntel.macroCount}</p>
              <p className="text-[10px] text-gray-400 font-bold">Macro Events</p>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
              <p className="text-xl font-black text-white">{portfolioIntel.fedCount}</p>
              <p className="text-[10px] text-gray-400 font-bold">Fed Events</p>
            </div>
          </div>

          {/* Today's Market Brief — 3 columns */}
          <GlassCard className="p-5" hoverEffect={false}>
            <div className="flex items-center gap-2 mb-4">
              <Sun className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Today's Market Brief</h3>
              <span className="ml-auto text-[9px] text-gray-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Markets — mini heat summaries per region */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-gray-500 uppercase">Markets</p>
                {marketBrief.regions.map((region, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                    {/* Region header with avg + sector summary */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-white">{region.name}</span>
                      <span className={`text-[9px] font-bold ${region.avg >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {region.up}/{region.total} green
                      </span>
                    </div>
                    {/* Individual indices */}
                    <div className="space-y-1">
                      {region.items.slice(0, 3).map((item, j) => (
                        <div key={j} className="flex items-center justify-between text-[10px]">
                          <span className="text-gray-400">{item.label}</span>
                          <span className={`font-bold ${item.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {item.change >= 0 ? '+' : ''}{item.change.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {marketBrief.regions.length === 0 && <p className="text-[10px] text-gray-600 italic">Loading market data...</p>}
              </div>
              {/* Affected Holdings — with sentiment breakdown */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-gray-500 uppercase">Affected Holdings</p>
                {portfolioIntel.affectedHoldingsList.slice(0, 5).map((h, i) => (
                  <div key={i} className="p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">{h.ticker}</span>
                      <span className="text-[9px] text-gray-500">{h.count} articles</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {h.negCount > 0 && (
                        <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          ↓ {h.negCount} Bearish
                        </span>
                      )}
                      {h.posCount > 0 && (
                        <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          ↑ {h.posCount} Bullish
                        </span>
                      )}
                      {h.isHighRisk && (
                        <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          High Risk
                        </span>
                      )}
                      {h.negCount === 0 && h.posCount === 0 && (
                        <span className="text-[8px] text-gray-600">Neutral</span>
                      )}
                    </div>
                  </div>
                ))}
                {portfolioIntel.affectedHoldingsList.length === 0 && <p className="text-[10px] text-gray-600 italic">No holdings affected</p>}
              </div>
              {/* Watch Today — categorized with colored badges */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-gray-500 uppercase">Watch Today</p>
                {articles.filter(a => (a.impactScore || 0) >= 5).slice(0, 4).map((a, i) => {
                  const cat = /earnings|quarterly|Q[1-4]|EPS/i.test(a.title) ? { label: 'Earnings', icon: '📈', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }
                    : /fed|CPI|GDP|inflation|rate|FOMC/i.test(a.title) ? { label: 'Macro', icon: '🏛', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' }
                    : /bitcoin|BTC|crypto|ETF|ethereum|ETH/i.test(a.title) ? { label: 'Crypto', icon: '🪙', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' }
                    : /breaking|alert|urgent/i.test(a.title) ? { label: 'Breaking', icon: '🔥', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' }
                    : { label: 'Market', icon: '📊', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' };
                  return (
                    <Link key={i} href={`/news/${encodeURIComponent(a.id)}`}
                      className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/5 hover:border-indigo-500/30 hover:bg-white/[0.07] transition-all group">
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${cat.color} shrink-0`}>
                        {cat.icon} {cat.label}
                      </span>
                      <span className="text-[10px] text-gray-400 truncate group-hover:text-indigo-300 transition-colors">
                        {a.title.split(/[:\-–—]/)[0].slice(0, 30)}
                      </span>
                      <ChevronRight className="w-3 h-3 text-gray-600 group-hover:text-indigo-400 shrink-0 ml-auto" />
                    </Link>
                  );
                })}
                {articles.filter(a => (a.impactScore || 0) >= 5).length === 0 && <p className="text-[10px] text-gray-600 italic">No major events today</p>}
              </div>
            </div>
          </GlassCard>

          {/* Macro Dashboard — status cards with trend indicators */}
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase mb-3">Macro Dashboard</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Fear & Greed', value: macroData?.fearGreed ? String(macroData.fearGreed.value) : '—', sub: macroData?.fearGreed?.label || 'Loading...', color: macroData?.fearGreed?.color || 'text-gray-500', trend: macroData?.fearGreed?.label?.includes('Fear') ? '↓' : macroData?.fearGreed?.label?.includes('Greed') ? '↑' : '◆' },
                { label: 'VIX', value: macroData?.vix ? macroData.vix.value.toFixed(1) : '—', sub: macroData?.vix?.label || 'Loading...', color: macroData?.vix?.color || 'text-gray-500', trend: macroData?.vix?.value < 20 ? '↓' : '↑' },
                { label: 'Dollar Index', value: macroData?.dollarIndex ? macroData.dollarIndex.value.toFixed(1) : '—', sub: macroData?.dollarIndex ? `${macroData.dollarIndex.change >= 0 ? '+' : ''}${macroData.dollarIndex.change.toFixed(2)}%` : 'Loading...', color: macroData?.dollarIndex?.color || 'text-gray-500', trend: macroData?.dollarIndex?.change < 0 ? '↓' : '↑' },
                { label: '10Y Yield', value: macroData?.treasury10Y ? `${macroData.treasury10Y.value.toFixed(2)}%` : '—', sub: macroData?.treasury10Y?.label || 'Loading...', color: macroData?.treasury10Y?.color || 'text-gray-500', trend: macroData?.treasury10Y?.change > 0 ? '↑' : '↓' },
              ].map((macro, i) => (
                <div key={i} className="flex flex-col gap-1 p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-gray-500 uppercase">{macro.label}</span>
                    <span className={`text-[10px] ${macro.color}`}>{macro.trend}</span>
                  </div>
                  <span className="text-lg font-black text-white">{macro.value}</span>
                  <span className={`text-[9px] font-bold ${macro.color}`}>{macro.sub}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Events — with impact level */}
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase mb-3">Upcoming Events</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {calendarEvents.length > 0 ? calendarEvents.slice(0, 3).map((evt, i) => (
                <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-base">{evt.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-white truncate">{evt.event}</p>
                    <p className="text-[9px] text-gray-500">{evt.when}</p>
                  </div>
                  {evt.type === 'fed' && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">High Impact</span>}
                  {evt.type === 'earnings' && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Earnings</span>}
                  {evt.type === 'economic' && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Macro</span>}
                </div>
              )) : (
                <p className="text-[10px] text-gray-600 italic col-span-3">No upcoming events in the next 7 days</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Market strip — swipeable carousel */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {marketStrip.map((item, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/5 shrink-0 min-w-[120px]">
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-white">{item.label}</p>
              <div className="flex items-center gap-1.5">
                {item.price ? <span className="text-[9px] text-gray-400">{formatPrice(item.price, item.currency)}</span> : <span className="text-[9px] text-gray-600">—</span>}
                <span className={`text-[9px] font-bold ${item.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {item.price ? `${item.change >= 0 ? '+' : ''}${item.change.toFixed(1)}%` : ''}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Trending Assets widget */}
      {activeTab === 'foryou' && !searchQuery && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1"><Flame className="w-3 h-3 text-orange-400" /> Trending</span>
          {TRENDING_ASSETS.map(ticker => (
            <button
              key={ticker}
              onClick={() => { setTrendingFilter(trendingFilter === ticker ? '' : ticker); }}
              className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors ${
                trendingFilter === ticker ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-white/5 text-gray-400 border border-white/5 hover:text-white'
              }`}
            >
              {ticker}
            </button>
          ))}
          {trendingFilter && <button onClick={() => setTrendingFilter('')} className="text-[10px] text-gray-500 hover:text-white flex items-center gap-1"><X className="w-3 h-3" /> Clear</button>}
        </div>
      )}

      {/* Category tabs — horizontally scrollable */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors ${
                activeTab === tab.id ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-white/5 text-gray-400 border border-white/5 hover:text-white hover:bg-white/10'
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.id === 'bookmarks' && bookmarkArticles.length > 0 && <span className="text-[8px] bg-indigo-500/20 px-1 rounded">{bookmarkArticles.length}</span>}
            </button>
          );
        })}
      </div>

      {/* Exposed filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTER_CHIPS.map(chip => {
          const isActive = chip.group === 'time' ? timeFilter === chip.id : chip.id === 'high_impact' ? highImpactOnly : chip.id === 'portfolio' ? portfolioOnly : chip.id === 'verified' ? verifiedOnly : false;
          return (
            <button key={chip.id} onClick={() => toggleChip(chip.id)}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                isActive ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-white/5 text-gray-400 border border-white/5 hover:text-white'
              }`}>
              {chip.id === 'verified' && <CheckCircle2 className="w-2.5 h-2.5" />}
              {chip.label}
            </button>
          );
        })}

        {/* Reading progress */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px] text-gray-500 flex items-center gap-1"><Eye className="w-2.5 h-2.5" /> {unreadCount} unread</span>
          <span className="text-[10px] text-gray-500 flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" /> {readCount} read</span>
          <span className="text-[10px] text-gray-500 flex items-center gap-1"><BookmarkIcon className="w-2.5 h-2.5" /> {bookmarks.size} saved</span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-20 text-xs text-indigo-300 font-bold animate-pulse">Syncing live news from all providers...</div>
      ) : displayArticles.length === 0 ? (
        <div className="text-center py-20 text-xs text-gray-500">
          {activeTab === 'bookmarks' ? 'No bookmarked articles yet. Click the bookmark icon on any article to save it.' : 'No articles found. Try adjusting your filters or search query.'}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top story */}
          {topStory && !searchQuery && !trendingFilter && activeTab !== 'bookmarks' && (
            <NewsCard article={topStory} variant="top" portfolioTickers={portfolioTickers} portfolioAssets={portfolioAssets} onBookmark={handleBookmark} />
          )}

          {/* Articles grid — 1 col on mobile, 2 on desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(searchQuery || trendingFilter || activeTab === 'bookmarks' ? displayArticles.slice(0, visibleCount) : restArticles).map((article, idx) => (
              <NewsCard key={`${article.id}-${idx}`} article={article} portfolioTickers={portfolioTickers} portfolioAssets={portfolioAssets} onBookmark={handleBookmark} />
            ))}
          </div>

          {/* Infinite scroll loader */}
          {visibleCount < displayArticles.length && (
            <div className="text-center py-4 text-[10px] text-gray-500 animate-pulse">Loading more...</div>
          )}
        </div>
      )}
    </div>
  );
}
