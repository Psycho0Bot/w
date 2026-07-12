'use client';

import React, { useEffect, useRef } from 'react';

interface TradingViewWidgetProps {
  symbol: string; // e.g. "NASDAQ:AAPL", "BINANCE:BTCUSDT", "FX_IDC:USDINR"
  theme?: 'light' | 'dark';
}

export default function TradingViewWidget({ symbol, theme = 'dark' }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Reset container contents
    container.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: symbol,
      width: '100%',
      height: '100%',
      locale: 'en',
      dateRange: '12M',
      colorTheme: theme,
      isTransparent: true,
      autosize: true,
      largeChartUrl: '',
    });

    container.appendChild(script);

    return () => {
      if (container) container.innerHTML = '';
    };
  }, [symbol, theme]);

  return (
    <div className="w-full h-full min-h-[140px] relative overflow-hidden rounded-xl bg-black/10 border border-white/5">
      <div ref={containerRef} className="tradingview-widget-container w-full h-full" />
    </div>
  );
}
