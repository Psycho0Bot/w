import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireCsrf, checkRateLimit } from '@/lib/serverAuth';
import { globalRateLimiter } from '@/lib/rateLimit';
import { db } from '@/lib/db';
import { logger } from '@/services/LogService';

/**
 * POST /api/news/bookmark
 * Body: { action: 'save' | 'remove' | 'markRead', article: {...}, articleId?: string }
 *
 * save: creates or updates a bookmark (sets readStatus to 'bookmarked')
 * remove: deletes a bookmark
 * markRead: updates readStatus to 'read'
 *
 * GET /api/news/bookmark
 * Returns all bookmarks for the authenticated user.
 */
export async function GET(request: NextRequest) {
  const authResult = requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const bookmarks = await db.newsBookmark.findMany({
      where: { userId: authResult.userId },
      include: { article: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      bookmarks: bookmarks.map(b => ({
        id: b.id,
        articleId: b.articleId,
        readStatus: b.readStatus,
        createdAt: b.createdAt,
        article: {
          id: b.article.id,
          title: b.article.title,
          url: b.article.url,
          summary: b.article.summary,
          source: b.article.source,
          imageUrl: b.article.imageUrl,
          ticker: b.article.ticker,
          assetName: b.article.assetName,
          category: b.article.category,
          provider: b.article.provider,
          impactScore: b.article.impactScore,
          impactType: b.article.impactType,
          publishedAt: b.article.publishedAt,
        },
      })),
    });
  } catch (err) {
    logger.error('Error fetching bookmarks', err);
    return NextResponse.json({ error: 'Failed to fetch bookmarks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const csrfError = requireCsrf(request);
  if (csrfError) return csrfError;

  const rateLimitResponse = checkRateLimit(request, globalRateLimiter);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const { action, article, articleId } = body;

    if (action === 'save') {
      if (!article || !article.url || !article.title) {
        return NextResponse.json({ error: 'Article data required' }, { status: 400 });
      }

      // Upsert the article in the NewsArticle table
      const savedArticle = await db.newsArticle.upsert({
        where: { url: article.url },
        update: {
          title: article.title,
          summary: article.summary || null,
          source: article.source || 'Unknown',
          imageUrl: article.imageUrl || null,
          ticker: article.ticker || null,
          assetName: article.assetName || null,
          category: article.category || null,
          provider: article.provider || 'google',
          impactScore: article.impactScore || 0,
          impactType: article.impactType || 'neutral',
          publishedAt: article.pubDate ? new Date(article.pubDate) : new Date(),
        },
        create: {
          title: article.title,
          url: article.url,
          summary: article.summary || null,
          source: article.source || 'Unknown',
          imageUrl: article.imageUrl || null,
          ticker: article.ticker || null,
          assetName: article.assetName || null,
          category: article.category || null,
          provider: article.provider || 'google',
          impactScore: article.impactScore || 0,
          impactType: article.impactType || 'neutral',
          publishedAt: article.pubDate ? new Date(article.pubDate) : new Date(),
        },
      });

      // Upsert the bookmark
      const bookmark = await db.newsBookmark.upsert({
        where: {
          userId_articleId: {
            userId: authResult.userId,
            articleId: savedArticle.id,
          },
        },
        update: { readStatus: 'bookmarked' },
        create: {
          userId: authResult.userId,
          articleId: savedArticle.id,
          readStatus: 'bookmarked',
        },
      });

      return NextResponse.json({ success: true, bookmarkId: bookmark.id, articleId: savedArticle.id });
    }

    if (action === 'remove') {
      if (!articleId) {
        return NextResponse.json({ error: 'articleId required' }, { status: 400 });
      }
      await db.newsBookmark.deleteMany({
        where: { userId: authResult.userId, articleId },
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'markRead') {
      if (!articleId) {
        return NextResponse.json({ error: 'articleId required' }, { status: 400 });
      }

      // Find the bookmark if it exists
      const existing = await db.newsBookmark.findUnique({
        where: {
          userId_articleId: {
            userId: authResult.userId,
            articleId,
          },
        },
      });

      if (existing) {
        await db.newsBookmark.update({
          where: { id: existing.id },
          data: { readStatus: 'read' },
        });
      } else {
        // Create a read-status entry
        await db.newsBookmark.create({
          data: {
            userId: authResult.userId,
            articleId,
            readStatus: 'read',
          },
        });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    logger.error('Error in bookmark API', err);
    return NextResponse.json({ error: 'Failed to process bookmark action' }, { status: 500 });
  }
}
