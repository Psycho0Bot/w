export interface MetricCardData {
  title: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

export abstract class AssetMetricProvider {
  /**
   * Generates and returns a list of metrics specific to an asset class.
   * Consumes the asset instance and optional additional pricing metadata.
   */
  public abstract getMetrics(asset: any, usdInrRate: number, extraData?: any): MetricCardData[];
}
