import { logger } from '../LogService';
import { scoreArticle, type NewsArticle } from './types';
import { fetchFinnhubNews, fetchFinnhubMarketNews } from './finnhubService';
import { fetchNewsDataNews, fetchNewsDataGlobalNews } from './newsdataService';
import { fetchGoogleNews, fetchGoogleGlobalNews } from './googleNewsService';

/**
 * News Aggregation Service
 *
 * Fetches news from multiple providers (Finnhub, NewsData.io, Google News RSS),
 * deduplicates by URL and title, ranks by impact score + recency,
 * and caches results in the database to reduce API calls.
 *
 * Architecture:
 *   Finnhub    → company-specific news, market news, insider activity
 *   NewsData.io → global financial news, business, economy, crypto
 *   Google RSS  → free fallback when other providers are rate-limited
 */

interface AssetQuery {
  ticker: string;
  name: string;
  category: string;
}

// In-memory cache (15-minute TTL) to avoid hitting APIs on every request
interface CacheEntry {
  articles: NewsArticle[];
  timestamp: number;
}
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const cache = new Map<string, CacheEntry>();

function getCached(key: string): NewsArticle[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.articles;
}

function setCached(key: string, articles: NewsArticle[]): void {
  cache.set(key, { articles, timestamp: Date.now() });
}

/**
 * Normalize a title for dedup comparison.
 */
function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
}

/**
 * Normalize a URL for dedup comparison.
 */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname;
  } catch {
    return url.toLowerCase().replace(/^https?:\/\//, '').split('?')[0];
  }
}

/**
 * Deduplicate articles by URL and by normalized title.
 */
function deduplicate(articles: NewsArticle[]): NewsArticle[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const result: NewsArticle[] = [];

  for (const article of articles) {
    const urlKey = normalizeUrl(article.url);
    const titleKey = normalizeTitle(article.title);

    if (seenUrls.has(urlKey) || seenTitles.has(titleKey)) continue;
    seenUrls.add(urlKey);
    seenTitles.add(titleKey);
    result.push(article);
  }
  return result;
}

/**
 * Group articles covering the same event (similar titles covering same asset).
 * Merges them into a single article with a sourceCount and relatedArticles list.
 */
function groupStories(articles: NewsArticle[]): NewsArticle[] {
  const groups: { key: string; articles: NewsArticle[] }[] = [];

  for (const article of articles) {
    // Create a grouping key from the ticker + first few significant words
    const words = article.title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !['about', 'says', 'with', 'from', 'have', 'this', 'that', 'will', 'been', 'into', 'after'].includes(w))
      .slice(0, 3);
    const key = `${article.ticker}_${words.join('_')}`;

    // Find existing group with similar key
    let existingGroup = groups.find(g => {
      if (g.articles[0].ticker !== article.ticker) return false;
      // Check if the words overlap significantly
      const existingWords = g.key.split('_').slice(1);
      const overlap = words.filter(w => existingWords.includes(w));
      return overlap.length >= 2;
    });

    if (!existingGroup) {
      existingGroup = { key, articles: [] };
      groups.push(existingGroup);
    }
    existingGroup.articles.push(article);
  }

  // Build result — each group becomes one article (the highest-impact one)
  // with sourceCount and relatedArticles
  return groups.map(group => {
    const sorted = group.articles.sort((a, b) => b.impactScore - a.impactScore);
    const primary = sorted[0];
    const related = sorted.slice(1).map(a => ({
      title: a.title,
      source: a.source,
      url: a.url,
    }));

    return {
      ...primary,
      sourceCount: group.articles.length,
      relatedArticles: related.length > 0 ? related : undefined,
    };
  });
}

/**
 * Rank articles by impact score (highest first), then by recency (newest first).
 */
function rankArticles(articles: NewsArticle[]): NewsArticle[] {
  return articles.sort((a, b) => {
    if (b.impactScore !== a.impactScore) return b.impactScore - a.impactScore;
    const dateA = new Date(a.publishedAt).getTime() || 0;
    const dateB = new Date(b.publishedAt).getTime() || 0;
    return dateB - dateA;
  });
}

/**
 * Fetch aggregated news for ALL portfolio assets.
 *
 * For each asset, fetches from Finnhub + NewsData.io + Google News in parallel,
 * then merges, deduplicates, and ranks across all providers.
 *
 * Results are cached for 15 minutes to reduce API calls.
 */
export async function fetchPortfolioNews(assets: AssetQuery[]): Promise<NewsArticle[]> {
  if (assets.length === 0) return [];

  // Check cache
  const cacheKey = `portfolio_${assets.map(a => a.ticker).sort().join(',')}`;
  const cached = getCached(cacheKey);
  if (cached) {
    logger.info('News cache hit', { count: cached.length });
    return cached;
  }

  logger.info('Fetching portfolio news from all providers', { assetCount: assets.length });

  // Fetch news for each asset from all 3 providers in parallel
  const assetNewsPromises = assets.map(async (asset) => {
    const [finnhub, newsdata, google] = await Promise.allSettled([
      fetchFinnhubNews(asset.ticker, asset.name, asset.category, 5),
      fetchNewsDataNews(asset.ticker, asset.name, asset.category, 5),
      fetchGoogleNews(asset.ticker, asset.name, asset.category, 5),
    ]);

    const articles: NewsArticle[] = [];
    if (finnhub.status === 'fulfilled') articles.push(...finnhub.value);
    if (newsdata.status === 'fulfilled') articles.push(...newsdata.value);
    if (google.status === 'fulfilled') articles.push(...google.value);
    return articles;
  });

  // Also fetch global market news from all providers
  const globalNewsPromises = Promise.allSettled([
    fetchFinnhubMarketNews(5),
    fetchNewsDataGlobalNews(5),
    fetchGoogleGlobalNews(5),
  ]);

  const [assetResults, globalResults] = await Promise.all([Promise.all(assetNewsPromises), globalNewsPromises]);

  // Flatten all asset news
  let allNews: NewsArticle[] = assetResults.flat();

  // Add global market news (tagged as general, not asset-specific)
  for (const result of globalResults) {
    if (result.status === 'fulfilled') {
      allNews.push(...result.value);
    }
  }

  // Filter to only high-impact articles (score > 0)
  allNews = allNews.filter(a => a.impactScore > 0);

  // Deduplicate across all providers
  allNews = deduplicate(allNews);

  // Group stories covering the same event
  allNews = groupStories(allNews);

  // Rank by impact score, then recency
  allNews = rankArticles(allNews);

  // Cap at 30 articles
  allNews = allNews.slice(0, 30);

  // Cache the result
  setCached(cacheKey, allNews);

  logger.info('Portfolio news aggregation complete', {
    total: allNews.length,
    providers: {
      finnhub: allNews.filter(a => a.provider === 'finnhub').length,
      newsdata: allNews.filter(a => a.provider === 'newsdata').length,
      google: allNews.filter(a => a.provider === 'google').length,
    },
  });

  return allNews;
}

/**
 * Fetch global trending financial news (not asset-specific).
 * Used for market overview, dashboard news feed, etc.
 */
export async function fetchGlobalNews(limit: number = 15): Promise<NewsArticle[]> {
  const cacheKey = 'global_news';
  const cached = getCached(cacheKey);
  if (cached) return cached.slice(0, limit);

  const [finnhub, newsdata, google] = await Promise.allSettled([
    fetchFinnhubMarketNews(10),
    fetchNewsDataGlobalNews(10),
    fetchGoogleGlobalNews(10),
  ]);

  let allNews: NewsArticle[] = [];
  if (finnhub.status === 'fulfilled') allNews.push(...finnhub.value);
  if (newsdata.status === 'fulfilled') allNews.push(...newsdata.value);
  if (google.status === 'fulfilled') allNews.push(...google.value);

  allNews = allNews.filter(a => a.impactScore > 0);
  allNews = deduplicate(allNews);
  allNews = groupStories(allNews);
  allNews = rankArticles(allNews);
  allNews = allNews.slice(0, limit);

  setCached(cacheKey, allNews);
  return allNews;
}

/**
 * Fetch news for a single asset (for asset detail page).
 */
export async function fetchAssetNews(
  ticker: string,
  assetName: string,
  category: string,
  limit: number = 10,
): Promise<NewsArticle[]> {
  const cacheKey = `asset_${ticker}`;
  const cached = getCached(cacheKey);
  if (cached) return cached.slice(0, limit);

  const [finnhub, newsdata, google] = await Promise.allSettled([
    fetchFinnhubNews(ticker, assetName, category, limit),
    fetchNewsDataNews(ticker, assetName, category, limit),
    fetchGoogleNews(ticker, assetName, category, limit),
  ]);

  let allNews: NewsArticle[] = [];
  if (finnhub.status === 'fulfilled') allNews.push(...finnhub.value);
  if (newsdata.status === 'fulfilled') allNews.push(...newsdata.value);
  if (google.status === 'fulfilled') allNews.push(...google.value);

  allNews = allNews.filter(a => a.impactScore > 0);
  allNews = deduplicate(allNews);
  allNews = groupStories(allNews);
  allNews = rankArticles(allNews);
  allNews = allNews.slice(0, limit);

  setCached(cacheKey, allNews);
  return allNews;
}
