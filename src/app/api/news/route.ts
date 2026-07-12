import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, checkRateLimit } from '@/lib/serverAuth';
import { globalRateLimiter } from '@/lib/rateLimit';
import { logger } from '@/services/LogService';
import { fetchPortfolioNews, fetchGlobalNews, fetchAssetNews, type NewsArticle } from '@/services/news';

/**
 * GET /api/news?tickers=BTC,ETH,AAPL&names=Bitcoin,Ethereum,Apple&categories=crypto,crypto,stock_us
 *
 * Fetches portfolio-impacting news from multiple providers:
 *   - Finnhub (company-specific news, market news)
 *   - NewsData.io (global financial news, business, economy)
 *   - Google News RSS (free fallback)
 *
 * Articles are deduplicated, ranked by impact score, and cached for 15 minutes.
 * Only high-impact articles (earnings, upgrades, M&A, regulatory, hacks, etc.) are returned.
 *
 * Optional params:
 *   - global=true → fetch global market news (not asset-specific)
 *   - ticker=BTC&name=Bitcoin&category=crypto → fetch news for a single asset
 */
export async function GET(request: NextRequest) {
  const authResult = requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const rateLimitResponse = checkRateLimit(request, globalRateLimiter);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { searchParams } = new URL(request.url);

    // Check if this is a global news request
    const isGlobal = searchParams.get('global') === 'true';

    // Check if this is a single-asset request
    const singleTicker = searchParams.get('ticker');
    const singleName = searchParams.get('name');
    const singleCategory = searchParams.get('category');

    let news: NewsArticle[];

    if (isGlobal) {
      // Global market news
      news = await fetchGlobalNews(20);
    } else if (singleTicker && singleName) {
      // Single asset news
      news = await fetchAssetNews(singleTicker, singleName, singleCategory || 'general', 15);
    } else {
      // Portfolio news (all assets)
      const tickersParam = searchParams.get('tickers') || '';
      const namesParam = searchParams.get('names') || '';
      const categoriesParam = searchParams.get('categories') || '';

      if (!tickersParam) {
        return NextResponse.json({ news: [] });
      }

      const tickers = tickersParam.split(',').filter(Boolean);
      const names = namesParam.split(',').filter(Boolean);
      const categories = categoriesParam.split(',').filter(Boolean);

      const assets = tickers.map((ticker, i) => ({
        ticker,
        name: names[i] || ticker,
        category: categories[i] || 'general',
      }));

      news = await fetchPortfolioNews(assets);
    }

    // Map to the response shape expected by the frontend
    const response = news.map(item => ({
      id: item.id,
      title: item.title,
      link: item.url,
      summary: item.summary,
      source: item.source,
      imageUrl: item.imageUrl,
      pubDate: item.publishedAt,
      ticker: item.ticker,
      assetName: item.assetName,
      category: item.category,
      provider: item.provider,
      impactScore: item.impactScore,
      impactType: item.impactType,
    }));

    return NextResponse.json({
      news: response,
      fetchedAt: new Date().toISOString(),
      count: response.length,
    });
  } catch (err) {
    logger.error('Error in news API route', err);
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
  }
}
