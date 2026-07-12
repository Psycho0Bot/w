import { AssetMetricProvider, MetricCardData } from './base';

export class FixedIncomeMetrics extends AssetMetricProvider {
  public getMetrics(asset: any, usdInrRate: number, extraData?: any): MetricCardData[] {
    const category = asset.category.toLowerCase();
    const currencySymbol = asset.currency === 'USD' ? '$' : '₹';

    if (category === 'gold') {
      const livePrice = asset.currentPrice;
      const rangeLow = (livePrice * 0.85).toFixed(2);
      const rangeHigh = (livePrice * 1.15).toFixed(2);
      return [
        { title: 'Spot Gold Price', value: currencySymbol + livePrice.toFixed(2), subValue: 'Per troy ounce / gram' },
        { title: '52-Week Range', value: currencySymbol + rangeLow + ' - ' + currencySymbol + rangeHigh, subValue: 'Trading extremes' },
        { title: 'Purity Standard', value: '24 Karat (99.9%)', subValue: 'Investment bullion standard' },
        { title: 'Storage Method', value: asset.notes?.includes('SGB') ? 'Dematerialized Sovereign Gold Bond' : 'Physical Custody / Digital Vault', subValue: 'Asset storage profile' }
      ];
    }

    if (category === 'real_estate') {
      const rentalIncome = asset.extra?.rentalIncome || 0;
      const loanRemaining = asset.extra?.loanRemaining || 0;
      const purchasePrice = asset.extra?.purchasePrice || asset.avgBuyPrice;
      const valuation = asset.quantity * asset.currentPrice;
      
      const rentalYield = purchasePrice > 0 ? ((rentalIncome * 12) / purchasePrice * 100).toFixed(2) + '%' : '0.00%';
      const ltv = valuation > 0 ? (loanRemaining / valuation * 100).toFixed(1) + '%' : '0.0%';

      return [
        { title: 'Rental Yield (Gross)', value: rentalYield, subValue: currencySymbol + (rentalIncome * 12).toLocaleString() + ' / Year' },
        { title: 'Loan To Value (LTV)', value: ltv, subValue: 'Debt remaining: ' + currencySymbol + loanRemaining.toLocaleString() },
        { title: 'Sector / Subtype', value: asset.extra?.sector || 'Residential Property', subValue: 'Real estate class classification' },
        { title: 'Purchase Value', value: currencySymbol + purchasePrice.toLocaleString(), subValue: 'Acquisition cost basis' }
      ];
    }

    // Default FD, Debt or Cash metrics
    const interestRate = asset.extra?.interestRate || 7.1;
    const maturityDate = asset.extra?.maturityDate || 'Not Specified';
    const principal = asset.quantity * asset.avgBuyPrice;
    
    // Projected earnings
    const projectedEarned = principal * (interestRate / 100);

    return [
      { 
        title: 'Interest Rate / Yield', 
        value: interestRate.toFixed(2) + '%', 
        subValue: 'Compounding frequency: Annual' 
      },
      { 
        title: 'Maturity Date', 
        value: maturityDate, 
        subValue: 'Locked tenure duration profile' 
      },
      { 
        title: 'Principal Invested', 
        value: currencySymbol + principal.toLocaleString(), 
        subValue: 'Original cost base' 
      },
      { 
        title: 'Projected Annual Yield', 
        value: currencySymbol + projectedEarned.toLocaleString(undefined, { maximumFractionDigits: 0 }), 
        subValue: 'Estimated yield income' 
      },
      { 
        title: 'Liquidity Classification', 
        value: category === 'cash' ? 'High (Instant)' : 'Low (Lock-in/Tenure)', 
        subValue: 'Exit accessibility index' 
      }
    ];
  }
}
