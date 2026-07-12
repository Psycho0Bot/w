/**
 * Unified news article shape used across all news providers.
 * Every provider maps their API response into this format.
 */
export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  summary?: string;
  source: string;
  imageUrl?: string;
  ticker: string;
  assetName: string;
  category: string;
  provider: 'finnhub' | 'newsdata' | 'google';
  impactScore: number;
  impactType: 'positive' | 'negative' | 'neutral';
  publishedAt: string; // ISO date string
  // Story grouping — multiple articles covering the same event
  relatedArticles?: { title: string; source: string; url: string }[];
  sourceCount?: number;
}

/**
 * High-impact financial signal keywords.
 * Articles must contain at least one of these to be included in Smart Alerts.
 * Each keyword has a weight — higher weight = more portfolio-relevant.
 */
const IMPACT_KEYWORDS: { regex: RegExp; weight: number; sentiment: 'positive' | 'negative' | 'neutral' }[] = [
  // Earnings & financial results
  { regex: /earnings|quarterly results|Q[1-4] results|revenue (beat|miss|surge|jump|drop|fall|decline)|profit (beat|miss|surge|jump|plunge|fall)|EPS/i, weight: 5, sentiment: 'neutral' },
  { regex: /beats? (estimates?|expectations?|forecasts?)/i, weight: 5, sentiment: 'positive' },
  { regex: /misses? (estimates?|expectations?|forecasts?)/i, weight: 5, sentiment: 'negative' },
  { regex: /guidance|outlook|raises? (guidance|outlook|forecast)|cuts? (guidance|outlook|forecast)|lowers? (guidance|outlook)/i, weight: 4, sentiment: 'neutral' },

  // Upgrades / downgrades
  { regex: /upgrade[sd]?|upgraded|downgrade[sd]?|downgraded|rating (cut|raise|boost|lower)|target (price|raised|cut|lowered|boosted|increased|reduced)/i, weight: 5, sentiment: 'neutral' },
  { regex: /\b(overweight|underweight|buy rating|sell rating|hold rating|strong buy|strong sell)\b/i, weight: 4, sentiment: 'neutral' },

  // M&A, partnerships, deals
  { regex: /acquir(e|es|ing|ition)|merger|merge[sd]?|takeover|buyout|LBO|deal (to buy|to acquire|to merge)/i, weight: 5, sentiment: 'neutral' },
  { regex: /partnership|joint venture|collaborat(e|ion)|strategic (alliance|partnership|deal)|signs? (deal|agreement|contract)/i, weight: 4, sentiment: 'positive' },
  { regex: /contract (win|awarded|secured)|wins? (contract|bid|tender)|order (win|secured|booked)/i, weight: 4, sentiment: 'positive' },

  // Regulatory & legal
  { regex: /FDA (approv|reject|delay)|regulatory (approv|reject|delay|investigation|probe|fine|penalty)|SEC (suit|charge|fine|investigation|probe|settlement)|antitrust|monopoly (probe|investigation|case)/i, weight: 5, sentiment: 'neutral' },
  { regex: /lawsuit|sue[sd]?|class.action|settlement|charged|indicted|fraud|corruption|investigation (into|launched|opened)/i, weight: 4, sentiment: 'negative' },
  { regex: /fine[sd]?|penalty|sanction[sd]?|banned|ban(s|ned)? /i, weight: 4, sentiment: 'negative' },

  // Crypto-specific
  { regex: /ETF (approv|reject|delay|listing|launch|filed)|spot (ETF|bitcoin ETF|ethereum ETF)/i, weight: 5, sentiment: 'neutral' },
  { regex: /hack|exploit|breach|drained|stolen|rugpull|rug pull|exchange (collaps|bankrupt|halts|freezes)/i, weight: 5, sentiment: 'negative' },
  { regex: /burn|token burn|supply (cut|reduce)|halving|halvening/i, weight: 3, sentiment: 'positive' },
  { regex: /mainnet|testnet|launch|upgrade|fork|airdrop|staking|defi (launch|protocol|integration)/i, weight: 3, sentiment: 'neutral' },
  { regex: /whale (buy|sell|move|transfer)|large (buy|sell|transfer)|accumulat(e|ing|ion)/i, weight: 3, sentiment: 'neutral' },

  // Macro / market impact
  { regex: /interest rate|hike|cut rates|fed (decision|meeting|hike|cut)|rate (decision|hike|cut|increase|decrease)|inflation (data|report|rises|falls|surges)|CPI|FOMC/i, weight: 4, sentiment: 'neutral' },
  { regex: /crude (oil|prices?) (surge|jump|plunge|fall|rise|drop|spike)|oil prices? (surge|jump|plunge|fall|rise|drop|spike)|gold prices? (surge|jump|plunge|fall|rise|drop|spike|record)/i, weight: 4, sentiment: 'neutral' },

  // Stock-specific corporate actions
  { regex: /buyback|share (repurchase|buyback)|dividend (increase|raise|cut|slash|announce|declare|boost)|special dividend|stock split|reverse split/i, weight: 4, sentiment: 'neutral' },
  { regex: /IPO|going public|SPAC|listing (date|plans?|files?)/i, weight: 4, sentiment: 'neutral' },
  { regex: /CEO (resign|quit|step down|fired|ousted|replaced)|CFO (resign|quit|fired|ousted)|executive (resign|fired|ousted|depart)|leadership (change|shake.up|transition)/i, weight: 4, sentiment: 'negative' },
  { regex: /layoff|layoffs|job cuts|firing|restructuring|headcount (cut|reduce)/i, weight: 3, sentiment: 'negative' },
  { regex: /product (launch|reveal|announce|delay|recall)|new (product|iPhone|model|release|feature)|unveil/i, weight: 3, sentiment: 'neutral' },
  { regex: /recall|defect|safety (issue|concern|investigation)|faulty/i, weight: 4, sentiment: 'negative' },

  // Price-moving keywords
  { regex: /(surge|soar|jump|spike|rally|skyrocket|moon|pump|bull run|bullish)\b/i, weight: 3, sentiment: 'positive' },
  { regex: /(plunge|crash|dump|tumble|nosedive|collapse|crater|tank|freefall|bearish|sell.off|slump)\b/i, weight: 3, sentiment: 'negative' },
  { regex: /(all.time high|record high|all.time low|52.week (high|low))\b/i, weight: 4, sentiment: 'neutral' },
  { regex: /(default|bankrupt|chapter 11|insolvency|liquidation|collapse)\b/i, weight: 5, sentiment: 'negative' },
  { regex: /(delist|delisting|halt|trading halt|suspension|suspend)\b/i, weight: 5, sentiment: 'negative' },
];

/**
 * Scores a headline (+ optional summary) for portfolio impact.
 * Returns score=0 if the text has no financial signal keywords.
 */
export function scoreArticle(title: string, summary?: string): { score: number; sentiment: 'positive' | 'negative' | 'neutral' } {
  const text = `${title} ${summary || ''}`;
  let score = 0;
  let positiveCount = 0;
  let negativeCount = 0;

  for (const { regex, weight, sentiment } of IMPACT_KEYWORDS) {
    if (regex.test(text)) {
      score += weight;
      if (sentiment === 'positive') positiveCount++;
      else if (sentiment === 'negative') negativeCount++;
    }
  }

  const sentiment = negativeCount > positiveCount ? 'negative' : positiveCount > negativeCount ? 'positive' : 'neutral';
  return { score, sentiment };
}
