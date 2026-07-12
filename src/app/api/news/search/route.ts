import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, checkRateLimit } from '@/lib/serverAuth';
import { globalRateLimiter } from '@/lib/rateLimit';
import { logger } from '@/services/LogService';
import { fetchPortfolioNews, fetchGlobalNews, fetchAssetNews, type NewsArticle } from '@/services/news';

/**
 * GET /api/news/search
 *
 * Advanced news search with filters:
 *   - q: search query (keyword search in title/summary)
 *   - category: markets | stocks | etf | mutual_funds | crypto | economy | commodities | forex | earnings | ipo | ai_tech
 *   - time: today | week | month
 *   - sort: latest | relevant | oldest
 *   - portfolioOnly: true = only news affecting user's portfolio
 *   - source: filter by provider (finnhub, newsdata, google)
 *   - limit: number of articles (default 20)
 *
 * Uses the same aggregation service as /api/news, then applies client-side filters.
 */
export async function GET(request: NextRequest) {
  const authResult = requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const rateLimitResponse = checkRateLimit(request, globalRateLimiter);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category') || 'all';
    const time = searchParams.get('time') || 'today';
    const sort = searchParams.get('sort') || 'latest';
    const portfolioOnly = searchParams.get('portfolioOnly') === 'true';
    const sourceFilter = searchParams.get('source') || '';
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Get tickers/names/categories for portfolio-only mode
    const tickersParam = searchParams.get('tickers') || '';
    const namesParam = searchParams.get('names') || '';
    const categoriesParam = searchParams.get('categories') || '';

    // Fetch articles from aggregation service
    let articles: NewsArticle[];

    if (portfolioOnly && tickersParam) {
      const tickers = tickersParam.split(',').filter(Boolean);
      const names = namesParam.split(',').filter(Boolean);
      const categories = categoriesParam.split(',').filter(Boolean);
      const assets = tickers.map((ticker, i) => ({
        ticker,
        name: names[i] || ticker,
        category: categories[i] || 'general',
      }));
      articles = await fetchPortfolioNews(assets);
    } else {
      // Fetch global + portfolio news
      const [global, portfolio] = await Promise.all([
        fetchGlobalNews(30),
        tickersParam ? fetchPortfolioNews(
          tickersParam.split(',').filter(Boolean).map((ticker, i) => ({
            ticker,
            name: (namesParam.split(',')[i] || ticker),
            category: (categoriesParam.split(',')[i] || 'general'),
          }))
        ) : Promise.resolve([]),
      ]);
      articles = [...portfolio, ...global];
    }

    // Apply time filter
    const now = Date.now();
    const timeMs = time === 'week' ? 7 * 24 * 60 * 60 * 1000 : time === 'month' ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const cutoff = now - timeMs;
    articles = articles.filter(a => {
      const pubTime = new Date(a.publishedAt).getTime();
      return !isNaN(pubTime) && pubTime > cutoff;
    });

    // Apply category filter
    if (category !== 'all') {
      const categoryMap: Record<string, string[]> = {
        markets: ['stock_us', 'stock_in', 'general'],
        stocks: ['stock_us', 'stock_in'],
        etf: ['stock_us'],
        mutual_funds: ['mutual_fund'],
        crypto: ['crypto'],
        economy: ['general'],
        commodities: ['gold'],
        forex: ['general'],
        earnings: [],
        ipo: [],
        ai_tech: ['general'],
      };

      const matchingCategories = categoryMap[category];
      if (matchingCategories && matchingCategories.length > 0) {
        articles = articles.filter(a =>
          matchingCategories.includes(a.category) ||
          a.category === '' // global news matches most categories
        );
      }

      // For earnings/ipo, filter by keyword in title
      if (category === 'earnings') {
        articles = articles.filter(a => /earnings|quarterly|Q[1-4]|EPS|revenue|beat|miss/i.test(a.title));
      } else if (category === 'ipo') {
        articles = articles.filter(a => /IPO|going public|SPAC|listing/i.test(a.title));
      } else if (category === 'ai_tech') {
        articles = articles.filter(a => /AI|artificial intelligence|machine learning|tech|OpenAI|Google|Microsoft|Nvidia/i.test(a.title));
      }
    }

    // Apply source filter
    if (sourceFilter) {
      articles = articles.filter(a => a.provider === sourceFilter);
    }

    // Apply keyword search
    if (query) {
      const q = query.toLowerCase();
      articles = articles.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.summary || '').toLowerCase().includes(q) ||
        (a.assetName || '').toLowerCase().includes(q) ||
        (a.ticker || '').toLowerCase().includes(q)
      );
    }

    // Apply sort
    if (sort === 'latest') {
      articles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    } else if (sort === 'oldest') {
      articles.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
    } else if (sort === 'relevant') {
      // Sort by impact score (highest first), then by recency
      articles.sort((a, b) => {
        if (b.impactScore !== a.impactScore) return b.impactScore - a.impactScore;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });
    }

    // Deduplicate
    const seen = new Set<string>();
    articles = articles.filter(a => {
      const key = a.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Map to response format
    const response = articles.slice(0, limit).map(item => ({
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
      sourceCount: item.sourceCount || 1,
      relatedArticles: item.relatedArticles || [],
    }));

    return NextResponse.json({
      news: response,
      count: response.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Error in news search API route', err);
    return NextResponse.json({ error: 'Failed to search news' }, { status: 500 });
  }
}
