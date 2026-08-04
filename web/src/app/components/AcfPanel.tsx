"use client";

// 這個檔案負責：ACF / PACF 自相關圖 + Ljung-Box 白噪聲檢定
// 放在 Validation workspace，用於說明 return 序列的自相關結構
// 圖表用純 SVG 繪製，不依賴 recharts

import { useState } from "react";

type AcfRow = {
  symbol: string;
  type: string;      // "acf" | "pacf"
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

// ── 常數 ──────────────────────────────────────────────────────────────────────
const SYMBOLS = ["BTC", "ETH", "SOL"];
const SYMBOL_BORDER: Record<string, string> = {
  BTC: "border-green-400 text-green-400",
  ETH: "border-blue-400 text-blue-400",
  SOL: "border-yellow-400 text-yellow-400",
};
const SYMBOL_COLOR: Record<string, string> = {
  BTC: "#22c55e",
  ETH: "#60a5fa",
  SOL: "#facc15",
};

// SVG 圖表尺寸常數
const SVG_W        = 640;
const SVG_H        = 220;
const PAD_L        = 42;
const PAD_R        = 16;
const PAD_T        = 16;
const PAD_B        = 36;
const CHART_W      = SVG_W - PAD_L - PAD_R;
const CHART_H      = SVG_H - PAD_T - PAD_B;
const Y_DOMAIN     = 0.22;   // y 軸顯示範圍 ±0.22
const MAX_LAGS     = 30;

// ── SVG ACF 圖 ────────────────────────────────────────────────────────────────
function AcfChart({
  rows,
  ciUpper,
  color,
}: {
  rows: AcfRow[];
  ciUpper: number;
  color: string;
}) {
  if (rows.length === 0) return null;

  // 座標轉換
  function xOf(lag: number) {
    // lag 1-30 均分
    const step = CHART_W / MAX_LAGS;
    return PAD_L + (lag - 0.5) * step;
  }
  function yOf(v: number) {
    return PAD_T + CHART_H / 2 - (v / Y_DOMAIN) * (CHART_H / 2);
  }

  const barW    = (CHART_W / MAX_LAGS) * 0.5;
  const yZero   = yOf(0);
  const yCiUp   = yOf(ciUpper);
  const yCiDown = yOf(-ciUpper);

  // Y 軸刻度
  const yTicks = [-0.2, -0.1, 0, 0.1, 0.2];

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="w-full"
      style={{ maxHeight: `${SVG_H}px` }}
    >
      {/* 背景格線 */}
      {yTicks.map((tick) => (
        <line
          key={tick}
          x1={PAD_L}
          x2={SVG_W - PAD_R}
          y1={yOf(tick)}
          y2={yOf(tick)}
          stroke="#374151"
          strokeWidth={tick === 0 ? 1.2 : 0.7}
          strokeDasharray={tick === 0 ? "none" : "3 3"}
        />
      ))}

      {/* 信賴區間帶（淺色填充）*/}
      <rect
        x={PAD_L}
        y={yCiUp}
        width={CHART_W}
        height={yCiDown - yCiUp}
        fill={color}
        fillOpacity={0.07}
      />
      {/* 信賴區間上下邊線 */}
      <line x1={PAD_L} x2={SVG_W - PAD_R} y1={yCiUp}   y2={yCiUp}   stroke={color} strokeWidth={0.8} strokeDasharray="4 3" strokeOpacity={0.6} />
      <line x1={PAD_L} x2={SVG_W - PAD_R} y1={yCiDown} y2={yCiDown} stroke={color} strokeWidth={0.8} strokeDasharray="4 3" strokeOpacity={0.6} />

      {/* Bars */}
      {rows.map((row) => {
        if (row.lag == null || row.value == null) return null;
        const x      = xOf(row.lag) - barW / 2;
        const isUp   = row.value >= 0;
        const yTop   = isUp ? yOf(row.value) : yZero;
        const height = Math.abs(yOf(row.value) - yZero);
        const outside = Math.abs(row.value) > ciUpper;
        const fill   = outside ? color : "#4b5563";
        return (
          <rect
            key={row.lag}
            x={x}
            y={yTop}
            width={barW}
            height={Math.max(height, 1)}
            fill={fill}
            fillOpacity={outside ? 0.9 : 0.55}
            rx={1}
          />
        );
      })}

      {/* Y 軸刻度文字 */}
      {yTicks.map((tick) => (
        <text
          key={tick}
          x={PAD_L - 6}
          y={yOf(tick) + 4}
          textAnchor="end"
          fontSize={10}
          fill="#9ca3af"
        >
          {tick.toFixed(1)}
        </text>
      ))}

      {/* X 軸刻度：每 5 個 lag 一個 */}
      {[5, 10, 15, 20, 25, 30].map((lag) => (
        <text
          key={lag}
          x={xOf(lag)}
          y={SVG_H - PAD_B + 18}
          textAnchor="middle"
          fontSize={10}
          fill="#9ca3af"
        >
          {lag}
        </text>
      ))}

      {/* X 軸標籤 */}
      <text
        x={PAD_L + CHART_W / 2}
        y={SVG_H - 2}
        textAnchor="middle"
        fontSize={10}
        fill="#6b7280"
      >
        Lag (days)
      </text>

      {/* Y 軸邊框線 */}
      <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={PAD_T + CHART_H} stroke="#4b5563" strokeWidth={0.8} />
    </svg>
  );
}

// ── Ljung-Box 解讀 ────────────────────────────────────────────────────────────
function lbInterpret(pvalue: number | null): { label: string; color: string; zh: string } {
  if (pvalue === null) return { label: "—", color: "text-gray-400", zh: "—" };
  if (pvalue < 0.01) return {
    label: "Highly significant",
    color: "text-red-400",
    zh: "高度顯著（序列非白噪聲）",
  };
  if (pvalue < 0.05) return {
    label: "Significant",
    color: "text-orange-400",
    zh: "顯著（p < 0.05）",
  };
  if (pvalue < 0.1) return {
    label: "Marginal",
    color: "text-yellow-400",
    zh: "邊際顯著（p < 0.1）",
  };
  return {
    label: "Not significant",
    color: "text-green-400",
    zh: "不顯著（接近白噪聲）",
  };
}

// ── 主組件 ────────────────────────────────────────────────────────────────────
export default function AcfPanel({
  acfData,
  lbData,
}: {
  acfData: AcfRow[];
  lbData: LjungBoxRow[];
}) {
  const [sym,      setSym]      = useState("BTC");
  const [viewType, setViewType] = useState<"acf" | "pacf">("acf");
  const [showInfo, setShowInfo] = useState(false);

  const symKey = `${sym}USDT`;

  // 篩選當前幣種 + 類型的 ACF/PACF rows
  const rows = acfData.filter((r) => r.symbol === symKey && r.type === viewType);

  // CI（所有 row 的 ci_upper 都一樣，取第一個）
  const ciUpper = rows[0]?.ci_upper ?? 0.035;

  // 超出 CI 的 lag 數量
  const significantCount = rows.filter(
    (r) => r.value != null && Math.abs(r.value) > ciUpper
  ).length;

  // Ljung-Box 取 lag 1, 5, 10, 20
  const lbRows = lbData.filter((r) => r.symbol === symKey && [1, 5, 10, 20].includes(r.lag ?? -1));

  const color = SYMBOL_COLOR[sym];

  return (
    <div className="bg-gray-900 rounded-xl p-6">

      {/* ── 標題列 ── */}
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h3 className="text-lg font-semibold">Return Autocorrelation (ACF / PACF)</h3>
          <p className="text-gray-500 text-xs mt-0.5">
            日對數回報序列的自相關結構分析 · 用於評估 random walk 假設
          </p>
        </div>
        <button
          onClick={() => setShowInfo((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-200 whitespace-nowrap transition-colors flex-shrink-0"
        >
          {showInfo ? "▾" : "▸"} What is this?
        </button>
      </div>

      {/* ── 說明框（可折疊）── */}
      {showInfo && (
        <div className="mt-3 mb-5 rounded-lg border border-white/[0.07] bg-white/[0.03] p-4 text-sm leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English</p>
              <p className="text-gray-300 mb-2">
                <strong className="text-white">ACF (Autocorrelation Function)</strong> measures how much today's return is correlated with returns from N days ago.
                If bars stay <em>inside the shaded band</em>, the series behaves like a random walk — past returns carry no useful predictive signal.
              </p>
              <p className="text-gray-400 text-xs">
                <strong className="text-gray-300">PACF</strong>: like ACF but removes indirect correlations — shows direct lag effects only.<br />
                <strong className="text-gray-300">Ljung-Box test</strong>: formally tests whether all autocorrelations up to lag k are jointly zero.
                A low p-value (p &lt; 0.05) means the series is <em>not</em> pure white noise, but the economic significance of tiny autocorrelations may still be negligible.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-2">
                <strong className="text-white">ACF（自相關函數）</strong>測量今日回報與 N 天前回報的相關程度。
                如果所有 bars 都落在<em>陰影帶內</em>，代表序列接近隨機漫步——過去回報對未來幾乎沒有預測價值。
              </p>
              <p className="text-gray-400 text-xs">
                <strong className="text-gray-300">PACF</strong>：剔除間接相關後的自相關，只保留直接 lag 效應。<br />
                <strong className="text-gray-300">Ljung-Box 檢定</strong>：正式檢驗所有 lag 的自相關係數是否聯合為零。
                p 值低（p &lt; 0.05）代表序列不是純白噪聲，但微弱的自相關在經濟上可能仍無實際意義。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── 篩選器列 ── */}
      <div className="flex flex-wrap items-center gap-4 mt-4 mb-5">
        {/* 幣種 tabs */}
        <div className="flex gap-1 border-b border-gray-700">
          {SYMBOLS.map((s) => (
            <button
              key={s}
              onClick={() => setSym(s)}
              className={`px-3 py-1.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                sym === s ? SYMBOL_BORDER[s] : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* ACF / PACF 切換 */}
        <div className="flex gap-1">
          {(["acf", "pacf"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setViewType(t)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors uppercase tracking-wide ${
                viewType === t
                  ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-300"
                  : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* 顯著 lag 統計 */}
        <span className="text-xs text-gray-500 ml-auto">
          <span className={significantCount > 0 ? "text-yellow-400" : "text-green-400"}>
            {significantCount}
          </span>
          {" "}/ {MAX_LAGS} lags outside 95% CI
        </span>
      </div>

      {/* ── 圖表 ── */}
      <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3 mb-6">
        <AcfChart rows={rows} ciUpper={ciUpper} color={color} />
        <p className="text-center text-xs text-gray-500 mt-1">
          Shaded band = 95% confidence interval (±1.96/√n) · Highlighted bars = statistically significant lags
        </p>
      </div>

      {/* ── Ljung-Box 結果表 ── */}
      <div>
        <h4 className="text-sm font-semibold text-gray-300 mb-3">
          Ljung-Box White Noise Test
          <span className="ml-2 text-xs font-normal text-gray-500">
            H₀: no autocorrelation up to lag k
          </span>
        </h4>
        <div className="overflow-x-auto">
          <table className="text-sm w-full border-collapse">
            <thead className="text-gray-400 border-b border-gray-700">
              <tr>
                <th className="pb-2 pr-8 font-medium text-left whitespace-nowrap">Lag k</th>
                <th className="pb-2 pr-8 font-medium text-left whitespace-nowrap">LB Statistic</th>
                <th className="pb-2 pr-8 font-medium text-left whitespace-nowrap">p-value</th>
                <th className="pb-2 pr-8 font-medium text-left whitespace-nowrap">Interpretation</th>
                <th className="pb-2 font-medium text-left whitespace-nowrap text-gray-500">中文</th>
              </tr>
            </thead>
            <tbody>
              {lbRows.map((row) => {
                const interp = lbInterpret(row.lb_pvalue);
                return (
                  <tr key={row.lag} className="border-b border-gray-800 hover:bg-gray-800/30">
                    <td className="py-3 pr-8 text-gray-300">{row.lag}</td>
                    <td className="py-3 pr-8 font-mono text-gray-300">
                      {row.lb_stat?.toFixed(2) ?? "—"}
                    </td>
                    <td className="py-3 pr-8 font-mono text-gray-300">
                      {row.lb_pvalue != null ? row.lb_pvalue.toFixed(4) : "—"}
                    </td>
                    <td className={`py-3 pr-8 font-medium ${interp.color}`}>
                      {interp.label}
                    </td>
                    <td className="py-3 text-gray-400 text-xs">{interp.zh}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 底部白話解讀 */}
        <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-sm leading-relaxed">
          <p className="text-gray-300">
            <strong className="text-white">Key takeaway · 核心結論</strong>
          </p>
          <p className="text-gray-400 mt-1 text-xs leading-relaxed">
            {sym} daily log-returns show{" "}
            <span className={significantCount === 0 ? "text-green-400 font-medium" : "text-yellow-400 font-medium"}>
              {significantCount === 0
                ? "no statistically significant autocorrelation"
                : `${significantCount} lag(s) with statistically significant autocorrelation`}
            </span>
            {" "}out of {MAX_LAGS} tested.
            While the Ljung-Box test may reject pure white noise, the magnitude of autocorrelations is small —
            suggesting that simple momentum or mean-reversion strategies based on daily returns face a high bar to be profitable after costs.
            This is consistent with a near-efficient market assumption.{" "}
            <span className="text-gray-500">
              · {sym} 日對數回報在 {MAX_LAGS} 個 lag 中，
              {significantCount === 0 ? "無" : `有 ${significantCount} 個`}統計顯著的自相關。
              自相關係數數值微弱，提示基於過去回報的動量或均值回歸策略，在考慮成本後難以持續獲利。
            </span>
          </p>
        </div>
      </div>

    </div>
  );
}
