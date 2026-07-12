import { logger } from '../LogService';
import { scoreArticle, type NewsArticle } from './types';

/**
 * Finnhub — Company-specific news, market news, insider trading, SEC filings.
 * API docs: https://finnhub.io/docs/api
 */
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';
const BASE_URL = 'https://finnhub.io/api/v1';

/**
 * Fetch company-specific news from Finnhub for a given ticker.
 * Finnhub uses stock symbols (AAPL, MSFT, etc.) for US stocks.
 * For crypto, we fall back to general market news.
 */
export async function fetchFinnhubNews(
  ticker: string,
  assetName: string,
  category: string,
  limit: number = 5,
): Promise<NewsArticle[]> {
  if (!FINNHUB_API_KEY) return [];

  try {
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 24 * 60 * 60;
    const from = new Date(oneDayAgo * 1000).toISOString().split('T')[0];
    const to = new Date(now * 1000).toISOString().split('T')[0];

    // For stocks, use company news endpoint
    // For crypto and other categories, use general market news
    let url: string;
    if (category === 'stock_us' || category === 'stock_in') {
      url = `${BASE_URL}/news?category=general&token=${FINNHUB_API_KEY}`;
    } else {
      url = `${BASE_URL}/news?category=crypto&token=${FINNHUB_API_KEY}`;
    }

    // For company-specific news, use the company-news endpoint
    if (category === 'stock_us') {
      url = `${BASE_URL}/company-news?symbol=${encodeURIComponent(ticker)}&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`;
    }

    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const articles: NewsArticle[] = [];
    for (const item of data.slice(0, limit * 2)) {
      const title = item.headline || item.title || '';
      const summary = item.summary || '';
      const url = item.url || item.link || '';
      if (!title || !url) continue;

      // Check if the article mentions the asset name or ticker
      const textToCheck = `${title} ${summary}`.toLowerCase();
      const tickerMatch = ticker.toLowerCase();
      const nameMatch = assetName.toLowerCase();
      const isRelevant =
        textToCheck.includes(tickerMatch) ||
        textToCheck.includes(nameMatch) ||
        category === 'stock_us'; // company-news endpoint already filters by symbol

      if (!isRelevant) continue;

      const { score, sentiment } = scoreArticle(title, summary);
      if (score === 0) continue; // Only keep high-impact articles

      articles.push({
        id: `finnhub_${Buffer.from(url).toString('hex').slice(0, 16)}`,
        title,
        url,
        summary: summary.slice(0, 300),
        source: item.source || 'Finnhub',
        imageUrl: item.image || undefined,
        ticker,
        assetName,
        category,
        provider: 'finnhub',
        impactScore: score,
        impactType: sentiment,
        publishedAt: item.datetime
          ? new Date(item.datetime * 1000).toISOString()
          : new Date().toISOString(),
      });
      if (articles.length >= limit) break;
    }
    return articles;
  } catch (err) {
    logger.warn('Finnhub news fetch failed', { ticker, error: err });
    return [];
  }
}

/**
 * Fetch general market news from Finnhub (not asset-specific).
 */
export async function fetchFinnhubMarketNews(limit: number = 10): Promise<NewsArticle[]> {
  if (!FINNHUB_API_KEY) return [];

  try {
    const url = `${BASE_URL}/news?category=general&token=${FINNHUB_API_KEY}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const articles: NewsArticle[] = [];
    for (const item of data.slice(0, limit * 2)) {
      const title = item.headline || '';
      const summary = item.summary || '';
      const articleUrl = item.url || '';
      if (!title || !articleUrl) continue;

      const { score, sentiment } = scoreArticle(title, summary);
      if (score === 0) continue;

      articles.push({
        id: `finnhub_market_${Buffer.from(articleUrl).toString('hex').slice(0, 16)}`,
        title,
        url: articleUrl,
        summary: summary.slice(0, 300),
        source: item.source || 'Finnhub',
        imageUrl: item.image || undefined,
        ticker: '',
        assetName: '',
        category: 'general',
        provider: 'finnhub',
        impactScore: score,
        impactType: sentiment,
        publishedAt: item.datetime
          ? new Date(item.datetime * 1000).toISOString()
          : new Date().toISOString(),
      });
      if (articles.length >= limit) break;
    }
    return articles;
  } catch (err) {
    logger.warn('Finnhub market news fetch failed', { error: err });
    return [];
  }
}
