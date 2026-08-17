import { Suspense } from "react";
import { baseUrl } from "../lib/baseUrl";
import PatternValidationPanel from "../components/PatternValidationPanel";
import AcfPanel from "../components/AcfPanel";
import WalkForwardPanel from "../components/WalkForwardPanel";
import RegimeEfficacyPanel, { EfficacyRow } from "../components/RegimeEfficacyPanel";
import TierGate from "../components/TierGate";
import WorkspaceHeader from "../components/WorkspaceHeader";
import FactorIcPanel from "../components/FactorIcPanel";
import RollingCorrelationChart from "../components/RollingCorrelationChart";
import VolumeMomentumPanel from "../components/VolumeMomentumPanel";
import WorkspaceTOC, { TocSection } from "../components/WorkspaceTOC";

const VALIDATION_SECTIONS: TocSection[] = [
  { id: "pattern-validation", label: "Pattern Validation",  labelZh: "模式驗證",       tier: "pro"      },
  { id: "regime-efficacy",    label: "Regime Efficacy",     labelZh: "Regime 信號勝率", tier: "pro"      },
  { id: "correlation",        label: "Rolling Correlation", labelZh: "滾動相關係數",    tier: "pro"      },
  { id: "volume-momentum",    label: "Vol & Momentum",      labelZh: "成交量×動量",     tier: "pro"      },
  { id: "walk-forward",       label: "Walk-Forward",        labelZh: "滾動驗證",        tier: "research" },
  { id: "acf",                label: "ACF / PACF",          labelZh: "自相關檢定",      tier: "research" },
  { id: "factor-ic",          label: "Factor IC",           labelZh: "因子 IC 分析",    tier: "research" },
];

type AcfRow = {
  symbol: string;
  type: string;
  lag: number | null;
  value: number | null;
  ci_upper: number | null;
  ci_lower: number | null;
};

type LjungBoxRow = {
  symbol: string;
  lag: number | null;
  lb_stat: number | null;
  lb_pvalue: number | null;
};

type WalkForwardRow = {
  symbol: string;
  threshold: number | null;
  holding_days: number | null;
  fold: number | null;
  train_start: string;
  train_end: string;
  test_start: string;
  test_end: string;
  train_n: number | null;
  test_n: number | null;
  train_win_rate: number | null;
  test_win_rate: number | null;
  train_mean_return: number | null;
  test_mean_return: number | null;
  train_sharpe: number | null;
  test_sharpe: number | null;
  pass_flag: string;
};

type ValidationRow = {
  symbol: string;
  threshold: number | null;
  holding_days: number | null;
  discovery_start: string;
  discovery_end: string;
  validation_start: string;
  validation_end: string;
  discovery_sample_size: number | null;
  discovery_mean_return: number | null;
  discovery_median_return: number | null;
  discovery_win_rate: number | null;
  discovery_sharpe_ratio: number | null;
  discovery_sortino_ratio: number | null;
  discovery_max_drawdown: number | null;
  validation_sample_size: number | null;
  validation_mean_return: number | null;
  validation_median_return: number | null;
  validation_win_rate: number | null;
  validation_sharpe_ratio: number | null;
  validation_sortino_ratio: number | null;
  validation_max_drawdown: number | null;
  consistency_flag: string;
  confidence_label: string;
  confidence_score: number | null;
  confidence_reasons: string;
  summary_note: string;
};

export default async function ValidationPage() {
  const BASE = baseUrl();
  const [pvRes, acfRes, lbRes, wfRes, reRes, rcRes] = await Promise.all([
    fetch(`${BASE}/api/pattern-validation`,       { cache: "no-store" }),
    fetch(`${BASE}/api/acf`,                      { cache: "no-store" }),
    fetch(`${BASE}/api/ljung-box`,                { cache: "no-store" }),
    fetch(`${BASE}/api/walk-forward`,             { cache: "no-store" }),
    fetch(`${BASE}/api/regime-signal-efficacy`,   { cache: "no-store" }),
    fetch(`${BASE}/api/rolling-correlation`,      { cache: "no-store" }),
  ]);
  const data: ValidationRow[]       = await pvRes.json();
  const acfData: AcfRow[]           = await acfRes.json();
  const lbData: LjungBoxRow[]       = await lbRes.json();
  const wfData: WalkForwardRow[]    = await wfRes.json();
  const reJson                      = await reRes.json();
  const reData: EfficacyRow[]       = reJson.rows ?? [];
  const rcData: { date: string; eth_btc_corr: number | null; sol_btc_corr: number | null; eth_btc_ratio: number | null }[] = await rcRes.json();

  return (
    <main className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      <Suspense>
        <WorkspaceHeader activeView="validation" maxWidthClass="max-w-6xl" />
      </Suspense>

      <div className="px-4 md:px-8 py-10 md:py-14">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
          <span className="inline-block text-xs font-semibold tracking-widest text-cyan-400 uppercase mb-3">
            Anti-Overfitting Validation
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold leading-tight mb-3">
            Pattern Validation Workspace
          </h1>
          <p className="text-gray-400 max-w-3xl text-sm md:text-base leading-relaxed">
            This page separates discovery from validation so research findings are not judged only by in-sample history.
            Use it to inspect whether a pattern stayed alive after 2023, instead of trusting a single backtest summary.
          </p>
          </div>

          {/* Mobile TOC pill bar */}
          <WorkspaceTOC sections={VALIDATION_SECTIONS} mobileOnly accentColor="text-cyan-500" />

          {/* Desktop: TOC sidebar + panels */}
          <div className="xl:flex xl:gap-8 xl:items-start">
            <WorkspaceTOC sections={VALIDATION_SECTIONS} desktopOnly accentColor="text-cyan-500" />

            <div className="flex-1 min-w-0 space-y-10">

              <div id="pattern-validation">
                <TierGate requiredTier="pro" title="Pattern Validation" description="Discovery vs. validation split at 2022-12-31. Checks whether patterns survived out-of-sample after 2023 — confidence score, consistency flag, and reasons. 模式發現期 vs 驗證期分析，防止 overfitting。">
                  <PatternValidationPanel data={data} />
                </TierGate>
              </div>

              <div id="regime-efficacy">
                <TierGate requiredTier="pro" title="Regime Signal Efficacy" description="Win rates of Vol Spike and Drop3 signals across Bull/Bear/Sideways regimes. Chi-square significance test. Signal effectiveness is regime-dependent. 信號在不同市場狀態下的勝率對比，Chi-square 顯著性檢定。">
                  <RegimeEfficacyPanel data={reData} />
                </TierGate>
              </div>

              <div id="correlation">
                <TierGate requiredTier="pro" title="Rolling Correlation" description="60-day rolling correlation between ETH/BTC and SOL/BTC. Validates diversification assumptions and detects regime-dependent co-movement. 60日滾動相關係數，驗證分散化效果。">
                  <RollingCorrelationChart data={rcData} />
                </TierGate>
              </div>

              <div id="volume-momentum">
                <TierGate requiredTier="pro" title="Volume & Momentum (F7+F8)" description="F7 volume surge × F8 price momentum score history. Validates whether high Multi-Factor scores coincide with real volume confirmation. 成交量 × 動量，驗證高分設置是否有量佐證。">
                  <VolumeMomentumPanel />
                </TierGate>
              </div>

              <div id="walk-forward">
                <TierGate requiredTier="research" title="Walk-Forward Validation" description="Rolling train/test folds across market cycles. Tests whether each threshold's edge is consistent or only appeared in a specific era. 滾動驗證折疊，跨市場週期穩定性分析。">
                  <WalkForwardPanel data={wfData} />
                </TierGate>
              </div>

              <div id="acf">
                <TierGate requiredTier="research" title="ACF / PACF Autocorrelation" description="Autocorrelation and partial autocorrelation up to 30 lags, with Ljung-Box test. Tests whether BTC/ETH/SOL returns contain exploitable serial dependence. 自相關與 Ljung-Box 檢定，驗證 random walk 假設。">
                  <AcfPanel acfData={acfData} lbData={lbData} />
                </TierGate>
              </div>

              <div id="factor-ic">
                <TierGate requiredTier="research" title="Factor IC Analysis" description="Spearman IC and IC IR for each of the 15 factors across BTC/ETH/SOL. Validates which factors have stable predictive power. 因子 IC 分析，驗證各因子預測力穩定性。">
                  <FactorIcPanel />
                </TierGate>
              </div>

            </div>{/* end panels */}
          </div>{/* end TOC + panels flex */}
        </div>
      </div>
    </main>
  );
}
