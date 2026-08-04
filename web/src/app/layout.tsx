import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import DevTierSwitcher from "./components/DevTierSwitcher";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://cryptopatternlab.com";
const TITLE    = "CryptoPatternLab — Bloomberg-depth Crypto Research";
const DESC     = "Institutional-grade pattern research for BTC, ETH & SOL. Win rates, Sharpe ratios, GARCH volatility forecasts, Fear & Greed analysis, Monte Carlo simulation, and AI-powered summaries — all in one research workspace.";

export const metadata: Metadata = {
  title: {
    default:  TITLE,
    template: "%s · CryptoPatternLab",
  },
  description: DESC,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type:        "website",
    url:         SITE_URL,
    title:       TITLE,
    description: DESC,
    siteName:    "CryptoPatternLab",
  },
  twitter: {
    card:        "summary_large_image",
    title:       TITLE,
    description: DESC,
  },
  keywords: [
    "crypto research", "bitcoin analysis", "BTC pattern analysis",
    "crypto win rate", "GARCH volatility", "Fear Greed Index",
    "RSI oversold", "Bollinger Band", "Monte Carlo crypto",
    "crypto institutional research", "ETH SOL analysis",
  ],
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <DevTierSwitcher />
      </body>
    </html>
  );
}
