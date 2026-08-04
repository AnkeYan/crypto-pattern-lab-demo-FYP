"use client";

// ReportClient — print-optimised research report
// @media print CSS hides the print button and screen chrome.
// Requires Pro tier — shows upgrade gate for Free users.

import { useRef } from "react";
import { useTier, hasAccess } from "../lib/useTier";

/* ── types (mirrors page.tsx) ─────────────────────────────────────────────── */
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
  symbol: string; from_regime: string; to_regime: string;
  count: number | null; probability: number | null; extra: string | null;
};

/* ── constants ────────────────────────────────────────────────────────────── */
const SYMBOLS   = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
const SYM_SHORT: Record<string, string> = { BTCUSDT: "BTC", ETHUSDT: "ETH", SOLUSDT: "SOL" };
const THRESHOLDS = [-0.03, -0.05, -0.07];
const HOLDINGS   = [1, 3, 7];
const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const REGIME_LABEL: Record<string, string> = {
  bull: "Bull ↗", bear: "Bear ↘", sideways: "Sideways →", unknown: "—",
};

/* ── helpers ──────────────────────────────────────────────────────────────── */
function pct(v: number | null, d = 1): string {
  if (v == null || isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}%`;
}
function num(v: number | null, d = 2): string {
  if (v == null || isNaN(v)) return "—";
  return v.toFixed(d);
}
function fmtPrice(v: number | null): string {
  if (v == null) return "—";
  return v >= 1000 ? "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "$" + v.toFixed(2);
}

/* ── sub-components ───────────────────────────────────────────────────────── */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
      color: "#6b7280", borderBottom: "1px solid #e5e7eb", paddingBottom: 4, marginBottom: 8, marginTop: 20 }}>
      {children}
    </h3>
  );
}

function MiniTable({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginBottom: 6 }}>
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i} style={{ textAlign: i === 0 ? "left" : "right", paddingBottom: 3,
              paddingRight: 8, color: "#9ca3af", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} style={{ borderTop: "1px solid #f3f4f6" }}>
            {row.map((cell, ci) => (
              <td key={ci} style={{ textAlign: ci === 0 ? "left" : "right", padding: "3px 8px 3px 0",
                color: "#374151", whiteSpace: "nowrap" }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SymbolSection({
  sym, patterns, rsiData, bolData, garchData, summary, msData, mfData,
}: {
  sym: string;
  patterns: PatternResult[];
  rsiData: RsiRow[];
  bolData: BollingerRow[];
  garchData: GarchRow[];
  summary: SignalSummary[];
  msData: MonthSeasonalityRow[];
  mfData: MultifactorRow[];
}) {
  const short  = SYM_SHORT[sym];
  const sig    = summary.find((s) => s.symbol === sym);
  const garch  = garchData.find((g) => g.symbol === sym);
  const totalMF = mfData.find((r) => r.symbol === sym && r.factor === "__total__");
  const factorRows = mfData.filter((r) => r.symbol === sym && r.factor !== "__total__");

  // ── Pattern stats: show -3% and -5%, 7d holding only ──
  const patRows = THRESHOLDS.slice(0, 2).map((thr) => {
    const r = patterns.find((p) => p.symbol === sym && p.threshold === thr && p.holding_days === 7);
    if (!r) return null;
    return [
      `Drop ≥ ${Math.abs(thr * 100).toFixed(0)}%`,
      String(r.sample_size),
      pct(r.win_rate),
      pct(r.mean_return),
      num(r.sharpe_ratio),
      num(r.sortino_ratio),
      pct(r.max_drawdown),
    ];
  }).filter(Boolean) as string[][];

  // ── Pattern 1d/3d/7d for -3% ──
  const holdRows = HOLDINGS.map((h) => {
    const r = patterns.find((p) => p.symbol === sym && p.threshold === -0.03 && p.holding_days === h);
    if (!r) return null;
    return [
      `Hold ${h}d`,
      pct(r.win_rate),
      pct(r.mean_return),
      num(r.sharpe_ratio),
      pct(r.max_drawdown),
    ];
  }).filter(Boolean) as string[][];

  // ── RSI: window=14, threshold=30, all holdings ──
  const rsiRows = HOLDINGS.map((h) => {
    const r = rsiData.find((row) => row.symbol === sym && row.rsi_window === 14 && row.rsi_threshold === 30 && row.holding_days === h);
    if (!r) return null;
    return [`${h}d`, String(r.sample_size ?? "—"), pct(r.win_rate), pct(r.mean_return), num(r.sharpe_ratio)];
  }).filter(Boolean) as string[][];

  // ── Bollinger: window=20, k=2.0, all holdings ──
  const bolRows = HOLDINGS.map((h) => {
    const r = bolData.find((row) => row.symbol === sym && row.window === 20 && row.k === 2.0 && row.holding_days === h);
    if (!r) return null;
    return [`${h}d`, String(r.sample_size ?? "—"), pct(r.win_rate), pct(r.mean_return)];
  }).filter(Boolean) as string[][];

  // ── Month Seasonality: top 3 by mean_return ──
  const msRows = msData
    .filter((r) => r.symbol === sym && r.month != null)
    .sort((a, b) => (b.mean_return ?? -99) - (a.mean_return ?? -99))
    .slice(0, 3)
    .map((r) => [
      MONTH_LABELS[(r.month ?? 1) - 1],
      String(r.sample_size ?? "—"),
      pct(r.mean_return),
      pct(r.median_return),
      r.win_rate != null ? `${(r.win_rate * 100).toFixed(0)}%` : "—",
    ]);

  // ── GARCH vol trend ──
  const volTrend = garch
    ? (garch.forecast_vol_h7 - garch.forecast_vol_h1) / garch.forecast_vol_h1 > 0.02
      ? "Expanding ↑" : (garch.forecast_vol_h7 - garch.forecast_vol_h1) / garch.forecast_vol_h1 < -0.02
        ? "Compressing ↓" : "Stable →"
    : "—";

  const scoreColor = (totalMF?.raw_value ?? 0) >= 50 ? "#16a34a" : (totalMF?.raw_value ?? 0) >= 30 ? "#d97706" : "#6b7280";

  return (
    <div style={{ breakInside: "avoid", marginBottom: 32, padding: "16px 20px",
      border: "1px solid #e5e7eb", borderRadius: 8, backgroundColor: "#fafafa" }}>

      {/* Symbol header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>{short}</span>
          <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>{fmtPrice(sig?.last_price ?? null)}</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#6b7280" }}>Regime</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
            {REGIME_LABEL[sig?.current_regime ?? "unknown"]}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#6b7280" }}>RSI-14</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{num(sig?.rsi14 ?? null, 1)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#6b7280" }}>Confluence</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{sig?.confluence_score ?? 0}/100</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#6b7280" }}>Setup Score</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: scoreColor }}>
            {totalMF?.raw_value != null ? `${totalMF.raw_value.toFixed(0)}/100` : "—"}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Left column */}
        <div>
          <SectionTitle>Drop &amp; Recover — Hold 7d (Drop ≥ threshold)</SectionTitle>
          <MiniTable
            headers={["Threshold", "n", "Win Rate", "Mean Ret", "Sharpe", "Sortino", "Max DD"]}
            rows={patRows}
          />

          <SectionTitle>Drop ≥ 3% — by Hold Period</SectionTitle>
          <MiniTable
            headers={["Hold", "Win Rate", "Mean Ret", "Sharpe", "Max DD"]}
            rows={holdRows}
          />

          <SectionTitle>RSI-14 &lt; 30 Oversold</SectionTitle>
          {rsiRows.length > 0
            ? <MiniTable headers={["Hold", "n", "Win Rate", "Mean Ret", "Sharpe"]} rows={rsiRows} />
            : <p style={{ fontSize: 10, color: "#9ca3af" }}>No data</p>}
        </div>

        {/* Right column */}
        <div>
          <SectionTitle>Bollinger Band Breakdown (BB-20, k=2.0)</SectionTitle>
          {bolRows.length > 0
            ? <MiniTable headers={["Hold", "n", "Win Rate", "Mean Ret"]} rows={bolRows} />
            : <p style={{ fontSize: 10, color: "#9ca3af" }}>No data</p>}

          <SectionTitle>GARCH Volatility Snapshot</SectionTitle>
          {garch ? (
            <MiniTable
              headers={["Metric", "Value"]}
              rows={[
                ["Annualized Vol",  `${(garch.annualized_vol * 100).toFixed(1)}%`],
                ["1d Forecast Vol", `${(garch.forecast_vol_h1 * 100).toFixed(2)}%`],
                ["7d Forecast Vol", `${(garch.forecast_vol_h7 * 100).toFixed(2)}%`],
                ["Vol Trend",       volTrend],
                ["Persistence",     garch.persistence >= 0.9999 ? "1.000 (IGARCH)" : garch.persistence.toFixed(3)],
                ["Tail Risk ν",     `${garch.nu.toFixed(1)} (${garch.nu < 5 ? "High" : garch.nu < 8 ? "Moderate" : "Low"})`],
              ]}
            />
          ) : <p style={{ fontSize: 10, color: "#9ca3af" }}>No data</p>}

          <SectionTitle>Top 3 Months by Mean Return (Seasonality)</SectionTitle>
          {msRows.length > 0
            ? <MiniTable headers={["Month", "n", "Mean", "Median", "Win Rate"]} rows={msRows} />
            : <p style={{ fontSize: 10, color: "#9ca3af" }}>No data</p>}

          <SectionTitle>Multi-Factor Setup Score Breakdown</SectionTitle>
          {factorRows.length > 0 ? (
            <MiniTable
              headers={["Factor", "Score", "Detail"]}
              rows={factorRows.map((r) => [
                r.factor.replace(/_/g, " "),
                r.normalized_score != null ? `${(r.normalized_score * 100).toFixed(0)}/100` : "—",
                (r.description ?? "").slice(0, 42),
              ])}
            />
          ) : <p style={{ fontSize: 10, color: "#9ca3af" }}>No data</p>}
        </div>
      </div>
    </div>
  );
}

/* ── main component ───────────────────────────────────────────────────────── */
export default function ReportClient({
  patterns, rsiData, bolData, garchData, summary, msData, mfData, rtData,
}: {
  patterns: PatternResult[];
  rsiData: RsiRow[];
  bolData: BollingerRow[];
  garchData: GarchRow[];
  summary: SignalSummary[];
  msData: MonthSeasonalityRow[];
  mfData: MultifactorRow[];
  rtData: RegimeTransitionRow[];
}) {
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const printRef = useRef<HTMLDivElement>(null);
  const tier    = useTier();
  const allowed = hasAccess(tier, "pro");

  // ── Pro gate ───────────────────────────────────────────────────────────────
  if (!allowed) {
    return (
      <div style={{ minHeight: "100vh", background: "#030712", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <span style={{ display: "inline-block", padding: "3px 12px", borderRadius: 99,
            background: "rgba(6,182,212,0.15)", color: "#22d3ee", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.06em", textTransform: "uppercase", border: "1px solid rgba(6,182,212,0.3)",
            marginBottom: 20 }}>
            Pro Feature
          </span>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#f9fafb", marginBottom: 12, letterSpacing: "-0.02em" }}>
            Research Report (PDF)
          </h1>
          <p style={{ color: "#9ca3af", fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}>
            Export a full research report covering Pattern Analysis, RSI, Bollinger, GARCH, Month Seasonality, Signal Intelligence, and Multi-Factor Setup Score for BTC, ETH &amp; SOL.
          </p>
          <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 28 }}>
            研究報告包含所有指標的完整數據快照，可一鍵 Save as PDF。
          </p>
          
          <div style={{ marginTop: 16 }}>
            <a href="/" style={{ color: "#4b5563", fontSize: 12, textDecoration: "none" }}>
              ← Back to Research
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Print CSS injected inline ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { margin: 16mm 14mm; size: A4; }
        }
        @media screen {
          body { background: #f3f4f6; }
          .report-wrap { max-width: 860px; margin: 0 auto; padding: 32px 16px; }
        }
      `}</style>

      {/* ── Screen-only top bar ── */}
      <div className="no-print" style={{ background: "#111827", padding: "12px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#d1fae5", fontWeight: 700, fontSize: 14 }}>
          CryptoPatternLab · Research Report
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/" style={{ color: "#9ca3af", fontSize: 12, textDecoration: "none",
            padding: "6px 14px", border: "1px solid #374151", borderRadius: 6 }}>
            ← Research
          </a>
          <button
            onClick={() => window.print()}
            style={{ background: "#22c55e", color: "#000", fontWeight: 700, fontSize: 12,
              padding: "6px 18px", borderRadius: 6, border: "none", cursor: "pointer" }}
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="report-wrap" ref={printRef}>
        {/* ── Report Header ── */}
        <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "2px solid #111827" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#111827", letterSpacing: "-0.02em" }}>
                CryptoPatternLab
              </div>
              <div style={{ fontSize: 14, color: "#6b7280", marginTop: 2 }}>
                Research Report — BTC · ETH · SOL
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Generated</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{today}</div>
            </div>
          </div>

          {/* Snapshot row */}
          <div style={{ marginTop: 14, display: "flex", gap: 20, flexWrap: "wrap" }}>
            {summary.map((s) => {
              const totalMF = mfData.find((r) => r.symbol === s.symbol && r.factor === "__total__");
              const scoreVal = totalMF?.raw_value ?? 0;
              const scoreColor = scoreVal >= 50 ? "#16a34a" : scoreVal >= 30 ? "#d97706" : "#6b7280";
              return (
                <div key={s.symbol} style={{ flex: "1 1 180px", padding: "10px 14px",
                  border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: "#111827" }}>
                      {SYM_SHORT[s.symbol]}
                    </span>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{fmtPrice(s.last_price)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 10, color: "#6b7280" }}>
                    <span>Regime: <strong style={{ color: "#374151" }}>{REGIME_LABEL[s.current_regime]}</strong></span>
                    <span>RSI: <strong style={{ color: "#374151" }}>{num(s.rsi14, 1)}</strong></span>
                    <span>Score: <strong style={{ color: scoreColor }}>{scoreVal.toFixed(0)}/100</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Per-symbol sections ── */}
        {SYMBOLS.map((sym) => (
          <SymbolSection
            key={sym}
            sym={sym}
            patterns={patterns}
            rsiData={rsiData}
            bolData={bolData}
            garchData={garchData}
            summary={summary}
            msData={msData}
            mfData={mfData}
          />
        ))}

        {/* ── Signals Intelligence Snapshot ── */}
        <div style={{ breakInside: "avoid", marginBottom: 32, padding: "16px 20px",
          border: "1px solid #e5e7eb", borderRadius: 8, backgroundColor: "#fafafa" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 12,
            borderBottom: "1px solid #e5e7eb", paddingBottom: 8 }}>
            Signal Intelligence Snapshot
            <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 400, marginLeft: 8 }}>
              Regime · Confluence Score · Regime Transition
            </span>
          </div>

          {/* Regime + Confluence table */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", textTransform: "uppercase",
                letterSpacing: "0.06em", marginBottom: 6 }}>Current Market State</p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                <thead>
                  <tr>
                    {["Symbol","Regime","RSI-14","Vol Z","Confluence","Setup"].map((h) => (
                      <th key={h} style={{ textAlign: h === "Symbol" ? "left" : "right", paddingBottom: 3,
                        paddingRight: 6, color: "#9ca3af", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.map((s) => {
                    const totalMF = mfData.find((r) => r.symbol === s.symbol && r.factor === "__total__");
                    const score   = totalMF?.raw_value ?? 0;
                    return (
                      <tr key={s.symbol} style={{ borderTop: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "3px 6px 3px 0", fontWeight: 700, color: "#111827" }}>
                          {SYM_SHORT[s.symbol]}
                        </td>
                        <td style={{ textAlign: "right", padding: "3px 6px 3px 0", color: "#374151" }}>
                          {s.current_regime}
                        </td>
                        <td style={{ textAlign: "right", padding: "3px 6px 3px 0", color: "#374151" }}>
                          {s.rsi14?.toFixed(1) ?? "—"}
                        </td>
                        <td style={{ textAlign: "right", padding: "3px 6px 3px 0", color: "#374151" }}>
                          {s.vol_zscore?.toFixed(2) ?? "—"}
                        </td>
                        <td style={{ textAlign: "right", padding: "3px 6px 3px 0",
                          color: (s.confluence_score ?? 0) > 0 ? "#d97706" : "#6b7280", fontWeight: 600 }}>
                          {s.confluence_score ?? 0}/100
                        </td>
                        <td style={{ textAlign: "right", padding: "3px 0 3px 0",
                          color: score >= 50 ? "#16a34a" : score >= 30 ? "#d97706" : "#6b7280", fontWeight: 700 }}>
                          {score.toFixed(0)}/100
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Regime Transition snapshot */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", textTransform: "uppercase",
                letterSpacing: "0.06em", marginBottom: 6 }}>Regime Transition — Next Regime Probability</p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                <thead>
                  <tr>
                    {["Symbol","Current","Streak","→Bull","→Bear","Avg Rem."].map((h) => (
                      <th key={h} style={{ textAlign: h === "Symbol" ? "left" : "right", paddingBottom: 3,
                        paddingRight: 6, color: "#9ca3af", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {["BTCUSDT","ETHUSDT","SOLUSDT"].map((sym) => {
                    const snap = rtData.find((r) => r.symbol === sym && r.from_regime === "__snapshot__");
                    if (!snap) return null;
                    const nextProbs = (snap.extra ?? "").split("|");
                    const bullP = nextProbs[0] ? `${(parseFloat(nextProbs[0]) * 100).toFixed(0)}%` : "—";
                    const bearP = nextProbs[1] ? `${(parseFloat(nextProbs[1]) * 100).toFixed(0)}%` : "—";
                    return (
                      <tr key={sym} style={{ borderTop: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "3px 6px 3px 0", fontWeight: 700, color: "#111827" }}>
                          {SYM_SHORT[sym]}
                        </td>
                        <td style={{ textAlign: "right", padding: "3px 6px 3px 0", color: "#374151" }}>
                          {snap.to_regime}
                        </td>
                        <td style={{ textAlign: "right", padding: "3px 6px 3px 0", color: "#374151" }}>
                          {snap.count != null ? `${snap.count}d` : "—"}
                        </td>
                        <td style={{ textAlign: "right", padding: "3px 6px 3px 0", color: "#16a34a" }}>{bullP}</td>
                        <td style={{ textAlign: "right", padding: "3px 6px 3px 0", color: "#dc2626" }}>{bearP}</td>
                        <td style={{ textAlign: "right", padding: "3px 0 3px 0", color: "#6b7280" }}>
                          {snap.probability != null ? `~${snap.probability}d` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Disclaimer ── */}
        <div style={{ marginTop: 24, padding: "12px 16px", border: "1px solid #e5e7eb",
          borderRadius: 6, backgroundColor: "#fffbeb" }}>
          <p style={{ fontSize: 9, color: "#92400e", lineHeight: 1.6, margin: 0 }}>
            <strong>Research Disclaimer / 研究免責聲明：</strong>{" "}
            All statistics in this report are based on historical data (BTC/ETH from Aug 2017, SOL from Sep 2020) and are for research and educational purposes only.
            Past patterns do not guarantee future results. Win rates and mean returns reflect historical conditional averages — not forward-looking predictions.
            This report is not investment advice. Always conduct your own due diligence before making any trading or investment decision.
            本報告所有數據均基於歷史資料，僅供研究與教育目的。歷史模式不代表未來表現。勝率與平均回報為歷史條件平均值，不構成交易建議。
          </p>
          <p style={{ fontSize: 9, color: "#9ca3af", marginTop: 6, marginBottom: 0 }}>
            Data sources: Binance API (price), Alternative.me (Fear &amp; Greed Index) · Generated by CryptoPatternLab · cryptopatternlab.com
          </p>
        </div>
      </div>
    </>
  );
}
