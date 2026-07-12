import { logger } from '../LogService';
import { scoreArticle, type NewsArticle } from './types';

/**
 * Google News RSS — Free fallback news source, no API key needed.
 * Used as a backup when Finnhub/NewsData.io are unavailable or rate-limited.
 */

async function fetchGoogleNewsRSS(query: string, limit: number = 5): Promise<NewsArticle[]> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}+when:1d&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const text = await res.text();
    const items: NewsArticle[] = [];
    const matches = Array.from(text.matchAll(/<item>([\s\S]*?)<\/item>/g));

    for (const match of matches) {
      const content = match[1];
      const titleMatch = content.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = content.match(/<link>([\s\S]*?)<\/link>/);
      const pubDateMatch = content.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const sourceMatch = content.match(/<source[^>]*>([\s\S]*?)<\/source>/);

      if (titleMatch) {
        const title = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
        const { score, sentiment } = scoreArticle(title);
        if (score === 0) continue;

        const link = linkMatch ? linkMatch[1].trim() : '';
        const pubDate = pubDateMatch ? pubDateMatch[1].trim() : '';
        const source = sourceMatch ? sourceMatch[1].trim() : 'Google News';
        items.push({
          id: `google_${Buffer.from(title).toString('hex').slice(0, 16)}`,
          title,
          url: link,
          source,
          ticker: '',
          assetName: '',
          category: '',
          provider: 'google',
          impactScore: score,
          impactType: sentiment,
          publishedAt: pubDate || new Date().toISOString(),
        });
        if (items.length >= limit) break;
      }
    }
    return items;
  } catch (err) {
    logger.warn('Google News RSS fetch failed', { query, error: err });
    return [];
  }
}

/**
 * Fetch news from Google News RSS for a specific asset.
 */
export async function fetchGoogleNews(
  ticker: string,
  assetName: string,
  category: string,
  limit: number = 5,
): Promise<NewsArticle[]> {
  const financeContext = category === 'crypto' ? 'crypto' : category === 'stock_in' || category === 'stock_us' ? 'stock OR earnings OR upgrade' : 'finance OR market';
  const query = `${assetName} ${financeContext}`;

  const items = await fetchGoogleNewsRSS(query, limit);
  return items.map(item => ({
    ...item,
    ticker,
    assetName,
    category,
  }));
}

/**
 * Fetch global market news from Google News RSS.
 */
export async function fetchGoogleGlobalNews(limit: number = 10): Promise<NewsArticle[]> {
  return fetchGoogleNewsRSS('stock market OR economy OR finance OR crypto', limit);
}
