'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PortfolioProvider, usePortfolio, Asset } from '@/context/portfolioStore';
import { formatVal } from '@/services/financeUtils';
import { useSession, signOut as nextAuthSignOut, SessionProvider } from '@/context/authContext';
import { useTheme, ThemeProvider } from '@/providers/ThemeProvider';
import {
  LayoutDashboard,
  Briefcase,
  PieChart as ChartIcon,
  BrainCircuit,
  Eye,
  Calendar,
  Percent,
  Upload,
  Search,
  Bell,
  RefreshCw,
  Menu,
  X,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers,
  Settings,
  Plus,
  Sun,
  Moon,
  LogOut,
  User as UserIcon,
  Newspaper
} from 'lucide-react';

interface SidebarLink {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
}

const navLinks: SidebarLink[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Portfolio', href: '/portfolio', icon: Briefcase },
  { name: 'Analytics', href: '/analytics', icon: ChartIcon },
  { name: 'AI Advisor', href: '/ai-advisor', icon: BrainCircuit },
  { name: 'News', href: '/news', icon: Newspaper },
  { name: 'Watchlist', href: '/watchlist', icon: Eye },
  { name: 'Calendar', href: '/calendar', icon: Calendar },
  { name: 'Tax', href: '/tax', icon: Percent },
  { name: 'CSV Import', href: '/import', icon: Upload },
];

function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { theme, setTheme, resolvedTheme } = useTheme();
  
  const isAuthPage = ['/login', '/signup'].includes(pathname);

  const {
    assets,
    currencyPref,
    setCurrencyPref,
    alerts,
    markAlertRead,
    clearAlerts,
    refreshPrices,
    isUpdatingPrices,
    usdInrRate,
    googleSheetUrl,
    setGoogleSheetUrl,
    lastSyncTime,
    sheetSyncCount,
    priceSheet,
    updateSheetPrice,
    resetSheetPrice,
    addSheetTicker
  } = usePortfolio();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'virtual' | 'google'>('virtual');
  const [sheetSearch, setSheetSearch] = useState('');

  // Add custom asset ticker form state
  const [customTicker, setCustomTicker] = useState('');
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<Asset['category']>('cash');
  const [customPrice, setCustomPrice] = useState('');
  const [customCurrency, setCustomCurrency] = useState<'INR' | 'USD'>('INR');

  const unreadAlerts = useMemo(() => alerts.filter(a => !a.read), [alerts]);

  const filteredPriceSheet = useMemo(() => {
    return priceSheet.filter(
      (item) =>
        item.ticker.toLowerCase().includes(sheetSearch.toLowerCase()) ||
        item.name.toLowerCase().includes(sheetSearch.toLowerCase())
    );
  }, [priceSheet, sheetSearch]);

  const handleAddCustomTicker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTicker || !customName || !customPrice) return;
    addSheetTicker({
      ticker: customTicker.toUpperCase(),
      name: customName,
      price: parseFloat(customPrice),
      currency: customCurrency,
      category: customCategory,
    });
    setCustomTicker('');
    setCustomName('');
    setCustomPrice('');
  };

  // Global search filtering across all portfolio assets
  const filteredAssets = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return assets.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.ticker.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [searchQuery, assets]);

  const handleAlertClick = (id: string) => {
    markAlertRead(id);
  };

  if (isAuthPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030308] relative font-sans text-slate-100 overflow-hidden">
        {/* Decorative Blur Blobs */}
        <div className="glow-blob w-[400px] h-[400px] bg-indigo-500/10 top-[-100px] left-[-100px]" />
        <div className="glow-blob w-[500px] h-[500px] bg-violet-600/5 bottom-[-100px] right-[-100px]" />
        <main className="relative z-10 w-full">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex text-slate-100 bg-[#030308] relative font-sans">
      {/* Decorative Blur Blobs */}
      <div className="glow-blob w-[400px] h-[400px] bg-indigo-500/10 top-[-100px] left-[-100px]" />
      <div className="glow-blob w-[500px] h-[500px] bg-violet-600/5 bottom-[-100px] right-[-100px]" />
      <div className="glow-blob w-[300px] h-[300px] bg-emerald-500/5 top-[30%] right-[10%]" />

      {/* Sidebar Navigation - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 glass-panel border-r border-white/5 sticky top-0 h-screen z-20 shrink-0">
        {/* Brand */}
        <div className="p-6 border-b border-white/5 flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-tight text-white">WealthOS</h1>
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Portfolio Engine</p>
          </div>
        </div>

        {/* Links */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto no-scrollbar">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`flex items-center px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600/25 to-transparent text-indigo-400 border-l-2 border-indigo-500'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 mr-3 transition-colors ${isActive ? 'text-indigo-400' : 'text-gray-400 group-hover:text-white'}`} />
                {link.name}
                {link.name === 'Portfolio' && assets.length > 0 && (
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    {assets.length}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sync Rate Info */}
        <div className="p-6 border-t border-white/5 bg-black/10 flex flex-col space-y-1.5 text-xs text-gray-500">
          <div className="flex items-center justify-between">
            <span>USD/INR rate:</span>
            <span className="font-semibold text-gray-400">₹{usdInrRate.toFixed(2)}</span>
          </div>
          {googleSheetUrl && (
            <div className="flex items-center justify-between border-t border-white/5 pt-1.5">
              <span>Google Sheet:</span>
              <span className="font-bold text-indigo-400" title={`Last Synced: ${lastSyncTime}`}>
                {sheetSyncCount} synced
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Dashboard Bar */}
        <header className="h-16 glass-panel border-b border-white/5 px-6 sticky top-0 flex items-center justify-between z-10 backdrop-blur-md">
          {/* Left: Mobile hamburger & Title */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Global Search Bar */}
            <div className="relative max-w-md hidden sm:block">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Global Search tickers, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                className="w-64 focus:w-80 transition-all text-xs glass-input pl-9 pr-4 py-2 rounded-xl text-white placeholder-gray-500"
              />

              {/* Search dropdown results */}
              {searchFocused && filteredAssets.length > 0 && (
                <div className="absolute left-0 right-0 mt-2 glass-panel border border-white/10 rounded-2xl shadow-2xl p-2 z-50 text-xs overflow-hidden">
                  <div className="px-3 py-1.5 text-gray-500 uppercase tracking-wider font-semibold text-[10px]">
                    Holdings Found
                  </div>
                  <div className="space-y-0.5">
                    {filteredAssets.map((asset) => {
                      const val = asset.quantity * asset.currentPrice;
                      return (
                        <Link
                          key={asset.id}
                          href="/portfolio"
                          className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg transition-colors"
                        >
                          <div>
                            <p className="font-semibold text-white">{asset.name}</p>
                            <p className="text-[10px] text-gray-500">{asset.ticker} • {asset.category.replace('_', ' ').toUpperCase()}</p>
                          </div>
                          <span className="font-bold text-gray-300">
                            {formatVal(val, asset.currency, 0)}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-4">
            {/* Currency selector toggle */}
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 text-xs font-semibold">
              {(['INR', 'USD', 'BOTH'] as const).map((pref) => (
                <button
                  key={pref}
                  onClick={() => setCurrencyPref(pref)}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    currencyPref === pref
                      ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/10'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {pref}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => refreshPrices()}
              disabled={isUpdatingPrices}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 border border-white/5 flex items-center justify-center transition-all disabled:opacity-50"
              title="Refresh Portfolio Prices"
            >
              <RefreshCw className={`w-4 h-4 ${isUpdatingPrices ? 'animate-spin text-indigo-400' : ''}`} />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 border border-white/5 flex items-center justify-center transition-all"
              title={`Theme: ${theme}`}
            >
              {resolvedTheme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {/* Settings Button */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 border border-white/5 flex items-center justify-center transition-all"
              title="WealthOS Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Alerts Drawer */}
            <div className="relative">
              <button
                onClick={() => setAlertsOpen(!alertsOpen)}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 border border-white/5 relative flex items-center justify-center"
              >
                <Bell className="w-4 h-4" />
                {unreadAlerts.length > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                )}
              </button>

              {/* Alerts drop window */}
              {alertsOpen && (
                <div className="absolute right-0 mt-3 w-80 glass-panel border border-white/10 rounded-2xl shadow-2xl p-4 z-50 text-xs flex flex-col space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="font-bold text-sm text-white">Smart Alerts ({unreadAlerts.length})</span>
                    {unreadAlerts.length > 0 && (
                      <button onClick={clearAlerts} className="text-[10px] text-indigo-400 hover:underline">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
                    {alerts.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">No alerts active</p>
                    ) : (
                      alerts.map((al) => {
                        const isNews = al.id.startsWith('news_');
                        const Wrapper = isNews && al.link ? 'a' : 'div';
                        return (
                        <Wrapper
                          key={al.id}
                          {...(isNews && al.link ? { href: al.link, target: '_blank', rel: 'noopener noreferrer' } : { onClick: () => handleAlertClick(al.id) })}
                          className={`p-2.5 rounded-xl border transition-colors cursor-pointer flex gap-2.5 ${
                            al.read
                              ? 'bg-transparent border-white/5 opacity-60'
                              : isNews
                              ? 'bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10'
                              : al.type === 'critical'
                              ? 'bg-rose-500/5 border-rose-500/20 hover:bg-rose-500/10'
                              : al.type === 'warning'
                              ? 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10'
                              : 'bg-indigo-500/5 border-indigo-500/20 hover:bg-indigo-500/10'
                          }`}
                        >
                        <div className="mt-0.5">
                            {isNews && <Newspaper className="w-4 h-4 text-blue-400" />}
                            {!isNews && al.type === 'critical' && <AlertTriangle className="w-4 h-4 text-rose-400" />}
                            {!isNews && al.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                            {!isNews && al.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                            {!isNews && al.type === 'info' && <Info className="w-4 h-4 text-blue-400" />}
                          </div>
                          <div className="flex-1 space-y-0.5">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-white">{al.title}</span>
                              <span className="text-[9px] text-gray-500">
                                {new Date(al.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-gray-400 text-[11px] leading-snug">{al.message}</p>
                          </div>
                        </Wrapper>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile / Logout Dropdown */}
            {session?.user && (
              <div className="flex items-center space-x-2 pl-2 border-l border-white/10">
                <div className="hidden md:flex flex-col text-right">
                  <span className="font-semibold text-xs text-white leading-tight">{session.user.name || 'User'}</span>
                  <span className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">{(session.user as any).role || 'USER'}</span>
                </div>
                <button
                  onClick={() => nextAuthSignOut()}
                  className="p-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/15 flex items-center justify-center transition-all"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Child Router Screens */}
        <main className="flex-1 p-6 overflow-y-auto no-scrollbar relative z-10">{children}</main>
      </div>

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#07070f] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5 relative overflow-hidden text-xs flex flex-col max-h-[85vh]">
            <div className="glow-blob w-[200px] h-[200px] bg-indigo-600/10 top-[-50px] right-[-50px]" />
            <div className="flex items-center justify-between border-b border-white/5 pb-3 shrink-0">
              <div className="flex items-center space-x-2">
                <Settings className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">WealthOS Asset Configuration</h3>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Switched Header */}
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 text-xs font-semibold shrink-0">
              <button
                onClick={() => setSettingsTab('virtual')}
                className={`flex-1 py-2 rounded-lg text-center transition-all ${
                  settingsTab === 'virtual'
                    ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/10'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Virtual Price Sheet (Built-in)
              </button>
              <button
                onClick={() => setSettingsTab('google')}
                className={`flex-1 py-2 rounded-lg text-center transition-all ${
                  settingsTab === 'google'
                    ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/10'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                External Google Sheet Sync
              </button>
            </div>

            {/* Tabs content */}
            <div className="flex-1 overflow-y-auto pr-1 no-scrollbar space-y-4">
              {settingsTab === 'virtual' ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center gap-4">
                    <p className="text-gray-400 text-[11px] leading-relaxed">
                      Update any price directly in the sheet below. Manually updated values are locked and won't be overwritten by live API streams.
                    </p>
                    <input
                      type="text"
                      placeholder="Search tickers..."
                      value={sheetSearch}
                      onChange={(e) => setSheetSearch(e.target.value)}
                      className="glass-input px-3 py-1.5 rounded-lg text-[10px] w-48 text-white placeholder-gray-500 shrink-0"
                    />
                  </div>

                  {/* Pricing table */}
                  <div className="border border-white/5 rounded-xl overflow-hidden bg-black/20">
                    <table className="w-full text-[10px] text-left border-collapse">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/5 font-bold uppercase tracking-wider text-gray-400">
                          <th className="p-2.5">Ticker</th>
                          <th className="p-2.5">Name</th>
                          <th className="p-2.5">Category</th>
                          <th className="p-2.5 text-right">Price Override</th>
                          <th className="p-2.5 text-center">Status</th>
                          <th className="p-2.5 text-center">Reset</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPriceSheet.map((item) => (
                          <tr key={item.ticker} className="border-b border-white/5 hover:bg-white/5 transition-all">
                            <td className="p-2.5 font-bold text-white">{item.ticker}</td>
                            <td className="p-2.5 text-gray-300 max-w-[120px] truncate" title={item.name}>{item.name}</td>
                            <td className="p-2.5 text-gray-500 uppercase font-semibold text-[9px]">{item.category.replace('_', ' ')}</td>
                            <td className="p-2.5 text-right">
                              <div className="inline-flex items-center space-x-1 justify-end">
                                <span className="text-gray-500 font-semibold">{item.currency === 'USD' ? '$' : '₹'}</span>
                                <input
                                  type="number"
                                  step="any"
                                  className="w-20 px-1.5 py-0.5 bg-black/40 border border-white/10 rounded text-right text-white focus:border-indigo-500 focus:outline-none"
                                  defaultValue={item.price.toFixed(item.category === 'crypto' ? 5 : 2)}
                                  onBlur={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) {
                                      updateSheetPrice(item.ticker, val);
                                    }
                                  }}
                                />
                              </div>
                            </td>
                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[8px] ${
                                item.isManual
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {item.isManual ? 'Manual' : 'Auto'}
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              {item.isManual ? (
                                <button
                                  onClick={() => resetSheetPrice(item.ticker)}
                                  className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 font-bold transition-all text-[9px]"
                                >
                                  Unlock
                                </button>
                              ) : (
                                <span className="text-gray-600">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Add Custom Ticker section */}
                  <form onSubmit={handleAddCustomTicker} className="border border-white/5 p-3 rounded-xl bg-black/40 space-y-3">
                    <h4 className="font-bold text-white uppercase text-[9px] tracking-wider flex items-center">
                      <Plus className="w-3 h-3 mr-1" /> Add Custom Asset Price (FD, Land, etc.)
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[10px]">
                      <input
                        type="text"
                        placeholder="Ticker (e.g. LAND_MUM)"
                        value={customTicker}
                        onChange={(e) => setCustomTicker(e.target.value)}
                        className="glass-input px-2 py-1.5 rounded-lg text-white"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Asset Name (e.g. Mumbai Plot)"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        className="glass-input px-2 py-1.5 rounded-lg text-white"
                        required
                      />
                      <select
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value as Asset['category'])}
                        className="glass-input px-2 py-1.5 rounded-lg text-white bg-slate-900 border border-white/10"
                      >
                        <option value="stock_in">Indian Stock</option>
                        <option value="stock_us">US Stock</option>
                        <option value="mutual_fund">Mutual Fund</option>
                        <option value="crypto">Crypto</option>
                        <option value="gold">Gold</option>
                        <option value="fixed_income">Fixed Income</option>
                        <option value="real_estate">Real Estate</option>
                        <option value="cash">Cash/Savings</option>
                      </select>
                      <input
                        type="number"
                        step="any"
                        placeholder="Valuation/Price"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(e.target.value)}
                        className="glass-input px-2 py-1.5 rounded-lg text-white"
                        required
                      />
                      <select
                        value={customCurrency}
                        onChange={(e) => setCustomCurrency(e.target.value as 'INR' | 'USD')}
                        className="glass-input px-2 py-1.5 rounded-lg text-white bg-slate-900 border border-white/10"
                      >
                        <option value="INR">INR (₹)</option>
                        <option value="USD">USD ($)</option>
                      </select>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="glass-btn-primary px-4 py-1.5 rounded-lg font-bold text-[9px]"
                      >
                        Register Price Entry
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                      Google Sheet Price Feed URL (CSV)
                    </label>
                    <input
                      type="url"
                      placeholder="https://docs.google.com/spreadsheets/d/e/2PACX-1v.../pub?output=csv"
                      value={googleSheetUrl}
                      onChange={(e) => setGoogleSheetUrl(e.target.value)}
                      className="w-full glass-input px-3 py-2 text-white bg-slate-900 rounded-xl"
                    />
                    <p className="text-[10px] text-gray-500">
                      Provide a published Google Sheets CSV URL to feed real-time prices for Indian stocks, mutual funds, or custom assets.
                    </p>
                  </div>

                  {/* Status info */}
                  <div className="bg-white/5 border border-white/5 p-3 rounded-xl space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Sync Status:</span>
                      <span className={`font-semibold ${googleSheetUrl ? 'text-indigo-400' : 'text-gray-400'}`}>
                        {googleSheetUrl ? 'Configured' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Last Synced:</span>
                      <span className="font-semibold text-gray-300">{lastSyncTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Assets Loaded:</span>
                      <span className="font-semibold text-gray-300">{sheetSyncCount} items</span>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="space-y-2 text-gray-400 leading-relaxed border-t border-white/5 pt-4">
                    <h4 className="font-bold text-white uppercase text-[9px] tracking-wider">How to Link a Google Sheet:</h4>
                    <ol className="list-decimal pl-4 space-y-1 text-[11px]">
                      <li>Create a Google Sheet.</li>
                      <li>
                        Put <strong>Ticker</strong> in Column A (e.g. <code className="text-indigo-300 px-1 py-0.5 bg-black/40 rounded">NSE:RELIANCE</code>, <code className="text-indigo-300 px-1 py-0.5 bg-black/40 rounded">119063</code>, or <code className="text-indigo-300 px-1 py-0.5 bg-black/40 rounded">AAPL</code>) and the <strong>Price/NAV</strong> in Column B (e.g. using <code className="text-indigo-300 px-1 py-0.5 bg-black/40 rounded">=GOOGLEFINANCE(A1)</code> or mutual fund NAV lookup formulas).
                      </li>
                      <li>In Google Sheets, go to <strong>File</strong> &gt; <strong>Share</strong> &gt; <strong>Publish to web</strong>.</li>
                      <li>Select <strong>Entire Document</strong> (or sheet name) and format as <strong>Comma-separated values (.csv)</strong>.</li>
                      <li>Click <strong>Publish</strong>, copy the generated link, and paste it above.</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-white/5 shrink-0">
              <button
                onClick={() => {
                  setSettingsOpen(false);
                  refreshPrices();
                }}
                className="glass-btn-primary px-5 py-2 rounded-xl font-bold"
              >
                Save &amp; Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Drawer Slide-out Nav Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 lg:hidden">
          <div className="w-72 max-w-full h-full bg-[#07070f] border-r border-white/10 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-white/5">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center">
                    <Layers className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-extrabold text-white text-lg">WealthOS</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="py-6 space-y-2">
                {navLinks.map((link) => {
                  const isActive = pathname === link.href;
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.name}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all ${
                        isActive
                          ? 'bg-indigo-600/20 text-indigo-400 border-l-2 border-indigo-500'
                          : 'text-gray-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-3" />
                      {link.name}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="text-xs text-gray-500 border-t border-white/5 pt-4">
              <div className="flex justify-between mb-2">
                <span>Exchange rate USD/INR:</span>
                <span className="font-bold text-gray-300">₹{usdInrRate.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-gray-600 text-center mt-4">WealthOS Portfolio Tracker © 2026</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <PortfolioProvider>
          <LayoutShell>{children}</LayoutShell>
        </PortfolioProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
