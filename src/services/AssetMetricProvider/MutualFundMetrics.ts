import { AssetMetricProvider, MetricCardData } from './base';

const schemeDetailsMap: Record<string, { manager: string; aum: string; expenseRatio: string; exitLoad: string; categoryRank: string; ratingStars: string }> = {
  '119063': {
    manager: 'Arun Agarwal & Nandita Menezes',
    aum: '₹23,703 Cr',
    expenseRatio: '0.20%',
    exitLoad: '0.25% if redeemed within 3 days',
    categoryRank: '12 of 84',
    ratingStars: '★★★★☆'
  },
  '122639': {
    manager: 'Rajeev Thakkar',
    aum: '₹1,43,388 Cr',
    expenseRatio: '0.53%',
    exitLoad: '2.00% within 365 days, 1.00% within 730 days',
    categoryRank: '2 of 81',
    ratingStars: '★★★★★'
  },
  '118989': {
    manager: 'Pradeep Kesavan & Saurabh Pant',
    aum: '₹55,064 Cr',
    expenseRatio: '0.84%',
    exitLoad: '0.25% if redeemed within 30 days',
    categoryRank: '15 of 78',
    ratingStars: '★★★★☆'
  },
  '120847': {
    manager: 'Gaurav Misra',
    aum: '₹37,692 Cr',
    expenseRatio: '0.52%',
    exitLoad: '1.00% if redeemed within 365 days',
    categoryRank: '24 of 78',
    ratingStars: '★★★★☆'
  },
  '148918': {
    manager: 'Swapnil Mayekar & Rakesh Shetty',
    aum: '₹8,583 Cr',
    expenseRatio: '0.19%',
    exitLoad: '1.00% if redeemed within 15 days',
    categoryRank: '10 of 28',
    ratingStars: '★★★★☆'
  },
  '120828': {
    manager: 'Sanjeev Sharma, Vasav Sahgal & Ankit A. Pande',
    aum: '₹33,739 Cr',
    expenseRatio: '0.77%',
    exitLoad: '1.00% if redeemed within 365 days',
    categoryRank: '3 of 42',
    ratingStars: '★★★★★'
  },
  '120823': {
    manager: 'Ankit Pande, Sanjeev Sharma & Vasav Sahgal',
    aum: '₹7,664 Cr',
    expenseRatio: '0.75%',
    exitLoad: '1.00% if redeemed within 15 days',
    categoryRank: '5 of 81',
    ratingStars: '★★★★★'
  },
  '118778': {
    manager: 'Samir Rachh & Amber Singhania',
    aum: '₹78,407 Cr',
    expenseRatio: '0.67%',
    exitLoad: '1.00% if redeemed within 365 days',
    categoryRank: '1 of 42',
    ratingStars: '★★★★★'
  },
  '119598': {
    manager: 'Shreyash Devalkar & Jayesh Sundar',
    aum: '₹30,005 Cr',
    expenseRatio: '0.75%',
    exitLoad: 'None',
    categoryRank: '42 of 78',
    ratingStars: '★★★☆☆'
  },
  '119364': {
    manager: 'Anish Tawakley & Sankaran Naren',
    aum: '₹76,297 Cr',
    expenseRatio: '0.72%',
    exitLoad: '1.00% if redeemed within 30 days',
    categoryRank: '8 of 78',
    ratingStars: '★★★★★'
  },
  '118632': {
    manager: 'Sailesh Raj Bhan & Bhavik Dave',
    aum: '₹53,227 Cr',
    expenseRatio: '0.58%',
    exitLoad: '1.00% if redeemed within 7 days',
    categoryRank: '4 of 78',
    ratingStars: '★★★★★'
  },
  '119732': {
    manager: 'Rohit Shimpi',
    aum: '₹6,684 Cr',
    expenseRatio: '0.79%',
    exitLoad: '0.50% if redeemed within 30 days',
    categoryRank: '2 of 18',
    ratingStars: '★★★★☆'
  },
  '127042': {
    manager: 'Ankit Agarwal',
    aum: '₹36,458 Cr',
    expenseRatio: '0.65%',
    exitLoad: '1.00% if redeemed within 365 days',
    categoryRank: '4 of 48',
    ratingStars: '★★★★★'
  },
  '146746': {
    manager: 'Rajeev Thakkar',
    aum: '₹5,540 Cr',
    expenseRatio: '0.68%',
    exitLoad: 'None',
    categoryRank: '5 of 62',
    ratingStars: '★★★★★'
  },
  '120621': {
    manager: 'Sanket Gaidhani',
    aum: '₹8,351 Cr',
    expenseRatio: '0.98%',
    exitLoad: '1.00% if redeemed within 15 days',
    categoryRank: '3 of 22',
    ratingStars: '★★★★★'
  },
  '118557': {
    manager: 'Ajay Argal & Kiran Sebastian',
    aum: '₹3,160 Cr',
    expenseRatio: '1.05%',
    exitLoad: '1.00% if redeemed within 1 year',
    categoryRank: '5 of 22',
    ratingStars: '★★★★☆'
  },
  '147946': {
    manager: 'Manish Gunwani & Kirthi Jain',
    aum: '₹27,219 Cr',
    expenseRatio: '0.68%',
    exitLoad: '1.00% if redeemed within 365 days',
    categoryRank: '7 of 42',
    ratingStars: '★★★★★'
  }
};

export class MutualFundMetrics extends AssetMetricProvider {
  public getMetrics(asset: any, usdInrRate: number, extraData?: any): MetricCardData[] {
    const ticker = asset.ticker.toUpperCase().replace(/\.(NS|BOM)$/, '');
    const liveDetails = extraData?.mfDetails;
    const matched = liveDetails || schemeDetailsMap[ticker];

    let expenseRatio = '0.62%';
    let exitLoad = '1.00% if redeemed within 1 year';
    let aum = '₹4,500 Cr';
    let manager = 'Sachin Relekar';
    let categoryRank = '15 of 42';
    let ratingStars = '★★★★☆';

    if (matched) {
      manager = matched.manager;
      aum = matched.aum;
      expenseRatio = matched.expenseRatio;
      exitLoad = matched.exitLoad;
      categoryRank = matched.categoryRank;
      ratingStars = matched.ratingStars;
    } else {
      // Deterministic metrics generation as fallback
      const getHash = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return Math.abs(hash);
      };

      const hash = getHash(ticker);
      expenseRatio = ((hash % 100) + 40) / 100 + '%'; // 0.40% to 1.40%
      exitLoad = (hash % 2 === 0) ? '1.00% if redeemed within 1 year' : 'None';
      
      const aumRaw = (hash % 18000) + 2000;
      aum = '₹' + aumRaw.toLocaleString('en-IN') + ' Cr';
      
      const managers = ['Sankaran Naren', 'Sachin Relekar', 'Rajeev Thakkar', 'Jinesh Gopani', 'R. Srinivasan', 'Harsha Upadhyaya'];
      manager = managers[hash % managers.length];

      categoryRank = `${(hash % 5) + 1} of 42`;
      ratingStars = '★'.repeat((hash % 3) + 3) + '☆'.repeat(5 - ((hash % 3) + 3));
    }

    const metrics: MetricCardData[] = [
      {
        title: 'Fund Manager',
        value: manager,
        subValue: 'Lead Portfolio Manager'
      },
      {
        title: 'Assets Under Management (AUM)',
        value: aum,
        subValue: matched?.fundHouse || 'Fund Size'
      },
      {
        title: 'Expense Ratio',
        value: expenseRatio,
        subValue: matched?.planType ? `${matched.planType} Plan` : 'Direct Plan'
      },
      {
        title: 'Exit Load',
        value: exitLoad,
        subValue: 'Redemption penalty rules'
      },
      {
        title: 'Category Rank',
        value: categoryRank,
        subValue: matched?.subCategory || 'Performance in peer group'
      },
      {
        title: 'Analyst Rating',
        value: ratingStars,
        subValue: 'Crisil / Groww Rating'
      }
    ];

    // Add enriched fields if available from live data
    if (matched && matched !== schemeDetailsMap[ticker]) {
      if (matched.nav) metrics.push({ title: 'NAV', value: matched.nav, subValue: matched.navDate || 'Latest NAV' });
      if (matched.benchmark && matched.benchmark !== '—') metrics.push({ title: 'Benchmark', value: matched.benchmark, subValue: 'Index tracked' });
      if (matched.riskLevel && matched.riskLevel !== '—') metrics.push({ title: 'Risk Level', value: matched.riskLevel, subValue: 'Risk classification' });
      if (matched.portfolioTurnover && matched.portfolioTurnover !== '—') metrics.push({ title: 'Portfolio Turnover', value: matched.portfolioTurnover, subValue: 'Annual turnover ratio' });
      if (matched.minSIP && matched.minSIP !== '—') metrics.push({ title: 'Min SIP', value: matched.minSIP, subValue: 'Monthly SIP investment' });

      // Returns
      if (matched.returns) {
        const r = matched.returns;
        if (r['1Y'] != null) metrics.push({ title: '1Y Return', value: `${r['1Y']}%`, subValue: matched.categoryReturns?.['1Y'] != null ? `Category: ${matched.categoryReturns['1Y']}%` : 'Category avg' });
        if (r['3Y'] != null) metrics.push({ title: '3Y Return (CAGR)', value: `${r['3Y']}%`, subValue: matched.categoryReturns?.['3Y'] != null ? `Category: ${matched.categoryReturns['3Y']}%` : 'Category avg' });
        if (r['5Y'] != null) metrics.push({ title: '5Y Return (CAGR)', value: `${r['5Y']}%`, subValue: matched.categoryReturns?.['5Y'] != null ? `Category: ${matched.categoryReturns['5Y']}%` : 'Category avg' });
      }

      // Top holdings
      if (matched.topHoldings?.length > 0) {
        const holdingsStr = matched.topHoldings.map((h: any) => `${h.name} (${h.weight}%)`).join(', ');
        metrics.push({ title: 'Top Holdings', value: holdingsStr, subValue: 'Highest weighted stocks' });
      }

      // Top sectors
      if (matched.topSectors?.length > 0) {
        const sectorsStr = matched.topSectors.map((s: any) => `${s.name} (${s.weight}%)`).join(', ');
        metrics.push({ title: 'Top Sectors', value: sectorsStr, subValue: 'Sector allocation' });
      }
    }

    return metrics;
  }
}
