"use client";

// Signal Intelligence 面板
// 三個區塊：Regime Status · Signal Confluence Score · Conditional Return Stats

import { useState } from "react";
import { wilsonCILabel } from "../lib/wilson";

// ── 類型定義 ──────────────────────────────────────────────────────────────────
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

// ── 常數 ──────────────────────────────────────────────────────────────────────
const SYMBOLS   = ["BTC", "ETH", "SOL"];
const HOLDINGS  = [1, 3, 7];

const SYMBOL_BORDER: Record<string, string> = {
  BTC: "border-green-400 text-green-400",
  ETH: "border-blue-400 text-blue-400",
  SOL: "border-yellow-400 text-yellow-400",
};
const SYMBOL_ACCENT: Record<string, string> = {
  BTC: "#22c55e", ETH: "#60a5fa", SOL: "#facc15",
};

const REGIME_STYLE: Record<string, { bg: string; text: string; border: string; label: string; zh: string; icon: string }> = {
  bull:     { bg: "bg-green-500/10",  text: "text-green-300",  border: "border-green-500/30",  label: "Bull",     zh: "牛市",  icon: "↗" },
  bear:     { bg: "bg-red-500/10",    text: "text-red-300",    border: "border-red-500/30",    label: "Bear",     zh: "熊市",  icon: "↘" },
  sideways: { bg: "bg-yellow-500/10", text: "text-yellow-300", border: "border-yellow-500/30", label: "Sideways", zh: "橫盤",  icon: "→" },
  unknown:  { bg: "bg-gray-800",      text: "text-gray-400",   border: "border-gray-700",      label: "—",        zh: "未知",  icon: "?" },
};

const SIGNAL_META: Record<string, { label: string; zh: string; desc: string }> = {
  sig_rsi:      { label: "RSI < 30",       zh: "RSI 超賣",       desc: "RSI-14 落入超賣區" },
  sig_bollinger:{ label: "BB Breakdown",   zh: "布林下軌突破",    desc: "收盤價跌破 Bollinger 下軌" },
  sig_drop3:    { label: "Drop ≥ 3%",      zh: "單日跌幅 ≥ 3%",  desc: "今日收盤跌幅超過 3%" },
  sig_vol_spike:{ label: "Vol Spike",      zh: "成交量異常",      desc: "成交量 z-score > 2" },
};

const SIGNAL_COMBO_LABEL: Record<string, string> = {
  "rsi":                  "RSI < 30",
  "bollinger":            "Bollinger Breakdown",
  "drop3":                "Drop ≥ 3%",
  "vol_spike":            "Volume Spike",
  "rsi+bollinger":        "RSI + Bollinger",
  "rsi+drop3":            "RSI + Drop ≥ 3%",
  "bollinger+drop3":      "Bollinger + Drop",
  "rsi+bollinger+drop3":  "RSI + Bollinger + Drop",
  "baseline":             "No signal (baseline)",
};

// ── 輔助 ──────────────────────────────────────────────────────────────────────
function pct(v: number | null, d = 1) {
  if (v == null) return "—";
  return `${(v * 100).toFixed(d)}%`;
}
function fmtPrice(v: number | null) {
  if (v == null) return "—";
  if (v >= 1000) return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return "$" + v.toFixed(2);
}

// ── Regime Badge ──────────────────────────────────────────────────────────────
function RegimeBadge({ regime }: { regime: string }) {
  const s = REGIME_STYLE[regime] ?? REGIME_STYLE.unknown;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.bg} ${s.text} ${s.border}`}>
      <span>{s.icon}</span>
      <span>{s.label}</span>
      <span className="opacity-60">· {s.zh}</span>
    </span>
  );
}

// ── Confluence Score Gauge ────────────────────────────────────────────────────
function ConfluenceGauge({ score, color }: { score: number; color: string }) {
  const pctVal = score; // 0, 25, 50, 75, 100
  const label =
    score === 0   ? "No signals · 無信號" :
    score === 25  ? "Weak · 輕微超賣" :
    score === 50  ? "Moderate · 中度超賣" :
    score === 75  ? "Strong · 強烈超賣" :
                    "Extreme · 極端超賣";
  const barColor =
    score === 0  ? "#374151" :
    score <= 25  ? "#6b7280" :
    score <= 50  ? "#f59e0b" :
    score <= 75  ? "#f97316" : "#ef4444";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">Confluence Score</span>
        <span className="font-bold text-base" style={{ color: barColor }}>{score}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pctVal}%`, background: barColor }}
        />
      </div>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

// ── GARCH vol context type ────────────────────────────────────────────────────
type GarchContext = {
  annualized_vol: number;
  vol_trend: "compressing" | "expanding" | "stable";
  vol_slope_pct: number;
  persistence: number;
  nu: number;
};

type RollingCorrSnapshot = {
  date: string;
  eth_btc_corr: number | null;
  sol_btc_corr: number | null;
  eth_btc_ratio: number | null;
};

// ── 主組件 ────────────────────────────────────────────────────────────────────
export default function SignalIntelligencePanel({
  summary,
  confluence,
  garchContext = {},
  latestRc = null,
}: {
  summary: SignalSummary[];
  confluence: ConfluenceRow[];
  garchContext?: Record<string, GarchContext>;
  latestRc?: RollingCorrSnapshot | null;
}) {
  const [sym,     setSym]     = useState("BTC");
  const [holding, setHolding] = useState(7);
  const [regime,  setRegime]  = useState("all");
  const [showInfo, setShowInfo] = useState(true); // 預設展開，讓用戶第一眼就能讀到說明

  const symKey  = `${sym}USDT`;
  const symData = summary.find((s) => s.symbol === symKey);
  const color   = SYMBOL_ACCENT[sym];

  // 篩出當前幣種的 confluence rows（只顯示 n_signals >= 1 的組合）
  const confRows = confluence.filter(
    (r) =>
      r.symbol === symKey &&
      r.holding_days === holding &&
      r.regime === regime &&
      (r.signals === "baseline" || (r.n_signals != null && r.n_signals >= 1)) &&
      (r.n ?? 0) >= 5
  ).sort((a, b) => (b.n_signals ?? 0) - (a.n_signals ?? 0));

  // 活躍信號列表
  const activeSigs = symData
    ? (["sig_rsi","sig_bollinger","sig_drop3","sig_vol_spike"] as const)
        .filter((k) => symData[k])
    : [];

  return (
    <div className="space-y-6">

      {/* ── 說明框 ── */}
      <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="text-lg font-semibold">Signal Intelligence</h3>
            <p className="text-gray-500 text-sm mt-0.5">
              市場狀態分類 · 信號匯聚評分 · 條件回報概率
            </p>
          </div>
          <button
            onClick={() => setShowInfo((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-200 whitespace-nowrap transition-colors flex-shrink-0 mt-1"
          >
            {showInfo ? "▾ Collapse" : "▸ Expand"}
          </button>
        </div>

        {showInfo && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-white/[0.05]">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English</p>
              <p className="text-gray-200 text-sm mb-2">
                Signal Intelligence answers one question:{" "}
                <strong className="text-white">"Given today's market conditions, what does history say about the next few days?"</strong>
              </p>
              <p className="text-gray-400 text-sm leading-relaxed mb-2">
                It is <em>not</em> a price prediction. It is a <strong className="text-gray-300">conditional historical analysis</strong> —
                looking at past instances when similar signals appeared, and summarising the outcomes.
              </p>
              <div className="space-y-1.5 text-sm text-gray-400">
                <p><strong className="text-gray-200">① Regime (Market State)</strong><br />
                  Is the overall market in an uptrend, downtrend, or going sideways?
                  Defined by price position relative to SMA50 / SMA200 and 30-day momentum.</p>
                <p><strong className="text-gray-200">② Confluence Score (0–100)</strong><br />
                  How many of the 4 oversold signals are active right now?
                  Each signal adds 25 points. Score 75–100 = historically rare and often stronger setups.</p>
                <p><strong className="text-gray-200">③ Conditional Return Table</strong><br />
                  When each signal combination appeared in history, what was the actual win rate and average return over the next 1/3/7 days?
                  Compare to the Baseline row (no signal) to see the edge.</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-200 text-sm mb-2">
                Signal Intelligence 回答一個問題：
                <strong className="text-white">「在當前市場條件下，歷史數據告訴我們接下來幾天會怎樣？」</strong>
              </p>
              <p className="text-gray-400 text-sm leading-relaxed mb-2">
                這<em>不是</em>價格預測。它是<strong className="text-gray-300">條件歷史統計</strong>——
                回顧過去出現類似信號時的市場表現，匯總成可參考的概率數據。
              </p>
              <div className="space-y-1.5 text-sm text-gray-400">
                <p><strong className="text-gray-200">① Regime（市場狀態）</strong><br />
                  整體市場是上升趨勢、下跌趨勢，還是橫盤整理？
                  判斷依據：收盤價相對 SMA50 / SMA200 的位置，以及 30 天動量方向。</p>
                <p><strong className="text-gray-200">② Confluence Score（信號匯聚評分，0–100）</strong><br />
                  當前有多少個超賣信號同時觸發？每個信號貢獻 25 分。
                  75–100 分代表歷史上罕見的多重超賣，反彈設置往往更強。</p>
                <p><strong className="text-gray-200">③ 條件回報統計表</strong><br />
                  歷史上每種信號組合出現時，接下來 1/3/7 天的真實勝率和平均回報是多少？
                  對比 Baseline（無信號）一行，即可看出信號帶來的額外優勢。</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 三幣種 Regime 狀態卡片 ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summary.map((s) => {
          const symShort = s.symbol.replace("USDT", "");
          const rs = REGIME_STYLE[s.current_regime] ?? REGIME_STYLE.unknown;
          const activeSigCount = (["sig_rsi","sig_bollinger","sig_drop3","sig_vol_spike"] as const)
            .filter((k) => s[k]).length;
          return (
            <div
              key={s.symbol}
              className={`rounded-xl border p-5 cursor-pointer transition-all ${
                sym === symShort
                  ? `border-${symShort === "BTC" ? "green" : symShort === "ETH" ? "blue" : "yellow"}-400/50 bg-white/[0.03]`
                  : "border-gray-800 hover:border-gray-700"
              }`}
              onClick={() => setSym(symShort)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-300">{symShort}</p>
                  <p className="text-xl font-bold text-white mt-0.5">{fmtPrice(s.last_price)}</p>
                </div>
                <RegimeBadge regime={s.current_regime} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 mb-3">
                <div>
                  <span className="text-gray-600">RSI-14</span>
                  <span className={`font-semibold ml-1 ${(s.rsi14 ?? 50) < 30 ? "text-red-400" : (s.rsi14 ?? 50) > 70 ? "text-green-400" : "text-gray-200"}`}>{s.rsi14?.toFixed(1) ?? "—"}</span>
                  {(s.rsi14 ?? 50) < 30 && <span className="ml-1 text-red-400 text-xs">超賣</span>}
                  {(s.rsi14 ?? 50) > 70 && <span className="ml-1 text-green-400 text-xs">超買</span>}
                </div>
                <div>
                  <span className="text-gray-600">Vol Z-score</span>
                  <span className={`font-semibold ml-1 ${(s.vol_zscore ?? 0) > 2 ? "text-orange-400" : "text-gray-200"}`}>{s.vol_zscore?.toFixed(2) ?? "—"}</span>
                  {(s.vol_zscore ?? 0) > 2 && <span className="ml-1 text-orange-400 text-xs">異常放大</span>}
                </div>
                <div>
                  <span className="text-gray-600">今日漲跌</span>
                  <span className={`font-semibold ml-1 ${(s.daily_ret ?? 0) < 0 ? "text-red-400" : "text-green-400"}`}>{s.daily_ret != null ? pct(s.daily_ret) : "—"}</span>
                </div>
                <div>
                  <span className="text-gray-600">活躍信號</span>
                  <span className={`font-semibold ml-1 ${activeSigCount > 0 ? "text-yellow-400" : "text-gray-400"}`}>{activeSigCount}/4</span>
                </div>
              </div>
              {/* mini confluence bar */}
              <div className="h-1 rounded-full bg-gray-800 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(s.confluence_score ?? 0)}%`,
                    background: (s.confluence_score ?? 0) === 0 ? "#374151" : (s.confluence_score ?? 0) <= 25 ? "#6b7280" : (s.confluence_score ?? 0) <= 50 ? "#f59e0b" : "#ef4444",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 選中幣種的詳細面板 ── */}
      {symData && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-sm font-semibold" style={{ color }}>{sym}</span>
            <RegimeBadge regime={symData.current_regime} />
            <span className="text-xs text-gray-500 ml-auto">Last updated: {new Date().toLocaleDateString()}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* 左：Confluence Score */}
            <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Signal Confluence Score · 信號匯聚評分
              </p>
              <p className="text-gray-500 text-xs mb-3 leading-relaxed">
                4 個超賣信號，每個觸發 +25 分。分數越高，歷史上同類設置的反彈概率越強。<br />
                <span className="text-gray-600">Each of the 4 oversold signals adds 25 points when active. Higher score = more signals aligned = historically stronger setup.</span>
              </p>
              <ConfluenceGauge score={symData.confluence_score ?? 0} color={color} />
              <div className="mt-4 space-y-2">
                {(["sig_rsi","sig_bollinger","sig_drop3","sig_vol_spike"] as const).map((k) => {
                  const active = symData[k];
                  const meta   = SIGNAL_META[k];
                  return (
                    <div key={k} className={`flex items-center gap-2 text-xs rounded-md px-3 py-2 border ${
                      active
                        ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-200"
                        : "border-gray-800 text-gray-500"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? "bg-yellow-400" : "bg-gray-700"}`} />
                      <span className="font-medium">{meta.label}</span>
                      <span className="opacity-60 ml-auto">{meta.zh}</span>
                    </div>
                  );
                })}
              </div>
              {activeSigs.length === 0 && (
                <p className="text-xs text-gray-600 mt-3 text-center">
                  No oversold signals currently active · 當前無超賣信號觸發
                </p>
              )}
            </div>

            {/* 右：Regime 說明 */}
            <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">
                Current Regime · 當前市場狀態
              </p>
              {(() => {
                const rs = REGIME_STYLE[symData.current_regime] ?? REGIME_STYLE.unknown;
                const regimeDesc: Record<string, { en: string; zh: string }> = {
                  bull:     { en: "Price is above both SMA50 and SMA200, with strong 30-day momentum. Historically, oversold signals in bull regimes are less common but tend to recover faster.", zh: "價格在 SMA50 和 SMA200 上方，且 30 天動量強勁。牛市中超賣信號較少出現，但反彈通常更快。" },
                  bear:     { en: "Price is below both SMA50 and SMA200, with negative 30-day momentum. Oversold signals in bear regimes can be value opportunities or falling knives — check confluence.", zh: "價格在 SMA50 和 SMA200 下方，30 天動量為負。熊市中的超賣可能是入場機會，也可能是接刀——需結合信號匯聚評分判斷。" },
                  sideways: { en: "Market is drifting without a clear trend. Signals in sideways regimes have mixed historical outcomes — direction less predictable.", zh: "市場無明確趨勢，處於橫盤整理。橫盤期間信號的歷史表現較混雜，方向預測難度較高。" },
                  unknown:  { en: "Insufficient data to classify regime.", zh: "數據不足，無法分類市場狀態。" },
                };
                const desc = regimeDesc[symData.current_regime] ?? regimeDesc.unknown;
                return (
                  <>
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border mb-3 ${rs.bg} ${rs.text} ${rs.border}`}>
                      <span className="text-xl">{rs.icon}</span>
                      <span>{rs.label} · {rs.zh}</span>
                    </div>
                    <p className="text-gray-300 text-xs leading-relaxed mb-1">{desc.en}</p>
                    <p className="text-gray-500 text-xs leading-relaxed">{desc.zh}</p>
                  </>
                );
              })()}
            </div>
          </div>

          {/* ── GARCH Vol Context + Cross-Asset Confirmation ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
            {/* GARCH 結論層 */}
            {(() => {
              const gc = garchContext[symKey];
              if (!gc) return null;
              const trendColor =
                gc.vol_trend === "compressing" ? "text-green-400" :
                gc.vol_trend === "expanding"   ? "text-red-400"   : "text-gray-300";
              const trendIcon  =
                gc.vol_trend === "compressing" ? "↓" :
                gc.vol_trend === "expanding"   ? "↑" : "→";
              const trendZh =
                gc.vol_trend === "compressing" ? "波動率收縮 — 有利反彈" :
                gc.vol_trend === "expanding"   ? "波動率擴張 — 謹慎方向" : "波動率穩定";
              const tailRisk = gc.nu < 5 ? "High" : gc.nu < 8 ? "Moderate" : "Low";
              const tailColor = gc.nu < 5 ? "text-red-400" : gc.nu < 8 ? "text-yellow-400" : "text-green-400";
              return (
                <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    GARCH Volatility Context · 波動率背景
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Annualized Vol</span>
                      <span className="font-semibold text-gray-200">{(gc.annualized_vol * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Vol Trend · 趨勢</span>
                      <span className={`font-semibold ${trendColor}`}>{trendIcon} {gc.vol_trend}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">7d Slope</span>
                      <span className={`font-semibold tabular-nums ${trendColor}`}>{gc.vol_slope_pct >= 0 ? "+" : ""}{(gc.vol_slope_pct * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Persistence · 持續性</span>
                      <div className="text-right">
                        <span className={`font-semibold tabular-nums ${gc.persistence > 0.97 ? "text-orange-400" : "text-gray-300"}`}>{gc.persistence.toFixed(3)}</span>
                        {gc.persistence >= 0.9999 && (
                          <span className="block text-xs text-orange-400/70">IGARCH — shock impact never decays</span>
                        )}
                        {gc.persistence > 0.97 && gc.persistence < 0.9999 && (
                          <span className="block text-xs text-orange-400/70">Very high — vol shocks persist long</span>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Tail Risk · 尾部風險</span>
                      <div className="text-right">
                        <span className={`font-semibold ${tailColor}`}>{tailRisk} (ν={gc.nu.toFixed(1)})</span>
                        <span className="block text-xs text-gray-600">Student-t ν: lower = fatter tails</span>
                      </div>
                    </div>
                  </div>
                  <p className={`text-xs mt-3 font-medium ${trendColor}`}>{trendZh}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {gc.vol_trend === "compressing"
                      ? "Volatility compression can precede sharp moves — direction unclear, but risk/reward may improve."
                      : gc.vol_trend === "expanding"
                        ? "Expanding vol = wider distribution of outcomes. Oversold signals are noisier in high-vol regimes."
                        : "Stable vol — no unusual vol regime signal currently."}
                  </p>
                </div>
              );
            })()}

            {/* Cross-Asset Confirmation */}
            {latestRc && (() => {
              const ethBtcCorr  = latestRc.eth_btc_corr;
              const solBtcCorr  = latestRc.sol_btc_corr;
              const ethBtcRatio = latestRc.eth_btc_ratio;
              const altSeason   = ethBtcCorr != null && ethBtcRatio != null &&
                                  ethBtcCorr < 0.7 && ethBtcRatio > 100;

              const btcSignals = summary.find((s) => s.symbol === "BTCUSDT");
              const ethSignals = summary.find((s) => s.symbol === "ETHUSDT");
              const syncOversold = btcSignals && ethSignals &&
                (btcSignals.sig_rsi || btcSignals.sig_bollinger) &&
                (ethSignals.sig_rsi || ethSignals.sig_bollinger);

              return (
                <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Cross-Asset Confirmation · 跨資產確認
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">ETH/BTC 60d Corr</span>
                      <span className={`font-semibold tabular-nums ${
                        ethBtcCorr != null && ethBtcCorr < 0.7 ? "text-yellow-400" : "text-gray-200"
                      }`}>{ethBtcCorr != null ? ethBtcCorr.toFixed(2) : "—"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">SOL/BTC 60d Corr</span>
                      <span className={`font-semibold tabular-nums ${
                        solBtcCorr != null && solBtcCorr < 0.7 ? "text-yellow-400" : "text-gray-200"
                      }`}>{solBtcCorr != null ? solBtcCorr.toFixed(2) : "—"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">ETH/BTC Ratio</span>
                      <span className={`font-semibold tabular-nums ${
                        ethBtcRatio != null && ethBtcRatio > 100 ? "text-cyan-400" : "text-gray-200"
                      }`}>{ethBtcRatio != null ? ethBtcRatio.toFixed(1) : "—"}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-gray-800">
                      <span className="text-gray-500">Alt-Season Signal</span>
                      <span className={`font-semibold text-xs ${altSeason ? "text-cyan-400" : "text-gray-500"}`}>
                        {altSeason ? "⚡ Possible" : "Not detected"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Sync Oversold (BTC+ETH)</span>
                      <span className={`font-semibold text-xs ${syncOversold ? "text-yellow-400" : "text-gray-500"}`}>
                        {syncOversold ? "⚠ Yes — historically stronger setup" : "No"}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3 leading-relaxed">
                    {syncOversold
                      ? "BTC + ETH both showing oversold signals — historically this coincidence correlates with stronger mean-reversion bounces."
                      : altSeason
                        ? "Low correlation + ETH outperforming — possible alt-season rotation. BTC oversold signals may precede ETH outperformance."
                        : "No cross-asset confirmation signal currently active."}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {syncOversold
                      ? "BTC 與 ETH 同步超賣，歷史上這種情況下的均值回歸反彈幅度通常更強。"
                      : altSeason
                        ? "低相關性 + ETH 相對強勢，可能進入山寨季輪動。BTC 超賣信號可能先行於 ETH 強勢。"
                        : "當前無跨資產確認信號。"}
                  </p>
                </div>
              );
            })()}
          </div>

          {/* ── Conditional Stats 表 ── */}
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <p className="text-sm font-semibold text-gray-300">
                Historical Conditional Returns · 條件回報統計
              </p>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-gray-500">Regime filter</span>
                <div className="flex gap-1">
                  {["all","bull","bear","sideways"].map((r) => (
                    <button key={r} onClick={() => setRegime(r)}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                        regime === r
                          ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-300"
                          : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                      }`}
                    >
                      {r === "all" ? "All" : r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Hold</span>
                <div className="flex gap-1">
                  {HOLDINGS.map((h) => (
                    <button key={h} onClick={() => setHolding(h)}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                        holding === h
                          ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-300"
                          : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                      }`}
                    >
                      {h}d
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-gray-500 text-xs mb-3 leading-relaxed">
              每行代表某種信號組合在歷史上出現時的統計結果。<strong className="text-gray-300">對比 Baseline 行（無信號條件下的平均表現）</strong>，即可看出各信號帶來的額外優勢。
              <span className="text-gray-600"> — Each row shows historical stats when that signal combination appeared. Compare to the Baseline row (no signal) to see the edge.</span>
            </p>
            <div className="overflow-x-auto">
              <table className="text-sm w-full border-collapse">
                <thead className="text-gray-400 border-b border-gray-700">
                  <tr>
                    <th className="pb-2 pr-6 font-medium text-left whitespace-nowrap">
                      Signal Combination<br /><span className="text-xs font-normal text-gray-600">信號組合</span>
                    </th>
                    <th className="pb-2 pr-6 font-medium text-left whitespace-nowrap">
                      # Signals<br /><span className="text-xs font-normal text-gray-600">信號數量</span>
                    </th>
                    <th className="pb-2 pr-6 font-medium text-left whitespace-nowrap">
                      Samples (n)<br /><span className="text-xs font-normal text-gray-600">歷史樣本數</span>
                    </th>
                    <th className="pb-2 pr-6 font-medium text-left whitespace-nowrap">
                      Win Rate<br /><span className="text-xs font-normal text-gray-600">勝率 [95% CI]</span>
                    </th>
                    <th className="pb-2 font-medium text-left whitespace-nowrap">
                      Mean Return<br /><span className="text-xs font-normal text-gray-600">平均回報</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {confRows.map((row, i) => {
                    const isBaseline = row.signals === "baseline";
                    const label = SIGNAL_COMBO_LABEL[row.signals] ?? row.signals;
                    const wr = row.win_rate;
                    const lowN = (row.n ?? 0) < 20;
                    return (
                      <tr key={i} className={`border-b border-gray-800 hover:bg-gray-800/30 ${isBaseline ? "opacity-50" : ""}`}>
                        <td className="py-3 pr-6">
                          <span className={`text-xs font-medium ${isBaseline ? "text-gray-500 italic" : "text-gray-200"}`}>
                            {label}
                          </span>
                        </td>
                        <td className="py-3 pr-6">
                          <span className={`text-xs font-mono ${isBaseline ? "text-gray-600" : "text-gray-400"}`}>
                            {isBaseline ? "—" : row.n_signals}
                          </span>
                        </td>
                        <td className="py-3 pr-6">
                          <span className={`text-xs ${lowN ? "text-yellow-400" : "text-gray-400"}`}>
                            {row.n ?? "—"}{lowN && !isBaseline && <span className="ml-1 text-xs">⚠</span>}
                          </span>
                        </td>
                        <td className="py-3 pr-6">
                          {wr != null ? (
                            <>
                              <span className={`font-semibold text-sm ${wr >= 0.55 ? "text-green-400" : wr >= 0.50 ? "text-gray-300" : "text-red-400"}`}>
                                {pct(wr)}
                              </span>
                              {(() => {
                                const ci = wilsonCILabel(wr, row.n ?? null);
                                return ci ? <span className="block text-xs text-gray-600 mt-0.5">{ci}</span> : null;
                              })()}
                            </>
                          ) : "—"}
                        </td>
                        <td className="py-3">
                          {row.mean_return != null ? (
                            <span className={`text-sm font-medium ${row.mean_return >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {row.mean_return >= 0 ? "+" : ""}{(row.mean_return * 100).toFixed(2)}%
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 rounded-lg border border-white/[0.05] bg-white/[0.02] p-3 text-xs leading-relaxed">
              <p className="text-gray-400 mb-1">
                <strong className="text-gray-300">如何解讀這張表 · How to read this table</strong>
              </p>
              <p className="text-gray-500">
                勝率 = 持有期結束時回報為正的比例。平均回報 = 所有觸發案例的算術平均。
                <strong className="text-gray-400"> Baseline</strong> 行代表「沒有任何信號」時的歷史平均表現，作為對比基準。
                勝率旁的 <span className="text-gray-400">[X%–Y%]</span> 是 95% Wilson 信賴區間，樣本少時範圍會較寬。
                ⚠ 代表樣本數少於 20，結果僅供參考。
              </p>
              <p className="text-gray-600 mt-1">
                Win rate = % of triggered trades that ended positive. Mean return = arithmetic average.
                The <strong className="text-gray-500">Baseline</strong> row is the unconditional historical average — a benchmark with no signal filter.
                Numbers in brackets are 95% Wilson confidence intervals. ⚠ = fewer than 20 samples, treat with caution.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
