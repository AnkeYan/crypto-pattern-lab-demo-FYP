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
import WorkspaceTOC, { TocSection } from "../components/WorkspaceTOC";

const FACTORS_SECTIONS: TocSection[] = [
  { id: "funding-rate",    label: "Funding Rate",      labelZh: "資金費率",     tier: "pro"      },
  { id: "btc-dominance",   label: "BTC Dominance",     labelZh: "BTC 佔有率",   tier: "pro"      },
  { id: "active-addresses",label: "Active Addresses",  labelZh: "鏈上活躍地址", tier: "pro"      },
  { id: "drawdown-recovery",label: "Drawdown Recovery",labelZh: "回撤恢復",     tier: "pro"      },
  { id: "mvrv",            label: "MVRV Valuation",    labelZh: "MVRV 估值",    tier: "research" },
  { id: "turbulence",      label: "Turbulence Index",  labelZh: "市場異常指數", tier: "research" },
  { id: "garch",           label: "GARCH Volatility",  labelZh: "波動率預測",   tier: "research" },
];

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

      <main className="max-w-5xl mx-auto px-4 md:px-8 py-8">
        {/* Page intro */}
        <div className="space-y-1 mb-6">
          <h1 className="text-xl font-semibold text-slate-100">Factors Workspace</h1>
          <p className="text-sm text-slate-400">
            Deep-dive into individual alpha factors — the raw signals that power the Multi-Factor Setup Score.
            <span className="ml-2 text-slate-500">· 深入分析每個因子的歷史走勢與當前狀態</span>
          </p>
        </div>

        {/* Mobile TOC */}
        <WorkspaceTOC sections={FACTORS_SECTIONS} mobileOnly accentColor="text-amber-400" />

        {/* Desktop: TOC sidebar + panels */}
        <div className="xl:flex xl:gap-8 xl:items-start">
          <WorkspaceTOC sections={FACTORS_SECTIONS} desktopOnly accentColor="text-amber-400" />

          <div className="flex-1 min-w-0 space-y-10">

        {/* Section: Futures & Sentiment */}
        <section className="space-y-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">
            Futures &amp; Sentiment
          </h2>

          <TierGate requiredTier="pro" title="Funding Rate & Trend (F9+F14)"
            description="F9: current funding rate level (IC IR 1.41). F14: 7-day trend direction (IC IR 1.33). Two of the strongest predictive factors. 資金費率水平 + 7日趨勢，IC 最強因子群之一。">
            <div id="funding-rate">
              <FundingRatePanel />
            </div>
          </TierGate>

          <TierGate requiredTier="pro" title="BTC Dominance (F15)"
            description="BTC market cap share and 7-day change rate. Rising dominance = risk-off rotation. Dashboard only — data accumulating. BTC 佔有率走勢，Dashboard 展示因子。">
            <div id="btc-dominance">
              <BtcDominancePanel />
            </div>
          </TierGate>
        </section>

        {/* Section: Valuation & On-chain */}
        <section className="space-y-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">
            Valuation &amp; On-chain
          </h2>

          <TierGate requiredTier="pro" title="Active Addresses (F11)"
            description="BTC on-chain unique active addresses vs 30-day MA. Measures real blockchain usage growth. BTC 鏈上活躍地址數，衡量真實使用量。">
            <div id="active-addresses">
              <ActiveAddressesPanel />
            </div>
          </TierGate>

          <TierGate requiredTier="pro" title="Drawdown Recovery Analysis"
            description="After N% drawdown from rolling high, historical recovery statistics within 90 days. 從滾動高點回撤 N% 後，90日內回到前高的歷史統計。">
            <div id="drawdown-recovery">
              <DrawdownRecoveryPanel data={drData} />
            </div>
          </TierGate>

          <TierGate requiredTier="research" title="MVRV Valuation (F13)"
            description="Market Value / Realized Value — IC IR = 1.76 (strongest factor). Identifies market overheating and deep value zones. MVRV 是 IC 最強因子，識別過熱和底部區域。">
            <div id="mvrv">
              <MvrvPanel />
            </div>
          </TierGate>
        </section>

        {/* Section: Market Stress & Volatility */}
        <section className="space-y-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">
            Market Stress &amp; Volatility
          </h2>

          <TierGate requiredTier="research" title="Turbulence Index (F12)"
            description="Mahalanobis distance across BTC/ETH/SOL joint returns. Detects systemic stress events (Luna, FTX, etc). Feature importance #2–3 across all symbols. 三幣種馬氏距離，捕捉系統性壓力事件。">
            <div id="turbulence">
              <TurbulencePanel />
            </div>
          </TierGate>

          <TierGate requiredTier="research" title="GARCH Volatility Forecast"
            description="GARCH(1,1) with Student-t distribution. Forecasts 7-day volatility and persistence. BTC/ETH show IGARCH (persistence = 1.0). GARCH 波動率預測，BTC/ETH 為 IGARCH。">
            <div id="garch">
              <GarchPanel data={garchData} />
            </div>
          </TierGate>
        </section>
          </div>{/* end panels */}
        </div>{/* end TOC + panels flex */}
      </main>
    </div>
  );
}
