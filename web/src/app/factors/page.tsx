import { Suspense } from "react";
import { baseUrl } from "../lib/baseUrl";
import WorkspaceHeader from "../components/WorkspaceHeader";
import GarchPanel from "../components/GarchPanel";
import DrawdownRecoveryPanel, { DrawdownRecoveryRow } from "../components/DrawdownRecoveryPanel";
import FundingRatePanel from "../components/FundingRatePanel";
import MvrvPanel from "../components/MvrvPanel";
import TurbulencePanel from "../components/TurbulencePanel";
import ActiveAddressesPanel from "../components/ActiveAddressesPanel";
import BtcDominancePanel from "../components/BtcDominancePanel";
import TierGate from "../components/TierGate";

export const dynamic = "force-dynamic";

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

export default async function FactorsPage() {
  const BASE = baseUrl();
  const [garchRes, drRes] = await Promise.all([
    fetch(`${BASE}/api/garch`,             { cache: "no-store" }),
    fetch(`${BASE}/api/drawdown-recovery`, { cache: "no-store" }),
  ]);
  const garchData: GarchRow[]          = await garchRes.json();
  const drData: DrawdownRecoveryRow[]  = await drRes.json();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Suspense>
        <WorkspaceHeader activeView="factors" />
      </Suspense>

      <main className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-8">
        {/* Page intro */}
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-slate-100">Factors Workspace</h1>
          <p className="text-sm text-slate-400">
            Deep-dive into individual alpha factors — the raw signals that power the Multi-Factor Setup Score.
            <span className="ml-2 text-slate-500">· 深入分析每個因子的歷史走勢與當前狀態</span>
          </p>
        </div>

        {/* Section: Valuation & On-chain */}
        <section className="space-y-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">
            Valuation &amp; On-chain
          </h2>

          <TierGate requiredTier="pro" title="MVRV Valuation (F13)">
            <div id="mvrv">
              <MvrvPanel />
            </div>
          </TierGate>

          <TierGate requiredTier="pro" title="Active Addresses (F11)">
            <div id="active-addresses">
              <ActiveAddressesPanel />
            </div>
          </TierGate>
        </section>

        {/* Section: Futures & Sentiment */}
        <section className="space-y-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">
            Futures &amp; Sentiment
          </h2>

          <TierGate requiredTier="pro" title="Funding Rate & Trend (F9+F14)">
            <div id="funding-rate">
              <FundingRatePanel />
            </div>
          </TierGate>

          <TierGate requiredTier="pro" title="BTC Dominance (F15)">
            <div id="btc-dominance">
              <BtcDominancePanel />
            </div>
          </TierGate>
        </section>

        {/* Section: Market Stress */}
        <section className="space-y-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">
            Market Stress
          </h2>

          <TierGate requiredTier="pro" title="Turbulence Index (F12)">
            <div id="turbulence">
              <TurbulencePanel />
            </div>
          </TierGate>
        </section>

        {/* Section: Volatility & Recovery */}
        <section className="space-y-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">
            Volatility &amp; Recovery
          </h2>

          <TierGate requiredTier="pro" title="GARCH Volatility Forecast">
            <div id="garch">
              <GarchPanel data={garchData} />
            </div>
          </TierGate>

          <TierGate requiredTier="pro" title="Drawdown Recovery Analysis">
            <div id="drawdown-recovery">
              <DrawdownRecoveryPanel data={drData} />
            </div>
          </TierGate>
        </section>
      </main>
    </div>
  );
}
