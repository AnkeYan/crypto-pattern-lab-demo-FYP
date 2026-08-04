import { Suspense } from "react";
import { baseUrl } from "../lib/baseUrl";
import WorkspaceHeader from "../components/WorkspaceHeader";
import SignalIntelligencePanel from "../components/SignalIntelligencePanel";
import RegimeTransitionPanel, { RegimeTransitionRow } from "../components/RegimeTransitionPanel";
import MultiFactorPanel, { MultifactorRow } from "../components/MultiFactorPanel";
import TierGate from "../components/TierGate";

type SignalSummary = {
  symbol: string;
  last_price: number | null;
  current_regime: string;
  rsi14: number | null;
  bb_lower: number | null;
  daily_ret: number | null;
  vol_zscore: number | null;
  sig_rsi: boolean;
  sig_bollinger: boolean;
  sig_drop3: boolean;
  sig_vol_spike: boolean;
  confluence_score: number | null;
};

type ConfluenceRow = {
  symbol: string;
  signals: string;
  n_signals: number | null;
  holding_days: number | null;
  regime: string;
  n: number | null;
  win_rate: number | null;
  mean_return: number | null;
};

type GarchRow = {
  symbol: string;
  annualized_vol: number;
  forecast_vol_h1: number;
  forecast_vol_h7: number;
  persistence: number;
  nu: number;
};

type RollingCorrRow = {
  date: string;
  eth_btc_corr: number | null;
  sol_btc_corr: number | null;
  eth_btc_ratio: number | null;
};

export type XgbFold = {
  symbol:      string;
  test_year:   number | null;
  n_train:     number | null;
  n_test:      number | null;
  auc:         number | null;
  accuracy:    number | null;
  train_start: string | null;
  train_end:   string | null;
};

export type XgbImportance = {
  symbol:       string;
  feature:      string | null;
  feature_name: string | null;
  importance:   number | null;
  rank:         number | null;
};

export type XgbPrediction = {
  symbol:       string;
  date:         string;
  xgb_win_prob: number | null;
  calib_score:  number | null;
};

export type CalibSummaryRow = {
  symbol:     string;
  pct_bucket: string;
  n:          number;
  win_rate:   number;
  mean_7d:    number;
  score_min:  number;
  score_max:  number;
};

export type CalibScatterPoint = {
  score:      number;
  outcome_7d: number;
  win:        number;
};

export default async function SignalsPage() {
  const BASE = baseUrl();
  const [signalsRes, rtRes, mfRes, mfCalibRes, xgbRes, garchRes, rcRes] = await Promise.all([
    fetch(`${BASE}/api/signals`,                  { cache: "no-store" }),
    fetch(`${BASE}/api/regime-transition`,        { cache: "no-store" }),
    fetch(`${BASE}/api/multifactor`,              { cache: "no-store" }),
    fetch(`${BASE}/api/multifactor-calibration`,  { cache: "no-store" }),
    fetch(`${BASE}/api/xgboost`,                  { cache: "no-store" }),
    fetch(`${BASE}/api/garch`,                    { cache: "no-store" }),
    fetch(`${BASE}/api/rolling-correlation`,      { cache: "no-store" }),
  ]);

  const { summary, confluence }: {
    summary: SignalSummary[];
    confluence: ConfluenceRow[];
  } = await signalsRes.json();

  const rtData: RegimeTransitionRow[] = await rtRes.json();
  const mfData: MultifactorRow[]      = await mfRes.json();
  const { summary: calibSummary, scatter: calibScatter }: {
    summary: CalibSummaryRow[];
    scatter: Record<string, CalibScatterPoint[]>;
  } = await mfCalibRes.json();
  const { folds: xgbFolds, importance: xgbImportance, predictions: xgbPredictions }: {
    folds:       XgbFold[];
    importance:  XgbImportance[];
    predictions: XgbPrediction[];
  } = await xgbRes.json();
  const garchData: GarchRow[]         = await garchRes.json();
  const rcData: RollingCorrRow[]      = await rcRes.json();

  // Derive GARCH context per symbol for SignalIntelligencePanel
  const garchContext = Object.fromEntries(
    garchData.map((g) => {
      const slope = (g.forecast_vol_h7 - g.forecast_vol_h1) / (g.forecast_vol_h1 || 1);
      const vol_trend = (slope < -0.02 ? "compressing" : slope > 0.02 ? "expanding" : "stable") as "compressing" | "expanding" | "stable";
      return [
        g.symbol,
        {
          annualized_vol: g.annualized_vol,
          vol_trend,
          vol_slope_pct: slope,
          persistence: g.persistence,
          nu: g.nu,
        },
      ];
    })
  );

  // Derive latest rolling correlation for cross-asset confirmation
  const latestRc = rcData.length > 0 ? rcData[rcData.length - 1] : null;

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <Suspense>
        <WorkspaceHeader activeView="signals" maxWidthClass="max-w-6xl" />
      </Suspense>

      <div className="px-4 md:px-8 py-10 md:py-14">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <span className="inline-block text-xs font-semibold tracking-widest text-purple-400 uppercase mb-3">
              Signal Intelligence
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold leading-tight mb-3">
              Market Context &amp; Signal Confluence
            </h1>
            <p className="text-gray-400 max-w-3xl text-sm md:text-base leading-relaxed">
              Given today&apos;s market conditions, what does history say?
              This workspace combines regime classification, oversold signal detection, transition probabilities,
              and multi-factor synthesis — evidence-based setup analysis, not price prediction.
            </p>
          </div>

          {/* ── 1. Signal Intelligence — Pro ── */}
          <div id="signals-overview">
            <TierGate requiredTier="pro" title="Signal Intelligence" description="Real-time regime classification (Bull/Bear/Sideways), oversold signal detection, Confluence Score, GARCH vol context, and cross-asset confirmation. 市場狀態分類 + 信號匯聚評分 + 條件回報統計。">
              <SignalIntelligencePanel
                summary={summary}
                confluence={confluence}
                garchContext={garchContext}
                latestRc={latestRc}
              />
            </TierGate>
          </div>

          {/* ── 2. Multi-Factor Setup Score — Research ── */}
          <div id="multifactor" className="mt-8">
            <TierGate requiredTier="pro" title="Multi-Factor Setup Score" description="Weighted synthesis of 6 models into a single 0–100 setup quality score: RSI intensity, Bollinger deviation, GARCH vol regime, Fear & Greed zone, seasonality bias, regime favorability. 多因子跨模型加權評分。">
              <MultiFactorPanel
                data={mfData}
                calibSummary={calibSummary}
                calibScatter={calibScatter}
                xgbFolds={xgbFolds}
                xgbImportance={xgbImportance}
                xgbPredictions={xgbPredictions}
              />
            </TierGate>
          </div>

          {/* ── 3. Regime Transition — Research ── */}
          <div id="regime-transition" className="mt-8">
            <TierGate requiredTier="research" title="Regime Transition Probabilities" description="Markov Chain analysis of historical regime switches — transition matrix, average duration per regime, current streak, and next-regime probability. 市場狀態轉換概率矩陣（馬可夫鏈）。">
              <RegimeTransitionPanel data={rtData} />
            </TierGate>
          </div>
        </div>
      </div>
    </main>
  );
}
