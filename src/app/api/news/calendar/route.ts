import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { logger } from '@/services/LogService';

/**
 * GET /api/news/calendar
 *
 * Fetches upcoming economic events and earnings:
 *   - Finnhub earnings calendar (next 7 days)
 *   - FRED economic releases (CPI, FOMC, GDP, etc.)
 *
 * Returns a unified list of events sorted by date.
 */

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';
const FRED_API_KEY = process.env.FRED_API_KEY || '';

interface CalendarEvent {
  event: string;
  date: string;       // ISO date
  when: string;       // human-readable relative time
  type: 'earnings' | 'economic' | 'fed';
  ticker?: string;
  icon: string;
}

// Cache for 1 hour
let cache: { data: CalendarEvent[]; timestamp: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000;

function relativeTime(dateStr: string): string {
  const eventDate = new Date(dateStr);
  const now = new Date();
  const diffMs = eventDate.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 0) return 'Today';
  if (diffHours < 24) return 'Tonight';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `In ${diffDays} days`;
  return eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

async function fetchEarningsCalendar(): Promise<CalendarEvent[]> {
  if (!FINNHUB_API_KEY) return [];

  try {
    const today = new Date();
    const from = today.toISOString().split('T')[0];
    const future = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const to = future.toISOString().split('T')[0];

    const res = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${FINNHUB_API_KEY}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];

    const data = await res.json();
    const earnings = data?.earningsCalendar || [];
    if (!Array.isArray(earnings)) return [];

    // Filter to major companies (market cap > 0, pick top ones)
    const events: CalendarEvent[] = earnings
      .filter((e: any) => e.symbol && e.date)
      .slice(0, 10)
      .map((e: any) => ({
        event: `${e.symbol} Earnings`,
        date: e.date,
        when: relativeTime(e.date),
        type: 'earnings' as const,
        ticker: e.symbol,
        icon: '📈',
      }));

    return events;
  } catch {
    return [];
  }
}

async function fetchEconomicCalendar(): Promise<CalendarEvent[]> {
  if (!FRED_API_KEY) return [];

  try {
    // Fetch upcoming releases from FRED
    const today = new Date().toISOString().split('T')[0];
    const future = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const res = await fetch(
      `https://api.stlouisfed.org/fred/releases/dates?api_key=${FRED_API_KEY}&file_type=json&limit=50&order_by=release_date&sort_order=asc&realtime_start=${today}&realtime_end=${future}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];

    const data = await res.json();
    const releaseDates = data?.release_dates || [];
    if (!Array.isArray(releaseDates)) return [];

    // Map important economic releases
    const importantReleases: Record<number, { name: string; icon: string }> = {
      10: { name: 'Employment Situation', icon: '📊' },        // Jobs report
      20: { name: 'Consumer Price Index', icon: '📊' },        // CPI
      53: { name: 'GDP Report', icon: '📊' },                  // GDP
      46: { name: 'FOMC Statement', icon: '🏦' },              // Fed
      101: { name: 'Producer Price Index', icon: '📊' },       // PPI
      175: { name: 'Treasury Auction', icon: '💰' },
      50: { name: 'Retail Sales', icon: '🛒' },
      81: { name: 'Industrial Production', icon: '🏭' },
      192: { name: 'Consumer Confidence', icon: '😊' },
      312: { name: 'Unemployment Insurance', icon: '📋' },
    };

    const events: CalendarEvent[] = releaseDates
      .filter((r: any) => importantReleases[r.release_id])
      .slice(0, 10)
      .map((r: any) => {
        const info = importantReleases[r.release_id];
        const isFed = r.release_id === 46;
        return {
          event: info.name,
          date: r.date,
          when: relativeTime(r.date),
          type: isFed ? 'fed' as const : 'economic' as const,
          icon: info.icon,
        };
      });

    return events;
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const authResult = requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json({ events: cache.data });
  }

  try {
    const [earnings, economic] = await Promise.all([
      fetchEarningsCalendar(),
      fetchEconomicCalendar(),
    ]);

    // Merge and sort by date
    const allEvents = [...earnings, ...economic].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Deduplicate by event name + date
    const seen = new Set<string>();
    const deduped = allEvents.filter(e => {
      const key = `${e.event}_${e.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    cache = { data: deduped, timestamp: Date.now() };

    return NextResponse.json({ events: deduped.slice(0, 6) });
  } catch (err) {
    logger.error('Error fetching calendar', err);
    return NextResponse.json({ error: 'Failed to fetch calendar' }, { status: 500 });
  }
}
