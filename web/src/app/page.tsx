

// 這個檔案負責：Landing Page（Hero + Features + Pricing）+ 研究工具主體

import { Suspense } from "react";
import { baseUrl } from "./lib/baseUrl";
import ResearchTOC from "./components/ResearchTOC";
import SummaryButton from "./components/SummaryButton";
import ResultsTable from "./components/ResultsTable";
import FearGreedPanel from "./components/FearGreedPanel";
import RollingCorrelationChart from "./components/RollingCorrelationChart";
import GarchPanel from "./components/GarchPanel";
import BollingerPanel from "./components/BollingerPanel";
import MonteCarloPanel from "./components/MonteCarloPanel";
import RsiPanel from "./components/RsiPanel";
import MonthSeasonalityPanel, { MonthSeasonalityRow } from "./components/MonthSeasonalityPanel";
import ConsecutiveDropPanel, { ConsecutiveDropRow } from "./components/ConsecutiveDropPanel";
import DrawdownRecoveryPanel, { DrawdownRecoveryRow } from "./components/DrawdownRecoveryPanel";
import HalvingPanel, { HalvingData } from "./components/HalvingPanel";
import TierGate from "./components/TierGate";
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

type GarchRow = {
  symbol: string;
  last_price: number;
  annualized_vol: number;
  forecast_vol_1d: number;
  forecast_vol_7d: number;
  mu: number;
  alpha: number;
  beta: number;
  nu: number;
  persistence: number;
  forecast_vol_h1: number;
  forecast_vol_h2: number;
  forecast_vol_h3: number;
  forecast_vol_h4: number;
  forecast_vol_h5: number;
  forecast_vol_h6: number;
  forecast_vol_h7: number;
};

export default async function Home() {
  const BASE = baseUrl();
  const [res, fgRes, rcRes, garchRes, bollingerRes, rsiRes, msRes, cdRes, drRes, halvRes] = await Promise.all([
    fetch(`${BASE}/api/results`,             { cache: "no-store" }),
    fetch(`${BASE}/api/fear-greed`,          { cache: "no-store" }),
    fetch(`${BASE}/api/rolling-correlation`, { cache: "no-store" }),
    fetch(`${BASE}/api/garch`,               { cache: "no-store" }),
    fetch(`${BASE}/api/bollinger`,           { cache: "no-store" }),
    fetch(`${BASE}/api/rsi`,                 { cache: "no-store" }),
    fetch(`${BASE}/api/month-seasonality`,   { cache: "no-store" }),
    fetch(`${BASE}/api/consecutive-drop`,    { cache: "no-store" }),
    fetch(`${BASE}/api/drawdown-recovery`,   { cache: "no-store" }),
    fetch(`${BASE}/api/halving`,             { cache: "no-store" }),
  ]);
  const data: PatternResult[]              = await res.json();
  const fgData: FearGreedRow[]             = await fgRes.json();
  const rcData: { date: string; eth_btc_corr: number | null; sol_btc_corr: number | null; eth_btc_ratio: number | null }[] = await rcRes.json();
  const garchData: GarchRow[]              = await garchRes.json();
  const bollingerData: BollingerRow[]      = await bollingerRes.json();
  const rsiData: RsiRow[]                  = await rsiRes.json();
  const msData: MonthSeasonalityRow[]      = await msRes.json();
  const cdData: ConsecutiveDropRow[]       = await cdRes.json();
  const drData: DrawdownRecoveryRow[]      = await drRes.json();
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
              Try Free Research ↓
            </a>
            <a
              href="#pricing"
              className="border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              View Pricing
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
            <a
              href="/report"
              className="md:ml-auto flex items-center gap-1.5 text-xs border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 px-3 py-1 rounded-full transition-colors font-medium whitespace-nowrap"
            >
              <span>📄</span>
              <span>Export PDF Report</span>
              <span className="text-cyan-600 text-[10px]">Pro</span>
            </a>
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
            <TierGate requiredTier="pro" title="RSI Oversold Analysis" description="Wilder's RSI-14 oversold signals — win rates, mean returns, and Sharpe ratios across 1/3/7-day holding periods for BTC, ETH, SOL. RSI 超賣後的歷史條件統計。">
              <RsiPanel data={rsiData} />
            </TierGate>
          </div>

          <div id="bollinger" className="mt-8">
            <TierGate requiredTier="pro" title="Bollinger Band Breakdown" description="Historical stats when price closes below the Bollinger lower band — a classic oversold signal with quantified edge. 布林帶下軌突破後的條件回報統計。">
              <BollingerPanel data={bollingerData} />
            </TierGate>
          </div>

          <div id="seasonality" className="mt-8">
            <TierGate requiredTier="pro" title="Month Seasonality" description="Historical monthly return distributions for BTC, ETH, SOL — mean, median, win rate, and volatility by calendar month. 月份季節性歷史回報分布。">
              <MonthSeasonalityPanel data={msData} />
            </TierGate>
          </div>

          <div id="consecutive-drop" className="mt-8">
            <TierGate requiredTier="pro" title="Consecutive Drop Analysis" description="After N consecutive down days, what has history shown? Win rates and mean returns for 2–5 day losing streaks. 連跌 N 天後的歷史反彈概率。">
              <ConsecutiveDropPanel data={cdData} />
            </TierGate>
          </div>

          <div id="correlation" className="mt-8">
            <TierGate requiredTier="pro" title="Rolling Correlation" description="60-day rolling correlation between ETH/BTC and SOL/BTC, plus ETH/BTC relative strength ratio and alt-season detection. 滾動相關係數與山寨季偵測。">
              <RollingCorrelationChart data={rcData} />
            </TierGate>
          </div>

          <div id="garch" className="mt-8">
            <TierGate requiredTier="research" title="GARCH Volatility Forecast" description="GARCH(1,1) with Student-t errors — 7-day vol forecast, persistence, tail risk classification, and regime interpretation. 學術級波動率預測模型。">
              <GarchPanel data={garchData} />
            </TierGate>
          </div>

          <div id="drawdown-recovery" className="mt-8">
            <TierGate requiredTier="research" title="Drawdown Recovery Analysis" description="After a -5% to -20% drawdown from the 60-day high, how long did it historically take to recover? Recovery rates and median days. 回撤後歷史恢復時間分析。">
              <DrawdownRecoveryPanel data={drData} />
            </TierGate>
          </div>

          <div id="halving" className="mt-8">
            <TierGate requiredTier="research" title="Bitcoin Halving Cycle" description="Price performance around each of the 3 BTC halvings in our dataset — event comparison table and relative price path chart. BTC 減半週期前後價格行為。">
              <HalvingPanel data={halvingData} />
            </TierGate>
          </div>

          <div id="monte-carlo" className="mt-8">
            <TierGate requiredTier="research" title="Monte Carlo Price Simulation" description="10,000 price path simulations using bootstrapped returns — P10/P50/P90 probability bands for 1–30 day horizons. 蒙特卡洛價格模擬，概率扇形圖。">
              <MonteCarloPanel />
            </TierGate>
          </div>
            </div>{/* end panels flex-1 */}
          </div>{/* end TOC + panels flex */}
        </div>
      </section>

      {/* ── PRICING SECTION ── */}
      <section id="pricing" className="px-4 md:px-8 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-2">Pricing</h2>
          <p className="text-gray-400 text-center text-sm mb-10">
            Start free. Upgrade when you need more depth.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Free */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h3 className="font-bold text-lg mb-1">Free</h3>
              <p className="text-3xl font-extrabold mb-1">$0</p>
              <p className="text-gray-500 text-sm mb-6">Forever</p>
              <ul className="text-sm text-gray-300 space-y-2 mb-8">
                <li>✅ BTC · ETH · SOL pattern table</li>
                <li>✅ Win rate + Mean return</li>
                <li>✅ Full AI Summary</li>
                <li>✅ Win Rate chart</li>
                <li>✅ Fear &amp; Greed analysis</li>
              </ul>
              <button className="w-full border border-gray-600 text-gray-300 py-2 rounded-lg text-sm font-semibold">
                Current Plan
              </button>
            </div>

            {/* Pro */}
            <div className="bg-gray-900 rounded-xl p-6 border border-green-500/50 relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs bg-green-500 text-black font-bold px-3 py-0.5 rounded-full">
                MOST POPULAR
              </span>
              <h3 className="font-bold text-lg mb-1">Pro</h3>
              <p className="text-3xl font-extrabold mb-1">$29<span className="text-lg font-normal text-gray-400">/mo</span></p>
              <p className="text-gray-500 text-sm mb-6">Billed monthly</p>
              <ul className="text-sm text-gray-300 space-y-2 mb-8">
                <li>✅ Everything in Free</li>
                <li>✅ RSI oversold analysis</li>
                <li>✅ Bollinger Band breakdown</li>
                <li>✅ Month Seasonality</li>
                <li>✅ Consecutive Drop analysis</li>
                <li>✅ Rolling Correlation (ETH/BTC · SOL/BTC)</li>
                <li>✅ Signal Intelligence workspace</li>
                <li>✅ Multi-Factor Setup Score</li>
                <li>✅ Pattern Validation workspace</li>
                <li>✅ PDF Report export</li>
              </ul>
              <button className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-2 rounded-lg text-sm transition-colors">
                Coming Soon
              </button>
            </div>

            {/* Research */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h3 className="font-bold text-lg mb-1">Research</h3>
              <p className="text-3xl font-extrabold mb-1">$79<span className="text-lg font-normal text-gray-400">/mo</span></p>
              <p className="text-gray-500 text-sm mb-6">Billed monthly</p>
              <ul className="text-sm text-gray-300 space-y-2 mb-8">
                <li>✅ Everything in Pro</li>
                <li>✅ GARCH volatility forecast</li>
                <li>✅ Drawdown Recovery analysis</li>
                <li>✅ Halving Cycle analysis</li>
                <li>✅ Monte Carlo simulation</li>
                <li>✅ Walk-Forward validation</li>
                <li>✅ ACF/PACF autocorrelation</li>
                <li>✅ Regime Transition (Markov)</li>
              </ul>
              <button className="w-full border border-gray-600 text-gray-300 py-2 rounded-lg text-sm font-semibold">
                Coming Soon
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="px-8 py-8 border-t border-gray-800 text-center text-gray-500 text-sm">
        <p>© 2025 CryptoPatternLab · Built for all crypto users</p>
      </footer>

    </main>
  );
}
