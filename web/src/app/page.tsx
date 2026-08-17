
// FYP 副本 — 無 Tier、無 Pricing、全功能開放

import { Suspense } from "react";
import { baseUrl } from "./lib/baseUrl";
import ResearchTOC from "./components/ResearchTOC";
import SummaryButton from "./components/SummaryButton";
import ResultsTable from "./components/ResultsTable";
import FearGreedPanel from "./components/FearGreedPanel";
import BollingerPanel from "./components/BollingerPanel";
import RsiPanel from "./components/RsiPanel";
import MonthSeasonalityPanel, { MonthSeasonalityRow } from "./components/MonthSeasonalityPanel";
import ConsecutiveDropPanel, { ConsecutiveDropRow } from "./components/ConsecutiveDropPanel";
import HalvingPanel, { HalvingData } from "./components/HalvingPanel";
import WorkspaceHeader from "./components/WorkspaceHeader";

type FearGreedRow = {
  symbol: string;
  threshold: number | null;
  holding_days: number | null;
  sample_size: number | null;
  corr_fg_same_day: number | null; p_fg_same_day: number | null;
  corr_fg_pre7: number | null;     p_fg_pre7: number | null;
  ef_n: number | null; ef_mean: number | null; ef_win_rate: number | null;
  fe_n: number | null; fe_mean: number | null; fe_win_rate: number | null;
  ne_n: number | null; ne_mean: number | null; ne_win_rate: number | null;
  gr_n: number | null; gr_mean: number | null; gr_win_rate: number | null;
  eg_n: number | null; eg_mean: number | null; eg_win_rate: number | null;
};

type PatternResult = {
  symbol: string;
  threshold: number;
  holding_days: number;
  sample_size: number;
  mean_return: number;
  median_return: number;
  win_rate: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  skewness: number;
  kurtosis: number;
  max_drawdown: number;
  avg_drawdown: number;
};

type RsiRow = {
  symbol: string;
  rsi_window: number | null;
  rsi_threshold: number | null;
  holding_days: number | null;
  sample_size: number | null;
  mean_return: number | null;
  median_return: number | null;
  win_rate: number | null;
  sharpe_ratio: number | null;
  sortino_ratio: number | null;
  skewness: number | null;
  kurtosis: number | null;
  max_drawdown: number | null;
  avg_drawdown: number | null;
};

type BollingerRow = {
  symbol: string;
  window: number | null;
  k: number | null;
  holding_days: number | null;
  sample_size: number | null;
  mean_return: number | null;
  median_return: number | null;
  win_rate: number | null;
  sharpe_ratio: number | null;
  sortino_ratio: number | null;
  skewness: number | null;
  kurtosis: number | null;
  max_drawdown: number | null;
  avg_drawdown: number | null;
};

export default async function Home() {
  const BASE = baseUrl();
  const [res, fgRes, bollingerRes, rsiRes, msRes, cdRes, halvRes] = await Promise.all([
    fetch(`${BASE}/api/results`,             { cache: "no-store" }),
    fetch(`${BASE}/api/fear-greed`,          { cache: "no-store" }),
    fetch(`${BASE}/api/bollinger`,           { cache: "no-store" }),
    fetch(`${BASE}/api/rsi`,                 { cache: "no-store" }),
    fetch(`${BASE}/api/month-seasonality`,   { cache: "no-store" }),
    fetch(`${BASE}/api/consecutive-drop`,    { cache: "no-store" }),
    fetch(`${BASE}/api/halving`,             { cache: "no-store" }),
  ]);
  const data: PatternResult[]              = await res.json();
  const fgData: FearGreedRow[]             = await fgRes.json();
  const bollingerData: BollingerRow[]      = await bollingerRes.json();
  const rsiData: RsiRow[]                  = await rsiRes.json();
  const msData: MonthSeasonalityRow[]      = await msRes.json();
  const cdData: ConsecutiveDropRow[]       = await cdRes.json();
  const halvingData: HalvingData           = await halvRes.json();

  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* ── TOP NAV ── */}
      <Suspense>
        <WorkspaceHeader activeView="research" maxWidthClass="max-w-6xl" />
      </Suspense>

      {/* ── HERO SECTION ── */}
      <section className="px-4 md:px-8 pt-10 pb-10 md:pt-16 md:pb-16 text-center border-b border-gray-800">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block text-xs font-semibold tracking-widest text-green-400 uppercase mb-4">
            AI-Powered Research
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight mb-4">
            Bloomberg-depth analysis.
          </h1>
          <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
            CryptoPatternLab turns institutional-grade pattern research into clear, actionable insights — built specifically for crypto traders and analysts.
          </p>
          <div className="flex gap-4 justify-center">
            <a
              href="#research"
              className="bg-green-500 hover:bg-green-400 text-black font-bold px-6 py-3 rounded-lg transition-colors"
            >
              Start Research ↓
            </a>
          </div>
        </div>
      </section>

      {/* ── FEATURES SECTION ── */}
      <section className="px-4 md:px-8 py-16 border-b border-gray-800">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">
            What makes CryptoPatternLab different
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-900 rounded-xl p-6">
              <div className="text-3xl mb-3">📊</div>
              <h3 className="font-bold text-lg mb-2">Statistical Depth</h3>
              <p className="text-gray-400 text-sm">
                Win rate, Sharpe ratio, Skewness, Kurtosis — every pattern backed by real statistics, not gut feel.
              </p>
            </div>
            <div className="bg-gray-900 rounded-xl p-6">
              <div className="text-3xl mb-3">🤖</div>
              <h3 className="font-bold text-lg mb-2">AI Summary</h3>
              <p className="text-gray-400 text-sm">
                Powered by Gemini 2.5 Flash. Raw numbers translated into plain-English conclusions you can act on.
              </p>
            </div>
            <div className="bg-gray-900 rounded-xl p-6">
              <div className="text-3xl mb-3">🎯</div>
              <h3 className="font-bold text-lg mb-2">Crypto-Native</h3>
              <p className="text-gray-400 text-sm">
                Built for BTC, ETH, SOL with crypto-specific drop thresholds and holding period logic. Not a generic tool.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── RESEARCH WORKSPACE ── */}
      <section id="research" className="px-4 md:px-8 py-10 md:py-16 border-b border-gray-800">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold">Research Workspace</h2>
            <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
              LIVE DATA
            </span>
          </div>
          <p className="text-gray-400 text-sm mb-6">
            BTC · ETH · SOL · Daily data updated automatically · Pattern analysis, sentiment, volatility &amp; more
          </p>

          {/* ── Mobile TOC pill bar (shown only below xl) ── */}
          <ResearchTOC mobileOnly />

          {/* ── TOC + panels layout ── */}
          <div className="xl:flex xl:gap-8 xl:items-start">
            <ResearchTOC desktopOnly />

            <div className="flex-1 min-w-0">

          <div id="summary">
            <SummaryButton data={data} />
          </div>

          <div id="results" className="mt-8">
            <Suspense>
              <ResultsTable data={data} />
            </Suspense>
          </div>

          <div id="fear-greed" className="mt-8">
            <Suspense>
              <FearGreedPanel data={fgData} />
            </Suspense>
          </div>

          <div id="rsi" className="mt-8">
            <RsiPanel data={rsiData} />
          </div>

          <div id="bollinger" className="mt-8">
            <BollingerPanel data={bollingerData} />
          </div>

          <div id="seasonality" className="mt-8">
            <MonthSeasonalityPanel data={msData} />
          </div>

          <div id="consecutive-drop" className="mt-8">
            <ConsecutiveDropPanel data={cdData} />
          </div>

          <div id="halving" className="mt-8">
            <HalvingPanel data={halvingData} />
          </div>

            </div>{/* end panels flex-1 */}
          </div>{/* end TOC + panels flex */}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="px-8 py-8 border-t border-gray-800 text-center text-gray-500 text-sm">
        <p>© 2025 CryptoPatternLab · FYP Research Demo</p>
      </footer>

    </main>
  );
}
