/**
 * Asset badge helper — colored circle badges by asset type.
 * No external logo fetching — keeps the app trustworthy and fast.
 *
 * 🟠 Crypto   → orange
 * 🔵 ETF      → blue
 * 🟢 Stock    → green
 * 🟡 Commodity→ gold
 * 🟣 Index    → purple
 * ⚪ Other    → gray
 */

export type BadgeColor = 'orange' | 'blue' | 'green' | 'gold' | 'purple' | 'gray';

/**
 * Map asset category to badge color.
 */
export function getBadgeColor(category?: string): BadgeColor {
  if (!category) return 'gray';
  const cat = category.toLowerCase();
  if (cat === 'crypto') return 'orange';
  if (cat === 'etf' || cat === 'mutual_fund') return 'blue';
  if (cat === 'stock_us' || cat === 'stock_in') return 'green';
  if (cat === 'gold' || cat === 'commodity') return 'gold';
  if (cat.includes('index') || cat.includes('nifty') || cat.includes('sensex')) return 'purple';
  return 'gray';
}

/**
 * Tailwind classes for each badge color.
 */
export const BADGE_STYLES: Record<BadgeColor, { bg: string; ring: string; text: string }> = {
  orange: { bg: 'bg-orange-500/20', ring: 'border-orange-500/30', text: 'text-orange-400' },
  blue:   { bg: 'bg-blue-500/20',   ring: 'border-blue-500/30',   text: 'text-blue-400' },
  green:  { bg: 'bg-emerald-500/20',ring: 'border-emerald-500/30',text: 'text-emerald-400' },
  gold:   { bg: 'bg-amber-500/20',  ring: 'border-amber-500/30',  text: 'text-amber-400' },
  purple: { bg: 'bg-purple-500/20', ring: 'border-purple-500/30', text: 'text-purple-400' },
  gray:   { bg: 'bg-white/5',       ring: 'border-white/10',      text: 'text-gray-400' },
};

/**
 * Verified financial news sources — gets a "Verified Source" badge.
 */
const VERIFIED = [
  'Reuters', 'Bloomberg', 'CNBC', 'Economic Times', 'Moneycontrol',
  'CoinDesk', 'Cointelegraph', 'The Block', 'WSJ', 'Wall Street Journal',
  'Financial Times', 'FT', "Barron's", 'MarketWatch', 'Investing.com',
  'Yahoo Finance', 'Seeking Alpha', 'Motley Fool', 'Investopedia',
  'Forbes', 'Business Insider', 'TechCrunch', 'The Verge',
  'Associated Press', 'AP', 'AFP', 'Benzinga', 'GlobeNewswire',
  'PR Newswire', 'Business Standard', 'Livemint', 'NDTV Profit',
  'CNBC TV18', 'ET Now', 'Mint', 'Hindu BusinessLine',
];

export function isVerifiedSource(source: string): boolean {
  const normalized = source.trim().toLowerCase();
  for (const v of VERIFIED) {
    if (v.toLowerCase() === normalized) return true;
  }
  return false;
}

/**
 * Source classification — factual labels, not subjective ratings.
 * Based on whether the publisher is a recognized editorial organization.
 */
const SOURCE_TYPES: Record<string, { type: string; verified: boolean }> = {
  // Wire services / official — verified
  'reuters': { type: 'Wire Service', verified: true },
  'bloomberg': { type: 'Wire Service', verified: true },
  'associated press': { type: 'Wire Service', verified: true },
  'ap': { type: 'Wire Service', verified: true },
  'afp': { type: 'Wire Service', verified: true },
  'wsj': { type: 'Major Financial Media', verified: true },
  'wall street journal': { type: 'Major Financial Media', verified: true },
  'financial times': { type: 'Major Financial Media', verified: true },
  'ft': { type: 'Major Financial Media', verified: true },
  // Major financial media — verified
  'cnbc': { type: 'Major Financial Media', verified: true },
  'marketwatch': { type: 'Major Financial Media', verified: true },
  'barron\'s': { type: 'Major Financial Media', verified: true },
  'barrons': { type: 'Major Financial Media', verified: true },
  'investing.com': { type: 'Major Financial Media', verified: true },
  'yahoo finance': { type: 'Major Financial Media', verified: true },
  'forbes': { type: 'Major Financial Media', verified: true },
  'business insider': { type: 'Major Financial Media', verified: true },
  'economic times': { type: 'Major Financial Media', verified: true },
  'moneycontrol': { type: 'Major Financial Media', verified: true },
  'business standard': { type: 'Major Financial Media', verified: true },
  'livemint': { type: 'Major Financial Media', verified: true },
  'hindu businessline': { type: 'Major Financial Media', verified: true },
  'mint': { type: 'Major Financial Media', verified: true },
  'ndtv profit': { type: 'Major Financial Media', verified: true },
  'cnbc tv18': { type: 'Major Financial Media', verified: true },
  'et now': { type: 'Major Financial Media', verified: true },
  // Crypto-native media
  'coindesk': { type: 'Crypto Media', verified: true },
  'cointelegraph': { type: 'Crypto Media', verified: true },
  'the block': { type: 'Crypto Media', verified: true },
  // Financial blogs — unverified
  'investopedia': { type: 'Financial Blog', verified: false },
  'motley fool': { type: 'Financial Blog', verified: false },
  'seeking alpha': { type: 'Financial Blog', verified: false },
  'techcrunch': { type: 'Tech Media', verified: false },
  'the verge': { type: 'Tech Media', verified: false },
};

export function getSourceInfo(source: string): { type: string; verified: boolean } {
  const normalized = source.trim().toLowerCase();
  const info = SOURCE_TYPES[normalized];
  if (info) return info;
  // Check if it's a known verified source
  if (isVerifiedSource(source)) return { type: 'Recognized Source', verified: true };
  return { type: 'Unverified', verified: false };
}

/**
 * Format a price with currency symbol.
 */
export function formatPrice(price: number, currency: 'INR' | 'USD'): string {
  if (currency === 'INR') {
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)}Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(2)}L`;
    if (price >= 1000) return `₹${(price / 1000).toFixed(1)}K`;
    return `₹${price.toFixed(2)}`;
  }
  if (price >= 1000000) return `$${(price / 1000000).toFixed(2)}M`;
  if (price >= 1000) return `$${(price / 1000).toFixed(1)}K`;
  return `$${price.toFixed(2)}`;
}
