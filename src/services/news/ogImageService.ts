import { logger } from '../LogService';

/**
 * Fetch OpenGraph image from an article URL.
 * Parses the HTML <meta property="og:image"> tag.
 * Used as a fallback when news providers don't include an image.
 */

// In-memory cache to avoid re-fetching the same URL
const ogCache = new Map<string, { imageUrl: string | null; timestamp: number }>();
const OG_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Fetch the og:image for a given article URL.
 * Returns the image URL or null if not found / on error.
 */
export async function fetchOgImage(url: string): Promise<string | null> {
  if (!url || !url.startsWith('http')) return null;

  // Check cache
  const cached = ogCache.get(url);
  if (cached && Date.now() - cached.timestamp < OG_CACHE_TTL) {
    return cached.imageUrl;
  }

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WealthOS/1.0; +https://wealthos.app)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      ogCache.set(url, { imageUrl: null, timestamp: Date.now() });
      return null;
    }

    const html = await res.text();

    // Try og:image first, then twitter:image, then article:image
    const patterns = [
      /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
      /<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i,
      /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i,
      /<meta\s+content=["']([^"']+)["']\s+name=["']twitter:image["']/i,
      /<meta\s+property=["']og:image:url["']\s+content=["']([^"']+)["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const imageUrl = match[1].trim();
        if (imageUrl.startsWith('http')) {
          ogCache.set(url, { imageUrl, timestamp: Date.now() });
          return imageUrl;
        }
      }
    }

    ogCache.set(url, { imageUrl: null, timestamp: Date.now() });
    return null;
  } catch (err) {
    // Don't log — too noisy for expected timeouts
    ogCache.set(url, { imageUrl: null, timestamp: Date.now() });
    return null;
  }
}

/**
 * Batch fetch OG images for multiple articles.
 * Only fetches for articles that don't already have an imageUrl.
 * Limits concurrent requests to avoid overwhelming servers.
 */
export async function fetchOgImagesBatch(
  articles: { url: string; imageUrl?: string | null }[],
  concurrency: number = 5,
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();
  const needFetch = articles.filter(a => a.url && !a.imageUrl);

  // Process in batches to limit concurrency
  for (let i = 0; i < needFetch.length; i += concurrency) {
    const batch = needFetch.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(async (article) => {
        const ogImage = await fetchOgImage(article.url);
        return { url: article.url, ogImage };
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.set(result.value.url, result.value.ogImage);
      }
    }
  }

  return results;
}
