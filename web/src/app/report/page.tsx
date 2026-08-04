// /report — CryptoPatternLab Research Report
// Print-optimised page. No new dependencies. Uses existing APIs.
// CSS @media print hides screen-only elements; user clicks Print → Save as PDF.

import { Suspense } from "react";
import { baseUrl } from "../lib/baseUrl";
import ReportClient from "./ReportClient";

type PatternResult = {
  symbol: string; threshold: number; holding_days: number; sample_size: number;
  mean_return: number; win_rate: number; sharpe_ratio: number; sortino_ratio: number;
  skewness: number; kurtosis: number; max_drawdown: number;
};

type RsiRow = {
  symbol: string; rsi_window: number | null; rsi_threshold: number | null;
  holding_days: number | null; sample_size: number | null;
  mean_return: number | null; win_rate: number | null; sharpe_ratio: number | null;
};

type BollingerRow = {
  symbol: string; window: number | null; k: number | null;
  holding_days: number | null; sample_size: number | null;
  mean_return: number | null; win_rate: number | null;
};

type GarchRow = {
  symbol: string; last_price: number; annualized_vol: number;
  persistence: number; nu: number;
  forecast_vol_h1: number; forecast_vol_h7: number;
};

type SignalSummary = {
  symbol: string; last_price: number | null; current_regime: string;
  rsi14: number | null; vol_zscore: number | null; daily_ret: number | null;
  confluence_score: number | null;
};

type MonthSeasonalityRow = {
  symbol: string; month: number | null; sample_size: number | null;
  mean_return: number | null; median_return: number | null;
  win_rate: number | null;
};

type MultifactorRow = {
  symbol: string; factor: string; raw_value: number | null;
  normalized_score: number | null; description: string;
};

type RegimeTransitionRow = {
  symbol: string;
  from_regime: string;
  to_regime: string;
  count: number | null;
  probability: number | null;
  extra: string | null;
};

export default async function ReportPage() {
  const BASE = baseUrl();
  const [patRes, rsiRes, bolRes, garchRes, sigRes, msRes, mfRes, rtRes] = await Promise.all([
    fetch(`${BASE}/api/results`,            { cache: "no-store" }),
    fetch(`${BASE}/api/rsi`,                { cache: "no-store" }),
    fetch(`${BASE}/api/bollinger`,          { cache: "no-store" }),
    fetch(`${BASE}/api/garch`,              { cache: "no-store" }),
    fetch(`${BASE}/api/signals`,            { cache: "no-store" }),
    fetch(`${BASE}/api/month-seasonality`,  { cache: "no-store" }),
    fetch(`${BASE}/api/multifactor`,        { cache: "no-store" }),
    fetch(`${BASE}/api/regime-transition`,  { cache: "no-store" }),
  ]);

  const patterns: PatternResult[]          = await patRes.json();
  const rsiData: RsiRow[]                  = await rsiRes.json();
  const bolData: BollingerRow[]            = await bolRes.json();
  const garchData: GarchRow[]              = await garchRes.json();
  const { summary }: { summary: SignalSummary[] } = await sigRes.json();
  const msData: MonthSeasonalityRow[]      = await msRes.json();
  const mfData: MultifactorRow[]           = await mfRes.json();
  const rtData: RegimeTransitionRow[]      = await rtRes.json();

  return (
    <Suspense>
      <ReportClient
        patterns={patterns}
        rsiData={rsiData}
        bolData={bolData}
        garchData={garchData}
        summary={summary}
        msData={msData}
        mfData={mfData}
        rtData={rtData}
      />
    </Suspense>
  );
}
