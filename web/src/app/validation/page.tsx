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

          <TierGate requiredTier="pro" title="Pattern Validation" description="Discovery vs. validation split at 2022-12-31. Checks whether patterns survived out-of-sample after 2023 — confidence score, consistency flag, and reasons. 模式發現期 vs 驗證期分析，防止 overfitting。">
            <PatternValidationPanel data={data} />
          </TierGate>

          <div id="walk-forward" className="mt-10">
            <TierGate requiredTier="research" title="Walk-Forward Validation" description="Rolling train/test folds across market cycles. Tests whether each threshold's edge is consistent or only appeared in a specific era. 滾動驗證折疊，跨市場週期穩定性分析。">
              <WalkForwardPanel data={wfData} />
            </TierGate>
          </div>

          <div id="acf" className="mt-10">
            <TierGate requiredTier="research" title="ACF / PACF Autocorrelation" description="Autocorrelation and partial autocorrelation up to 30 lags, with Ljung-Box test. Tests whether BTC/ETH/SOL returns contain exploitable serial dependence. 自相關與 Ljung-Box 檢定，驗證 random walk 假設。">
              <AcfPanel acfData={acfData} lbData={lbData} />
            </TierGate>
          </div>

          <div id="regime-efficacy" className="mt-10">
            <RegimeEfficacyPanel data={reData} />
          </div>

          <div id="factor-ic" className="mt-10">
            <FactorIcPanel />
          </div>

          <div id="correlation" className="mt-10">
            <TierGate requiredTier="pro" title="Rolling Correlation" description="60-day rolling correlation between BTC, ETH, SOL. Validates diversification assumptions and detects regime-dependent co-movement. 60日滾動相關係數，驗證分散化效果。">
              <RollingCorrelationChart data={rcData} />
            </TierGate>
          </div>

          <div id="volume-momentum" className="mt-10">
            <TierGate requiredTier="pro" title="Volume & Momentum (F7+F8)" description="F7 volume surge × F8 price momentum. Validates whether high-score setups coincide with real volume confirmation. 成交量 × 動量信號，驗證買賣訊號是否有量佐證。">
              <VolumeMomentumPanel />
            </TierGate>
          </div>
        </div>
      </div>
    </main>
  );
}
