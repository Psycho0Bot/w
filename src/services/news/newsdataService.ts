import { logger } from '../LogService';
import { scoreArticle, type NewsArticle } from './types';

/**
 * NewsData.io — Global financial news, business news, economy, crypto, AI.
 * API docs: https://newsdata.io/documentation
 */
const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY || '';
const BASE_URL = 'https://newsdata.io/api/1';

/**
 * Fetch financial news from NewsData.io for a given asset.
 * Uses the search endpoint with the asset name as query.
 */
export async function fetchNewsDataNews(
  ticker: string,
  assetName: string,
  category: string,
  limit: number = 5,
): Promise<NewsArticle[]> {
  if (!NEWSDATA_API_KEY) return [];

  try {
    // Build query — asset name + finance context
    const financeContext = category === 'crypto' ? 'crypto' : 'stock OR market';
    const query = `${assetName} ${financeContext}`;

    const params = new URLSearchParams({
      apikey: NEWSDATA_API_KEY,
      q: query,
      category: 'business,economy,crypto,technology',
      language: 'en',
      size: String(limit * 2),
    });

    const url = `${BASE_URL}/news?${params.toString()}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const data = await res.json();
    const results = data.results || [];
    if (!Array.isArray(results)) return [];

    const articles: NewsArticle[] = [];
    for (const item of results) {
      const title = item.title || '';
      const articleUrl = item.link || '';
      if (!title || !articleUrl) continue;

      const summary = item.description || item.content || '';
      const { score, sentiment } = scoreArticle(title, summary);
      if (score === 0) continue; // Only keep high-impact articles

      articles.push({
        id: `newsdata_${Buffer.from(articleUrl).toString('hex').slice(0, 16)}`,
        title,
        url: articleUrl,
        summary: summary.slice(0, 300),
        source: item.source_id || item.publisher || 'NewsData.io',
        imageUrl: item.image_url || undefined,
        ticker,
        assetName,
        category,
        provider: 'newsdata',
        impactScore: score,
        impactType: sentiment,
        publishedAt: item.pubDate
          ? new Date(item.pubDate).toISOString()
          : new Date().toISOString(),
      });
      if (articles.length >= limit) break;
    }
    return articles;
  } catch (err) {
    logger.warn('NewsData.io fetch failed', { ticker, error: err });
    return [];
  }
}

/**
 * Fetch global trending financial news from NewsData.io.
 * Not asset-specific — used for market overview.
 */
export async function fetchNewsDataGlobalNews(limit: number = 10): Promise<NewsArticle[]> {
  if (!NEWSDATA_API_KEY) return [];

  try {
    const params = new URLSearchParams({
      apikey: NEWSDATA_API_KEY,
      category: 'business,economy',
      language: 'en',
      size: String(limit * 2),
    });

    const url = `${BASE_URL}/news?${params.toString()}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const data = await res.json();
    const results = data.results || [];
    if (!Array.isArray(results)) return [];

    const articles: NewsArticle[] = [];
    for (const item of results) {
      const title = item.title || '';
      const articleUrl = item.link || '';
      if (!title || !articleUrl) continue;

      const summary = item.description || item.content || '';
      const { score, sentiment } = scoreArticle(title, summary);
      if (score === 0) continue;

      articles.push({
        id: `newsdata_global_${Buffer.from(articleUrl).toString('hex').slice(0, 16)}`,
        title,
        url: articleUrl,
        summary: summary.slice(0, 300),
        source: item.source_id || 'NewsData.io',
        imageUrl: item.image_url || undefined,
        ticker: '',
        assetName: '',
        category: 'general',
        provider: 'newsdata',
        impactScore: score,
        impactType: sentiment,
        publishedAt: item.pubDate
          ? new Date(item.pubDate).toISOString()
          : new Date().toISOString(),
      });
      if (articles.length >= limit) break;
    }
    return articles;
  } catch (err) {
    logger.warn('NewsData.io global news fetch failed', { error: err });
    return [];
  }
}
