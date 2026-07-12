import { NextResponse } from 'next/server';
import { marketDataService } from '@/services/MarketDataService';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker') || '';
  const category = searchParams.get('category') || 'stock_in';
  const range = searchParams.get('range') || '1y';

  if (!ticker) {
    return NextResponse.json({ error: 'Ticker query parameter is required' }, { status: 400 });
  }

  try {
    const data = await marketDataService.getHistory(ticker, category, range);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch market history' }, { status: 500 });
  }
}
