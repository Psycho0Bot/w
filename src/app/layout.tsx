import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "WealthOS | Unified Portfolio Manager",
  description: "Automated real-time personal investment tracking across Indian & US Stocks, Mutual Funds, Cryptos, Gold, Real Estate, and Fixed Income.",
  keywords: ["portfolio tracker", "investment dashboard", "wealth manager", "US stocks tracker", "mutual funds tracker", "crypto manager"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable} h-full antialiased scroll-smooth`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-full flex flex-col text-slate-100 antialiased selection:bg-indigo-500/30">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
