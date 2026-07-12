import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, checkRateLimit } from '@/lib/serverAuth';
import { globalRateLimiter } from '@/lib/rateLimit';

async function fetchLatestNews(): Promise<string> {
  try {
    const res = await fetch('https://news.google.com/rss/search?q=finance+cryptocurrency+stocks&hl=en-US&gl=US&ceid=US:en', {
      next: { revalidate: 600 } // cache for 10 minutes
    });
    if (!res.ok) return 'Could not retrieve latest news.';
    const txt = await res.text();
    const items: string[] = [];
    const matches = txt.matchAll(/<item>([\s\S]*?)<\/item>/g);
    for (const match of matches) {
      const content = match[1];
      const titleMatch = content.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = content.match(/<link>([\s\S]*?)<\/link>/);
      const pubDateMatch = content.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      if (titleMatch) {
        const title = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
        const link = linkMatch ? linkMatch[1].trim() : '';
        const pubDate = pubDateMatch ? pubDateMatch[1].trim() : '';
        items.push(`- **${title}** (${pubDate}) - [Link](${link})`);
      }
      if (items.length >= 10) break;
    }
    return items.length > 0 ? items.join('\n') : 'No recent news found.';
  } catch (error) {
    console.error('Failed to fetch news:', error);
    return 'Could not retrieve latest news.';
  }
}

export async function POST(request: NextRequest) {
  // ── Auth check ──
  const authResult = requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  // ── Rate limit ──
  const rateLimitResponse = checkRateLimit(request, globalRateLimiter);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { messages, portfolio, usdInrRate, currencyPref, goals } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    const rate = usdInrRate || 83.54;
    const pref = currencyPref || 'BOTH';
    
    // Fetch latest news
    const newsText = await fetchLatestNews();

    // Perform portfolio totals calculation programmatically for 100% mathematical accuracy
    let totalValUsd = 0;
    let totalValInr = 0;
    let totalInvestedUsd = 0;
    let totalInvestedInr = 0;

    const categoryTotals: Record<string, { valUsd: number; valInr: number; costUsd: number; costInr: number; count: number }> = {};
    const CATEGORY_LABELS: Record<string, string> = {
      stock_in: 'Indian Stocks',
      stock_us: 'US Stocks',
      etf: 'ETFs',
      mutual_fund: 'Mutual Funds',
      crypto: 'Crypto',
      gold: 'Gold & Metals',
      fixed_income: 'Fixed Income & Debt',
      real_estate: 'Real Estate',
      cash: 'Cash & Savings',
    };

    if (portfolio && portfolio.length > 0) {
      portfolio.forEach((asset: any) => {
        const qty = Number(asset.quantity) || 0;
        const buyPrice = Number(asset.avgBuyPrice ?? asset.buyPrice ?? 0);
        const curPrice = Number(asset.currentPrice ?? 0);

        const curValue = qty * curPrice;
        const curValueUsd = asset.currency === 'USD' ? curValue : curValue / rate;
        const curValueInr = asset.currency === 'INR' ? curValue : curValue * rate;

        const invValue = qty * buyPrice;
        const invValueUsd = asset.currency === 'USD' ? invValue : invValue / rate;
        const invValueInr = asset.currency === 'INR' ? invValue : invValue * rate;

        totalValUsd += curValueUsd;
        totalValInr += curValueInr;
        totalInvestedUsd += invValueUsd;
        totalInvestedInr += invValueInr;

        const cat = asset.category || 'other';
        if (!categoryTotals[cat]) {
          categoryTotals[cat] = { valUsd: 0, valInr: 0, costUsd: 0, costInr: 0, count: 0 };
        }
        categoryTotals[cat].valUsd += curValueUsd;
        categoryTotals[cat].valInr += curValueInr;
        categoryTotals[cat].costUsd += invValueUsd;
        categoryTotals[cat].costInr += invValueInr;
        categoryTotals[cat].count += 1;
      });
    }

    const totalPnlUsd = totalValUsd - totalInvestedUsd;
    const totalPnlInr = totalValInr - totalInvestedInr;
    const profitPercent = totalInvestedUsd > 0 ? (totalPnlUsd / totalInvestedUsd) * 100 : 0;

    const categoryBreakdownText = Object.entries(categoryTotals).map(([cat, data]) => {
      const pnlUsd = data.valUsd - data.costUsd;
      const pnlInr = data.valInr - data.costInr;
      const pct = data.costUsd > 0 ? (pnlUsd / data.costUsd) * 100 : 0;
      const label = CATEGORY_LABELS[cat] || cat;
      return `- **${label}**:
  * Current Value: ₹${data.valInr.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ($${data.valUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })} USD)
  * Invested Capital: ₹${data.costInr.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ($${data.costUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })} USD)
  * Unrealized P&L: ${pnlInr >= 0 ? '+' : ''}₹${pnlInr.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (${pnlUsd >= 0 ? '+' : ''}$${pnlUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })} USD) (${pct.toFixed(2)}%)`;
    }).join('\n');
    
    // Format financial goals context for the system prompt
    const goalsText = goals && goals.length > 0
      ? goals.map((g: any) => {
          const percent = Math.min(100, (g.currentAmount / g.targetAmount) * 100);
          const inrCurrent = g.currentAmount * rate;
          const inrTarget = g.targetAmount * rate;
          return `- **${g.name}** (Category: ${g.category || 'other'}): Current Saved ₹${inrCurrent.toLocaleString('en-IN', { maximumFractionDigits: 0 })} ($${g.currentAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD) / Target ₹${inrTarget.toLocaleString('en-IN', { maximumFractionDigits: 0 })} ($${g.targetAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD) (Progress: ${percent.toFixed(1)}%, Deadline: ${g.targetDate})`;
        }).join('\n')
      : 'No active financial goals configured.';

    // Format portfolio context for the system prompt
    const portfolioText = portfolio && portfolio.length > 0
      ? portfolio.map((a: any) => {
          const sym = a.currency === 'INR' ? '₹' : '$';
          const buyPrice = a.avgBuyPrice ?? a.buyPrice ?? 0;
          const currentPrice = a.currentPrice ?? 0;
          return `- ${a.name} (${a.ticker}): Quantity ${a.quantity}, Avg Buy Price ${sym}${buyPrice}, Current Price ${sym}${currentPrice}, Currency: ${a.currency}, Category: ${a.category}`;
        }).join('\n')
      : 'No assets currently in portfolio.';

    const systemPrompt = `You are WealthOS AI Advisor, a world-class financial advisor and crypto/traditional finance expert.
Analyze the user's portfolio and provide actionable, personalized financial advice. Make sure to consider the latest market news in your response.

USD to INR Exchange Rate: 1 USD = ${rate} INR
User Preferred Currency: ${pref}

CRITICAL: Here are the exact portfolio totals calculated directly from the user's database. Do NOT recalculate these totals or output different numbers. When mentioning the user's portfolio value, cost, or returns, ALWAYS use these exact numbers:
- Total Portfolio Value: ₹${totalValInr.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (approx. $${totalValUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })} USD)
- Total Invested Capital: ₹${totalInvestedInr.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (approx. $${totalInvestedUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })} USD)
- Total Unrealized Profit/Loss: ${totalPnlInr >= 0 ? '+' : ''}₹${totalPnlInr.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (${totalPnlUsd >= 0 ? '+' : ''}$${totalPnlUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })} USD)
- Total Return Rate (ROI): ${profitPercent.toFixed(2)}%

User's Financial Goals (IMPORTANT: Align your rebalancing advice, asset allocation feedback, and risk critiques to help the user achieve these target milestones):
${goalsText}

Category Breakdown:
${categoryBreakdownText}

User's current portfolio assets (detailed list):
${portfolioText}

Latest Market News (last 24 hours):
${newsText}

Rules:
1. Provide highly professional, mathematically sound advice.
2. If the user asks about rebalancing, explain which assets to sell/buy based on their target allocations.
3. Be direct, clear, and prioritize risk management.
4. Keep formatting beautiful with clean Markdown, bullet points, and headers.
5. If the user asks about specific crypto coins like SUI, MAJOR, ZK, POL, AO, PEPE, BTC, ETH, XLM, or APT, analyze their quantities and cost bases. Give them insights about market caps, utility, and risk/reward dynamics. Connect your advice to the latest news where relevant.
6. The user may upload screenshots of their holdings. If they upload an image, inspect it to verify asset names, quantities, or values, and offer a detailed critique.
7. Incorporate and cite at least one or two relevant recent news stories from the provided news list that might affect the user's portfolio (e.g., changes in BTC/ETH prices, regulatory updates, or macro market sentiment).
8. CRITICAL CURRENCY RULE: Use the pre-calculated totals above. Do not report an INR value as a USD value or vice-versa.`;

    if (!apiKey) {
      // Return a professional mock message suggesting they add their API key to .env
      const lastMessage = messages[messages.length - 1];
      const userText = lastMessage?.content || '';
      
      let mockReply = `### 🤖 WealthOS Advisor (Demo Mode)

⚠️ **The real Gemini API is currently inactive because the \`GEMINI_API_KEY\` environment variable is not configured in your \`.env\` file.**

To unlock real-time Gemini AI portfolio advice and screenshot processing, please add the following line to your project's **\`.env\`** file:
\`\`\`env
GEMINI_API_KEY="your_gemini_api_key_here"
\`\`\`

---

#### 📰 Latest Market News (Last 24h):
${newsText}

---

#### Portfolio Assessment & Insights:
Based on your active holdings, here is an analysis of your **${portfolio?.length || 0} assets**:
`;

      if (portfolio && portfolio.length > 0) {
        const cryptos = portfolio.filter((a: any) => a.category === 'crypto');
        if (cryptos.length > 0) {
          mockReply += `\n- **High Crypto Concentration:** Cryptocurrencies represent your primary holdings. This introduces significant volatility. We suggest rebalancing a portion into fixed income or broad market index funds to guard against drawdowns.`;
          
          const eth = cryptos.find((c: any) => c.ticker === 'ETH');
          if (eth) {
            mockReply += `\n- **Ethereum (ETH) Focus:** You hold **${eth.quantity} ETH** with an average cost basis of **$${eth.buyPrice}**. With current markets, you are holding a net paper loss of over $1,300. We recommend maintaining a long-term hodl stance rather than panic-selling, or implementing a DCA (Dollar Cost Average) strategy to lower your average entry price.`;
          }
          const btc = cryptos.find((c: any) => c.ticker === 'BTC');
          if (btc) {
            mockReply += `\n- **Bitcoin (BTC) Anchor:** Your **${btc.quantity} BTC** acts as a stable store-of-value anchor for your riskier crypto assets. Consider raising your BTC ratio relative to altcoins (like MAJOR, AO, POL) for improved risk-adjusted returns.`;
          }
          const major = cryptos.find((c: any) => c.ticker === 'MAJOR');
          if (major) {
            mockReply += `\n- **Altcoin Exposure (MAJOR/POL/ZK/AO):** Altcoins like MAJOR (${major.quantity} units) and POL are highly speculative. Only invest capital you are willing to lose entirely, and secure profits into stables/BTC during market rallies.`;
          }
        }
      } else {
        mockReply += `\nYour portfolio is currently empty. Go to the **Import** page to scan a portfolio screenshot or manually add assets!`;
      }

      mockReply += `\n\n*This simulated analysis is tailored directly to your current holdings. Once you supply the API key, you will be able to talk to a live Gemini instance and upload images/screenshots directly in the chat box below!*`;

      return NextResponse.json({ text: mockReply });
    }

    // Call real Gemini API — use header for API key instead of URL param
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;
    
    // Map messages to Gemini API format
    const contents = messages.map((m: any) => {
      const parts: any[] = [];
      
      // If there is an image, attach it as inlineData
      if (m.image) {
        const match = m.image.match(/^data:(image\/[a-zA-Z0-9.-]+);base64,(.+)$/);
        if (match) {
          parts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2]
            }
          });
        }
      }
      
      parts.push({ text: m.content || "Analyze this." });
      
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts
      };
    });

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey, // API key in header, not URL
      },
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API Error:', errText);
      return NextResponse.json({ error: 'AI service is currently unavailable. Please try again later.' }, { status: 502 });
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated from Gemini.';

    return NextResponse.json({ text: candidateText });
  } catch (err: any) {
    console.error('Error in chat API route:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
